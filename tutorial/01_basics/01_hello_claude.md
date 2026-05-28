# 01 — Перший запит до Claude

## Що відбувається під капотом

Коли ти пишеш `client.messages.create(...)` — SDK робить звичайний **HTTP POST** запит:

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: YOUR_KEY
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
  { model, max_tokens, messages: [...] }
```

Anthropic приймає запит, передає його в модель, та генерує відповідь токен за токеном. Коли генерація закінчена — сервер повертає JSON назад. Ти чекаєш на весь JSON одразу (на відміну від стрімінгу).

---

## Структура відповіді

```ts
{
  id: "msg_01XFDUDYJgAACzvnptvVoYEL",
  type: "message",
  role: "assistant",
  model: "claude-haiku-4-5-20251001",
  content: [               // масив блоків, не просто рядок!
    { type: "text", text: "The capital of France is Paris." }
  ],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 14,
    output_tokens: 10
  }
}
```

`content` — це **масив**, бо модель може відповісти кількома блоками одночасно: текст + виклик інструменту. Тому завжди перевіряй `block.type`.

---

## stop_reason — чому модель зупинилась

| Значення | Що означає |
|---|---|
| `end_turn` | Модель закінчила природньо |
| `max_tokens` | Досягнуто ліміт токенів — відповідь обрізана |
| `tool_use` | Модель хоче викликати інструмент |
| `stop_sequence` | Зустрівся один із твоїх кастомних стоп-рядків |

На співбесіді: `stop_reason` — це основа **agentic loop**. Якщо `tool_use` — виконуєш інструмент і відправляєш знову. Якщо `end_turn` — зупиняєшся.

---

## usage — токени і гроші

```ts
usage: {
  input_tokens: 14,   // токени що ти відправив
  output_tokens: 10   // токени що модель згенерувала
}
```

Ти платиш за обидва окремо. Output токени дорожчі ніж input (~5x для більшості моделей).

---

## API є stateless

Кожен запит — незалежний. Сервер нічого не пам'ятає між запитами. Якщо хочеш multi-turn діалог — ти сам несеш всю історію в кожному запиті.

---

## Підводні камені

**1. `content[0]` — не завжди текст.**
Якщо модель вирішила викликати tool, там буде `{ type: "tool_use", ... }`. Звернення до `.text` на ньому — runtime error. Завжди перевіряй `.type`.

**2. `import { Anthropic }` vs `import Anthropic`.**
SDK експортує клас як default export. Обидва варіанти працюють, але `import Anthropic from "@anthropic-ai/sdk"` — канонічний.

**3. API key в коді.**
Ніколи не хардкодь ключ в коді — він потрапить в git. Завжди через env змінні. `.env` має бути в `.gitignore`.
