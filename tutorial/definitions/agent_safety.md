# Agent Safety — Контроль і безпека агентів

> **Interview answer (English):**
> Three layers protect a production agent: hard limits (MAX_ITERATIONS, token budget, per-run cost cap), human-in-the-loop checkpoints before irreversible actions, and structured logging of every decision and tool call. Without these, an agent can loop infinitely burning budget, take destructive actions silently, or fail in ways that are impossible to debug. The rule: treat an agent like untrusted code running in production — assume it will misbehave and build the fences before it does.

## Поясни 7-річному

Уяви що ти відправив робота на склад за товаром. Без обмежень — він може ходити по колу вічно якщо не знайде потрібну полицю, замовляти зайве або розбити щось цінне. Тому ти даєш йому: таймер (max iterations), правило "запитай мене перед тим як підписувати документи" (human in the loop), і журнал де він записує кожен крок (логування). Агент у коді — той самий робот.

---

## Проблеми агентів у продакшені

```
┌─────────────────────────────────────────────────────┐
│              Небезпеки агентного loop               │
│                                                     │
│  1. Зациклювання    → нескінченні API calls         │
│  2. Помилки tools   → агент плутається, спробує     │
│                        знову і знову                 │
│  3. Cost explosion  → N ітерацій × M токенів        │
│  4. Тихі помилки    → агент "успішно завершив"      │
│                        але зробив не те              │
│  5. Незворотні дії  → видалив файл, відправив email │
└─────────────────────────────────────────────────────┘
```

---

## 1. MAX_ITERATIONS — жорстка межа

Найважливіший захист. Без нього агент може виконувати тисячі запитів поки не вичерпає бюджет.

```ts
const MAX_ITERATIONS = 10; // розумний дефолт для більшості агентів

async function runAgent(goal: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "end_turn") return { success: true, result: res, iterations: i + 1 };

    const toolResults = executeTools(res);
    messages.push({ role: "user", content: toolResults });
  }

  // Не кидаємо виняток — повертаємо структуровану помилку
  return { success: false, error: "MAX_ITERATIONS exceeded", iterations: MAX_ITERATIONS };
}
```

**Скільки ставити:**

```
Прості агенти (пошук, lookup)      → 5–10
Середні (аналіз, генерація)        → 10–20
Складні (code agent, дослідження)  → 20–50
Ніколи                             → без ліміту
```

---

## 2. Виявлення зациклювання

MAX_ITERATIONS ловить нескінченний цикл, але не "стуктурне" зациклювання — коли агент повторює той самий tool call без прогресу.

```ts
type ToolCallSignature = string;

function detectLoop(messages: Anthropic.MessageParam[], windowSize = 3): boolean {
  // Збираємо підписи останніх tool calls
  const recentCalls: ToolCallSignature[] = [];

  for (const msg of messages.slice(-windowSize * 2)) {
    if (msg.role !== "assistant") continue;
    const blocks = Array.isArray(msg.content) ? msg.content : [];
    for (const block of blocks) {
      if (block.type === "tool_use") {
        recentCalls.push(`${block.name}:${JSON.stringify(block.input)}`);
      }
    }
  }

  if (recentCalls.length < 2) return false;

  // Якщо останній виклик вже зустрічався — це цикл
  const last = recentCalls[recentCalls.length - 1];
  return recentCalls.slice(0, -1).includes(last);
}

// В agentic loop:
if (detectLoop(messages)) {
  return { success: false, error: "Loop detected: agent repeating same tool call" };
}
```

---

## 3. Human in the Loop

Контрольні точки де агент **зупиняється і чекає підтвердження** перед виконанням незворотної дії.

```
Agent loop
    │
    ├── reversible action (read, search, compute) → виконуй сам
    │
    └── irreversible action (write, delete, send) → ЗУПИНИСЬ
                                                      │
                                                    спитай юзера
                                                      │
                                              ┌───────┴───────┐
                                           approved?       rejected?
                                              │                │
                                           виконуй          скасуй
```

**Реалізація через спеціальний tool:**

```ts
const confirmationTool: Anthropic.Tool = {
  name: "request_human_approval",
  description:
    "Call this before any irreversible action: sending emails, deleting data, " +
    "making purchases, posting publicly. Describe what you are about to do.",
  input_schema: {
    type: "object" as const,
    properties: {
      action: { type: "string", description: "What action you want to perform" },
      reason: { type: "string", description: "Why this action is needed" },
      reversible: { type: "boolean", description: "Can this action be undone?" },
    },
    required: ["action", "reason", "reversible"],
  },
};

// В executor — зупинити loop і показати юзеру
async function executeTools(
  blocks: Anthropic.ToolUseBlock[],
  onApprovalNeeded: (action: string) => Promise<boolean>
): Promise<Anthropic.ToolResultBlockParam[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.name === "request_human_approval") {
        const input = block.input as { action: string; reason: string; reversible: boolean };
        const approved = await onApprovalNeeded(
          `${input.action}\nReason: ${input.reason}`
        );
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: approved ? "Approved. Proceed." : "Rejected. Do not perform this action.",
        };
      }
      return {
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: executeTool(block.name, block.input as Record<string, unknown>),
      };
    })
  );
}
```

