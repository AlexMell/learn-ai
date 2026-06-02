# Базові техніки промптингу

> **Interview answer (English):**
> The core prompting techniques are zero-shot (just the instruction), few-shot (instruction + examples), chain-of-thought (ask the model to reason step-by-step before answering), and role prompting (assign a persona). Few-shot is most effective when the task has a non-obvious output format or when zero-shot consistently makes the same type of mistake. Chain-of-thought dramatically improves accuracy on multi-step reasoning tasks by forcing the model to "show its work" before committing to an answer.

---

## Поясни 7-річному

Уяви що ти вчиш молодшого брата грати в шахи.

- **Zero-shot**: "Зроби хід" — він не знає правил, діє навмання.
- **Few-shot**: "Дивись, оцей хід — конем так, оцей — слоном так. Тепер твій хід." — показав приклади, він зрозумів патерн.
- **Chain of Thought**: "Спочатку подумай які фігури під загрозою, потім які ходи захищають короля, потім обери кращий." — вчиш думати покроково.
- **Role prompting**: "Уяви що ти Магнус Карлсен. Який хід би він зробив?" — даєш роль експерта.

---

## Zero-shot

**Ідея:** просто даєш задачу без прикладів. Модель спирається на знання з тренування.

```ts
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 256,
  messages: [{
    role: "user",
    content: "Classify the sentiment of this review as positive, negative, or neutral:\n\n\"The product arrived late but works perfectly.\""
  }]
});
// → "Mixed / Neutral"
```

### Коли підходить
- Прості, добре відомі задачі (переклад, підсумок, класифікація стандартних категорій)
- Прототипування — швидко перевірити чи модель взагалі розуміє задачу
- Задачі де формат відповіді очевидний

### Коли НЕ підходить
- Нестандартний формат виводу (модель не знає що ти хочеш)
- Доменно-специфічні задачі з особливою термінологією
- Модель стабільно помиляється одним і тим же способом

---

## Few-shot

**Ідея:** перед задачею даєш 2–5 прикладів вхід→вихід. Модель вчить патерн з прикладів, а не з тренування.

```ts
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 256,
  messages: [{
    role: "user",
    content: `Classify review sentiment. Use exactly one word: POSITIVE, NEGATIVE, or MIXED.

Review: "Amazing quality, fast shipping!"
Sentiment: POSITIVE

Review: "Broke after one week. Terrible."
Sentiment: NEGATIVE

Review: "Good product but expensive."
Sentiment: MIXED

Review: "The product arrived late but works perfectly."
Sentiment:`
  }]
});
// → "MIXED"
```

### Анатомія few-shot prompt

```
[Optional: коротка інструкція]

Input: <приклад 1 вхід>
Output: <приклад 1 вихід>

Input: <приклад 2 вхід>
Output: <приклад 2 вихід>

...

Input: <реальне завдання>
Output:   ← модель продовжує звідси
```

### Скільки прикладів?
- **1-shot** — мінімум, показує формат
- **3-5 shot** — оптимум для більшості задач
- **> 10** — рідко дає кращий результат, але коштує токени
- Якість прикладів важливіша за кількість

### Вибір прикладів
- Охоплюй різні випадки (не лише "легкі")
- Включай edge cases якщо вони важливі
- Порядок має значення — останній приклад впливає найбільше
- Для класифікації — збалансуй класи у прикладах

---

## Коли few-shot краще за zero-shot?

| Ситуація | Few-shot виграє? |
|---|---|
| Нестандартний формат виводу | **Так** — без прикладів модель вигадає свій |
| Zero-shot стабільно помиляється | **Так** — приклади коригують помилковий патерн |
| Доменна термінологія / жаргон | **Так** — приклади вчать правильні терміни |
| Тонкі розрізнення (3+ класи зі схожими значеннями) | **Так** — приклади показують межу між класами |
| Прості задачі (переклад, підсумок) | **Ні** — zero-shot і так справляється |
| Мало токенів у бюджеті | **Ні** — few-shot дорожчий |
| CoT вирішує проблему | **Ні** — краще CoT ніж більше прикладів |

**Правило:** спочатку спробуй zero-shot. Якщо результат неправильний або у неправильному форматі — додай 2-3 приклади.

---

## Chain of Thought (CoT)

**Ідея:** попросити модель *думати покроково* перед відповіддю. Це підвищує точність на складних задачах, бо модель не "стрибає" одразу до відповіді.

### Zero-shot CoT
Просто додати "Let's think step by step" або "Думай покроково":

```ts
messages: [{
  role: "user",
  content: `A store has 24 apples. They sell 1/3 in the morning and 1/4 of the remainder in the afternoon. How many are left?

Think step by step.`
}]

// Без CoT модель може дати: 12 (неправильно)
// З CoT:
// Step 1: 24 × 1/3 = 8 sold in morning → 24 - 8 = 16 remain
// Step 2: 16 × 1/4 = 4 sold in afternoon → 16 - 4 = 12 remain
// Answer: 12  ← але хід думок правильний, і для складніших задач CoT рятує
```

### Few-shot CoT
Показуєш приклади *з ходом думок* — найефективніший варіант:

```ts
messages: [{
  role: "user",
  content: `Solve math problems step by step.

Problem: A train travels 120km in 2 hours. What is its speed?
Reasoning: Speed = Distance / Time = 120km / 2h = 60 km/h
Answer: 60 km/h

Problem: If 5 workers build a wall in 10 days, how long for 2 workers?
Reasoning: Total work = 5 × 10 = 50 worker-days. With 2 workers: 50 / 2 = 25 days
Answer: 25 days

Problem: A shirt costs $40 after a 20% discount. What was the original price?
Reasoning:`
}]
```

### Коли CoT допомагає найбільше

