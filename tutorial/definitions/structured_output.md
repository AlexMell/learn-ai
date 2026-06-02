# Структуровані виводи: JSON і XML

> **Interview answer (English):**
> To guarantee structured output from Claude, combine three layers: a system prompt that specifies the exact schema, few-shot examples showing correct output, and a prefill of the assistant turn (start the response with `{` or `<result>`) so the model is forced to continue in the right format. For critical pipelines, wrap the call in a retry loop that validates the result and re-requests if parsing fails. Claude also natively supports tool use as a structured output mechanism — define a tool with a JSON schema and the model is architecturally constrained to return valid structured data.

---

## Поясни 7-річному

Уяви що ти просиш друга принести список покупок. Якщо просто скажеш "запиши що треба купити" — він може написати як завгодно: стовпцем, через кому, з коментарями. А якщо дати йому бланк з полями "назва / кількість / відділ" — він заповнить саме так. Structured output — це той бланк для моделі.

---

## Навіщо структурований вивід

LLM за замовчуванням генерує вільний текст. У продакшені це проблема:

```ts
// ❌ Вільний текст — не можна надійно парсити
"The sentiment is positive with a confidence of about 87%."

// ✓ Структурований — легко обробляти програмно
{ "sentiment": "positive", "confidence": 0.87 }
```

Структурований вивід потрібен коли:
- Результат іде в базу даних або інший API
- Кілька полів треба витягнути з одного тексту
- Downstream код очікує конкретний формат
- Треба валідувати результат перед використанням

---

## JSON у відповіді

### Базовий підхід: інструкція в system prompt

```ts
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 512,
  system: `You extract structured data from text.
Respond with valid JSON only. No markdown, no explanation, no code blocks.
Schema: { "name": string, "email": string | null, "topic": string }`,
  messages: [{
    role: "user",
    content: `Extract contact info: "Hi, I'm Sarah (sarah@example.com) and I need help with billing."`
  }]
});

// → { "name": "Sarah", "email": "sarah@example.com", "topic": "billing" }
```

### Проблема: модель обгортає JSON у markdown

```
```json          ← це зламає JSON.parse()
{ "name": "Sarah" }
```
```

**Рішення 1 — явна заборона:**
```ts
system: "Respond with raw JSON only. Never use markdown code blocks. Never add explanation."
```

**Рішення 2 — assistant prefill (найнадійніший):**

```ts
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 512,
  system: "Extract data as JSON.",
  messages: [
    { role: "user", content: "Extract: Hi, I'm Sarah (sarah@example.com)" },
    { role: "assistant", content: "{" }  // ← примусово починаємо JSON
  ]
});

// Claude продовжить: "name": "Sarah", "email": "sarah@example.com" }
// Склеїти: "{" + message.content[0].text
const raw = "{" + (message.content[0] as TextBlock).text;
const data = JSON.parse(raw);
```

Prefill — найефективніший метод: модель фізично не може почати з чогось іншого.

### Retry loop — захист від збоїв

```ts
async function extractJson<T>(prompt: string, schema: string, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `Extract data as JSON. Schema: ${schema}. Raw JSON only, no markdown.`,
      messages: [
        { role: "user", content: prompt },
        { role: "assistant", content: "{" }
      ]
    });

    try {
      const raw = "{" + (message.content[0] as TextBlock).text;
      return JSON.parse(raw) as T;
    } catch {
      if (attempt === maxRetries) throw new Error(`JSON parse failed after ${maxRetries} attempts`);
      // можна додати у наступний запит: "Previous attempt returned invalid JSON. Return only valid JSON."
    }
  }
  throw new Error("unreachable");
}
```

---

## Tool Use як гарантований JSON

Найнадійніший спосіб отримати структурований вивід — **визначити tool** з JSON Schema. Claude архітектурно зобов'язаний заповнити схему.

