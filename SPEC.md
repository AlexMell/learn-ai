# SPEC.md — Навчальний план

## Мета

Розібратись як працює Claude API на практиці — від базових запитів до побудови агентів. Кожна тема закріплюється кодом (examples) + практикою (tasks) + поясненням (tutorial).

---

## Модулі

### ✅ 01 — Basics
Фундамент. Як влаштований API, як спілкуватись з моделлю.

- [x] Перший запит — `messages.create`, `content[]`, `stop_reason`, `usage`
- [x] Параметри — `temperature`, `max_tokens`, `stop_sequences`, `top_p`
- [x] System prompts — роль system prompt, stateless API, multi-turn history
- [x] Streaming — SSE, `for await`, `process.stdout.write`, `finalMessage()`
- [x] Token counting — що таке токен, `countTokens()`, context window, вартість

### ✅ 02 — Tools
Function calling — як модель взаємодіє з зовнішнім світом.

- [x] Simple tool — визначення tool, `tool_use` блок, `tool_result`
- [x] Agentic loop — цикл до `end_turn`, `MAX_ITERATIONS`, history
- [x] Multi-tools — кілька tools, паралельні виклики, `tool_choice`

### ✅ 03 — Advanced
Оптимізація і розширені можливості.

- [x] Prompt caching — `cache_control`, cache write vs read, TTL
- [x] Extended thinking — `budget_tokens`, thinking блоки, стрімінг
- [x] Vision — зображення через URL і base64, кілька зображень

### ✅ Definitions — Теоретична база + Interview prep
Конспекти для розуміння і підготовки до інтерв'ю. Є flashcard app для повторення.

- [x] Tokens — BPE, чому кирилиця дорожча, countTokens(), gotchas
- [x] Як LLM генерує відповідь — next token prediction, temperature, top-p, stop sequences, галюцинації
- [x] Context Window — lost in the middle, RAG стратегії, history management
- [x] System vs User Prompt — різниця ролей, що куди писати, prompt injection
- [x] Базові техніки промптингу — zero-shot, few-shot, CoT, role prompting
- [x] Structured Output — JSON гарантії, assistant prefill, tool use, XML теги
- [x] Prompt Evaluation — метрики, A/B тестування, LLM-as-judge, eval процес
- [x] Review App — `tutorial/definitions/review-app/index.html` (41 flashcard, 27 quiz)

---

## Далі — 04 — Patterns (в роботі)

Реальні патерни з продакшен застосунків.

- [x] Structured output — примусовий JSON через `tool_choice: "tool"` *(покрито в Definitions)*
- [ ] RAG (Retrieval-Augmented Generation) — повна реалізація: embeddings, vector search, retrieval
- [ ] Summarization loop — стиснення довгої history щоб не перевищити context window
- [ ] Retry та error handling — rate limits, timeout, `overloaded_error`
- [ ] Batch API — відправка багатьох запитів асинхронно, дешевше на 50%

## Далі — 05 — Agents

Побудова повноцінного агента з пам'яттю і плануванням.

- [ ] Memory — короткострокова (conversation) vs довгострокова (vector store)
- [ ] Planning — декомпозиція задачі на кроки перед виконанням
- [ ] Multi-agent — кілька моделей що взаємодіють між собою
- [ ] Human-in-the-loop — зупинка для підтвердження перед небезпечними діями

## Далі — 06 — Production

Що треба знати щоб запустити в продакшені.

- [ ] Cost optimization — яку модель коли використовувати, caching стратегії
- [ ] Observability — логування запитів, відстеження токенів, latency
- [ ] Prompt versioning — як керувати змінами в промптах
- [ ] Security — prompt injection, jailbreak, валідація input/output

---

## Формат кожної теми

```
examples/<тема>.ts            — робочий код з коментарями
tasks/<тема>.ts               — завдання: умова зверху, код пишеш сам
tutorial/<тема>.md            — пояснення що відбувається, підводні камені, терміни
tutorial/definitions/<тема>.md — концептуальний конспект + interview Q&A
```
