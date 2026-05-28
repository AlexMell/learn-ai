# Task 02 — Multi-turn conversation

## Головна ідея

Claude API — **stateless**. Кожен запит незалежний, модель не пам'ятає попередніх повідомлень.

Щоб зробити розмову — ти сам ведеш масив `messages` і передаєш всю історію в кожен новий запит.

---

## Структура messages

```ts
const messages = [
  { role: "user",      content: "My name is Alex." },
  { role: "assistant", content: "Nice to meet you, Alex!" },
  { role: "user",      content: "What's my name?" },
];
```

Після кожного ходу потрібно додати **обидва** повідомлення до масиву: і те що відправив юзер, і те що відповів Claude.

---

## Паттерн одного ходу

```ts
// 1. Додати повідомлення юзера
messages.push({ role: "user", content: userMessage });

// 2. Запит до API
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  system: "You are a concise assistant. Answer in max 2 sentences.",
  messages,
});

// 3. Дістати текст відповіді
const text = response.content[0].text;

// 4. Зберегти відповідь асистента в історію
messages.push({ role: "assistant", content: text });
```

---

## Q&A

### Яка різниця — скільки писати max_tokens? Що буде якщо написати 1?

`max_tokens` — жорсткий ліміт на кількість output токенів. Якщо написати `1`, модель поверне максимум **один токен** (одне слово або частину слова) і зупиниться.

- Помилки не буде
- `stop_reason` стане `"max_tokens"` замість `"end_turn"`
- Відповідь просто обріжеться посередині

**Практично:** ставь достатньо великий ліміт для твоєї задачі. Для коротких відповідей — 256–1024, для довгих — 4096+. Модель зупиниться раніше сама, якщо закінчить відповідь.

**Підводний камінь:** якщо відповідь обрізалась — перевіряй `response.stop_reason === "max_tokens"`.
