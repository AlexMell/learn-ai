# WOR-27: AI-powered insight cards after voting — Feature Documentation
# WOR-27: AI-powered insight cards after voting — Feature Documentation

> Таск: WOR-27 | Статус: In Progress (реалізовано)
> Мета: Після голосування показати 5 персоналізованих AI-карток зі статистикою, щоб зробити момент голосування більш залученим і шерабельним.

---

## Що було зроблено

До WOR-27 після голосування користувач одразу бачив звичайний екран результатів — просто відсотки. Жодної персоналізації, жодного "вау-моменту". WOR-27 додає блок з 5 insight cards між translate-тоглером і результатами: Country Match, World Rank, Outlier Country, Most Divided, Rarity Score. Кожна картка має AI-згенерований headline від Claude Haiku і кольоровий акцент-бордер відповідно до типу. Перша картка додатково має прогрес-бар з відсотком згоди по світу. Share-кнопка відкриває WOR-25 ShareModal.

---

## Файли

| Файл | Статус | Призначення |
|------|--------|-------------|
| `src/lib/worldvote/types.ts` | оновлено | Додано `InsightCardType`, `InsightCard`, `VoteStatsResponse` |
| `src/lib/worldvote/insight-cards.ts` | новий | `computeVoteStats()` — агрегація голосів по країнах |
| `src/app/api/insight-cards/route.ts` | новий | POST endpoint — Claude Haiku генерує headlines |
| `src/components/home/InsightCardsOverlay.tsx` | новий | UI компонент з layout 1+2+2 |
| `src/components/home/HomeClient.tsx` | оновлено | Тригер після `handleVote`, стейт `insightCards` |

---

## Архітектура — детально

### 1. Статистика рахується client-side, не через окремий API

**Проблема:** можна було зробити окремий `GET /api/vote/stats` endpoint що йде в БД. Але всі голоси вже завантажені в `HomeClient` після `loadData()`.

**Рішення:** `computeVoteStats()` агрегує дані прямо з existing `votes` array. Zero extra DB roundtrip.

```ts
// src/lib/worldvote/insight-cards.ts
export const computeVoteStats = (
  question: Pick<QuestionRecord, "id" | "text">,
  options: QuestionOptionRecord[],
  votes: VoteRecord[]
): VoteStatsResponse => { ... }
```

`Pick<QuestionRecord, "id" | "text">` — замість повного `QuestionRecord`, бо функції потрібні лише ці два поля.

> Аналогія для співбесіди: як `Array.prototype.reduce` замість додаткового fetch — трансформуємо дані що вже є в пам'яті.

---

### 2. Агрегація по країнах через два проходи

**Проблема:** один `forEach` не може порахувати і кількість, і відсотки одночасно (потрібен total щоб рахувати відсоток).

**Рішення:** два окремих проходи — перший `forEach` рахує totalVotes по кожній країні, другий `forEach` по `Object.keys(byCountry)` рахує percA/percB.

```ts
// Прохід 1 — підрахунок
votes.forEach(vote => {
  if (!byCountry[code]) byCountry[code] = { totalVotes: 0, percA: 0, percB: 0 };
  byCountry[code].totalVotes += 1;
});

// Прохід 2 — відсотки
Object.keys(byCountry).forEach(code => {
  country.percA = Math.round((countryVotesA / country.totalVotes) * 100);
});
```

> Аналогія для співбесіди: два-прохідний алгоритм — класичний підхід коли результат другого кроку залежить від підсумку першого.

---

### 3. Як Claude API знає що куди підставляти

Claude отримує два повідомлення: `system` і `user`. Це як інструктаж перед завданням + саме завдання.

**`system` prompt** — встановлює роль і правила форматування. Claude читає це один раз і дотримується протягом всієї розмови:

```
You are a data storyteller for WorldVote app.
Generate insight headlines for voting result cards.
Rules:
- Each headline max 8 words, ALL CAPS for the key phrase
- Emotional, punchy, personal
- Use emojis strategically (max 1 per headline)
Respond ONLY with valid JSON, no extra text.
```

**`user` message** — конкретні дані для цього запиту. Підставляємо реальні цифри через template literals (`${}`):

```ts
content: `User voted: "${userVote === 'a' ? stats.optionA : stats.optionB}"
Global: ${userVote === 'a' ? stats.global.percA : stats.global.percB}% agree worldwide
Country (${userCountry}): ${stats.byCountry[userCountry]?.percA ?? 0}% agree locally
Most divided country: ${stats.insights.mostDividedCountry}
Biggest outlier: ${stats.insights.biggestOutlier}

Respond with JSON:
{
  "countryMatch": { "headline": "...", "subtext": "..." },
  "worldRank": { "headline": "...", "subtext": "..." },
  ...
}`
```

Claude бачить реальні числа і country codes — і генерує headlines специфічно для цього користувача. Структура JSON в `user` message — це буквально шаблон відповіді: Claude заповнює `"..."` своїм текстом.

