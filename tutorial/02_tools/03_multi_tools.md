# 03 — Кілька інструментів і tool_choice

## Як модель обирає tool

Коли ти передаєш масив tools — модель сама вирішує:
- Чи потрібен взагалі якийсь tool
- Який саме (або кілька)
- Які аргументи передати

Рішення базується на `description` кожного tool і контексті запиту. Чим чіткіший опис — тим точніший вибір.

---

## tool_choice — контроль вибору

```ts
tool_choice: { type: "auto" }   // Claude вирішує сам (дефолт)
tool_choice: { type: "any" }    // Claude мусить викликати хоча б один tool
tool_choice: { type: "tool", name: "get_weather" }  // примусово викликати конкретний tool
```

**Коли використовувати `any`:** коли ти точно знаєш що без tool відповідь не має сенсу. Наприклад у продукті де модель завжди має шукати в БД — щоб не відповідала "з голови".

**Коли використовувати `tool`:** для structured output. Замість того щоб просити модель "відповісти в JSON" — опиши схему як tool і примусь модель "викликати" його. Тоді `input` завжди буде валідним JSON відповідної форми.

---

## Паралельні виклики в одній відповіді

Модель може викликати **кілька tools одночасно** в одній відповіді:

```ts
response.content = [
  { type: "tool_use", id: "id1", name: "get_stock_price", input: { ticker: "AAPL" } },
  { type: "tool_use", id: "id2", name: "get_company_info", input: { company: "Apple" } },
  { type: "tool_use", id: "id3", name: "convert_currency", input: { amount: 182, from: "USD", to: "EUR" } }
]
```

Це ефективно — три операції в одному round-trip замість трьох окремих.

---

## Structured output через tool

Популярний патерн в продакшені:

```ts
const tools = [{
  name: "save_result",
  description: "Save the extracted data",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      email: { type: "string" }
    },
    required: ["name", "age", "email"]
  }
}];

// Примушуємо модель "викликати" tool — насправді просто хочемо структурований output
tool_choice: { type: "tool", name: "save_result" }
```

Замість того щоб парсити текстову відповідь — отримуємо гарантований JSON в `block.input`. Це надійніше ніж prompt-based JSON extraction.

---

## Підводні камені

**1. Забагато tools знижує якість.**
Якщо ти передаєш 20+ tools — модель гірше орієнтується. Оптимально: до 10. В складних системах використовують динамічний вибір tools (передаєш тільки релевантні для поточного контексту).

**2. Назви tools — частина промпту.**
`name` і `description` впливають на поведінку моделі. `get_user_data` і `fetch_user_info` — різні сигнали. Будь конкретним і описовим.

**3. `tool_choice: "any"` з одним tool ≠ гарантований виклик.**
Технічно "any" означає "хоча б один з доступних". Якщо хочеш конкретний — використовуй `{ type: "tool", name: "..." }`.
