# Agent Patterns — Архітектурні патерни агентів

> **Interview answer (English):**
> Anthropic identifies four core agent patterns: tool-using agent (single LLM in a loop with tools), prompt chaining (sequential steps where each output feeds the next), orchestrator-subagents (one LLM plans and dispatches to specialized workers), and multi-agent systems (fully independent agents with separate contexts). The rule: start with the simplest pattern that solves the problem — over-engineering to orchestrator when a tool loop suffices is the most common mistake.

## Поясни 7-річному

Уяви що ти директор проекту. Прості завдання — береш інструменти і робиш сам. Складні — розбиваєш на кроки, де кожен крок залежить від попереднього. Дуже складні — наймаєш спеціалістів і координуєш їх. Ось і всі патерни: "сам з інструментами", "сам але покроково", "ти + команда."

---

## Огляд патернів (від простого до складного)

```
Складність ↑
│
│  4. Multi-agent          — кілька незалежних агентів зі своїми контекстами
│  3. Orchestrator         — один диригент + виконавці-LLM
│  2. Multi-step / Chaining— послідовні залежні кроки
│  1. Tool-using agent     — один LLM + tools + loop
│
└── Простота ↓
```

**Правило: починай з найпростішого що вирішує задачу.**

---

## 1. Tool-using Agent

Базовий патерн — одна модель з набором tools в agentic loop.

```
Goal → LLM → tool_use → execute → observe → LLM → ... → end_turn
```

**Коли:** задача в 1–5 кроків, tools прості, немає залежностей між підзадачами.

```ts
async function toolAgent(goal: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];

  for (let i = 0; i < 10; i++) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });
    if (res.stop_reason === "end_turn") return res;

    const results = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({
        type: "tool_result" as const,
        tool_use_id: b.id,
        content: executeTool(b.name, b.input as Record<string, unknown>),
      }));

    messages.push({ role: "user", content: results });
  }
  throw new Error("MAX_ITERATIONS exceeded");
}
```

**Приклади:** агент перевірки погоди, калькулятор, пошук по БД.

---

## 2. Multi-step Agent (Prompt Chaining)

Задача розбивається на **послідовні кроки**, де вихід одного — вхід наступного.

```
Input → [Step 1: LLM] → output1 → gate? → [Step 2: LLM] → output2 → ... → Result
```

**Gate** — валідація між кроками. Якщо крок 2 отримав сміттєвий вихід кроку 1 — зупиняємо раніше, не ламаємо кроки 3–5.

**Коли:** фази залежать одна від одної, хочемо перевіряти якість між кроками.

```ts
async function analyzeAndReply(resumeText: string) {
  // Крок 1: витягти факти
  const factsRes = await client.messages.create({
    model: "claude-sonnet-4-6",
    system: "Extract name, skills, years of experience as JSON only.",
    messages: [{ role: "user", content: resumeText }],
    max_tokens: 512,
  });
  const facts = JSON.parse(extractText(factsRes));

  // Gate: зупинитись рано якщо нічого не знайшли
  if (!facts.skills?.length) return { error: "No skills found" };

  // Крок 2: оцінити кандидата
  const evalRes = await client.messages.create({
    model: "claude-sonnet-4-6",
    system: "Rate fit for a senior TypeScript role. Return score 1-10 with reasoning.",
    messages: [{ role: "user", content: JSON.stringify(facts) }],
    max_tokens: 256,
  });

  // Крок 3: написати відповідь кандидату
  const replyRes = await client.messages.create({
    model: "claude-sonnet-4-6",
    system: "Write a professional reply based on the evaluation.",
    messages: [{ role: "user", content: extractText(evalRes) }],
    max_tokens: 512,
  });

  return { facts, evaluation: extractText(evalRes), reply: extractText(replyRes) };
}
```

**Приклади:** обробка резюме, генерація звіту по кроках, SEO pipeline.

---

## 3. Orchestrator Pattern

Один LLM — **оркестратор** — планує і делегує підзадачі **виконавцям** (workers). Workers можуть бути LLM або звичайним кодом.

```
            ┌────────────────────┐
            │    Orchestrator    │
            │  (планує + керує)  │
            └─────────┬──────────┘
                      │ делегує
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
 ┌─────────┐   ┌─────────┐   ┌─────────┐
 │ Worker1 │   │ Worker2 │   │ Worker3 │
 │  (LLM)  │   │  (код)  │   │  (LLM)  │
 └─────────┘   └─────────┘   └─────────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
            ┌────────────────────┐
            │   Orchestrator     │ ← агрегує, синтезує
            └────────────────────┘
```

**Коли:** підзадачі спеціалізовані й незалежні; оркестратор тримає загальний контекст, workers — ні.

