# MCP — Model Context Protocol

> **Interview answer (English):**
> MCP is an open standard created by Anthropic in 2024 that defines how AI models connect to external tools, data sources, and services. Think of it as USB-C for AI: instead of every app building custom integrations with every AI model, you write one MCP server and any MCP-compatible host — Claude Desktop, Cursor, your own app — can use it. The key difference from function calling is scope: function calling is ad-hoc per-request in your code; MCP is a reusable, shareable server that any host can connect to without code changes.

---

## Поясни 7-річному

Уяви що у тебе є ігрова консоль і багато контролерів від різних виробників. Раніше кожен контролер підходив лише до своєї консолі. Потім придумали USB-C — один стандартний роз'єм для всіх. MCP — це той самий USB-C, але для AI. Раніше кожна AI-програма по-своєму підключалась до GitHub, до бази даних, до Slack. Тепер — є один стандарт: написав один "перехідник" (MCP сервер) і він працює з будь-якою AI-програмою.

---

## Хто створив і для чого

**Anthropic** опублікувала MCP у листопаді 2024 як відкритий стандарт (open source, MIT ліцензія).

**Проблема яку вирішує:**

```
БЕЗ MCP — N×M проблема:
  Claude    → своя інтеграція з GitHub
  Claude    → своя інтеграція з Postgres
  Cursor    → своя інтеграція з GitHub   (дублювання!)
  Cursor    → своя інтеграція з Postgres (дублювання!)
  Windsurf  → своя інтеграція з GitHub   (дублювання!)
  ...

З MCP — N+M рішення:
  GitHub MCP сервер    → підключається до будь-якого хоста
  Postgres MCP сервер  → підключається до будь-якого хоста
  Claude Desktop ──┐
  Cursor        ───┼── підключаються до будь-якого сервера
  Windsurf      ───┘
```

**Мета:** стандартизувати шар між AI і зовнішнім світом, щоб екосистема розвивалась без vendor lock-in.

---

## Архітектура: Host → Client → Server

```
┌─────────────────────────────────────────┐
│              HOST                       │
│  (Claude Desktop, Cursor, твій застосунок)│
│                                         │
│  ┌──────────────┐                       │
│  │  MCP Client  │  ←── вбудований в host│
│  └──────┬───────┘                       │
└─────────┼───────────────────────────────┘
          │  MCP Protocol (JSON-RPC 2.0)
          │  Transport: stdio або HTTP/SSE
          │
┌─────────┼───────────────────────────────┐
│  ┌──────┴───────┐                       │
│  │  MCP Server  │  ← твій або готовий   │
│  └──────────────┘                       │
│                                         │
│  Exposes:                               │
│   • Tools     — функції (як tool use)  │
│   • Resources — файли, БД, API дані    │
│   • Prompts   — шаблони промптів       │
│              SERVER                     │
└─────────────────────────────────────────┘
```

### Три компоненти

**Host** — застосунок що запускає AI і підключається до серверів.
Приклади: Claude Desktop, Claude Code, Cursor, Windsurf, VS Code + Copilot.

**MCP Client** — вбудований в host, керує з'єднаннями і трансляцією між AI і серверами. Один host може мати кілька клієнтів (по одному на кожен підключений сервер).

**MCP Server** — окремий процес або сервіс що надає інструменти. Може бути локальним (stdio) або віддаленим (HTTP).

---

## Що MCP сервер може надавати

| Тип | Що це | Аналог |
|---|---|---|
| **Tools** | Функції що модель може викликати | Function calling |
| **Resources** | Дані для читання: файли, БД записи, URL | Context/RAG |
| **Prompts** | Готові шаблони промптів з параметрами | Prompt templates |

---

## MCP vs Function Calling — детальне порівняння

| | Function Calling | MCP |
|---|---|---|
| **Хто визначає tools** | Ти в коді кожного запиту | MCP сервер (один раз) |
| **Область дії** | Один запит, один застосунок | Будь-який сумісний host |
| **Транспорт** | Вбудований в API | stdio або HTTP/SSE |
| **Повторне використання** | Тільки якщо скопіюєш код | Підключив — і готово |
| **Хто виконує функцію** | Твій код | MCP сервер (окремий процес) |
| **Стандарт** | Специфічний для кожного провайдера | Відкритий протокол |
| **Коли використовувати** | Логіка специфічна для твого застосунку | Загальні інструменти що хочеш шерити |

### Коли що обирати

```
Function Calling → коли:
  ✓ Tool специфічний для твого бізнес-домену
  ✓ Логіка вже в твоєму коді (DB запити, внутрішнє API)
  ✓ Не потрібно шерити між застосунками

MCP → коли:
  ✓ Хочеш підключити стандартний сервіс (GitHub, Slack, Postgres)
  ✓ Один і той самий tool потрібен в кількох AI застосунках
  ✓ Хочеш використати готовий MCP сервер з екосистеми
  ✓ Будуєш інструмент для розробників
```

---

## Реальні MCP сервери (екосистема)