**Після відповіді** — парсимо JSON і маппимо кожен ключ на відповідний тип картки:

```ts
const cards = [
  { type: 'countryMatch', ...parsed.countryMatch, percent: userGlobalPerc },
  { type: 'worldRank',    ...parsed.worldRank },
  { type: 'outlierCountry', ...parsed.outlierCountry },
  { type: 'mostDivided',  ...parsed.mostDivided },
  { type: 'rarityScore',  ...parsed.rarityScore },
];
```

Spread `...parsed.countryMatch` розкладає `{ headline, subtext }` в об'єкт картки, а `type` додається вручну — бо Claude його не генерує.

> Аналогія для співбесіди: `system` = посадова інструкція, `user` = конкретне завдання зі змінними даними. Розділення дозволяє переиспользовувати одні правила для різних запитів.

---

### 4. Claude Haiku з markdown-fence stripping

**Проблема:** попри `"Respond ONLY with valid JSON"` в system prompt, Claude Haiku інколи обгортає відповідь в ` ```json ... ``` `. `JSON.parse` кидає `SyntaxError`.

**Рішення:** перед парсингом — regex cleanup:

```ts
const text = block.text
  .replace(/^```json\s*/, '')
  .replace(/\s*```$/, '')
  .trim();
const parsed = JSON.parse(text);
```

> Аналогія для співбесіди: defensive parsing — не довіряй зовнішньому API повернути рівно те що попросив, завжди sanitize.

---

### 5. Асинхронний fetch не блокує UI

**Проблема:** якщо чекати Claude (~2-3 сек) перед показом результатів — UX буде поганий.

**Рішення:** в `handleVote` після `applyHomeData()`:
1. Одразу `setInsightCards(null)` — компонент рендериться але повертає `null` (не показується поки немає карток)
2. `fetch('/api/insight-cards', ...)` запускається у фоні
3. `.then(cards => setInsightCards(cards))` — картки з'являються коли Claude відповів

```ts
// HomeClient.tsx — handleVote
setInsightCards(null);
fetch('/api/insight-cards', { method: 'POST', ... })
  .then(res => res.json())
  .then(cards => setInsightCards(cards))
  .catch(() => setInsightCards([]));
```

> Аналогія для співбесіди: optimistic UI pattern — не блокуй рендер на мережевий запит, показуй що є і оновлюй коли прийде.

---

## UI Layout

Картки мають layout 1+2+2 (не рівна сітка):
- Рядок 1: 1 велика картка (countryMatch) — повна ширина, з прогрес-баром
- Рядок 2: 2 картки (worldRank + outlierCountry) — `SimpleGrid columns={2}`
- Рядок 3: 2 картки (mostDivided + rarityScore) — `SimpleGrid columns={2}`

Кожен тип має унікальний акцент-колір (лівий бордер) і emoji-іконку:

| Тип | Колір | Іконка |
|-----|-------|--------|
| countryMatch | `#ff6b00` orange | 🌍 |
| worldRank | `#3b82f6` blue | 📊 |
| outlierCountry | `#a855f7` purple | 😮 |
| mostDivided | `#ef4444` red | ⚡ |
| rarityScore | `#f59e0b` gold | 🔥 |

---

## Як пояснити на співбесіді

**"Як ти реалізував персоналізовані картки після голосування?"**
> Після успішного голосування я агрегую вже завантажені vote records client-side в `computeVoteStats()`, щоб не робити зайвий DB запит. Результат статистики разом з `userVote` і `userCountry` відправляється на POST `/api/insight-cards`, де Claude Haiku генерує 5 емоційних headlines у форматі JSON. Відповідь парситься і рендериться як картки з кольоровими акцентами та Share-кнопками.

**"Що робиш якщо Claude повертає не валідний JSON?"**
> Claude Haiku інколи обгортає відповідь в markdown code fences (` ```json ... ``` `). Перед `JSON.parse` робимо regex cleanup щоб видалити ці огортки. Якщо парсинг все одно падає — `catch` повертає порожній масив і картки просто не показуються, без крашу UI.

**"Чому `Pick<QuestionRecord, 'id' | 'text'>` замість `QuestionRecord`?"**
> `computeVoteStats` використовує тільки `question.id` і `question.text`. `HomeClient` зберігає `activeQuestion` як `Pick<QuestionRecord, ...>` — неповний тип. Якщо написати `QuestionRecord` в параметрі, TypeScript кине помилку бо типи не збігаються. `Pick` дозволяє сказати "потрібні тільки ці поля" — і функція приймає будь-який об'єкт з `id` і `text`.

**"Як ти структурував prompt щоб Claude генерував правильний JSON?"**
> `system` prompt встановлює роль і правила (ALL CAPS, max 8 слів, тільки JSON). `user` message містить реальні дані через template literals і буквальний шаблон JSON зі структурою відповіді — Claude заповнює `"..."` своїм текстом. Після отримання відповіді spread `...parsed.countryMatch` розкладає `{ headline, subtext }` в об'єкт картки, а `type` додається вручну.
