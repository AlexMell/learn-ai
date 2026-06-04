# Tool Use на практиці

> **Interview answer (English):**
> To implement a tool: define it with `name`, `description`, and `input_schema`; pass it in the `tools` array; check `stop_reason === "tool_use"` in the response; extract `block.name`, `block.id`, and `block.input` from each `tool_use` block; execute your function; send back a `tool_result` with the matching `tool_use_id`. For parallel calls, collect all results into one user message. Errors should also be returned as `tool_result` with `is_error: true` — never throw.

---

## Поясни 7-річному

Ти вчиш робота виконувати доручення. Спочатку пишеш йому інструкцію: "Є кнопка 'Дізнатись погоду' — вона приймає місто і повертає температуру." Робот сам вирішить коли натиснути кнопку. Після натискання — ти виконуєш дію і кажеш результат роботу. Робот використовує результат і відповідає тобі.

---

## Як описати tool для Claude

Три обов'язкових поля. `description` — найважливіше, саме воно керує рішенням Claude коли і чи викликати tool.

```ts
import Anthropic from "@anthropic-ai/sdk";

const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",           // snake_case, без пробілів
    description:
      "Get current weather for a city. " +
      "Returns temperature in celsius and sky conditions. " +
      "Use when the user asks about weather or temperature in a specific location.",
    input_schema: {
      type: "object" as const,     // завжди "object" as const
      properties: {
        city: {
          type: "string",
          description: "City name, e.g. 'Kyiv' or 'London'",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],   // обмежує можливі значення
          description: "Temperature unit. Default: celsius.",
        },
      },
      required: ["city"],          // unit — необов'язковий
    },
  },
];
```

### Правила хорошої description

| Що включати | Приклад |
|---|---|
| Що tool робить | "Get current weather for a city" |
| Що повертає | "Returns temperature and conditions" |
| Коли використовувати | "Use when user asks about weather" |
| Що НЕ робить | "Does not support weather forecasts" |

---

## Повний приклад: get_weather від початку до кінця

```ts
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// 1. Визначаємо tool
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get current weather for a city. Returns temp (celsius) and conditions.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name, e.g. 'Kyiv'" },
        unit: { type: "string", enum: ["celsius", "fahrenheit"] },
      },
      required: ["city"],
    },
  },
];

// 2. Реалізуємо функцію (в реальному проекті — виклик API)
function getWeather(city: string, unit = "celsius") {
  const db: Record<string, { temp: number; conditions: string }> = {
    kyiv:   { temp: 18, conditions: "partly cloudy" },
    london: { temp: 12, conditions: "rainy" },
    tokyo:  { temp: 28, conditions: "sunny" },
  };
  const data = db[city.toLowerCase()] ?? { temp: 20, conditions: "unknown" };
  const temp = unit === "fahrenheit" ? Math.round(data.temp * 9/5 + 32) : data.temp;
  return { city, temperature: temp, unit, conditions: data.conditions };
}

// 3. Перший запит
const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "What's the weather in Kyiv right now?" },
];

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 512,
  tools,
  messages,
});

console.log("stop_reason:", response.stop_reason); // "tool_use"

// 4. Парсимо tool_use відповідь
if (response.stop_reason === "tool_use") {
  const toolUseBlocks = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  // 5. Виконуємо і збираємо результати
  const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => {
    const input = block.input as { city: string; unit?: string };
    const result = getWeather(input.city, input.unit);

    return {
      type: "tool_result" as const,
      tool_use_id: block.id,               // ← прив'язка до виклику
      content: JSON.stringify(result),      // ← завжди string
    };
  });

  // 6. Додаємо обидва turn-и в history і отримуємо фінальну відповідь
  const finalResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    tools,
    messages: [
      ...messages,
      { role: "assistant", content: response.content }, // весь turn, не тільки tool_use
      { role: "user",      content: toolResults },
    ],
  });

  const text = finalResponse.content.find((b) => b.type === "text");
  console.log(text?.type === "text" ? text.text : "No text response");
}
```

Повний код: `02_tools/01_simple_tool.ts`

---

## Як парсити tool_use відповідь

```ts
// Варіант 1: filter з type guard (рекомендовано)
const toolBlocks = response.content.filter(
  (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
);

// Варіант 2: find для одного tool
const toolBlock = response.content.find((b) => b.type === "tool_use");
if (toolBlock?.type === "tool_use") { /* ... */ }

// Варіант 3: loop для mixed content (text + tool_use в одному response)
for (const block of response.content) {
  if (block.type === "text")     console.log("Text:", block.text);
  if (block.type === "tool_use") console.log("Tool:", block.name, block.input);
}

// block.input — вже розпарсений об'єкт, НЕ string
// Type assertion потрібен бо SDK повертає unknown
const input = block.input as { city: string; unit?: string };
```

---

## Parallel tool use

Модель може викликати кілька tools одночасно. Всі результати — в **одному** user turn.

```ts
// response.content може бути:
// [
//   { type: "tool_use", name: "get_stock_price", id: "tu_1", input: { ticker: "AAPL" } },
//   { type: "tool_use", name: "get_company_info", id: "tu_2", input: { company: "Apple" } },
//   { type: "tool_use", name: "convert_currency", id: "tu_3", input: { amount: 182, from: "USD", to: "EUR" } }
// ]

const results: Anthropic.ToolResultBlockParam[] = response.content
  .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
  .map((b) => ({
    type: "tool_result" as const,
    tool_use_id: b.id,
    content: executeTool(b.name, b.input as Record<string, unknown>),
  }));

// Всі три результати — один user message
messages.push({ role: "user", content: results });
```

Паралельні виклики можна виконувати паралельно і в твоєму коді:

