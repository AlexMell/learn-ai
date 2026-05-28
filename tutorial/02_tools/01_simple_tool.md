# 01 — Tool Use (Function Calling)

## Що це і навіщо

Модель сама по собі не може виконувати дії — вона тільки генерує текст. Tools (також відомі як "function calling") — це механізм який дозволяє моделі **запросити** виконання зовнішньої функції, а ти виконуєш її і повертаєш результат.

Приклади:
- Отримати актуальну погоду (модель не знає поточних даних)
- Прочитати файл з диску
- Зробити запит до бази даних
- Надіслати email

Модель **не виконує** код — вона лише каже "я хочу викликати функцію X з такими аргументами". Виконуєш ти.

---

## Як це працює покроково

```
1. Ти описуєш доступні tools у запиті
2. Модель вирішує чи потрібен tool → якщо так, stop_reason = "tool_use"
3. Відповідь містить блок { type: "tool_use", name: "...", input: {...} }
4. Ти виконуєш функцію зі своїм кодом
5. Відправляєш результат назад з role: "user", type: "tool_result"
6. Модель читає результат і пише фінальну відповідь
```

---

## Визначення tool — JSON Schema

```ts
{
  name: "get_weather",
  description: "Get current weather for a city.",  // ← модель читає це щоб вирішити чи використовувати tool
  input_schema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name" },
      unit: { type: "string", enum: ["celsius", "fahrenheit"] }
    },
    required: ["city"]  // ← модель зобов'язана передати ці поля
  }
}
```

`description` критично важливий — від нього залежить чи модель взагалі вирішить використати tool. Чим конкретніший — тим краще.

---

## tool_use блок у відповіді

```ts
{
  type: "tool_use",
  id: "toolu_01A09q90qw90lq917835lq9",  // ← треба зберегти для tool_result
  name: "get_weather",
  input: { city: "Kyiv", unit: "celsius" }  // ← аргументи які модель обрала
}
```

---

## Відправка результату назад

```ts
{
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "toolu_01A09q90qw90lq917835lq9",  // ← той самий id
      content: JSON.stringify({ temperature: 22, conditions: "sunny" })
    }
  ]
}
```

---

## Підводні камені

**1. `tool_use_id` — обов'язковий і точний.**
Якщо передаєш неправильний id — API поверне помилку. Завжди беремо `block.id` з відповіді, не генеруємо самі.

**2. Модель не валідує input сама.**
Якщо в `required` написано `city`, модель все одно може не передати його в edge cases. В продакшені — валідуй `block.input` перед виконанням.

**3. tool_result — завжди рядок або масив.**
`content` в `tool_result` — це string або array of blocks. Передавай `JSON.stringify(result)`, не сам об'єкт.

**4. Не забудь передати весь assistant turn.**
В наступний запит треба включити `{ role: "assistant", content: response.content }` де `response.content` — це весь масив блоків включно з `tool_use`. Якщо передати тільки текстовий блок — API видасть помилку про непослідовну историю.