```ts
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  tools: [{
    name: "extract_contact",
    description: "Extract contact information from text",
    input_schema: {
      type: "object" as const,
      properties: {
        name:  { type: "string", description: "Full name" },
        email: { type: "string", description: "Email address" },
        topic: { type: "string", enum: ["billing", "technical", "sales", "other"] }
      },
      required: ["name", "topic"]
    }
  }],
  tool_choice: { type: "tool", name: "extract_contact" }, // примусово викликати саме цей tool
  messages: [{
    role: "user",
    content: "Hi, I'm Sarah (sarah@example.com) and I need help with billing."
  }]
});

// Гарантований structured вивід:
const toolUse = message.content.find(b => b.type === "tool_use");
const data = toolUse.input; // { name: "Sarah", email: "sarah@example.com", topic: "billing" }
```

**Переваги tool use підходу:**
- JSON Schema валідується на рівні API — неправильний тип неможливий
- `enum` обмежує можливі значення
- `required` гарантує наявність полів
- Не треба парсити текст — `input` вже є об'єктом

---

## XML теги — чому це краще для Claude

Claude навчався на великій кількості XML-розміченого тексту (включно з внутрішніми даними Anthropic). Тому Claude природно "розуміє" XML-структуру і добре з нею працює.

### XML для розділення контенту в промпті

```ts
// ❌ Без розмітки — де закінчується документ і починається інструкція?
`Here is the contract text: ${contractText}
Now summarize the key obligations.`

// ✓ З XML тегами — межі явні
`<document>
${contractText}
</document>

<task>Summarize the key obligations from the document above.</task>`
```

### XML для кількох вхідних блоків

```ts
messages: [{
  role: "user",
  content: `Compare these two code versions:

<version_a>
${codeA}
</version_a>

<version_b>
${codeB}
</version_b>

<task>Which version is more performant and why?</task>`
}]
```

### XML у виводі

Просити XML вивід корисно коли:
- Потрібно витягнути кілька різних блоків
- Вивід може містити текст з лапками (JSON потребував би escaping)
- Потрібен вивід з вкладеними структурами

```ts
system: `Analyze the code and respond using these XML tags:
<bugs>List of bugs found, one per line</bugs>
<severity>critical|high|medium|low</severity>
<fix>Suggested fix for the most critical bug</fix>`

// Парсинг XML виводу:
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\s\S]*?)<\/${tag}>`));
  return match ? match[1].trim() : "";
}

const bugs     = extractTag(response, "bugs");
const severity = extractTag(response, "severity");
const fix      = extractTag(response, "fix");
```

### JSON vs XML — коли що обирати

| Критерій | JSON | XML |
|---|---|---|
| Інтеграція з JS/TS кодом | Краще (native parse) | Гірше (потрібен regex/parser) |
| Вивід містить довільний текст з лапками | Складніше (escaping) | Простіше |
| Кілька незалежних блоків виводу | Вкладення | Природно через теги |
| Розділення input контенту в промпті | Не підходить | Ідеально |
| Вкладені структури | Природно | Природно |
| Claude "розуміє" краще | Добре | Трохи краще (більше в тренуванні) |

**Практичне правило:**
- Вивід для коду/API → **JSON** (або tool use)
- Розділення блоків у промпті → **XML теги**
- Вивід з довільним текстом → **XML теги**

---

## Як зробити стабільний вивід: чек-ліст

### 1. Чіткий schema у system prompt

```ts
system: `You extract invoice data. Return JSON with this exact schema:
{
  "invoice_number": string,
  "date": "YYYY-MM-DD",
  "total": number,          // numeric, no currency symbols
  "line_items": [{ "description": string, "amount": number }]
}
No extra fields. No markdown. No explanation.`
```

### 2. Few-shot приклад виводу

```ts
messages: [
  {
    role: "user",
    content: `Extract: Invoice #001, dated Jan 5 2025, total $150 for "Consulting"`
  },
  {
    role: "assistant",
    content: `{"invoice_number":"001","date":"2025-01-05","total":150,"line_items":[{"description":"Consulting","amount":150}]}`
  },
  {
    role: "user",
    content: `Extract: ${realInput}` // реальне завдання
  }
]
```

### 3. Assistant prefill

```ts
// Для JSON:
{ role: "assistant", content: "{" }

// Для XML:
{ role: "assistant", content: "<result>" }
```

### 4. Temperature = 0

```ts
temperature: 0  // детермінований вивід, менше "творчості" у форматі
```

### 5. Валідація + retry

```ts
// Використовуй zod або ручну перевірку
import { z } from "zod";