**Коли обов'язково ставити HITL:**

```
✓ Відправка повідомлень (email, Slack, SMS)
✓ Запис / видалення в БД або файловій системі
✓ Фінансові транзакції
✓ Публічний постинг (соцмережі, GitHub PR)
✓ Будь-що з production середовищем
```

---

## 4. Логування рішень

Агент без логів — чорна скринька. Коли щось піде не так — дебагувати неможливо.

**Мінімальна структура лога:**

```ts
interface AgentStep {
  iteration: number;
  timestamp: string;
  input_tokens: number;
  output_tokens: number;
  stop_reason: string;
  tool_calls: Array<{
    name: string;
    input: Record<string, unknown>;
    result: string;
    duration_ms: number;
    is_error: boolean;
  }>;
}

interface AgentRun {
  run_id: string;
  goal: string;
  started_at: string;
  finished_at: string;
  success: boolean;
  total_iterations: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  steps: AgentStep[];
  error?: string;
}
```

**В agentic loop:**

```ts
async function runAgentWithLogging(goal: string): Promise<AgentRun> {
  const runId = crypto.randomUUID();
  const run: AgentRun = {
    run_id: runId,
    goal,
    started_at: new Date().toISOString(),
    finished_at: "",
    success: false,
    total_iterations: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    estimated_cost_usd: 0,
    steps: [],
  };

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stepStart = Date.now();

    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      messages,
    });

    const step: AgentStep = {
      iteration: i + 1,
      timestamp: new Date().toISOString(),
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      stop_reason: res.stop_reason ?? "unknown",
      tool_calls: [],
    };

    run.total_input_tokens += res.usage.input_tokens;
    run.total_output_tokens += res.usage.output_tokens;

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "end_turn") {
      run.steps.push(step);
      run.success = true;
      run.total_iterations = i + 1;
      break;
    }

    const toolBlocks = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const results: Anthropic.ToolResultBlockParam[] = toolBlocks.map((block) => {
      const toolStart = Date.now();
      let result = "";
      let isError = false;

      try {
        result = executeTool(block.name, block.input as Record<string, unknown>);
      } catch (e) {
        result = `Error: ${e instanceof Error ? e.message : "unknown"}`;
        isError = true;
      }

      step.tool_calls.push({
        name: block.name,
        input: block.input as Record<string, unknown>,
        result,
        duration_ms: Date.now() - toolStart,
        is_error: isError,
      });

      return {
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: result,
        ...(isError && { is_error: true }),
      };
    });

    run.steps.push(step);
    messages.push({ role: "user", content: results });
  }

  // claude-sonnet-4-6: $3/M input, $15/M output (наближено)
  run.estimated_cost_usd =
    (run.total_input_tokens / 1_000_000) * 3 +
    (run.total_output_tokens / 1_000_000) * 15;
  run.finished_at = new Date().toISOString();

  console.log(JSON.stringify(run, null, 2)); // або відправ в DB / Datadog
  return run;
}
```

---

## 5. Контроль вартості (Cost Budget)

```ts
const COST_LIMIT_USD = 0.50; // ліміт на один run

// В agentic loop — перевіряємо після кожної ітерації
const currentCost =
  (run.total_input_tokens / 1_000_000) * 3 +
  (run.total_output_tokens / 1_000_000) * 15;

if (currentCost > COST_LIMIT_USD) {
  return {
    success: false,
    error: `Cost limit exceeded: $${currentCost.toFixed(4)} > $${COST_LIMIT_USD}`,
  };
}
```

**Приблизна вартість одного агентного run (claude-sonnet-4-6):**

```
Простий run (5 ітерацій, ~2k tokens кожна)    → ~$0.03
Середній run (15 ітерацій, ~5k tokens)         → ~$0.30
Важкий run (50 ітерацій, ~10k tokens кожна)    → ~$2.00+
```

---

## 6. Обробка помилок tools

Помилки tool не повинні падати — агент має отримати їх як `tool_result` і вирішити що робити.

```ts
function safeExecuteTool(
  name: string,
  input: Record<string, unknown>
): Anthropic.ToolResultBlockParam {
  try {
    const result = executeTool(name, input);
    return {
      type: "tool_result" as const,
      tool_use_id: (input as { id: string }).id,
      content: typeof result === "string" ? result : JSON.stringify(result),
    };
  } catch (error) {
    // is_error: true → Claude знає що це помилка і може скоригувати підхід
    return {
      type: "tool_result" as const,
      tool_use_id: (input as { id: string }).id,
      content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      is_error: true,
    };
  }
}
```

**Поведінка агента при `is_error: true`:**
- Спробує інші аргументи
- Спробує альтернативний tool
- Поверне помилку юзеру з поясненням

---

## Чеклист безпечного агента

