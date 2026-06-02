# Notes

Personal knowledge base — things learned, found online, worth remembering.

---

## Claude Code: `.claude/commands/` vs `.claude/skills/`

**commands/** — prompt shortcuts
- Файл стає промптом, який Claude отримує тільки в момент виклику `/command-name`
- Claude не знає про них до виклику
- Підходить для: простих одноразових промптів, шаблонів

**skills/** — structured workflows
- Завантажуються в системний контекст на початку кожної сесії (видно у `system-reminder` як "available skills")
- Claude може проактивно запропонувати skill коли бачить відповідну ситуацію
- Підходить для: multi-step workflows, складних автоматизацій

**Правило**: використовуй `skills/` для складних workflows де хочеш проактивну поведінку; `commands/` для простих prompt-шаблонів.

---

## Tokens

- 1 токен ≈ 4 символи (англ.) ≈ 0.75 слова
- Кирилиця = 2–3x більше токенів ніж латиниця (UTF-8: 2 байти на символ → fallback на байтовий рівень)
- Output токени дорожчі за input у 3–5x — генерація авторегресивна (один forward pass на токен)
- Prompt caching: byte-identical текст + мінімум 1024 токени → ~10% від звичайної ціни
- `countTokens()` перед великим запитом — дешевше ніж отримати помилку 400

---

## Як LLM генерує текст

- Next token prediction: logits → softmax → sampling → наступний токен → повторити
- Temperature ділить logits до softmax: `T < 1` → гостріший розподіл, `T > 1` → плоскіший
- Top-p обрізає хвіст розподілу після temperature. Міняй або temperature, або top-p — не обидва
- CoT ("Think step by step") підвищує точність на логічних задачах на 30–50%
- Галюцинація — структурна проблема: немає варіанту "я не знаю", є лише розподіл ймовірностей

---

## Context Window та великі документи

- Lost in the middle: важлива інформація посередині = гірша якість attention
- Правило розміщення: критичне → system prompt або кінець user message
- Для продакшену з великими документами: RAG >> "засунути все в контекст"
- History в multi-turn росте → зберігати останні 10–20 повідомлень або стискати у summary
- max_tokens резервується з context window: 200k input + 64k max_tokens = реальний ліміт для input 136k

---

## System Prompt

- Anthropic API: `system` — окреме поле, НЕ в `messages[]` (відрізняється від OpenAI де `{ role: "system" }`)
- Правило розподілу: "однаково для всіх запитів?" → system; "специфічне для цього запиту?" → user
- System prompt НЕ секретний — модель може розкрити його вміст. Не зберігай credentials
- Великий system prompt → prompt caching з `cache_control: { type: "ephemeral" }`
- Prompt injection: ніколи не interpolate user input у system prompt без санітизації

---

## Prompting

- Порядок спроб: zero-shot → few-shot → CoT → role → комбінувати
- Few-shot: 3–5 прикладів оптимально; якість > кількість; останній приклад впливає найбільше
- Role prompting: конкретна роль > загальна ("senior security engineer" > "expert")
- Одна зміна за раз — інакше не зрозуміло що дало покращення

---

## Structured Output

- Рівні гарантії JSON: system prompt → few-shot → prefill `{` → retry loop → tool use (max)
- Assistant prefill: `{ role: "assistant", content: "{" }` — модель не може почати інакше
- Tool use з JSON Schema — архітектурно найнадійніший: неправильний тип/відсутнє поле неможливі
- XML теги для промпту (`<document>`, `<task>`), JSON для виводу в JS/TS код
- НЕ поєднувати CoT з JSON prefill — конфлікт: модель хоче думати, але стартова точка вже `{`

---

## Prompt Evaluation

- "На око" — не метрика. Тест-сет мінімум 20+ прикладів, 100+ для надійності
- Метрики: accuracy, consistency, cost (токени × ціна × об'єм), format compliance
- Одна зміна за раз → порівняти на повному тест-сеті → деплой лише якщо краще за baseline
- Holdout set (20–30%) не дивитись під час ітерацій → захист від overfitting промпту
- LLM-as-Judge: запускати з обома порядками (A→B і B→A) через positional bias
- Після деплою: ongoing monitoring — розподіл даних змінюється, промпт може деградувати