```ts
// Workers виглядають як tools для оркестратора
const orchestratorTools: Anthropic.Tool[] = [
  {
    name: "research_topic",
    description: "Delegate deep research on a topic to a specialist agent.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: { type: "string" },
        depth: { type: "string", enum: ["brief", "detailed"] },
      },
      required: ["topic"],
    },
  },
  {
    name: "write_section",
    description: "Delegate writing of a report section to a writing agent.",
    input_schema: {
      type: "object" as const,
      properties: {
        section_title: { type: "string" },
        key_points: { type: "string" },
      },
      required: ["section_title", "key_points"],
    },
  },
];

async function executeWorker(name: string, input: Record<string, unknown>): Promise<string> {
  const systemPrompts: Record<string, string> = {
    research_topic: "You are a research specialist. Find and summarize key facts.",
    write_section: "You are a technical writer. Write clear, concise content.",
  };
  const res = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // дешевша модель для workers
    system: systemPrompts[name],
    messages: [{ role: "user", content: JSON.stringify(input) }],
    max_tokens: 1024,
  });
  return extractText(res);
}
```

**Приклади:** агент написання звітів, агент code review (планує → запускає linter worker, security worker, style worker).

---

## 4. Multi-agent System

Кілька **незалежних** агентів зі своїми контекстами і agentic loops, скоординованих зовнішнім кодом або черговим агентом.

```
  ┌──────────────────────────────────────────────┐
  │             Multi-agent System               │
  │                                              │
  │  Agent A (content writer)  ──────────────► │
  │  Agent B (fact checker)    ──────────────►  │ → агрегація
  │  Agent C (style reviewer)  ──────────────►  │
  │                                              │
  └──────────────────────────────────────────────┘
```

**Різниця від Orchestrator:**
- Orchestrator: центральний планувальник, виконавці — без власного loop
- Multi-agent: кожен агент — автономний, зі своєю history і memory

**Коли:** задача > одного context window; справжня ізоляція підзадач; паралельний запуск незалежних складних задач.

```ts
async function multiAgentCodeReview(files: string[]) {
  const [securityReport, perfReport, styleReport] = await Promise.all([
    // Кожен — незалежний agentic loop зі своїм context
    runAgent("security_expert", `Find security vulnerabilities:\n${files[0]}`),
    runAgent("perf_expert",     `Find performance issues:\n${files[1]}`),
    runAgent("style_expert",    `Review code style:\n${files[2]}`),
  ]);

  // Агрегація — може бути ще один LLM
  return synthesize([securityReport, perfReport, styleReport]);
}
```

---

## Порівняльна таблиця

| Патерн | Запитів до LLM | Паралельність | Складність | Коли |
|---|---|---|---|---|
| Tool-using | N (loop) | tool calls | Низька | 1–5 кроків |
| Multi-step | N (sequential) | Немає | Низька | Залежні фази |
| Orchestrator | 1 + N (workers) | Так (workers) | Середня | Спеціалізовані підзадачі |
| Multi-agent | N × M | Так (agents) | Висока | > context window, ізоляція |

---

## Який pattern у агента розсилки?

**Задача:** відправити персоналізовану email-розсилку про новий курс.

```
Input: "Відправ розсилку про новий курс AI"
         │
         ▼
[Step 1] get_subscribers()  → [{email, name, segment}, ...]
         │
         ▼
[Step 2] generate_content(segment) — PARALLEL tool calls
         ├── "beginners"   → subject + body A
         ├── "advanced"    → subject + body B
         └── "enterprise"  → subject + body C
         │
         ▼
[Gate]   validate_content() → якщо spam score > 5 → стоп
         │
         ▼
[Step 3] send_campaign(segment, content) → delivery stats
         │
         ▼
[Step 4] report_results()  → "Надіслано 1240 листів, open rate 34%"
```

### Відповідь: **Multi-step Agent**

Це лінійний pipeline з паралельними tool calls всередині одного кроку. Один агент справляється — не потрібно розбивати на окремі agentic loops.

```ts
const mailingAgentTools: Anthropic.Tool[] = [
  {
    name: "get_subscribers",
    description: "Fetch subscriber list. Returns [{email, name, segment}].",
    input_schema: {
      type: "object" as const,
      properties: {
        segment: { type: "string", description: "Optional segment filter" },
      },
      required: [],
    },
  },
  {
    name: "generate_email_content",
    description: "Generate subject + body for a specific audience segment.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic: { type: "string" },
        segment: { type: "string", enum: ["beginners", "advanced", "enterprise"] },
        tone: { type: "string", enum: ["formal", "casual"] },
      },
      required: ["topic", "segment"],
    },
  },
  {
    name: "send_campaign",
    description: "Send email campaign to a segment. Returns {sent, failed, open_rate}.",
    input_schema: {
      type: "object" as const,
      properties: {
        segment: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["segment", "subject", "body"],
    },
  },
];
```

