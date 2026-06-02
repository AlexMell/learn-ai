# Prompt Evaluation

> **Interview answer (English):**
> A good prompt is one you can *measure*, not one that "feels right." The evaluation process starts by defining what correct output looks like — a rubric, a set of test cases, or a reference dataset. Then you run both the old and new prompt against the same inputs and compare on metrics: accuracy (is the answer correct?), consistency (does it give the same answer on repeated runs?), and cost (tokens used). A new prompt is better only when it wins on the metrics that matter for your use case — not just on the one example you were debugging.

---

## Поясни 7-річному

Уяви що ти готуєш пиріг за рецептом. Ти змінив один інгредієнт — але як дізнатись чи пиріг став кращим? Треба дати обидва варіанти 10 людям і запитати. Не просто одній людині. Не просто самому себе попробувати. Ось це і є evaluation промптів — систематична перевірка, а не "мені здалося краще".

---

## Чому "на око" не працює

```
❌ Типовий workflow:
1. Написав промпт
2. Протестував на 1-2 прикладах — "виглядає добре"
3. Задеплоїв у продакшн
4. Через тиждень дізнався що він ламається на певних вхідних даних

✓ Правильний workflow:
1. Визначив що таке "правильна відповідь"
2. Зібрав тест-сет (10-50 прикладів)
3. Запустив обидва промпти на всьому тест-сеті
4. Порівняв метрики
5. Прийняв рішення на основі даних
```

Одна людина може легко обдуритись — confirmation bias: ти бачиш що промпт "спрацював" на тому прикладі де ти щойно налагоджував, але не бачиш де він ламається.

---

## Метрики

### 1. Accuracy (точність)

Відсоток відповідей що відповідають очікуваному результату.

```ts
// Для класифікації — бінарна оцінка
function calcAccuracy(results: { expected: string; actual: string }[]): number {
  const correct = results.filter(r => r.expected === r.actual).length;
  return correct / results.length;
}

// Prompt A: 78% accuracy
// Prompt B: 84% accuracy → B краще
```

**Для суб'єктивних задач** (якість тексту, tone) accuracy не підходить — потрібен LLM-as-judge або human eval.

### 2. Consistency (стабільність)

Чи дає промпт однаковий результат при повторних запусках на одному й тому самому вхідному тексті?

```ts
async function measureConsistency(prompt: string, input: string, runs = 5): Promise<number> {
  const results = await Promise.all(
    Array.from({ length: runs }, () => callClaude(prompt, input))
  );
  const unique = new Set(results).size;
  return 1 - (unique - 1) / runs; // 1.0 = повністю стабільний
}
```

Важливо при `temperature > 0`. Якщо один і той самий документ класифікується по-різному при різних запусках — промпт нестабільний.

### 3. Cost (вартість)

```ts
// Порівнюємо токени між промптами на одному тест-сеті
const costA = testResults.reduce((sum, r) => sum + r.usage.input_tokens + r.usage.output_tokens, 0);
const costB = testResults.reduce((sum, r) => sum + r.usage.input_tokens + r.usage.output_tokens, 0);

console.log(`Prompt A avg tokens: ${costA / testResults.length}`);
console.log(`Prompt B avg tokens: ${costB / testResults.length}`);
```

**Реальна вартість на масштабі:**
```
Різниця 200 токенів × 1M запитів/місяць × $3/1M = $600/місяць
```

### 4. Latency (швидкість)

Менше токенів у system prompt → швидша перша відповідь (TTFT — Time To First Token).

### 5. Format compliance

Відсоток відповідей що відповідають очікуваному формату:

```ts
function checkFormat(response: string): boolean {
  try {
    const parsed = JSON.parse(response);
    return typeof parsed.sentiment === "string" && typeof parsed.confidence === "number";
  } catch {
    return false;
  }
}

const compliance = results.filter(r => checkFormat(r.response)).length / results.length;
// Prompt A: 72% format compliance
// Prompt B: 98% format compliance → B набагато надійніший
```

---

## A/B тестування промптів

### Офлайн A/B (перед деплоєм)

Запусти обидва промпти на заздалегідь підготовленому тест-сеті:

```ts
const TEST_CASES = [
  { input: "...", expected: "positive" },
  { input: "...", expected: "negative" },
  // ... 20-50 прикладів
];

async function runEval(systemPrompt: string) {
  const results = [];
  for (const tc of TEST_CASES) {
    const response = await callClaude(systemPrompt, tc.input);
    results.push({
      input: tc.input,
      expected: tc.expected,
      actual: response,
      correct: response === tc.expected,
      tokens: response.usage.input_tokens + response.usage.output_tokens,
    });
  }
  return results;
}

const resultsA = await runEval(PROMPT_A);
const resultsB = await runEval(PROMPT_B);

console.table({
  "Prompt A": { accuracy: calcAccuracy(resultsA), avgTokens: calcAvgTokens(resultsA) },
  "Prompt B": { accuracy: calcAccuracy(resultsB), avgTokens: calcAvgTokens(resultsB) },
});
```

