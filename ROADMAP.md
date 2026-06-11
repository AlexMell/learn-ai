# ROADMAP — AI Native Developer

> **Ціль:** закрити модулі 04–06 зі SPEC.md + дірки зі співбесіди (hooks, AI in CI/CD) і вийти на рівень AI Native інженера, який вміє все це руками.
>
> **Принцип:** кожна тема = код у репо + `/define` + `/update-review-app`. Без артефакта тема не закрита.
>
> **Темп:** одна задача за раз. Чекбокс ставиться тільки коли виконано Definition of Done.

---

## 🤖 Як працювати з цим файлом (інструкція для Claude Code)

Коли користувач викликає `/next-task`:
1. Прочитай цей файл, знайди **першу незакриту** задачу `[ ]` зверху вниз
2. Згенеруй файл завдання у відповідній папці у стилі існуючих `tasks/*.ts` — умова в коментарі зверху, код пише користувач сам
3. Якщо в задачі вказано `/define <topic>` — нагадай виконати після коду
4. Після того як користувач показав робочий код і він відповідає DoD — постав `[x]` у цьому файлі
5. Не генеруй більше однієї задачі за раз

Правила для користувача (нагадуй якщо порушує):
- Кожен рядок коду користувач може пояснити. Не може — розбираємо разом перед тим як рухатись далі
- Застряг на задачі > 2 днів → познач `?`, рухайся далі, повернешся
- Не починати наступний тиждень поки не закрито 80% поточного

---

## 📅 Тиждень 1 — Patterns: RAG руками (модуль 04)

**Мета тижня:** працюючий семантичний пошук по власних конспектах. Проєкт: **"Спитай свої конспекти"**.

### 1.1 Embeddings основи
- [ ] `04_patterns/01_embeddings.ts` — отримати embeddings для 5 текстів (Voyage AI або OpenAI), порахувати cosine similarity руками, вивести матрицю схожості
- [ ] Перевірити: схожі тексти ("пес"/"собака") дають similarity > 0.8, різні — < 0.5
- [ ] `/define embeddings-practice` (як отримати, скільки коштує, розмірності)

**DoD:** скрипт запускається, similarity числа відповідають інтуїції, можу пояснити що таке вектор і навіщо cosine.

### 1.2 Індексація в pgvector
- [ ] Створити таблицю в Supabase: `chunks (id, source, content, embedding vector(N))`
- [ ] `04_patterns/02_index_to_pgvector.ts` — прочитати всі `tutorial/definitions/*.md`, chunking 300–500 токенів з overlap 50, embeddings → insert у Supabase
- [ ] Створити SQL функцію `match_chunks` для ANN пошуку

**DoD:** `SELECT count(*) FROM chunks` повертає > 50 рядків, пошук по векторах працює з SQL.

### 1.3 RAG query
- [ ] `04_patterns/03_rag_query.ts` — CLI: питання → embedding → top-5 chunks → Claude відповідає тільки по контексту
- [ ] Eval: файл `04_patterns/eval/rag_questions.json` з 10 питаннями + очікуваним source файлом. Скрипт перевіряє чи retrieval знайшов правильний файл (retrieval accuracy)

**DoD:** retrieval accuracy ≥ 8/10. Можу намалювати pipeline на папері.

### 1.4 Retry + error handling
- [ ] `04_patterns/04_retry.ts` — обгортка callWithRetry з exponential backoff, розрізнення retryable/non-retryable помилок (патерн вже є в tool_use_practice.md — імплементувати і протестувати симуляцією помилок)

**DoD:** RateLimitError ретраїться 3 рази з backoff, BadRequestError падає одразу.

---

## 📅 Тиждень 2 — Agent у продакшн (модуль 05 = WOR-39)

**Мета тижня:** справжній агент, не навчальний. Маркетинг-агент WorldVote, який стане відповіддю на behavioral питання "розкажи про свого агента".

### 2.1 Скелет агента
- [ ] `05_agents/01_marketing_agent.ts` — agentic loop з tools: `get_question_of_day`, `get_vote_stats`, `generate_post`, `validate_content`, `publish_to_telegram` (спершу всі моки)
- [ ] MAX_ITERATIONS = 15, всі tool errors через `is_error: true`

**DoD:** агент проходить повний цикл на моках: питання → статистика → пост → валідація → "публікація".

### 2.2 Безпека агента
- [ ] Додати `detectLoop()` — порівняння підписів tool calls
- [ ] Додати cost budget: підрахунок $ після кожної ітерації, стоп при > $0.50
- [ ] Логування `AgentRun` (структура з agent_safety.md): run_id, iterations, tokens, tool_calls, cost → JSON файл

**DoD:** можу показати лог реального run і пояснити кожне поле. Штучно зациклений агент зупиняється сам.

### 2.3 Gate + HITL
- [ ] `validate_content` як справжній gate: окремий Claude виклик оцінює пост (spam score, довжина, тон) — якщо погано, агент регенерує
- [ ] HITL: перед `publish_to_telegram` агент викликає `request_human_approval` — підтвердження в консолі