**Коли розсилка стала б Orchestrator:**
- Orchestrator визначає стратегію кампанії
- Worker A: окремий agentic loop для A/B тестування subject lines
- Worker B: окремий loop для адаптації контенту на основі минулих кампаній
- Worker C: loop для аналізу результатів і follow-up стратегії

---

## Підводні камені (Gotchas)

### 1. Over-engineering — найчастіша помилка
Якщо multi-step вирішує задачу → не будуй orchestrator. Кожен рівень = більше токенів + latency + точок відмови.

### 2. Відсутність gate в chaining
Помилка на кроці 2 ламає кроки 3–5. Завжди валідуй вихід перед продовженням.

### 3. Контекст росте в оркестраторі
Передавай workers тільки необхідний контекст (summary або structured input), а не всю history оркестратора.

### 4. Shared state в multi-agent
Агенти не знають про стан одне одного. Потрібен shared store (Redis, Postgres) або передача результатів через координатора.

### 5. Multi-agent ≠ дешевше
N агентів = N × вартість одного запиту. Паралельні tool calls у одному агенті — майже завжди дешевший варіант.

---

## Interview Q&A

**Q: What are the main agent patterns and when do you choose each?**
A: Four patterns: tool-using agent — single LLM in a loop, best for simple tasks up to ~5 steps; prompt chaining — sequential steps where each output feeds the next, for dependent multi-phase pipelines; orchestrator — one LLM plans and dispatches to specialized workers, for complex tasks with independent subtasks; multi-agent — fully independent agents with separate contexts, for tasks that exceed one context window or need true isolation. Always start with the simplest pattern that works.

---

**Q: Чим відрізняється Orchestrator від Multi-agent?**
A: Orchestrator — ієрархія: центральний LLM планує і тримає загальний контекст, виконавці (workers) не мають власного agentic loop. Multi-agent — рівноправна мережа: кожен агент незалежний, має свій context window і власний loop, координація — через зовнішній код або окремий агент.

---

**Q: Який патерн у типового агента розсилки і чому?**
A: Multi-step agent. Розсилка — лінійний pipeline: отримати підписників → згенерувати контент для сегментів (паралельні tool calls в одному кроці) → валідація gate → відправити. Один агент справляється. Orchestrator потрібен лише якщо кожна підзадача сама по собі складний agentic loop — наприклад окремий агент для A/B тестування.

---

**Q: What is a "gate" in prompt chaining and why do you need it?**
A: A gate is a validation step between chaining steps. Before passing output from step N to step N+1, you check whether it meets quality criteria — is it valid JSON, are required fields present, is the result non-empty. Without gates, a bad output at step 2 silently corrupts steps 3–5, and you only discover the failure at the very end. Early failure is always cheaper than silent corruption.

---

**Q: When would you split one agent into a multi-agent system?**
A: When the task genuinely exceeds one context window; when subtasks need true isolation (agent A must not see agent B's context); or when you need per-agent fault tolerance — one failing shouldn't block others. Don't split just for parallelism — parallel tool calls within one agent achieve that at a fraction of the complexity and cost.

---

**Q: Як уникнути роздутого контексту в оркестраторі?**
A: Передавай workers тільки необхідний контекст, а не всю history. Worker повертає стислий результат — structured output або summary — а не повну conversation. Якщо pipeline довгий — compress попередні результати в один structured object між кроками. Оркестратор повинен бачити "що зроблено і який результат", а не "як саме worker це зробив."

---

## Правила напам'ять

```
Вибір патерну:
  1–5 кроків, прості tools              → Tool-using agent
  Залежні фази (B потребує результат A)  → Multi-step / Chaining
  Спеціалізовані незалежні підзадачі    → Orchestrator
  Задача > context window, ізоляція     → Multi-agent

Gates в chaining:
  Після кожного критичного кроку — валідація
  Помилка early >> сміттєвий кінець

Orchestrator vs Multi-agent:
  Orchestrator  → 1 планувальник + N виконавців (контекст у планувальника)
  Multi-agent   → N незалежних агентів (кожен has own context + loop)

Агент розсилки = Multi-step:
  get_subscribers → generate_content (parallel tool calls) → gate → send → report
  Orchestrator тільки якщо кожна фаза = окремий складний agentic loop

Вартість:
  Tool-using   → N API calls (sequential loop)
  Multi-step   → N calls (sequential, no overlap)
  Orchestrator → 1 + N worker calls (можна parallel)
  Multi-agent  → N × M calls (parallel, але множник N)

Антипатерн:
  ❌ Orchestrator коли multi-step достатньо
  ❌ Multi-agent коли parallel tool calls достатньо
  ❌ Відсутність gate в chaining pipeline
  ❌ Передача повної history оркестратора workers-у
```
