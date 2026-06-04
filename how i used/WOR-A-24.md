# WOR-25: AI-powered viral share messages — Feature Documentation
> Таск: WOR-25 | Статус: Done
> Мета: Після голосування юзер отримує модалку з AI-згенерованим вірусним повідомленням для шерінгу в соцмережах — з перекладом на мову юзера через DeepL.

---

## Що було зроблено

До цього таску шерінг на WorldVote був статичним — шаблонне повідомлення яке ніхто не клікав. Реалізовано Claude Haiku API endpoint, який отримує контекст голосування (більшість/меншість, позиція країни, перший з країни) і генерує персоналізований текст. Замість disabled кнопки "Your vote" — AI CTA блок з градієнтною кнопкою. Модалка відкривається по кліку, показує editable textarea, дозволяє regenerate до 2 разів і шерінг через 6 платформ + Copy.

Пізніше додано переклад через DeepL: кнопка "Translate to Ukrainian" (або інша мова юзера) з'являється якщо браузерна локаль підтримується DeepL і не є англійською. Після перекладу — кнопка "Show Original" для повернення. Regenerate скидає переклад.

Вирішена проблема Twitter OG кешу — кожне питання шериться з `?q=<questionId>` щоб Twitter робив свіжий fetch метатегів.

---

## Файли

| Файл | Статус | Призначення |
|---|---|---|
| `src/app/api/generate-share-message/route.ts` | Новий | POST endpoint: приймає `ShareContext`, викликає Claude Haiku, повертає `{ message }` з fallback |
| `src/app/api/translate-share-message/route.ts` | Новий | POST endpoint: приймає `{ text, targetLocale }`, викликає DeepL, повертає `{ translatedText }` |
| `src/components/home/ShareModal.tsx` | Новий | Модалка з textarea, skeleton, regenerate, translate toggle, 7 share кнопок (6 платформ + copy) |
| `src/lib/worldvote/share.ts` | Оновлено | Додані: `ShareContext` interface, `getFallbackMessage()`, `buildShareLinksFromMessage()` |
| `src/components/home/HomeClient.tsx` | Оновлено | `buildCurrentShareContext()`, стан модалки, `onShare` prop до `ResultsSection`, передає `browserLocale` в `ShareModal` |
| `src/components/home/ResultsSection.tsx` | Оновлено | AI CTA блок замість disabled "Your vote", прибраний `ShareActions` |

---

## Архітектура — детально

### Lazy share context computation

**Проблема:** `ShareContext` обчислювався тільки в `handleVote()` — якщо юзер вже проголосував в попередній сесії і перезавантажив сторінку, контекст був `null` і модалка не відкривалась.

**Рішення:** функція `buildCurrentShareContext()` в `HomeClient` обчислює контекст з поточного state (`options`, `votes`, `selectedOptionId`, `question`) щоразу при кліку Share.

```ts
const buildCurrentShareContext = (): ShareContext | null => {
  if (!question || options.length < 2 || !selectedOptionId) return null;
  const userVote = votes.find((v) => v.deviceId === deviceId);
  // ...обчислення відсотків і country stats
};
```

> Аналогія для співбесіди: замість зберігати знімок стану при одній події, обчислюємо його lazy — як computed property.

---

### Graceful degradation на рівні API

**Проблема:** Claude API може відмовити, перевищити ліміт або згенерувати відмову замість тексту (safety refusal).

**Рішення:** два окремих `try/catch` — JSON parse і Claude виклик. Плюс валідація довжини відповіді: якщо більше 300 символів — це, мабуть, пояснення а не share message → fallback.