```
Обов'язково:
  ✓ MAX_ITERATIONS встановлено (≤ 50)
  ✓ detectLoop() перевіряє повторювані виклики
  ✓ COST_LIMIT_USD встановлено і перевіряється
  ✓ Всі tool errors → is_error: true (не throw)
  ✓ Логується кожна ітерація (id, tokens, tool calls)

Для незворотних дій:
  ✓ request_human_approval tool в наборі
  ✓ System prompt чітко описує що потребує підтвердження

В production:
  ✓ run_id для кожного run (UUID)
  ✓ Зберігати AgentRun в DB (post-mortem аналіз)
  ✓ Алерти на runs що перевищують N ітерацій або $X
```

---

## Підводні камені (Gotchas)

### 1. `is_error` без опису — марно
```ts
// ❌ Claude не знає що сталось
content: "Error"

// ✓ Достатньо інформації щоб скоригувати
content: "Error: rate limit on weather API, retry after 60s"
```

### 2. Агент "успішно завершив" але нічого не зробив
`stop_reason === "end_turn"` не гарантує що мета досягнута. Логуй фінальний текст і перевіряй чи він відповідає очікуваному результату.

### 3. Human approval — синхронна затримка
Якщо чекаєш відповіді від юзера — тримаєш HTTP з'єднання або потребуєш webhook. В serverless (Vercel) — розбий на два запити з persistent state.

### 4. Логи ростуть разом з контекстом
Кожен step логує весь `block.input` і `result`. Для великих виводів (наприклад файлів) — скорочуй до перших 500 символів, зберігай повний вивід окремо.

### 5. detectLoop з `temperature > 0`
При ненульовій температурі аргументи можуть злегка відрізнятись навіть для одного й того ж виклику. Нормалізуй input перед порівнянням або порівнюй тільки назву tool без аргументів.

---

## Interview Q&A

**Q: How do you prevent an agent from running forever?**
A: Three layers: MAX_ITERATIONS as a hard loop counter (throw or return error when exceeded); loop detection that checks whether the last tool call signature was already seen in recent history; and a cost budget checked after each iteration. Any one of these catches a different failure mode — a slow diverging loop, a tight repeat cycle, or an expensive-but-progressing run.

---

**Q: Що таке Human in the Loop і коли він обов'язковий?**
A: HITL — це контрольна точка де агент зупиняється і чекає підтвердження від людини перед виконанням незворотної дії. Обов'язковий для: відправки повідомлень, запису або видалення даних, фінансових транзакцій, публічного постингу. Реалізується через спеціальний `request_human_approval` tool — агент сам вирішує коли його викликати на основі system prompt.

---

**Q: What should you log for every agent run and why?**
A: At minimum: run ID (for correlation), goal, iteration count, tokens per step, tool name + input + result + error flag per call, total cost estimate, and final success/failure. Without this, debugging a production failure means replaying the entire run from scratch. Logs also reveal cost outliers (one run using 10× normal tokens) and loop patterns before they become problems.

---

**Q: Що відбувається якщо tool кидає exception — треба ловити?**
A: Так, завжди. Якщо exception не спійманий — він вибиває весь agentic loop і агент не повертає жодного результату. Якщо спійманий і повернутий як `is_error: true` — агент отримує опис помилки і може скоригувати підхід: змінити аргументи, спробувати альтернативний tool, або пояснити юзеру що сталось.

---

**Q: How do you detect a stuck agent that's not quite infinite-looping?**
A: Track the signature (name + serialized input) of every tool call. If the last call's signature already appears in the last N calls — the agent is cycling. Alternatively, track whether any tool call succeeds (non-error result): if N consecutive calls all return errors, the agent is stuck. Both checks are O(N) and add negligible overhead.

---

**Q: Скільки ставити MAX_ITERATIONS?**
A: Залежить від задачі: прості lookup-агенти — 5–10, середні (аналіз, генерація з кількома кроками) — 10–20, складні code або research агенти — до 50. Правило: спочатку логуй реальну кількість ітерацій на успішних runs і встановлюй ліміт як 2× від 95-го перцентилю. Ніколи не ставити "без ліміту."

---

## Правила напам'ять

```
Три шари захисту агента:
  1. MAX_ITERATIONS    → жорстка межа кількості кроків
  2. detectLoop()      → перевірка повторюваних викликів
  3. COST_LIMIT_USD    → бюджет на один run

Human in the Loop:
  Незворотні дії → ЗУПИНИСЬ → спитай юзера
  Реалізація: request_human_approval tool в system prompt

Логування (обов'язково):
  run_id, goal, ітерація, токени, tool name + input + result + is_error, cost

Tool errors:
  ❌ throw exception → падає весь loop
  ✓  is_error: true + опис → агент коригує підхід

Виявлення циклу:
  Порівнюй "name:JSON.stringify(input)" останнього виклику з попередніми
  При temperature > 0 → порівнюй тільки name

Вартість (claude-sonnet-4-6):
  ~$3/M input tokens,  ~$15/M output tokens
  5 ітерацій × 2k tokens ≈ $0.03
  Перевіряй після кожної ітерації

MAX_ITERATIONS орієнтири:
  Прості агенти    → 5–10
  Середні          → 10–20
  Складні          → 20–50
  Ніколи           → без ліміту
```