const InvoiceSchema = z.object({
  invoice_number: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number(),
  line_items: z.array(z.object({
    description: z.string(),
    amount: z.number()
  }))
});

const result = InvoiceSchema.safeParse(parsed);
if (!result.success) {
  // retry з повідомленням про помилку
}
```

### 6. Tool use для критичних пайплайнів

Якщо стабільність критична — використовуй tool use замість text output.

---

## Підводні камені

### 1. Модель додає markdown навколо JSON
```
```json\n{ ... }\n```
```
Рішення: явна заборона в system + prefill з `{`.

### 2. Числа як рядки
```json
{ "amount": "150.00" }  // ← рядок замість числа
```
Рішення: у schema явно написати `// numeric, not a string` і дати приклад.

### 3. Null vs відсутність поля
```json
{ "email": null }   // vs
{ }                 // email відсутній
```
Рішення: явно описати в schema: `"email": string | null  // use null if not found`.

### 4. Великі числа як string
JSON не розрізняє `integer` і `float`. Для ID або великих чисел краще використовувати string у schema щоб уникнути float precision проблем.

### 5. CoT перед JSON ламає prefill
```ts
// ❌ Конфліктує з prefill
system: "Think step by step, then return JSON."
messages: [..., { role: "assistant", content: "{" }]
// Модель хоче думати, але prefill вже починає JSON
```
Рішення: або CoT (без prefill), або prefill (без CoT). Або окремий крок для reasoning.

### 6. Вкладені структури ненадійні без прикладу
Чим складніша вкладена структура — тим важливіший few-shot приклад точного виводу.

---

## Interview Q&A

**Q: How do you guarantee JSON output from Claude?**
A: Three layers: system prompt with explicit schema and "raw JSON only, no markdown", assistant prefill starting with `{` to constrain the start of output, and a retry loop with JSON.parse validation. For critical pipelines, use tool use with a JSON Schema definition — the model is architecturally constrained to return valid structured data matching the schema.

---

**Q: Чому XML теги краще для розділення контенту в промпті ніж просто текст?**
A: XML теги задають явні межі між блоками контенту. Без них модель може "злити" інструкцію з документом. Claude добре розпізнає XML структуру завдяки навчальним даним. Теги типу `<document>`, `<task>`, `<context>` роблять промпт структурованим і передбачуваним.

---

**Q: Що таке assistant prefill і як він гарантує формат?**
A: Prefill — це початок відповіді моделі, який ти задаєш сам у полі `{ role: "assistant", content: "{" }`. Модель фізично продовжує з цього місця і не може почати відповідь з іншого символу. Для JSON це найнадійніший спосіб уникнути markdown обгортки.

---

**Q: Коли використовувати tool use замість JSON у text відповіді?**
A: Tool use — коли надійність критична. JSON Schema валідується на рівні API (неправильний тип або відсутнє required поле неможливі). Для прототипів або простих задач — JSON у тексті з prefill достатньо. Для продакшн пайплайнів де помилка парсингу — критична — tool use.

---

**Q: Як обробити ситуацію де модель повертає числа як рядки?**
A: Явно описати тип у schema з коментарем ("numeric, no currency symbols, not a string") і дати few-shot приклад з правильним типом. Також можна додати post-processing: `const amount = Number(parsed.amount)` — але краще навчити модель одразу.

---

## Правила напам'ять

```
Рівні гарантії JSON (від слабкого до сильного):
  1. System prompt "return JSON only"          — слабко
  2. + Few-shot приклад правильного виводу     — краще
  3. + Assistant prefill "{"                   — надійно
  4. + Temperature = 0                         — стабільно
  5. + Retry loop з валідацією                 — production-ready
  6. Tool use з JSON Schema                    — максимальна гарантія

XML > JSON для:
  → розділення блоків у промпті
  → вивід з довільним текстом (no escaping issues)

JSON > XML для:
  → вивід що іде в JS/TS код (native JSON.parse)
  → інтеграція з API

Prefill для JSON:  { role: "assistant", content: "{" }
Prefill для XML:   { role: "assistant", content: "<result>" }

Не поєднуй CoT ("think step by step") з JSON prefill в одному запиті
```