```ts
const raw = block.type === 'text' ? block.text.trim() : '';
const generated = raw.length > 0 && raw.length <= 300 ? raw : getFallbackMessage(body);
const text = generated.includes('#WorldVote') ? generated : `${generated} #WorldVote`;
```

> Аналогія для співбесіді: defensive programming — ніколи не ламаємо UX через зовнішній сервіс.

---

### Twitter OG cache busting

**Проблема:** Twitter кешує `og:title`/`og:description` по URL. Після зміни питання Twitter показував старе.

**Рішення:** `buildShareLinksFromMessage(message, questionId)` формує URL з `?q=<questionId>`. Кожне нове питання — новий URL → Twitter робить свіжий fetch.

```ts
const pageUrl = questionId ? `${SITE_URL}?q=${questionId}` : SITE_URL;
```

> Аналогія для співбесіди: cache busting — класична техніка для статичних ресурсів, застосована до OG preview.

---

### Facebook share workaround

**Проблема:** Facebook заблокував pre-filled текст у sharer.php — передати текст через URL неможливо.

**Рішення:** при кліку на Facebook — автоматично копіювати текст в clipboard перед відкриттям вікна.

```tsx
onClick={() => {
  if (link.platform === 'facebook') {
    navigator.clipboard.writeText(`${message}\n\n${SITE_URL}`);
  }
  window.open(link.href, '_blank');
}}
```

---

### Переклад share повідомлення через DeepL

**Проблема:** Claude генерує повідомлення тільки англійською. Юзери з України, Німеччини, Японії хочуть шерити рідною мовою.

**Рішення:** окремий endpoint `/api/translate-share-message` — передає один текстовий рядок у DeepL. Не можна перевикористати `/api/translate-question` бо той вимагає непорожній масив `optionLabels[]`. В `ShareModal` — кнопка-тогл: "Translate to Ukrainian" → "Show Original". `originalMessage` зберігається в стані для повернення назад.

```ts
const handleTranslate = async () => {
  const res = await fetch('/api/translate-share-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message, targetLocale }),
  });
  const data = await res.json();
  if (data.translatedText) {
    setOriginalMessage(message);
    setMessage(data.translatedText);
    setIsTranslated(true);
  }
};
```

Кнопка видима тільки якщо `resolveDeepLTargetLanguage(browserLocale)` не `null` і не починається з `"EN"`. `browserLocale` передається з `HomeClient` де він вже детектується через `navigator.language` (той самий механізм що і для перекладу питання на головній).

> Аналогія для співбесіди: той самий DeepL SDK і helpers що і для перекладу питання — нова фіча без нового інфраструктурного коду.

---

## Як пояснити на співбесіді

**"Як ти забезпечуєш що AI не зламає UX якщо API недоступний?"**
> Два рівні захисту: на сервері — окремий try/catch для Claude виклику повертає fallback message замість 500 помилки. На клієнті — якщо fetch падає, `generateMessage` теж ставить fallback. Юзер завжди бачить якийсь текст і може шерити.

**"Чому `generateMessage` загорнутий в `useCallback`?"**
> Функція використовується в `useEffect` — без `useCallback` вона перестворюється при кожному рендері, ESLint попереджає про missing dependency, і потенційно може викликати infinite loop. `useCallback([shareContext])` мемоізує функцію і перестворює тільки коли змінюється контекст.

**"Як вирішив проблему що модалка не відкривалась для юзерів що вже голосували?"**
> Перша версія обчислювала `ShareContext` тільки в `handleVote()` — тобто тільки після щойного голосування. Юзери з попередніх сесій мали `null` контекст. Вирішив перенесенням логіки в `buildCurrentShareContext()` яка читає поточний state компонента — вона завжди доступна поки `hasVoted === true`.

**"Чому для перекладу share message зробив окремий endpoint замість перевикористати `/api/translate-question`?"**
> `/api/translate-question` вимагає непорожній масив `optionLabels[]` — це жорстко зашита валідація під конкретний формат даних питання. Share message — це один вільний текстовий рядок. Додавати до існуючого endpoint optional поле і розгалужувати логіку — погана практика (Single Responsibility). Новий мікро-endpoint простіший, тестується окремо, і не ламає контракт існуючого.