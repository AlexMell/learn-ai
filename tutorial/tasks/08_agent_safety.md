# Task 8 — Розбір коду

```ts
const MAX_ITERATIONS = 8;
```
**Hard limit** — жорстка межа ітерацій. Без неї агент може крутитись вічно якщо Claude з якоїсь причини не досягає `end_turn`. Виноситься в константу щоб легко міняти і щоб значення було очевидним.

---

```ts
const tools: Anthropic.Tool[] = [
  {
    name: "calculator",
    description: "Evaluate a math expression. Returns the numeric result.",
    input_schema: {
      type: "object" as const,
      properties: {
        expression: { type: "string" }
      },
      required: ["expression"]
    }
  }
]
```
Опис інструменту для Claude. `input_schema` — це JSON Schema: каже які поля tool приймає і якого типу. `as const` потрібен бо TypeScript інакше виводить тип `string` замість конкретного літерала `"object"` — а SDK вимагає точний тип.

Claude бачить це визначення і сам вирішує коли і з якими аргументами викликати tool. Ми тільки описуємо контракт, не реалізацію.

---

```ts
const messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];
let totalInputTokens = 0;
let totalOutputTokens = 0;
let lastToolCall = "";
```
Чотири змінні що живуть поза loop і накопичуються між ітераціями:
- `messages` — повна **conversation history**. Кожна ітерація додає сюди і assistant відповідь, і tool_result. Наступний запит бачить всю попередню розмову.
- `totalInputTokens / totalOutputTokens` — накопичувальні лічильники для підрахунку вартості.
- `lastToolCall` — рядок-підпис попереднього tool виклику. Потрібен для **loop detection**.

---

```ts
const res = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  tools,
  messages,
});
```
Кожна ітерація — новий API запит з повною поточною history. Перша ітерація: тільки питання. Друга: питання + tool_use + tool_result. Так Claude бачить весь контекст.

`tools` передаємо щоб Claude знав що може викликати `calculator`.

---

```ts
messages.push({ role: "assistant", content: res.content });
```
Одразу після отримання відповіді — кладемо її в history. Важливо робити це **до** будь-яких перевірок, бо наступний запит має бачити повну розмову незалежно від того чи буде `end_turn` чи `tool_use`.

---

```ts
totalInputTokens += res.usage.input_tokens;
totalOutputTokens += res.usage.output_tokens;
const costUsed = (totalInputTokens / 1_000_000) * 1 + (totalOutputTokens / 1_000_000) * 5;
```
`res.usage` містить кількість токенів цього конкретного запиту. Ми **додаємо** до загального лічильника — бо кожна ітерація це окремий запит зі своєю вартістю.

Формула вартості (Haiku pricing):
- input: $1 за 1 мільйон токенів → ділимо на `1_000_000` і множимо на `1`
- output: $5 за 1 мільйон токенів → ділимо на `1_000_000` і множимо на `5`

---

```ts
if (costUsed > 0.01) return { success: false, error: "budget exceeded", iterations: i + 1, costUsd: costUsed };
```
**Cost budget guard** — перевірка після кожної ітерації. Якщо витрачено більше $0.01 — зупиняємось і повертаємо **structured error** (не `throw`). Structured return зручніший ніж exception бо caller може обробити різні сценарії без try/catch.

---

```ts
if (res.stop_reason === 'end_turn') {
  console.log(`[iter ${i + 1}] end_turn — done`);
  return { success: true, result: resultText, iterations: i + 1, costUsd: costUsed };
}
```
`end_turn` — Claude вирішив що задача виконана і дав фінальну відповідь. Повертаємо `success: true` з результатом.

`resultText` — текстовий блок з `res.content`. Claude може повернути кілька блоків (text + tool_use), тому шукаємо через `.find(b => b.type === "text")`, не через `[0]`.

---

```ts
if (res.stop_reason === "tool_use") {
  const toolUseBlock = res.content.find(b => b.type === "tool_use");
  if (!toolUseBlock || toolUseBlock.type !== "tool_use") break;

  const { id, name, input } = toolUseBlock;
  const expr = (input as { expression: string }).expression;
```
`tool_use` — Claude хоче викликати calculator. Витягуємо `tool_use` блок з відповіді.

`id` — унікальний ідентифікатор цього виклику, потрібен щоб прив'язати `tool_result` назад.
`input as { expression: string }` — **type assertion**: ми знаємо що `input` містить `expression`, але TypeScript цього не знає без підказки.

---

```ts
const callSignature = JSON.stringify({ name, input });
if (callSignature === lastToolCall) return { success: false, error: "loop detected", iterations: i + 1, costUsd: costUsed };
lastToolCall = callSignature;
```
**Loop detection** — перевіряємо **до** виконання. `JSON.stringify({ name, input })` перетворює назву і аргументи в рядок-підпис. Якщо підпис співпадає з попереднім — агент застряг і повторює той самий виклик без прогресу.

Робимо перевірку до виконання бо немає сенсу виконувати той самий calculation вдруге.

---

```ts
const calcResult = String(Function(`"use strict"; return (${expr})`)());
```
Виконуємо математичний вираз. `Function(code)` створює нову функцію з рядка коду — безпечніше ніж `eval()` бо не має доступу до локальних змінних. `"use strict"` додатковий захист. Результат перетворюємо в рядок через `String()` бо `tool_result.content` має бути рядком.

---

```ts
messages.push({
  role: "user",
  content: [{ type: "tool_result", tool_use_id: id, content: calcResult }]
});
```
Повертаємо результат виконання tool назад Claude. `tool_use_id` прив'язує цей результат до конкретного `tool_use` блоку — Claude знає що це відповідь саме на той виклик.

`role: "user"` — tool_result завжди йде як user-повідомлення. API вимагає чергування `user → assistant`.

---

```ts
const costUsed = (totalInputTokens / 1_000_000) * 1 + (totalOutputTokens / 1_000_000) * 5;
return { success: false, error: "MAX_ITERATIONS exceeded", iterations: MAX_ITERATIONS, costUsd: costUsed };
```
Якщо вийшли з loop без `end_turn` — значить досягли ліміту ітерацій. Повертаємо **structured failure** — не кидаємо exception, а повертаємо об'єкт з `success: false`. Caller сам вирішить що робити далі.

---

**Як виглядає `messages` після двох ітерацій:**
```
[
  { role: "user",      content: "What is 123 * 456?" },
  { role: "assistant", content: [tool_use: calculator, expr: "123 * 456"] },
  { role: "user",      content: [tool_result: "56088"] },
  { role: "assistant", content: [text: "123 * 456 = 56088"] },  ← end_turn
]
```

---

**Три production guards — підсумок:**

| Guard | Де | Що робить |
|---|---|---|
| MAX_ITERATIONS | `for` loop | зупиняє після N ітерацій |
| Cost budget | після підрахунку токенів | зупиняє якщо витрати > $0.01 |
| Loop detection | перед виконанням tool | зупиняє якщо той самий виклик двічі поспіль |
