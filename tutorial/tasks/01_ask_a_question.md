# Task 1 — Розбір коду

```ts
import { Anthropic } from "@anthropic-ai/sdk";
import "dotenv/config";
```
Підключаємо SDK і dotenv. `dotenv/config` при імпорті одразу читає `.env` файл і кладе всі змінні в `process.env`. Після цього рядка `process.env.ANTHROPIC_API_KEY` вже містить твій ключ.

---

```ts
const client = new Anthropic();
```
Створюємо клієнт. Без аргументів — він сам знаходить ключ в `process.env.ANTHROPIC_API_KEY`. Можна передати явно: `new Anthropic({ apiKey: "..." })`, але так робити не треба — ключ потрапить в код.

---

```ts
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  messages: [
    { role: "user", content: "What is the capital of France?" }
  ],
});
```
Відправляємо HTTP POST запит до `api.anthropic.com/v1/messages`. `await` — чекаємо поки сервер поверне повну відповідь (не стрімінг).

- `model` — яку модель використовувати. Haiku — найдешевша і найшвидша.
- `max_tokens` — максимум токенів у відповіді. Обов'язкове поле.
- `messages` — масив повідомлень. Кожне має `role` (user або assistant) і `content`.

---

```ts
const block = response.content[0];
```
`response.content` — це **масив блоків**, не рядок. Може містити текст, виклики інструментів тощо. Беремо перший блок.

---

```ts
if (block.type === "text") {
  console.log("Answer:", block.text);
}
```
Перевіряємо тип перед тим як читати `.text` — якщо не перевіряти і блок виявиться `tool_use`, то `.text` буде `undefined` або TypeScript взагалі не скомпілює. Це обов'язкова перевірка.