| Тип задачі | CoT ефект |
|---|---|
| Багатокрокова математика | Значний |
| Логічні головоломки | Значний |
| Причинно-наслідкові міркування | Значний |
| Класифікація з обґрунтуванням | Помірний |
| Простий переклад | Мінімальний |
| Пряме запитання про факт | Мінімальний |

### CoT + Structured Output — підводний камінь

```ts
// ❌ Проблема: якщо вимагаєш JSON, CoT може зламати парсинг
system: "Always respond in JSON only."
user: "Think step by step. What is 15% of 80?"
// → модель може думати в тексті, а потім намагатись запхнути в JSON

// ✓ Рішення: thinking всередині JSON або окремий крок
user: "What is 15% of 80? Respond as: { \"reasoning\": \"...\", \"answer\": ... }"
```

### Extended Thinking (Claude-specific)

Claude має вбудований режим "думання" — окремий блок де модель міркує перед відповіддю:

```ts
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 16000,
  thinking: {
    type: "enabled",
    budget_tokens: 10000, // скільки токенів на роздуми
  },
  messages: [{ role: "user", content: "Solve this complex problem..." }]
});

// message.content = [
//   { type: "thinking", thinking: "Let me analyze..." },  // внутрішні думки
//   { type: "text", text: "The answer is..." }            // фінальна відповідь
// ]
```

---

## Role Prompting

**Ідея:** присвоїти моделі конкретну роль/персону. Активує відповідний "режим" знань і стилю.

### Базовий приклад

```ts
system: "You are a senior security engineer with 15 years of experience in web application security. You review code for vulnerabilities and explain risks in plain English."

// vs без ролі:
system: "Review code for security issues."
```

З роллю модель:
- Використовує правильну термінологію домену
- Розставляє пріоритети як реальний спеціаліст
- Підтримує відповідний тон і рівень деталізації

### Ефективні ролі

```ts
// Технічна експертиза
"You are a TypeScript compiler. Identify type errors in the code."

// Перевірка критичним поглядом
"You are a skeptical senior engineer doing code review. Your job is to find problems, not to be nice."

// Для пояснень
"You are a teacher explaining concepts to a smart 10-year-old with no technical background."

// Для тестування
"You are a QA engineer trying to break this feature. Think like a malicious user."
```

### Коли роль дає найбільший ефект

- Коли потрібна доменна специфіка (медицина, право, безпека)
- Коли тон важливий (суворий reviewer vs підтримуючий ментор)
- Коли потрібне конкретне обрамлення задачі (скептик vs оптиміст)

### Обмеження role prompting

- Модель не стає реальним експертом — вона імітує стиль
- При складних технічних задачах факти важливіші за роль
- Надто театральна роль ("ти — магічний дракон-програміст") не дає кращих результатів ніж чітка роль

---

## Комбінування технік

Техніки не виключають одна одну — вони підсилюють:

```ts
system: `You are a senior data analyst.`  // Role prompting

messages: [{
  role: "user",
  content: `Analyze this sales data and identify the top issue.

Example 1:
Data: Q1 sales down 15%, marketing spend up 20%
Analysis: Increased spend not converting → review funnel efficiency
Issue: Marketing ROI

Example 2:
Data: Q2 sales flat, new product launched
Analysis: New product cannibalizing existing line without net growth
Issue: Product cannibalization

Now analyze:                              // Few-shot
Data: Q3 sales down 8%, churn rate up 12%, NPS dropped from 42 to 31
Think step by step before your answer.   // Chain of Thought
Analysis:`
}]
```

---

## Interview Q&A

**Q: What is the difference between zero-shot and few-shot prompting?**
A: Zero-shot provides only the instruction — the model relies entirely on training. Few-shot adds 2–5 input/output examples before the real task, teaching the model the expected pattern. Few-shot is preferred when the output format is non-obvious or when zero-shot consistently makes the same type of mistake.

---

**Q: Як Chain of Thought покращує результати?**
A: CoT змушує модель генерувати проміжні кроки міркування перед фінальною відповіддю. Це критично для multi-step задач: без CoT модель "стрибає" до відповіді і може пропустити крок. Дослідження показують, що на складних математичних і логічних задачах CoT підвищує точність на 30–50%.

---

**Q: Коли few-shot краще за zero-shot?**
A: Коли формат виводу нестандартний, коли zero-shot стабільно помиляється одним типом помилки, або коли задача потребує доменної термінології. Якщо zero-shot дає правильний результат — few-shot не потрібен, він лише коштує більше токенів.

---

**Q: What's the risk of role prompting?**
A: The model mimics the style and terminology of the role but doesn't become a real expert. Factual accuracy still depends on training data. Overly theatrical roles ("you are an all-knowing oracle") don't improve results — specific, grounded roles ("senior backend engineer at a fintech company") work better.

---

**Q: Як поєднати CoT з JSON output?**
A: Або додати поле `reasoning` в JSON схему, або зробити два окремих запити: перший з CoT для аналізу, другий для структурованого виводу на основі першого. Інакше модель може "думати" в plain text і зламати JSON структуру.

---

## Правила напам'ять

```
Порядок спроб:
  1. Zero-shot — просто спробуй
  2. Few-shot — якщо формат неправильний або стабільні помилки
  3. CoT — якщо задача багатокрокова або логічна
  4. Role — якщо потрібен конкретний стиль або домен
  5. Комбінуй — найкращий результат

Few-shot:
  Оптимум: 3–5 прикладів
  Якість > кількість
  Останній приклад впливає найбільше
  Балансуй класи для класифікації

CoT тригери:
  "Think step by step"
  "Let's reason through this"
  "Думай покроково перед відповіддю"

Role prompting:
  Конкретна роль > загальна ("senior security engineer" > "expert")
  Роль у system prompt, задача у user message
```