### Онлайн A/B (після деплою)

Відправляти частину реальних запитів на новий промпт і порівнювати метрики в продакшні:

```ts
function selectPrompt(userId: string): string {
  // детермінований вибір за userId щоб один юзер бачив один промпт
  const hash = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return hash % 2 === 0 ? PROMPT_A : PROMPT_B;
}
```

**Небезпека online A/B**: якщо новий промпт гірший — реальні юзери страждають. Тому офлайн eval — спочатку.

---

## LLM-as-Judge

Для суб'єктивних задач (якість тексту, корисність) можна використати іншу модель як суддю:

```ts
async function judgeQuality(question: string, responseA: string, responseB: string): Promise<"A" | "B" | "tie"> {
  const judgment = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: `You are evaluating AI responses. Judge which response better answers the user's question.
Criteria: accuracy, clarity, conciseness.
Respond with only: "A", "B", or "tie"`,
    messages: [{
      role: "user",
      content: `Question: ${question}

Response A: ${responseA}

Response B: ${responseB}

Which is better?`
    }]
  });

  return judgment.content[0].text.trim() as "A" | "B" | "tie";
}
```

**Обережно з LLM-as-Judge:**
- Моделі мають positional bias (перша відповідь часто "виграє")
- Рішення: запускати з обома порядками (A vs B і B vs A) і брати більшість

---

## Системний підхід: покроково

```
1. DEFINE — що таке "правильна відповідь"?
   └── Для класифікації: конкретний label
   └── Для генерації: rubric з критеріями (1-5)
   └── Для extraction: точне співпадіння поля

2. COLLECT — тест-сет
   └── Мінімум 20 прикладів для первинної оцінки
   └── 100+ для надійних висновків
   └── Включай edge cases і "складні" приклади

3. BASELINE — запусти поточний промпт на тест-сеті
   └── Це твоя відправна точка

4. ITERATE — зміни промпт, знову запусти на тест-сеті
   └── Одна зміна за раз щоб знати що спрацювало

5. COMPARE — порівняй метрики
   └── Переможець за головною метрикою

6. DEPLOY — тільки якщо новий промпт кращий за baseline
   └── Збережи обидва промпти і їх scores у версійному контролі

7. MONITOR — слідкуй за метриками після деплою
   └── Розподіл вхідних даних змінюється → промпт може деградувати
```

---

## Приклади з worldvote.app

worldvote.app — платформа де юзери щодня голосують по темах на карті світу. Використовує Claude API. Ось де тут потрібна prompt evaluation:

### Кейс 1: Генерація щоденного питання для голосування

```ts
// Задача: генерувати цікаве, нейтральне питання для голосування на день
// Метрики: нейтральність (bias score), engaging-ність (CTR), формат

const VOTE_QUESTION_EVAL = [
  {
    topic: "climate",
    expected_format: { question: "string (< 100 chars)", options: ["string", "string"] },
    check_bias: true, // питання не повинно "тягнути" до одного варіанту
  }
];

// Prompt A: "Generate a voting question about {topic}"
// Prompt B: "Generate a neutral, engaging voting question about {topic}.
//            The question must not imply a preferred answer.
//            Keep it under 100 characters."

// Метрика: format_compliance + bias_score (через окремий judge-запит)
```

### Кейс 2: Класифікація user-generated контенту (коментарі до голосувань)

```ts
// Задача: визначити чи коментар є spam/toxic/ok
// Метрики: accuracy (порівняно з human-labeled тест-сетом), false positive rate

const MODERATION_TEST_SET = [
  { text: "Great question!", expected: "ok" },
  { text: "Buy crypto now!!!", expected: "spam" },
  { text: "This is biased garbage", expected: "ok" }, // критика ≠ toxic
  // ...50 прикладів
];

// Важливо: false positive (ok → spam) гірший ніж false negative
// Тому метрика: precision for "ok" class повинна бути > 95%
```

### Кейс 3: Генерація summary результатів голосування по країні

```ts
// Задача: "73% українців підтримують X. Напиши 2-речення summary."
// Метрики: factual accuracy (чи правильно передано відсоток),
//          tone neutrality, length compliance (< 150 символів)

// A/B: 
// Prompt A: "Summarize: {country} voted {percentage}% for {option}"
// Prompt B: "Write a 1-2 sentence neutral summary for a news ticker.
//            Facts: {country}, {percentage}% chose '{option}' out of {total} votes.
//            Do not editorialize."

// Метрика: fact_extraction_accuracy (чи відсоток правильно в тексті)
//          + length_compliance + LLM-as-judge для нейтральності
```