```
Офіційні від Anthropic:
  @modelcontextprotocol/server-filesystem  — читання/запис файлів
  @modelcontextprotocol/server-github      — репозиторії, issues, PRs
  @modelcontextprotocol/server-postgres    — SQL запити
  @modelcontextprotocol/server-slack       — повідомлення, канали
  @modelcontextprotocol/server-google-drive — файли Google Drive

Від спільноти:
  mcp-server-supabase   — Supabase DB + Auth
  mcp-server-notion     — Notion сторінки і бази
  mcp-server-linear     — issues і проекти
  mcp-obsidian          — нотатки Obsidian
  ...тисячі інших на github.com/modelcontextprotocol/servers
```

---

## Як підключити MCP в Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/alex/Projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

Після перезапуску Claude Desktop бачить tools з цих серверів і може їх викликати автоматично.

---

## Як виглядає MCP сервер зсередини (спрощено)

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "weather", version: "1.0.0" });

// Реєструємо tool — те саме що tool schema в function calling
server.tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string(), unit: z.enum(["celsius", "fahrenheit"]).optional() },
  async ({ city, unit = "celsius" }) => {
    const data = await fetchWeatherAPI(city);
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
    };
  }
);

// Запускаємо через stdio (локальний процес)
const transport = new StdioServerTransport();
await server.connect(transport);
```

Хост (Claude Desktop) запускає цей процес і спілкується з ним через stdin/stdout по JSON-RPC 2.0.

---

## Транспорти

| Транспорт | Коли використовувати |
|---|---|
| **stdio** | Локальний сервер (окремий процес на машині) |
| **HTTP + SSE** | Віддалений сервер (хмарний сервіс) |

stdio — простіший і безпечніший для локальних інструментів. HTTP/SSE потрібен коли сервер розгорнуто в хмарі і кілька користувачів підключаються одночасно.

---

## Підводні камені (Gotchas)

### 1. MCP сервер — окремий процес, не частина твого застосунку
Він запускається хостом (Claude Desktop), а не твоїм кодом. Якщо сервер впав — хост може не повідомити одразу, tools просто перестануть працювати.

### 2. stdio транспорт — без мережі, лише локально
stdio сервер не доступний з інтернету. Для продакшн API потрібен HTTP транспорт з авторизацією.

### 3. Версії протоколу ще активно змінюються (2024–2025)
MCP молодий. API може змінюватись між версіями SDK. Фіксуй версію пакету в `package.json`.

### 4. Авторизація — на тобі
MCP протокол не визначає авторизацію вбудовано. Для HTTP серверів треба самостійно реалізувати auth (API ключі, OAuth).

### 5. Resources ≠ Tools — різне призначення
Resources — для контексту (читання даних). Tools — для дій (виконання операцій). Плутати їх = погана UX для моделі.

---

## Interview Q&A

**Q: What is MCP and why was it created?**
A: MCP is an open protocol created by Anthropic in November 2024 to standardize how AI models connect to external tools and data. Before MCP, every AI app built custom integrations — N apps × M services = N×M duplicated work. MCP reduces this to N+M: write one server, any compatible host can use it.

---

**Q: Яка різниця між MCP і function calling?**
A: Function calling — ти сам визначаєш tools в коді кожного запиту, і лише твій застосунок їх використовує. MCP — стандартний протокол: tools визначені в окремому сервері, і будь-який MCP-сумісний хост (Claude Desktop, Cursor, твій застосунок) може їх підключити без дублювання коду.

---

**Q: Що таке MCP Host, Client і Server?**
A: Host — застосунок що запускає AI і керує підключеннями (Claude Desktop, Cursor). Client — вбудований в host компонент що спілкується з серверами по протоколу. Server — окремий процес що надає Tools, Resources або Prompts. Один host може підключатись до кількох серверів одночасно.

---

**Q: Коли варто писати MCP сервер замість звичайного function calling?**
A: Коли tool потрібен в кількох різних AI застосунках, або коли хочеш підключити стандартний сервіс і є готовий MCP сервер для нього. Для бізнес-логіки специфічної для одного застосунку — function calling простіший і достатній.

---

**Q: What transport protocols does MCP support?**
A: Two: stdio for local servers (the host spawns a subprocess and communicates via stdin/stdout — simple and secure) and HTTP with SSE for remote servers (needed for cloud deployments where multiple users connect simultaneously). Most developer tools use stdio; production APIs use HTTP.

---

## Правила напам'ять

```
MCP = стандарт для підключення AI до зовнішніх сервісів
Створено: Anthropic, листопад 2024, open source (MIT)
Аналогія: USB-C для AI

Архітектура:
  Host (Claude Desktop) → MCP Client → MCP Server (окремий процес)

MCP Server надає:
  Tools     → функції (як function calling)
  Resources → дані для читання
  Prompts   → шаблони

Транспорт:
  stdio    → локальний процес (розробка, Claude Desktop)
  HTTP/SSE → хмарний сервіс (продакшн, кілька юзерів)

MCP vs Function Calling:
  Function calling → 1 застосунок, 1 запит, твій код
  MCP             → N застосунків, 1 сервер, окремий процес

Коли MCP:
  ✓ Стандартний сервіс (GitHub, Slack, Postgres)
  ✓ Кілька AI хостів використовують той самий tool
  ✓ Хочеш готовий сервер з екосистеми

Коли Function Calling:
  ✓ Бізнес-логіка специфічна для твого застосунку
  ✓ Tool вже є в твоєму коді
  ✓ Не потрібно шерити

Конфіг Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json
Офіційні сервери: github.com/modelcontextprotocol/servers
```