**DoD:** агент не публікує без мого "y". Поганий пост відловлюється gate-ом.

### 2.4 Підключити реальний Telegram
- [ ] Замінити мок `publish_to_telegram` на реальний Telegram Bot API (це і є деплой WOR-39)
- [ ] `/define production-agent` (мій агент: патерн, безпека, що пішло не так)

**DoD:** пост реально з'являється в Telegram каналі. Є 5-хвилинна історія "як я будував агента".

---

## 📅 Тиждень 3 — MCP сервер + Claude Code майстерність

**Мета тижня:** написати свій MCP сервер + закрити дірку зі співбесіди про hooks.

### 3.1 Власний MCP сервер
- [ ] Окремий проєкт `worldvote-mcp`: tools `get_question_of_day`, `get_results_by_date`; resource `worldvote://stats` (покроковий гайд вже є в mcp_architecture.md)
- [ ] Підключити в Claude Desktop / Claude Code, перевірити що tools викликаються
- [ ] Пам'ятати: console.error для логів, не console.log!

**DoD:** питаю Claude Desktop "які результати голосування вчора" — він викликає мій сервер.

### 3.2 Claude Code Hooks ⭐ (дірка зі співбесіди)
- [ ] Прочитати доку: hooks = детерміновані shell-команди на події життєвого циклу (PreToolUse, PostToolUse, UserPromptSubmit, Stop), конфіг у settings.json
- [ ] Практика 1: PostToolUse hook у learn-ai — після кожної правки .ts запускається `tsc --noEmit`
- [ ] Практика 2: PreToolUse hook — блокування редагування `.env` (exit code 2)
- [ ] `/define claude-code-hooks` + `/update-review-app`

**DoD:** обидва hooks реально працюють. Interview answer напам'ять: "Hooks are deterministic shell commands on lifecycle events — unlike CLAUDE.md instructions, they're guaranteed to run. I use them for auto-typechecking and protecting sensitive files."

### 3.3 Subagents + headless
- [ ] Створити один subagent у `.claude/agents/` (наприклад code-reviewer зі своїм system prompt)
- [ ] Спробувати headless: `claude -p "summarize NOTES.md"` — зрозуміти що це будівельний блок для CI/CD
- [ ] `/define claude-code-advanced` (commands vs skills vs hooks vs subagents — таблиця коли що)

**DoD:** можу пояснити різницю між усіма чотирма механізмами розширення Claude Code.

---

## 📅 Тиждень 4 — AI in CI/CD ⭐ + Production (модуль 06)

**Мета тижня:** закрити другу дірку зі співбесіди і вміти розповісти про production AI.

### 4.1 AI код-рев'ю на PR
- [ ] Додати в WorldVote GitHub Action з Claude Code Action: на кожен PR — AI рев'ю коментарем
- [ ] Зробити тестовий PR з навмисним багом — перевірити що рев'ю його ловить

**DoD:** скріншот AI-коментаря на реальному PR.

### 4.2 Evals as tests ⭐ (найсильніша відповідь на співбесіді)
- [ ] Взяти промпт share-картки WorldVote, зробити тест-сет 10 кейсів (input → критерії: format compliance, довжина, hashtag)
- [ ] Скрипт `eval_share_prompt.ts` — запускає тест-сет, рахує метрики, exit code 1 якщо нижче baseline
- [ ] Підключити в GitHub Actions: промпт змінився → eval запускається → червоний пайплайн якщо деградація

**DoD:** навмисно зіпсований промпт валить CI. Interview answer: "Prompts are versioned and tested like code — eval suite runs in CI, deployment is blocked if accuracy drops below baseline."

### 4.3 Headless у пайплайні
- [ ] GitHub Action крок: `claude -p` генерує changelog з диफу при релізі (або коміт-повідомлення)
- [ ] `/define ai-in-cicd` (4 юзкейси: PR review, headless generation, evals as tests, security scan) + `/update-review-app`

**DoD:** один реальний автозгенерований changelog у репо.

### 4.4 Production checklist
- [ ] `06_production/01_cost_monitoring.ts` — обгортка над client що логує tokens + cost кожного виклику в JSON
- [ ] Prompt versioning: винести промпти WorldVote в окремі файли `prompts/v1/...` з changelog
- [ ] `/define production-ai` (caching стратегія, fallbacks, cost monitoring, versioning)

**DoD:** можу відповісти "що робиш коли API падає" конкретним кодом, не теорією.

---

## 🏁 Фінальний чек (після 4 тижнів)

- [ ] Можу за 5 хвилин розповісти про свого агента з реальними логами
- [ ] Можу написати tool loop з нуля без підглядання
- [ ] Маю власний MCP сервер у портфоліо
- [ ] Hooks і AI in CI/CD — закриті, є interview answers напам'ять
- [ ] Review app поповнений новими топіками: hooks, ai-cicd, production-agent, embeddings
- [ ] WOR-39 задеплоєний і працює щодня

> *Я не оцінюю себе за швидкістю. Я закриваю задачі, не відкриваю нові.*
