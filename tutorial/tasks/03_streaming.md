# Task 3 — Розбір коду

```ts
const stream = client.messages.stream({ ... });
```
`stream()` — на відміну від `create()` — не чекає повної відповіді. Повертає об'єкт стріму одразу. Зверни увагу: **без `await`**. `create()` повертає Promise, `stream()` повертає MessageStream — різні речі.

---

```ts
for await (const chunk of stream) {
```
`for await...of` — стандартний JS синтаксис для читання async iterable. Кожна ітерація — один SSE-евент від сервера. Цикл блокується і чекає на наступний евент, поки стрім не закриється.

---

```ts
  if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
    process.stdout.write(chunk.delta.text);
  }
```
Перевіряємо два рівні:
1. `chunk.type === "content_block_delta"` — це евент з шматком контенту (є й інші: `message_start`, `content_block_start`, тощо)
2. `chunk.delta.type === "text_delta"` — це текстовий шматок (не `thinking_delta` для extended thinking)

`process.stdout.write` замість `console.log` — бо `console.log` додає `\n` після кожного виклику. Токени прийшли б кожен з нового рядка.

---

```ts
const final = await stream.finalMessage();
```
`finalMessage()` чекає поки стрім повністю закриється і повертає повний об'єкт відповіді — такий самий як від `messages.create()`. Тут беремо `usage` з фінального повідомлення.

Виклик **після** циклу — якщо викликати до, він заблокується і почекає завершення стріму сам.

---

```ts
console.log(`\nTokens: ${final.usage.input_tokens} input, ${final.usage.output_tokens} output`);
```
`\n` на початку — щоб відступити від тексту поеми, яка друкувалась без переносу рядка.

`usage` приходить тільки в фінальному повідомленні, не в чанках — бо сервер знає скільки токенів витрачено тільки після завершення генерації.
