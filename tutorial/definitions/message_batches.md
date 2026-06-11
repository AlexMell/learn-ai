# Message Batches API

> **Interview answer (English):** The Message Batches API lets you send up to 100,000 Claude requests in a single batch that processes asynchronously — results arrive within 24 hours but typically in under an hour. The key trade-off is latency for cost: batched requests are 50% cheaper than real-time calls, making this the right choice for workloads that don't need an immediate response, such as bulk classification, evaluation pipelines, or data enrichment jobs.

## Поясни 7-річному

Уяви що ти замовляєш піцу для класу. Можна бігати в піцерію 30 разів по одній штуці — довго і дорого. Або скласти один великий список і відправити все одним замовленням — дешевше, але чекати трохи довше. Batches API — це той самий "оптовий список": надсилаєш купу запитів одним пакетом, платиш вдвічі менше, отримуєш відповіді коли будуть готові.

---

## Навіщо Batches API

Реальний час потрібен не завжди. Якщо задача не блокує користувача — немає сенсу платити повну ціну за миттєву відповідь.

**Де доречно:**
- Класифікація тисяч документів (sentiment, категорія, мова)
- Eval pipeline — оцінка промптів на великому тест-сеті
- Збагачення даних у базі (витягнути entities, резюмувати)
- Нічна генерація звітів
- Перевірка якості датасету перед файн-тюнінгом

**Де не доречно:**
- Chatbot (потрібна відповідь зараз)
- Streaming UI
- Будь-що інтерактивне

---

## Ключові параметри

| Параметр | Значення |
|---|---|
| Макс. запитів на батч | 100 000 |
| Макс. розмір батчу | 256 MB |
| Deadline обробки | 24 години |
| Типовий час | < 1 години |
| Зниження ціни | 50% від стандартної |
| Зберігання результатів | 29 днів |

---

## Структура запиту

Кожен елемент батчу — це звичайний `messages.create` виклик + `custom_id`:

```ts
const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: "review-1",          // твій ідентифікатор — приходить назад у результатах
      params: {                        // звичайний messages.create shape
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{ role: "user", content: "Classify: great product!" }],
      },
    },
    {
      custom_id: "review-2",
      params: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 64,
        messages: [{ role: "user", content: "Classify: terrible, broke in a day." }],
      },
    },
  ],
});

console.log(batch.id);               // batch_01ABC...
console.log(batch.processing_status); // "in_progress"
```

---

## Polling — чекаємо завершення

Батч обробляється асинхронно. Єдиний спосіб дізнатись що він готовий — опитувати статус:

```ts
let current = batch;

while (current.processing_status !== "ended") {
  await new Promise(r => setTimeout(r, 30_000)); // 30 секунд між перевірками
  current = await client.messages.batches.retrieve(batch.id);

  const { processing, succeeded, errored } = current.request_counts;
  console.log(`processing=${processing} succeeded=${succeeded} errored=${errored}`);
}
```

**`processing_status` може бути:**
- `in_progress` — ще обробляється
- `ended` — завершено (усі результати готові)
- `canceling` — скасовується після виклику `.cancel()`

**`request_counts` оновлюється в реальному часі** — можна бачити прогрес під час обробки.

---

## Отримання результатів

`batches.results()` повертає async iterable — перебираємо результати потоком, не завантажуємо все в пам'ять:

```ts
for await (const result of await client.messages.batches.results(batch.id)) {
  switch (result.result.type) {
    case "succeeded": {
      const block = result.result.message.content[0];
      if (block.type === "text") {
        console.log(`[${result.custom_id}] ${block.text.trim()}`);
      }
      break;
    }
    case "errored": {
      // error.type: "invalid_request" (твоя помилка) або "api_error" (сторона Anthropic)
      console.error(`[${result.custom_id}] ERROR: ${result.result.error.type}`);
      break;
    }
    case "expired": {
      // запит не був оброблений за 24 год — треба повторно відправити
      console.warn(`[${result.custom_id}] EXPIRED — resubmit`);
      break;
    }
  }
}
```

