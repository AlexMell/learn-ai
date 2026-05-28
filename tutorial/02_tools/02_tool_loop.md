# 02 — Agentic Loop

## Що це

Agentic loop — паттерн де модель може викликати tools **кілька разів підряд** перш ніж дати фінальну відповідь. Це основа будь-якого AI-агента.

```
User: "What is (25 * 4) + (100 / 5)?"

Loop iteration 1:
  Claude: [tool_use: multiply(25, 4)]
  You: [tool_result: 100]

Loop iteration 2:
  Claude: [tool_use: divide(100, 5)]
  You: [tool_result: 20]

Loop iteration 3:
  Claude: [tool_use: add(100, 20)]
  You: [tool_result: 120]

Loop iteration 4:
  Claude: "The result is 120." (stop_reason: end_turn)
  → виходимо з циклу
```

---

## Структура циклу

```
while (true) {
  response = await client.messages.create({ messages })

  if response.stop_reason === "end_turn":
    → забираємо фінальний текст, break

  if response.stop_reason === "tool_use":
    → додаємо response в history
    → виконуємо всі tool_use блоки
    → додаємо tool_results в history
    → continue (наступна ітерація)
}
```

Це і є весь патерн. Все інше — деталі реалізації.

---

## Чому всі tool_results — в одному user turn'і

Модель може викликати кілька tools в одній відповіді (паралельно). Всі результати треба повернути в **одному** user повідомленні — як масив `tool_result` блоків. Якщо відправити по одному — API видасть помилку про порушення структури messages.

```ts
messages.push({
  role: "user",
  content: [
    { type: "tool_result", tool_use_id: "id1", content: "result1" },
    { type: "tool_result", tool_use_id: "id2", content: "result2" },
  ]
});
```

---

## History росте з кожною ітерацією

Після 5 ітерацій messages виглядає так:
```
user: "оригінальне питання"
assistant: [tool_use #1]
user: [tool_result #1]
assistant: [tool_use #2]
user: [tool_result #2]
...
assistant: "фінальна відповідь"
```

Токени = гроші. Довгі agentic chains — дорогі.

---

## Підводні камені

**1. Нескінченний цикл.**
Якщо модель завжди повертає `tool_use` — цикл не зупиниться. В продакшені завжди додавай `max_iterations`:

```ts
const MAX_ITERATIONS = 10;
let iteration = 0;

while (iteration < MAX_ITERATIONS) {
  iteration++;
  // ...
}
```

**2. Помилки в tool треба передавати назад.**
Якщо функція кинула помилку — не крашай додаток. Передай помилку як `tool_result` щоб модель могла на неї відреагувати:

```ts
content: [{ type: "tool_result", tool_use_id: id, content: "Error: division by zero", is_error: true }]
```

**3. Модель не завжди зупиняється самостійно.**
В деяких промптах модель може "загубитись" і продовжувати викликати tools без прогресу. Моніторь що відбувається і встанови ліміт.
