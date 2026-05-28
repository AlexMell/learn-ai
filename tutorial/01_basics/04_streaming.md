# 04 — Streaming

## Проблема без стрімінгу

Модель генерує текст токен за токеном на сервері. Без стрімінгу — ти чекаєш поки вся відповідь не буде готова, і тільки тоді отримуєш її цілком. На довгих відповідях це може бути 10–30 секунд мовчання.

Зі стрімінгом — кожен токен відправляється одразу як з'явився. UI показує текст в реальному часі (саме так працює Claude.ai).

---

## Як це працює технічно

Під капотом — **SSE (Server-Sent Events)**. Це стандартний веб-протокол для односторонніх потоків даних від сервера до клієнта по HTTP. Кожна подія — рядок тексту в форматі:

```
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}
data: [DONE]
```

SDK читає цей потік і перетворює в зручні TypeScript об'єкти.

---

## Типи подій в стрімі

| Тип | Коли приходить |
|---|---|
| `message_start` | Початок — містить `id`, `model` |
| `content_block_start` | Початок нового блоку (text або tool_use) |
| `content_block_delta` | Кожен новий шматок тексту |
| `content_block_stop` | Блок завершено |
| `message_delta` | Оновлення `stop_reason` і `usage` |
| `message_stop` | Кінець стріму |

На практиці тебе цікавить в основному `content_block_delta` з `delta.type === "text_delta"`.

---

## Два способи через SDK

**Метод 1 — ручний цикл (більше контролю):**
```ts
const stream = await client.messages.stream({ ... });
for await (const chunk of stream) {
  if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
    process.stdout.write(chunk.delta.text);
  }
}
const final = await stream.finalMessage(); // чекаємо завершення і беремо повний об'єкт
```

**Метод 2 — callback (простіше для тексту):**
```ts
const stream = client.messages.stream({ ... });
stream.on("text", (text) => process.stdout.write(text));
const fullText = await stream.finalText(); // просто рядок
```

---

## first token latency vs total time

Важлива різниця для продуктових рішень:
- **TTFT (Time To First Token)** — скільки чекати до першого символу (~0.3–1s)
- **Total time** — скільки генерується вся відповідь (~5–30s)

Стрімінг покращує **сприйняту** швидкість (UX), але не реальний throughput.

---

## Підводні камені

**1. Extended thinking вимагає стрімінгу.**
Не-стрімінговий режим з `thinking: { type: "enabled" }` — не підтримується, буде помилка.

**2. `finalMessage()` чекає на завершення стріму.**
Якщо ти викликаєш `finalMessage()` до того як прочитав всі чанки — SDK заблокується поки стрім не завершиться. Це нормально, але треба розуміти що відбувається.

**3. Помилки в середині стріму.**
Якщо з'єднання обірвалось — ти отримаєш частковий текст без `message_stop`. В продакшені треба обробляти network errors і реалізовувати retry.
