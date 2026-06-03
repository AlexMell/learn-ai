# Function Calling (Tool Use)

> **Interview answer (English):**
> Function calling is a protocol where the model signals *intent* to call a function by returning a structured `tool_use` block instead of text — it never executes code itself. You execute the function, pass the result back as a `tool_result` message, and the model continues. The loop repeats until `stop_reason` is `"end_turn"`. The model's decision of *when* and *which* tool to call is driven by the tool's `description` and `input_schema`.

---

## Поясни 7-річному

Уяви що ти секретар, а модель — директор. Директор не може сам зателефонувати — він пише тобі записку: "Зателефонуй в аеропорт і дізнайся рейс о 15:00". Ти телефонуєш, отримуєш відповідь і приносиш директору. Директор читає і каже: "Добре, рейс затримується на годину." Модель — це директор. Вона вирішує **що** зробити, але **ти** виконуєш реальні дії.

---

## Як LLM "викликає" функції

LLM не виконує код. Вона лише **описує виклик** у структурованому форматі, а ти виконуєш і повертаєш результат.

```
Модель отримала tools → вирішила що потрібен tool → повернула tool_use блок
    ↓
Ти виконав функцію → отримав результат → відправив tool_result
    ↓
Модель отримала результат → продовжила генерацію
```

Модель ніколи не має доступу до твого коду, мережі або файлової системи напряму.

---

## Flow: decide → call → result → continue

### ASCII діаграма

```
┌─────────────────────────────────────────────────────────┐
│                    ОДИН TURN                            │
│                                                         │
│  User message                                           │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────┐   stop_reason    ┌──────────────────────┐  │
│  │  Claude  │ ─"end_turn"───▶ │  Фінальна відповідь  │  │
│  └─────────┘                 └──────────────────────┘  │
│       │                                                 │
│       │ stop_reason = "tool_use"                        │
│       ▼                                                 │
│  ┌───────────┐                                          │
│  │ tool_use  │  { name, id, input }                    │
│  │   block   │                                          │
│  └───────────┘                                          │
│       │                                                 │
│       ▼                                                 │
│  ┌───────────┐                                          │
│  │  Твій код │  виконує функцію                        │
│  └───────────┘                                          │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────┐                                        │
│  │ tool_result │  { tool_use_id, content }              │
│  │   у history │                                        │
│  └─────────────┘                                        │
│       │                                                 │
│       └────────────▶  Наступний запит до Claude ────┐  │
│                                                      │  │
└──────────────────────────────────────────────────────┘  │
         ▲                                                 │
         └─────────────────────────────────────────────────┘
                    (якщо знов tool_use → повторити)
```

### Кроки в коді

```ts
// 1. DECIDE — надіслати запит з tools
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  tools,          // описи доступних функцій
  messages,
});

// 2. CALL — перевірити чи модель хоче викликати tool
if (response.stop_reason === "tool_use") {
  for (const block of response.content) {
    if (block.type === "tool_use") {
      // block.name  → яку функцію викликати
      // block.id    → унікальний ID виклику
      // block.input → аргументи (вже розпарсений JSON)

      // 3. RESULT — виконати і зібрати результат
      const result = myFunction(block.input);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,   // прив'язка до конкретного виклику
        content: JSON.stringify(result),
      });
    }
  }

  // 4. CONTINUE — додати обидва turn-и в history і повторити
  messages.push({ role: "assistant", content: response.content });
  messages.push({ role: "user", content: toolResults });
  // → наступна ітерація циклу
}
```

Повний приклад: `02_tools/01_simple_tool.ts`, agentic loop: `02_tools/02_tool_loop.ts`

---

## Tool Schema

Tool schema — це опис функції яку ти даєш моделі. Три поля:

```ts
const tool: Anthropic.Tool = {
  name: "get_weather",           // ← ідентифікатор, яким модель викликає tool
  description: "Get current weather for a city. Returns temp and conditions.",
                                 // ← НАЙВАЖЛИВІШЕ: модель вирішує чи викликати
                                 //   tool саме на основі цього тексту
  input_schema: {                // ← JSON Schema для аргументів
    type: "object" as const,
    properties: {
      city: {
        type: "string",
        description: "City name, e.g. 'Kyiv'",  // ← підказка для моделі
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],         // ← обмеження значень
      },
    },
    required: ["city"],          // ← обов'язкові поля
  },
};
```

### Що впливає на якість tool calling

| Поле | Важливість | Порада |
|---|---|---|
| `description` | Критично | Чітко описуй КОЛИ і ЩО повертає tool. Модель вирішує виклик саме на основі цього. |
| `input_schema.properties[].description` | Важливо | Пояснюй формат і приклади значень |
| `required` | Важливо | Лише справді обов'язкові поля |
| `enum` | Корисно | Обмежуй допустимі значення де можливо |
| `name` | Помірно | snake_case, описовий, без пробілів |

---

## tool_choice — керування вибором

```ts
// auto (дефолт) — Claude сам вирішує чи викликати tool
tool_choice: { type: "auto" }

// any — мусить викликати хоча б один tool
tool_choice: { type: "any" }

// forced — мусить викликати конкретний tool (guaranteed structured output)
tool_choice: { type: "tool", name: "extract_data" }
```

`tool_choice: "tool"` + конкретна схема = найнадійніший спосіб отримати структурований JSON. Дивись `tutorial/definitions/structured_output.md`.