```ts
const results = await Promise.all(
  toolBlocks.map(async (b) => ({
    type: "tool_result" as const,
    tool_use_id: b.id,
    content: await fetchFromRealAPI(b.name, b.input),
  }))
);
```

Повний приклад: `02_tools/03_multi_tools.ts`

---

## Помилки і retry

### Помилка в tool → повертай як tool_result, не кидай exception

```ts
const results: Anthropic.ToolResultBlockParam[] = toolBlocks.map((block) => {
  try {
    const result = executeTool(block.name, block.input as Record<string, unknown>);
    return {
      type: "tool_result" as const,
      tool_use_id: block.id,
      content: JSON.stringify(result),
    };
  } catch (error) {
    // Помилка іде назад до Claude — він може скоригувати виклик
    return {
      type: "tool_result" as const,
      tool_use_id: block.id,
      content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      is_error: true,
    };
  }
});
```

### Rate limit / network error → retry з exponential backoff

```ts
async function callWithRetry(
  fn: () => Promise<Anthropic.Message>,
  maxRetries = 3
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError ||
        error instanceof Anthropic.APIConnectionError;

      if (!isRetryable || attempt === maxRetries - 1) throw error;

      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

// Використання:
const response = await callWithRetry(() =>
  client.messages.create({ model: "claude-sonnet-4-6", max_tokens: 512, tools, messages })
);
```

### Типи помилок Anthropic SDK

| Клас | HTTP статус | Причина |
|---|---|---|
| `RateLimitError` | 429 | Забагато запитів, чекай і повторюй |
| `InternalServerError` | 500 | Тимчасова проблема на стороні API |
| `APIConnectionError` | — | Мережа, timeout |
| `BadRequestError` | 400 | Невалідний запит (напр. перевищено context window) |
| `AuthenticationError` | 401 | Невалідний API ключ |

---

## Підводні камені (Gotchas)

### 1. `block.input` — об'єкт, не string. Але тип — `unknown`
```ts
// ❌ TypeScript помилка або runtime crash
const city = block.input.city;

// ✓ Type assertion
const input = block.input as { city: string; unit?: string };
const city = input.city;
```

### 2. Весь `response.content` іде в history, не тільки tool блоки
```ts
// ❌ Втрачаємо текстові блоки якщо були
messages.push({ role: "assistant", content: [block] });

// ✓ Повний turn
messages.push({ role: "assistant", content: response.content });
```

### 3. `tool_result.content` — завжди string
```ts
// ❌ SDK прийме але модель отримає "[object Object]"
content: { temperature: 22 }

// ✓
content: JSON.stringify({ temperature: 22 })
```

### 4. Паралельні results — один user message, не кілька
```ts
// ❌ Два окремі user повідомлення — помилка протоколу
messages.push({ role: "user", content: [result1] });
messages.push({ role: "user", content: [result2] }); // два user підряд!

// ✓ Один масив
messages.push({ role: "user", content: [result1, result2] });
```

### 5. `is_error: true` — підказка моделі, не виняток
Модель отримає помилку і може або перефразувати виклик, або пояснити юзеру що щось пішло не так. Без `is_error` вона не знає що результат — помилка.

---

## Interview Q&A

**Q: Walk me through implementing a tool from scratch.**
A: Define the tool object with `name`, `description`, and `input_schema`. Pass it in `tools`. After the request, check `stop_reason === "tool_use"`, filter `content` for `tool_use` blocks, cast `block.input`, execute the function, return a `tool_result` with the same `tool_use_id`. Add both the assistant turn and the results to `messages`, then repeat until `end_turn`.

---

**Q: Чому `block.input` має тип `unknown` і як з цим працювати?**
A: SDK не знає яку схему ти описав в `input_schema` — тому тип `unknown` для безпеки. Рішення: type assertion `block.input as { city: string }`. В продакшені — валідація через `zod` перед використанням.

---

**Q: Як відправити результати паралельних tool calls?**
A: Зібрати всі `tool_result` блоки в масив і відправити одним user повідомленням. Не можна два user повідомлення підряд — це порушення протоколу. Самі функції можна виконувати паралельно через `Promise.all`.

---

**Q: What happens if a tool throws an error — should I catch it?**
A: Yes — always catch and return the error as a `tool_result` with `is_error: true`. If you let the exception bubble up, Claude gets no feedback and can't adjust. With `is_error`, Claude can either retry with corrected arguments or explain the failure to the user.

---

**Q: Яка різниця між `tool_choice: "auto"`, `"any"` і примусовим викликом?**
A: `"auto"` — Claude сам вирішує чи потрібен tool. `"any"` — мусить викликати хоча б один. `{ type: "tool", name: "X" }` — примусово викликає конкретний tool, що гарантує structured output (block.input завжди відповідає схемі).

---

## Правила напам'ять

```
Мінімальна реалізація tool:
  1. Визначити: { name, description, input_schema }
  2. Передати: tools: [...] в messages.create
  3. Перевірити: stop_reason === "tool_use"
  4. Парсити: .filter(b => b.type === "tool_use")
  5. Виконати: твоя функція з block.input as YourType
  6. Повернути: { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) }
  7. Додати в history: assistant turn + user turn з results

Типові помилки:
  block.input → cast до свого типу (unknown за замовчуванням)
  tool_result.content → завжди string (JSON.stringify)
  history → весь response.content, не тільки tool_use блоки
  parallel → всі results в одному user message

Retry стратегія:
  RateLimitError / InternalServerError / APIConnectionError → exponential backoff
  BadRequestError / AuthenticationError → не ретрай, фікс в коді

Файли:
  02_tools/01_simple_tool.ts   → get_weather, базовий flow
  02_tools/02_tool_loop.ts     → agentic loop з calculator
  02_tools/03_multi_tools.ts   → паралельні виклики, executeTool switch
```
