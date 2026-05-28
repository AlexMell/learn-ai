# Task 5 — Розбір коду

```ts
const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "What is (25 * 4) + (100 / 5)? work through each step." }
]
```
Початкова история з одним повідомленням. На відміну від таску 4, тут масив живе **поза циклом** і росте з кожною ітерацією — так будується повна история агентського циклу.

---

```ts
function calculate(op: string, a: number, b: number): number { ... }
```
Реалізація tool на нашому боці. Claude ніколи не бачить цю функцію — він тільки каже "хочу викликати calculator з такими аргументами". Ми самі вирішуємо як виконати.

---

```ts
const MAX_ITERATIONS = 10;
let iteration = 0;

while (iteration < MAX_ITERATIONS) {
  iteration++;
```
Захист від нескінченного циклу. Якщо модель з якоїсь причини постійно викликає tools і не зупиняється — цикл все одно завершиться після 10 ітерацій.

---

```ts
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    tools,
    messages   // ← росте з кожною ітерацією
  });
```
Кожна ітерація — новий запит з повною поточною историєю. Перша ітерація: тільки питання юзера. Друга: питання + перший tool_use + перший tool_result. І так далі.

---

```ts
  if (response.stop_reason === "end_turn") {
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type === "text") {
      console.log("\nClaude:", textBlock.text);
    }
    break;
  }
```
Коли `end_turn` — Claude закінчив, виводимо відповідь і виходимо з циклу. `break` обов'язковий, інакше цикл продовжиться і зроблять зайвий запит.

`.find()` замість `[0]` — бо в відповіді з `end_turn` може бути спочатку якийсь інший блок, а текст другим.

`textBlock?.type` — опціональний chaining, бо `.find()` може повернути `undefined`.

---

```ts
  if (response.stop_reason === "tool_use") {
    messages.push({ role: "assistant", content: response.content });
```
Додаємо **весь** `response.content` в историю як assistant-повідомлення. Там можуть бути і текстові блоки і `tool_use` блоки разом. API вимагає що history була повною — не можна додати тільки `tool_use` блоки.

---

```ts
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const input = block.input as { operation: string; a: number; b: number };
        const result = calculate(input.operation, input.a, input.b);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(result)
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
```
Збираємо результати всіх tool викликів в один масив і додаємо одним user-повідомленням. Важливо: **одне** user-повідомлення з масивом результатів, не окреме повідомлення на кожен результат. API вимагає чергування `user → assistant`, тому всі результати мають йти разом.

---

**Як виглядає `messages` після двох ітерацій:**
```
[
  { role: "user",      content: "What is (25 * 4) + (100 / 5)?" },
  { role: "assistant", content: [tool_use: multiply, tool_use: divide] },
  { role: "user",      content: [tool_result: 100, tool_result: 20] },
  { role: "assistant", content: [tool_use: add] },
  { role: "user",      content: [tool_result: 120] },
]
```
Наступний запит відправить весь цей масив і Claude напише фінальну відповідь.