---

## Паралельні виклики

Модель може повернути кілька `tool_use` блоків в одному turn-і. Всі їх результати відправляються в **одному** `user` повідомленні:

```ts
// response.content може містити:
// [{ type: "tool_use", name: "get_weather", id: "tu_1" },
//  { type: "tool_use", name: "get_weather", id: "tu_2" }]

const toolResults = response.content
  .filter(b => b.type === "tool_use")
  .map(b => ({
    type: "tool_result" as const,
    tool_use_id: b.id,
    content: JSON.stringify(execute(b)),
  }));

// Всі результати — один user turn
messages.push({ role: "user", content: toolResults });
```

Повний приклад: `02_tools/03_multi_tools.ts`

---

## Підводні камені (Gotchas)

### 1. tool_use_id мусить точно співпадати
```ts
// ❌ Якщо id не співпадає — API помилка або модель плутається
{ type: "tool_result", tool_use_id: "wrong_id", content: "..." }

// ✓ Завжди беремо id безпосередньо з block.id
{ type: "tool_result", tool_use_id: block.id, content: "..." }
```

### 2. Весь assistant turn іде в history — не тільки tool_use блоки
```ts
// ❌ Не відправляй лише tool_use блоки
messages.push({ role: "assistant", content: [toolUseBlock] });

// ✓ Весь response.content (може містити і text, і tool_use)
messages.push({ role: "assistant", content: response.content });
```

### 3. Помилки у tool треба теж відправляти назад
```ts
// Якщо функція впала — відправ помилку як tool_result, не кидай exception
toolResults.push({
  type: "tool_result",
  tool_use_id: block.id,
  content: `Error: ${error.message}`,
  is_error: true,   // опціональне поле — підказка моделі
});
```

### 4. Нескінченний цикл без MAX_ITERATIONS
```ts
const MAX_ITERATIONS = 10;
let i = 0;
while (true) {
  if (++i > MAX_ITERATIONS) throw new Error("Too many iterations");
  // ...
}
```

### 5. description — найважливіше поле, але часто ігнорується
Якщо модель не викликає tool коли мала б, або викликає не той — це майже завжди проблема з `description`. Конкретний, чіткий опис КОЛИ використовувати tool = правильний вибір моделі.

### 6. tool_result content завжди string
```ts
// ❌ Об'єкт напряму
content: { temperature: 22, city: "Kyiv" }

// ✓ Серіалізований рядок
content: JSON.stringify({ temperature: 22, city: "Kyiv" })
```

---

## Interview Q&A

**Q: What is function calling and does Claude actually execute any code?**
A: No — Claude never executes code. It returns a `tool_use` block describing *which* function to call and with *what arguments*. You execute the function and send back a `tool_result`. Claude then uses the result to continue generating.

---

**Q: Що таке agentic loop і коли він завершується?**
A: Цикл: відправити запит → якщо `stop_reason = "tool_use"` → виконати tools → додати результати в history → повторити. Завершується коли `stop_reason = "end_turn"` — модель вирішила що має достатньо інформації для фінальної відповіді.

---

**Q: Яке поле в tool schema найважливіше і чому?**
A: `description`. Саме на його основі модель вирішує чи викликати tool і в яких ситуаціях. Погана `description` → модель не розуміє коли застосовувати tool або плутає tools між собою.

---

**Q: Як відправити результати кількох паралельних tool calls?**
A: Всі `tool_result` блоки йдуть в **одному** `user` повідомленні — масивом. Кожен блок містить `tool_use_id` що прив'язує результат до конкретного виклику.

---

**Q: Чим `tool_choice: "tool"` корисний для structured output?**
A: Якщо вказати конкретний tool і `tool_choice: { type: "tool", name: "..." }` — модель зобов'язана викликати саме цей tool і заповнити схему. `block.input` вже є валідним JS-об'єктом — не треба парсити текст і немає ризику markdown обгортки.

---

**Q: Що відбувається якщо tool кинув помилку?**
A: Треба відправити помилку назад як `tool_result` з `is_error: true` і описом проблеми. Не кидай JS exception — модель не отримає feedback і не зможе скоригувати поведінку.

---

## Правила напам'ять

```
Flow: messages → tool_use → execute → tool_result → messages → repeat → end_turn

stop_reason:
  "tool_use"  → виконай tools і продовж цикл
  "end_turn"  → фінальна відповідь, виходь з циклу

tool_use block:
  block.name  → яку функцію викликати
  block.id    → прив'язка для tool_result (мусить точно співпадати)
  block.input → аргументи (вже об'єкт, не string)

tool_result:
  content: завжди string (JSON.stringify якщо об'єкт)
  tool_use_id: block.id  ← завжди брати звідси, не хардкодити

tool_choice:
  "auto"  → модель сама вирішує
  "any"   → мусить викликати хоча б один
  { type: "tool", name: "X" } → forced → guaranteed structured output

Паралельні calls → всі tool_results в одному user turn
History порядок → ... user → assistant (з tool_use) → user (з tool_results) → ...
MAX_ITERATIONS → завжди встановлюй (рекомендовано: 10)

Файли:
  02_tools/01_simple_tool.ts  → базовий flow
  02_tools/02_tool_loop.ts    → agentic loop
  02_tools/03_multi_tools.ts  → паралельні виклики
```
