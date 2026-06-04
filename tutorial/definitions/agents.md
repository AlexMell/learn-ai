# Agents — AI агенти

> **Interview answer (English):**
> An AI agent is an LLM that runs in a loop: it receives a goal, decides what action to take (call a tool, search, write code), executes it, observes the result, and repeats until the goal is achieved or it gives up. The key difference from a chatbot: a chatbot responds once per message; an agent autonomously drives a multi-step process. The loop is: Think → Act → Observe → Think → Act → … until `end_turn` with no tool calls.

---

## Поясни 7-річному

Уяви що ти просиш друга: "Знайди мені найдешевший квиток до Парижа і забронюй." Чат-бот скаже: "Ось сайти де шукати." Агент — сам відкриє браузер, пошукає на кількох сайтах, порівняє ціни, заповнить форму і скаже: "Готово, квиток за €240." Агент діє, а не тільки відповідає.

---

## Чат-бот vs Агент

| | Чат-бот | Агент |
|---|---|---|
| **Скільки кроків** | 1 запит → 1 відповідь | N кроків до досягнення мети |
| **Хто вирішує що далі** | Людина | Модель сама |
| **Чи використовує tools** | Іноді, 1 раз | Так, в циклі, багато разів |
| **Стан між кроками** | Немає | Є (history, змінні стани) |
| **Коли зупиняється** | Після відповіді | Коли ціль досягнута або MAX_ITERATIONS |
| **Приклад** | "Що таке RAG?" | "Проаналізуй мій репо і відкрий PR з фіксами" |

---

## Архітектура агента: LLM + Tools + Loop

```
┌─────────────────────────────────────────────────┐
│                    AGENT LOOP                   │
│                                                 │
│  ┌──────────┐    think     ┌──────────────────┐ │
│  │          │ ──────────→  │   LLM (Claude)   │ │
│  │  Memory  │              │                  │ │
│  │(messages)│ ←──────────  │  stop_reason:    │ │
│  └──────────┘    observe   │  "tool_use"  or  │ │
│        ↑                   │  "end_turn"  ✓   │ │
│        │                   └────────┬─────────┘ │
│        │                            │ tool call  │
│        │                   ┌────────▼─────────┐ │
│        └───────────────────│   Tool Executor  │ │
│              result        │  (your code)     │ │
│                            └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

Три компоненти:
- **LLM** — мозок: вирішує що робити, аналізує результати
- **Tools** — руки: реальні дії (пошук, DB, API, запуск коду)
- **Loop** — серце: запускає циклічно поки `stop_reason !== "end_turn"`

---

## ReAct Pattern

**ReAct = Reasoning + Acting** — найпоширеніший патерн агентів (Google Research, 2022).

Модель по черзі:
1. **Reason** — думає вголос (scratchpad, extended thinking)
2. **Act** — викликає tool або генерує відповідь
3. **Observe** — отримує результат tool
4. → повертається до кроку 1

```
User: "Скільки відкритих PR у репо worldvote-app?"

[Reason]  Треба дізнатись кількість PR. Використаю github tool.
[Act]     list_pull_requests({ repo: "worldvote-app", state: "open" })
[Observe] [{ id: 1, title: "Add map clustering" }, { id: 2, title: "Fix auth" }]
[Reason]  Є 2 відкритих PR. Можу відповісти.
[Act]     "У репо worldvote-app є 2 відкритих PR: ..."
```

В коді ReAct виглядає просто як agentic loop — Claude сам виконує reasoning в прихованому тексті (або через extended thinking), а ти лише обробляєш tool calls.

---

## Мінімальний агент на TypeScript

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_ITERATIONS = 10;

async function runAgent(userGoal: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userGoal },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    // Ціль досягнута — LLM вирішив зупинитись
    if (response.stop_reason === "end_turn") {
      const text = response.content.find((b) => b.type === "text");
      return text?.type === "text" ? text.text : "";
    }

    // Виконуємо всі tool calls і збираємо результати
    const results: Anthropic.ToolResultBlockParam[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((block) => ({
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: executeTool(block.name, block.input as Record<string, unknown>),
      }));

    messages.push({ role: "user", content: results });
  }

  throw new Error(`Agent did not complete after ${MAX_ITERATIONS} iterations`);
}
```