### Як ти зрозумієш що новий промпт кращий?

Конкретно для worldvote.app:

```
Питання для голосування:
  ✓ format_compliance > 98% (завжди правильна структура JSON)
  ✓ bias_score < 0.1 (суддя-модель не може визначити "правильну" відповідь)
  ✓ avg_tokens < попередній промпт (дешевше при щоденній генерації)

Модерація:
  ✓ accuracy > 90% на labeled тест-сеті
  ✓ precision для "ok" > 95% (не блокуємо нормальних юзерів)
  ✓ recall для "spam" > 80% (ловимо більшість спаму)

Summary:
  ✓ fact_accuracy = 100% (відсоток завжди правильний)
  ✓ length < 150 символів у > 95% випадків
  ✓ LLM-judge: нейтральність > 4/5 в середньому
```

Якщо новий промпт виграє за основними метриками і не гірше за допоміжними — деплоїш.

---

## Підводні камені

### 1. Тест-сет з одного розподілу

Якщо всі тест-кейси прості — промпт що добре працює на них може провалитись на edge cases у продакшні. Навмисно додавай складні приклади.

### 2. Оптимізація під тест-сет (overfitting промпту)

Якщо ти постійно правиш промпт щоб пройти конкретні тест-кейси — він може перестати generalize. Тримай частину тест-сету як holdout set, якого не бачиш під час ітерацій.

### 3. Одна метрика не розповідає всього

```
Prompt B: accuracy 90% (vs A: 85%) ✓
Але: cost 2x більше ✗, consistency 70% (vs A: 95%) ✗
→ A може бути кращим загалом
```

### 4. Зміна розподілу даних у продакшні

Промпт що добре працював у грудні може деградувати у березні якщо юзери змінили поведінку. Потрібен ongoing monitoring, не разова оцінка.

### 5. Різні моделі — різні результати

Промпт що A/B тестувався на `claude-sonnet-4-6` може вести себе інакше на `claude-haiku-4-5`. При зміні моделі — повторюй eval.

---

## Interview Q&A

**Q: How do you know if a new prompt is better than the old one?**
A: You measure it. Define what "correct" means for your task, build a test set of 20-100 labeled examples, run both prompts on the full set, and compare on accuracy, consistency, cost, and format compliance. A new prompt is better only when it wins on the metrics that matter — not just on the one example you were debugging. Intuition is a starting point, not a verdict.

---

**Q: Що таке LLM-as-Judge і коли його використовувати?**
A: Це підхід де окрема модель оцінює якість відповіді — корисно для суб'єктивних задач де немає однозначної "правильної" відповіді (тон, корисність, нейтральність). Обережно з positional bias: запускай з обома порядками відповідей і бери більшість. Не замінює human eval для критичних задач.

---

**Q: Яка мінімальна кількість тест-кейсів для надійного висновку?**
A: 20+ для першої оцінки (щоб відчути тренд), 100+ для надійного статистичного порівняння. Для задач з рідкісними edge cases — більше. Якщо тест-сет менше 20 — висновки ненадійні, різниця в 1-2 приклади може перевернути результат.

---

**Q: Чим офлайн eval відрізняється від онлайн A/B?**
A: Офлайн — запускаєш на заготовленому тест-сеті до деплою, без ризику для реальних юзерів. Онлайн — частина реального трафіку іде на новий промпт, метрики збираються з реальної поведінки юзерів. Офлайн — швидше і безпечніше, онлайн — більш репрезентативний. Правильний порядок: офлайн спочатку, онлайн після.

---

**Q: Що таке "overfitting промпту" і як його уникнути?**
A: Коли ти правиш промпт спеціально щоб пройти конкретні тест-кейси — він перестає generalize на нові дані. Уникнення: тримай holdout set (20-30% тест-сету) що ти не дивишся під час ітерацій і використовуєш лише для фінальної оцінки.

---

## Правила напам'ять

```
Eval порядок:
  1. Define метрику ПЕРЕД тим як писати промпт
  2. Collect тест-сет (20 мін → 100+ для надійності)
  3. Baseline існуючий промпт
  4. One change at a time
  5. Compare на повному тест-сеті
  6. Deploy тільки якщо краще за baseline

Ключові метрики:
  accuracy     — правильність відповіді
  consistency  — стабільність при повторних запусках
  cost         — токени = гроші на масштабі
  format       — відсоток валідного формату

Пастки:
  ❌ Тестувати на 1-2 прикладах
  ❌ Оптимізувати під тест-сет без holdout
  ❌ Одна метрика вирішує все
  ❌ Не перевіряти після зміни моделі
  ❌ Eval один раз, не моніторити після деплою
```
