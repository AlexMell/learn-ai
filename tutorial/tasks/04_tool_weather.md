# Task 4 — Розбір коду

```ts
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    input_schema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name" },
        unit: { type: "string", enum: ["celsius"] }
      },
      required: ["city"],
    },
  },
]
```
Описуємо доступні інструменти. Claude **читає** `description` щоб вирішити чи варто використовувати tool. `input_schema` — це JSON Schema, вона каже моделі які аргументи передавати.

`type: "object" as const` — TypeScript без `as const` виводить тип як `string`, а SDK очікує літерал `"object"`. Це TypeScript-специфіка, не API.

`required: ["city"]` — поля без яких Claude не може викликати tool. `unit` не обов'язковий — Claude може не передати його.

---

```ts
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 512,
  tools,
  messages: [{ role: "user", content: "what the weather in london right now?" }]
});
```
Перший запит. Передаємо `tools` — тепер Claude знає що може їх викликати. Він або відповість текстом, або зупиниться з `stop_reason: "tool_use"`.

---

```ts
for (const block of response.content) {
  if (block.type === "tool_use") {
```
Перебираємо всі блоки відповіді. Якщо Claude викликав tool — там буде блок типу `tool_use`. Могло бути й кілька таких блоків якби Claude викликав кілька tools одночасно.

---

```ts
    console.log(`Tool called: ${block.name}(${JSON.stringify(block.input)})`);
    const mockResult = { city: "London", temp: 18, conditions: "rainy" };
```
`block.input` — об'єкт з аргументами які Claude передав. `JSON.stringify` перетворює його на рядок для виводу.

`mockResult` — в реальному застосунку тут би був виклик до weather API. Ми повертаємо захардкоджені дані.

---

```ts
    const finalResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools,
      messages: [
        { role: "user", content: "what the weather in london right now?" },
        { role: "assistant", content: response.content },         // ← вся відповідь з tool_use
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(mockResult) }]
        }
      ]
    });
```
Другий запит. History мусить містити:
1. Оригінальне питання юзера
2. Відповідь Claude з `tool_use` блоком (`response.content` — весь масив, не тільки текст)
3. Результат виконання tool

`tool_use_id: block.id` — прив'язує результат до конкретного виклику. Якщо передати неправильний id — API поверне помилку.

`content: JSON.stringify(mockResult)` — результат має бути рядком.

---

```ts
    const finalBlock = finalResponse.content[0];
    if (finalBlock.type === "text") {
      console.log("Claude:", finalBlock.text);
    }
```
Тепер Claude знає погоду і пише фінальну відповідь. `stop_reason` цього запиту — `"end_turn"`.