Повний агентний цикл: `02_tools/02_tool_loop.ts`

---

## Planning vs Execution

Складні агенти розділяють роботу на дві фази:

### Planning (планування)
LLM отримує ціль і генерує покроковий план — **до** виконання.

```ts
const planResponse = await client.messages.create({
  model: "claude-sonnet-4-6",
  system: "You are a planning assistant. Break the goal into concrete steps.",
  messages: [{ role: "user", content: `Goal: ${goal}. List the steps.` }],
  max_tokens: 1024,
});
// → "1. Fetch open issues. 2. Prioritize by label. 3. Assign to milestone."
```

### Execution (виконання)
LLM виконує кожен крок плану, можливо викликаючи tools.

```ts
for (const step of plan) {
  const result = await runAgent(step); // окремий agent loop на кожен крок
  context.push({ step, result });
}
```

### Коли що використовувати

```
Простий агент (без explicit planning):
  ✓ Ціль конкретна і зрозуміла ("знайди ціну на AAPL")
  ✓ Кроків мало (< 5)
  ✓ Помилка одного кроку не критична

Planning → Execution:
  ✓ Довготривалі завдання (десятки кроків)
  ✓ Потрібне підтвердження плану від юзера
  ✓ Кроки залежать один від одного і треба бачити картину цілком
  ✓ Паралельне виконання кроків
```

---

## Worldvote.app — приклади агентів

### 1. Агент модерації контенту

```ts
// Мета: автоматично модерувати коментарі до голосувань
const moderationAgent = async (comment: string, context: VoteContext) => {
  const messages = [{
    role: "user",
    content: `Comment: "${comment}"\nVote topic: "${context.title}"\nCheck this comment.`,
  }];

  // Tools: check_toxicity, check_spam, get_user_history, flag_comment, approve_comment
  const result = await runAgent(messages, moderationTools);
  return result; // "approved" | "flagged" | "deleted"
};
```

### 2. Агент генерації питань для голосування

```ts
// Мета: згенерувати якісне запитання для голосування по темі
// Tools: search_recent_news, get_trending_topics, check_duplicate_votes, validate_question
const questionAgent = async (topic: string) => {
  return runAgent(
    `Generate a fair, engaging voting question about: "${topic}". 
     Check for duplicates first. Validate the question quality.`,
    [searchNews, checkDuplicates, validateQuestion, createVote]
  );
};
```

### 3. Агент аналізу результатів

```ts
// Мета: аналізувати результати голосування і генерувати insights
// Tools: get_vote_results, get_demographic_breakdown, get_country_comparison, generate_summary
const analyticsAgent = async (voteId: string) => {
  return runAgent(
    `Analyze vote ${voteId}: find interesting patterns, regional differences, 
     demographic trends. Generate a 3-paragraph summary.`,
    analyticsTools
  );
};
```

---

## Типи агентної пам'яті

```
In-context memory (messages[])
  → все що є в поточній розмові
  → обмежено context window
  → зникає після сесії

External memory (DB, vector store)
  → довготривала пам'ять між сесіями
  → RAG для релевантного контексту
  → Worldvote: профіль юзера, його голоси, вподобання

Episodic memory
  → "що я робив у цій сесії"
  → реалізується через короткий summary в system prompt

Semantic memory
  → факти, знання про світ
  → vector embeddings + пошук
```

---

## Підводні камені (Gotchas)

### 1. Нескінченний цикл → MAX_ITERATIONS обов'язково
```ts
// ❌ Без ліміту агент може крутитись вічно (і спалити весь бюджет)
while (response.stop_reason === "tool_use") { ... }

// ✓ З лімітом
for (let i = 0; i < MAX_ITERATIONS; i++) { ... }
if (i === MAX_ITERATIONS) throw new Error("Agent exceeded limit");
```

