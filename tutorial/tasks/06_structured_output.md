# Task 6 — Розбір коду

```ts
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();
```
Стандартний бойлерплейт: підключаємо SDK і завантажуємо `.env` файл (звідки береться `ANTHROPIC_API_KEY`). `new Anthropic()` — створює клієнт, який автоматично підхопить ключ з `process.env.ANTHROPIC_API_KEY`.

---

```ts
const tools: Anthropic.Tool[] = [
  {
    name: "save_person",
    description: "save person by name age and city",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "name of person" },
        age:  { type: "number", description: "age of person" },
        city: { type: "string", description: "city of person" }
      },
      required: ["name", "age", "city"]
    }
  }
]
```
Визначаємо tool. Але цього разу ми не збираємось його "виконувати" — він потрібен тільки щоб Claude повернув дані в конкретній формі.

- `input_schema` — JSON Schema яка описує форму `block.input`. Claude зобов'язаний її дотримуватися.
- `required: ["name", "age", "city"]` — гарантує що всі три поля завжди будуть присутні. Без `required` Claude міг би пропустити поле якщо не знайшов значення.
- `type: "object" as const` — TypeScript вимагає literal type `"object"`, а не просто `string`. `as const` "звужує" тип до конкретного значення.

---

```ts
const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: "Extract the person: Oleksii is 34 years old and lives in Kyiv."
  }
]
```
Вхідне повідомлення з неструктурованим текстом — звичайна фраза природньою мовою. Саме це і є задача structured output: взяти довільний текст і витягти з нього структуровані дані.

---

```ts
let response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 512,
  tools,
  tool_choice: { type: "tool", name: "save_person" },
  messages
});
```
Ключова відмінність від попередніх тасків — `tool_choice`.

- `tools` — передаємо визначення інструментів (Claude знає їх форму).
- `tool_choice: { type: "tool", name: "save_person" }` — примусовий виклик конкретного tool. Замість `"auto"` (Claude сам вирішує) ми кажемо "ти **зобов'язаний** викликати `save_person`".
- `max_tokens: 512` — для structured output без додаткового тексту вистачає малого ліміту; відповідь коротка — один `tool_use` блок.

Без `tool_choice` Claude міг би вирішити відповісти текстом: _"Oleksii is 34 years old..."_ — і ти б парсив рядок. З `tool_choice: "tool"` — він **гарантовано** повертає `tool_use` блок з `input` у вигляді JSON.

---

```ts
for (const block of response.content) {
  if (block.type === "tool_use") {
    const input = block.input as { name: string; age: number; city: string };
    console.log(`Name: ${input.name}, Age: ${input.age}, City: ${input.city}`);
  }
}
```
- `response.content` — масив блоків. При `tool_choice: "tool"` там буде рівно один `tool_use` блок, але ми все одно ітеруємо і перевіряємо `block.type` — це правильна звичка.
- `block.input` — це `unknown` в TypeScript. `as { name: string; age: number; city: string }` — type assertion: ми кажемо компілятору "довір мені, я знаю що там буде". Це безпечно тому що `input_schema` в tool визначає саме таку форму.
- **Другий запит не потрібен** — нас не цікавить що Claude "відповість" на `tool_result`. Нам потрібні тільки дані з `block.input`.

---

## Порівняння підходів

**Поганий варіант — просити JSON в промпті:**
```ts
messages: [{ role: "user", content: "Extract person as JSON with fields name, age, city" }]
// Claude може відповісти: "Here is the JSON: ```json\n{...}```"
// Треба парсити текст, стрипати markdown, обробляти помилки
```

**Правильний варіант — structured output через tool:**
```ts
tool_choice: { type: "tool", name: "save_person" }
// block.input завжди валідний JSON потрібної форми
// Без парсингу, без markdown, без сюрпризів
```

Це патерн **structured output**: замість парсингу тексту ти отримуєш гарантований JSON потрібної форми. Використовується скрізь де потрібно витягувати дані з тексту — форми, класифікація, entity extraction.