---

## Три типи результатів

| Тип | Причина | Що робити |
|---|---|---|
| `succeeded` | Успіх | Обробити відповідь |
| `errored` | `invalid_request` — невалідні params; `api_error` — збій на стороні Anthropic | Перший: виправити і переподати. Другий: можна безпечно переподати |
| `expired` | Не оброблено за 24 год | Переподати запит |

---

## Скасування батчу

```ts
const cancelled = await client.messages.batches.cancel(batch.id);
// processing_status → "canceling"
// Запити що вже почали оброблятись — завершаться. Решта — не виконаються.
// Результати вже оброблених запитів доступні через .results()
```

---

## Підводні камені (Gotchas)

### 1. Порядок результатів не гарантований
Результати повертаються не в тому порядку що запити. Завжди орієнтуйся на `custom_id`, не на порядок у циклі.

### 2. `processing_status === "ended"` ≠ усі succeeded
Батч "ended" навіть якщо частина запитів errored або expired. Завжди перевіряй `request_counts.errored` після завершення.

### 3. Polling інтервал важливий
Занадто часто = зайві запити. Занадто рідко = затримка у обробці результатів. Розумний інтервал: 30–60 секунд. Для великих батчів — 5 хвилин.

### 4. Результати зберігаються 29 днів
Після цього — зникають назавжди. Якщо потрібно довше — зберігай самостійно одразу після завершення.

### 5. Той самий rate limit
Батчі не дають обійти rate limits — вони просто розподіляють ті самі ліміти в часі. Якщо ти на низькому tier — батч обробляється повільніше.

### 6. Немає webhooks
API не повідомляє тебе про завершення — тільки polling. Якщо потрібна автоматизація — треба будувати власну систему.

---

## Interview Q&A

**Q: Яка головна перевага Batches API порівняно зі звичайними запитами?**
A: 50% знижка на всі токени — input і output. Trade-off: немає гарантії часу відповіді — результат прийде протягом 24 годин, зазвичай менш ніж за годину. Підходить для будь-якої non-latency-sensitive роботи.

---

**Q: When would you NOT use the Batches API?**
A: Anything user-facing that needs an immediate response — chatbots, interactive tools, real-time pipelines. Batches trade latency for cost, so they're wrong wherever latency matters.

---

**Q: Як відстежити прогрес виконання батчу?**
A: Через polling: `client.messages.batches.retrieve(id)` — в `request_counts` видно скільки succeeded/errored/processing в реальному часі. Webhook API поки немає.

---

**Q: What does `result.result.type === "errored"` tell you, and how do you handle it?**
A: It means that specific request failed. The sub-type matters: `invalid_request` is your bug — fix params before resubmitting. `api_error` is on Anthropic's side — safe to resubmit as-is. The rest of the batch continues regardless.

---

**Q: Чому `custom_id` критично важливий?**
A: Результати повертаються не по порядку. Без `custom_id` неможливо зіставити відповідь із вхідними даними. Гарний custom_id = рядок що однозначно ідентифікує запит у твоїй системі (db row id, document id тощо).

---

**Q: Що відбувається при скасуванні батчу?**
A: Запити що вже почали оброблятись — завершуються і їх результати доступні. Ті що ще в черзі — скасовуються. `processing_status` переходить у `"canceling"`, потім у `"ended"`.

---

## Правила напам'ять

```
Batches API = 50% знижка, асинхронна обробка

Ліміти:
  100 000 запитів / батч
  256 MB / батч
  24 год deadline (зазвичай < 1 год)
  29 днів — термін зберігання результатів

Статуси батчу:   in_progress → ended (або canceling → ended)
Статуси запиту:  succeeded | errored | expired

Polling інтервал: 30–60 сек (малий батч), 5 хв (великий батч)

Коли використовувати:
  ✓ bulk classification / eval / data enrichment
  ✗ chatbots / streaming UI / real-time pipeline

custom_id — завжди унікальний, результати не по порядку
errored ≠ весь батч провалився, перевіряй request_counts окремо
```