### 2. Tool помилки не зупиняють агента
Агент отримує помилку як `tool_result` з `is_error: true` і може спробувати інакше. Це корисно — але треба стежити щоб він не зациклився на помилці.

### 3. Context window росте з кожним кроком
Довгий агентний цикл швидко заповнює контекст. Стратегії: summarization між кроками, обрізка старих кроків, prompt caching.

### 4. Агент може "галюцинувати" дії
Модель може вигадати що tool був успішний коли він провалився. Завжди парс реальний результат, не довіряй тільки тексту в думках моделі.

### 5. Паралельність ≠ безпека
Якщо кілька агентів пишуть в одну БД — потрібні locks або оптимістичний конкурентний контроль. Агент не знає про інших агентів.

### 6. Дорого — агент = N API запитів
Один агентний run може коштувати у 10-50 разів більше ніж простий запит. Логуй кількість ітерацій і вартість, встановлюй бюджети.

---

## Interview Q&A

**Q: What is an AI agent and how does it differ from a chatbot?**
A: An agent is an LLM running in an autonomous loop: it receives a goal, decides which tool to call, executes it, observes the result, and repeats until done. A chatbot does one request → one response, and a human drives the next step. The critical difference is autonomy: an agent drives multi-step processes on its own, using tools to interact with the real world.

---

**Q: Що таке ReAct pattern?**
A: ReAct (Reasoning + Acting) — патерн де модель чергує між "думанням вголос" і виконанням дій (tool calls). Спершу модель пише своє міркування (Reason), потім робить конкретний крок (Act), потім спостерігає результат (Observe) — і цикл повторюється. В Claude це природньо реалізується через extended thinking + tool use в agentic loop.

---

**Q: Як реалізувати planning у агента?**
A: Двофазно: спочатку окремий запит де модель генерує план (список кроків) без виконання; потім виконання — кожен крок як окремий agent run або prompt. Planning корисний коли задача складна, коли юзер хоче підтвердити план, або коли кроки можна виконувати паралельно.

---

**Q: Як запобігти нескінченному циклу агента?**
A: Завжди встановлюй `MAX_ITERATIONS` (зазвичай 10-20) і кидай error якщо агент не завершив. Також: логуй кожну ітерацію, встанови бюджет токенів, моніторь чи агент прогресує (якщо він двічі робить той самий tool call — щось пішло не так).

---

**Q: Яка різниця між in-context та external memory агента?**
A: In-context memory — це `messages[]` в поточній сесії: швидко, але обмежено context window і зникає після. External memory — база даних або vector store: персистентна між сесіями, але потребує явного запиту (RAG). Для агента в продакшені поєднують обидва: external для довготривалої пам'яті, in-context для поточної сесії.

---

## Правила напам'ять

```
Агент = LLM + Tools + Loop

Цикл:
  Think (LLM) → Act (tool call) → Observe (tool result) → Think → ...
  Зупиняється: stop_reason === "end_turn" (без tool calls)

Обов'язково:
  MAX_ITERATIONS = 10-20          ← без нього можливий нескінченний цикл
  is_error: true для помилок      ← модель коригує підхід
  log кожну ітерацію              ← дебаг агента без логів = пекло

ReAct = Reason + Act + Observe   ← чергування думок і дій

Planning vs Execution:
  Planning  → генерує план (один запит, без tools)
  Execution → виконує кожен крок (окремий agent loop)
  Коли ділити: > 5 кроків, залежності між ними, потрібне підтвердження

Пам'ять:
  In-context  → messages[], обмежено context window, тимчасово
  External    → DB/vector store, персистентно, потребує RAG запиту

Worldvote агенти:
  Модерація    → перевірка коментарів через кілька tools
  Генерація    → питання для голосування з перевіркою дублікатів
  Аналітика    → insights з результатів голосувань

Вартість:
  1 agent run ≈ N × вартість одного запиту
  Логуй iterations і tokens/run
```
