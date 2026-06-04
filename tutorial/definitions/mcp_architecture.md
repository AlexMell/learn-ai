# MCP Архітектура — глибоко

> **Interview answer (English):**
> An MCP server exposes three primitive types: Tools (callable functions, like function calling), Resources (read-only data — files, DB rows, URLs), and Prompts (reusable prompt templates with parameters). Communication happens over JSON-RPC 2.0 via one of two transports: stdio for local subprocesses (the host spawns the server and talks via stdin/stdout) or HTTP with SSE for remote services. The host maintains one MCP Client instance per connected server, handling capability negotiation, request routing, and lifecycle management.

---

## Поясни 7-річному

Уяви ресторан. **Хост** — це менеджер залу. **MCP Client** — офіціант від менеджера. **MCP Server** — кухня. Офіціант знає як говорити з кухнею мовою замовлень. Кухня може запропонувати: **Tools** — страви що можна приготувати (дія), **Resources** — меню і список інгредієнтів (дані для читання), **Prompts** — шаблони замовлень ("стандартний бізнес-ланч"). Менеджер не знає як готувати — він просто відправляє офіціанта на кухню.

---

## Детальна архітектура

```
╔══════════════════════════════════════════════════════════════╗
║                         HOST                                 ║
║  (Claude Desktop / Claude Code / твій застосунок)           ║
║                                                              ║
║   ┌─────────────────┐      ┌─────────────────┐              ║
║   │   LLM / Claude  │      │   UI / логіка   │              ║
║   └────────┬────────┘      └────────┬────────┘              ║
║            │ tool calls             │ user input             ║
║            ▼                        ▼                        ║
║   ┌──────────────────────────────────────────┐              ║
║   │              MCP Client Manager          │              ║
║   │  (lifecycle, capability negotiation)     │              ║
║   └──────┬───────────────────────┬───────────┘              ║
╚══════════╪═══════════════════════╪═══════════════════════════╝
           │ JSON-RPC 2.0          │ JSON-RPC 2.0
           │ (stdio)               │ (HTTP/SSE)
           ▼                       ▼
╔══════════════════╗    ╔═══════════════════════╗
║   MCP Server A   ║    ║    MCP Server B        ║
║  (local process) ║    ║   (remote HTTP)        ║
║                  ║    ║                        ║
║  ┌────────────┐  ║    ║  ┌──────────────────┐  ║
║  │   Tools    │  ║    ║  │     Tools        │  ║
║  │ Resources  │  ║    ║  │   Resources      │  ║
║  │  Prompts   │  ║    ║  │    Prompts       │  ║
║  └────────────┘  ║    ║  └──────────────────┘  ║
║  filesystem,     ║    ║  GitHub API,           ║
║  local DB        ║    ║  Slack, Notion         ║
╚══════════════════╝    ╚═══════════════════════╝
```

---

## Server і Client — деталі

### MCP Client (всередині Host)

Один клієнт на кожен підключений сервер. Відповідає за:

```
1. Lifecycle management
   ├── spawn (запускає процес для stdio)
   ├── initialize (handshake + capability negotiation)
   └── shutdown (graceful close)

2. Capability negotiation
   ├── client надсилає свої capabilities
   └── server відповідає своїми (що він вміє: tools / resources / prompts)

3. Request routing
   ├── tools/list      → список доступних tools
   ├── tools/call      → виклик конкретного tool
   ├── resources/list  → список доступних ресурсів
   ├── resources/read  → читання ресурсу
   ├── prompts/list    → список шаблонів
   └── prompts/get     → отримання конкретного шаблону
```

### MCP Server

Відповідає на запити від клієнта. Не ініціює з'єднання — тільки слухає.

```
Initialize sequence:
  Client → { method: "initialize", params: { protocolVersion, capabilities } }
  Server → { result: { protocolVersion, capabilities, serverInfo } }
  Client → { method: "notifications/initialized" }
  ↓
  Ready for requests
```

---

## Tools — виконувані функції

**Tools** — це те що Claude може *зробити*: викликати API, записати в БД, відправити повідомлення.

```ts
server.tool(
  "create_issue",
  "Create a new GitHub issue in a repository",
  {
    owner: z.string().describe("Repository owner"),
    repo:  z.string().describe("Repository name"),
    title: z.string().describe("Issue title"),
    body:  z.string().optional().describe("Issue body in markdown"),
  },
  async ({ owner, repo, title, body }) => {
    const issue = await github.issues.create({ owner, repo, title, body });
    return {
      content: [{
        type: "text",
        text: `Created issue #${issue.number}: ${issue.html_url}`,
      }],
    };
  }
);
```

Tool handler повертає `{ content: ContentBlock[] }` де `ContentBlock` може бути `text`, `image` або `resource`.

---

## Resources — дані для читання

**Resources** — статичні або динамічні дані що модель може прочитати як контекст. Не виконують дій.

```ts
// Статичний ресурс — конфіг файл
server.resource(
  "config://app",
  "Application configuration",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({ env: "production", version: "2.1.0" }),
    }],
  })
);

// Динамічний ресурс — рядки з БД
server.resource(
  new ResourceTemplate("db://users/{id}", { list: undefined }),
  "User record from database",
  async (uri, { id }) => {
    const user = await db.users.findById(id);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(user),
      }],
    };
  }
);
```

### Tools vs Resources — ключова різниця

| | Tools | Resources |
|---|---|---|
| **Дія** | Виконує операцію (side effects) | Лише читання, без side effects |
| **Ініціатор** | Claude вирішує коли викликати | Host може завантажити як контекст |
| **Аналог** | POST/PUT/DELETE API | GET API або файл |
| **Приклад** | `send_email()`, `create_ticket()` | `/users/42`, `config.json` |

---

## Prompts — шаблони

**Prompts** — готові шаблони повідомлень з параметрами. Користувач вибирає їх в UI хоста.

```ts
server.prompt(
  "code-review",
  "Structured code review template",
  {
    language: z.string().describe("Programming language"),
    focus:    z.enum(["security", "performance", "readability"]).optional(),
  },
  async ({ language, focus }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Review this ${language} code focusing on ${focus ?? "general quality"}.
               Check for: bugs, edge cases, ${focus === "security" ? "injection vulnerabilities, " : ""}best practices.`,
      },
    }],
  })
);
```

Prompts відображаються в Claude Desktop як `/` команди або в dropdown меню.

---

## Transport: stdio vs HTTP/SSE

### stdio — для локальних серверів

```
Host process
  │
  ├── spawn() → запускає MCP Server як дочірній процес
  │
  ├── stdin  →→→→→→→→→ MCP Server
  │                     (читає JSON-RPC запити)
  │
  └── stdout ←←←←←←←← MCP Server
                        (пише JSON-RPC відповіді)
```

```ts
// Серверна сторона (stdio)
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const transport = new StdioServerTransport();
await server.connect(transport);
// Тепер сервер читає stdin і пише в stdout
```

**Плюси stdio:** простий, безпечний (нема мережевого порту), не потребує auth.
**Мінуси:** лише локально, один хост на одночасне з'єднання.

### HTTP + SSE — для віддалених серверів

```
Browser / Remote Host
  │
  ├── POST /message  →→→→ MCP Server (запити)
  │
  └── GET  /sse     ←←←← MCP Server (відповіді через Server-Sent Events)
```

```ts
// Серверна сторона (HTTP)
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const transport = new SSEServerTransport("/message", res);
await server.connect(transport);

app.get("/sse", (req, res) => { /* SSE endpoint */ });
app.post("/message", (req, res) => { /* incoming requests */ });
```

**Плюси HTTP:** доступний з будь-де, кілька клієнтів одночасно.
**Мінуси:** потрібна auth, складніше налаштувати, CORS.

---

## Підключення у Claude Desktop

Файл конфігурації: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/alex/Projects"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    },
    "my-weather-server": {
      "command": "node",
      "args": ["/Users/alex/Projects/my-mcp-server/dist/index.js"]
    }
  }
}
```

**Після зміни — перезапустити Claude Desktop.** Підключені сервери видно в іконці 🔌 в правому нижньому куті.

**Дебаг логи:** `~/Library/Logs/Claude/mcp*.log`

---

## Написати свій MCP сервер з нуля

### Крок 1 — ініціалізація проекту

```bash
mkdir my-weather-mcp && cd my-weather-mcp
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node
npx tsc --init
```

`tsconfig.json` — додай:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "strict": true
  }
}
```

`package.json` — додай:
```json
{
  "type": "module",
  "scripts": { "build": "tsc", "start": "node dist/index.js" }
}
```

### Крок 2 — повний код сервера (`src/index.ts`)

```ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Ініціалізуємо сервер ──────────────────────────────────────
const server = new McpServer({
  name: "weather-server",
  version: "1.0.0",
});

// ── Мок-дані (замість реального API) ─────────────────────────
const weatherDB: Record<string, { temp: number; conditions: string; humidity: number }> = {
  kyiv:   { temp: 18, conditions: "partly cloudy", humidity: 65 },
  london: { temp: 12, conditions: "rainy",         humidity: 85 },
  tokyo:  { temp: 28, conditions: "sunny",          humidity: 70 },
  berlin: { temp: 15, conditions: "overcast",       humidity: 72 },
};

// ── TOOL: get_weather ─────────────────────────────────────────
server.tool(
  "get_weather",
  "Get current weather for a city. Returns temperature, conditions and humidity.",
  {
    city: z.string().describe("City name, e.g. 'Kyiv' or 'London'"),
    unit: z.enum(["celsius", "fahrenheit"])
          .optional()
          .default("celsius")
          .describe("Temperature unit"),
  },
  async ({ city, unit }) => {
    const data = weatherDB[city.toLowerCase()];

    if (!data) {
      return {
        content: [{ type: "text", text: `Weather data not available for "${city}"` }],
        isError: true,
      };
    }

    const temp = unit === "fahrenheit"
      ? Math.round(data.temp * 9 / 5 + 32)
      : data.temp;

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          city,
          temperature: temp,
          unit,
          conditions: data.conditions,
          humidity: `${data.humidity}%`,
        }, null, 2),
      }],
    };
  }
);

// ── TOOL: compare_weather ─────────────────────────────────────
server.tool(
  "compare_weather",
  "Compare weather between two cities",
  {
    city1: z.string(),
    city2: z.string(),
  },
  async ({ city1, city2 }) => {
    const d1 = weatherDB[city1.toLowerCase()];
    const d2 = weatherDB[city2.toLowerCase()];

    if (!d1 || !d2) {
      return {
        content: [{ type: "text", text: "One or both cities not found" }],
        isError: true,
      };
    }

    const warmer = d1.temp > d2.temp ? city1 : city2;
    return {
      content: [{
        type: "text",
        text: `${city1}: ${d1.temp}°C (${d1.conditions})\n` +
              `${city2}: ${d2.temp}°C (${d2.conditions})\n` +
              `${warmer} is warmer by ${Math.abs(d1.temp - d2.temp)}°C`,
      }],
    };
  }
);

// ── RESOURCE: weather data для конкретного міста ──────────────
server.resource(
  new ResourceTemplate("weather://{city}", { list: undefined }),
  "Current weather data for a city",
  async (uri, { city }) => {
    const data = weatherDB[String(city).toLowerCase()];
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: data
          ? JSON.stringify(data, null, 2)
          : JSON.stringify({ error: "City not found" }),
      }],
    };
  }
);

// ── RESOURCE: список всіх міст ────────────────────────────────
server.resource(
  "weather://cities",
  "List of all available cities",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(Object.keys(weatherDB), null, 2),
    }],
  })
);

// ── PROMPT: weather-report шаблон ────────────────────────────
server.prompt(
  "weather-report",
  "Generate a weather report for a city",
  { city: z.string(), style: z.enum(["brief", "detailed"]).optional() },
  async ({ city, style = "brief" }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: style === "detailed"
          ? `Write a detailed weather report for ${city} including temperature, conditions, humidity and what to wear.`
          : `Give a one-sentence weather summary for ${city}.`,
      },
    }],
  })
);

// ── Запускаємо через stdio ────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

// stderr для логів (stdout зайнятий протоколом)
console.error("Weather MCP server running on stdio");
```

### Крок 3 — збірка і підключення

```bash
npm run build   # компілює в dist/

# Тест в терміналі (Ctrl+C щоб вийти)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

Додай у `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/абсолютний/шлях/до/my-weather-mcp/dist/index.js"]
    }
  }
}
```

---

## Підводні камені (Gotchas)

### 1. `console.log` у stdio сервері = зламаний протокол
stdout зайнятий JSON-RPC. Будь-який `console.log` в stdout = корупція протоколу. Використовуй `console.error` для дебагу.

```ts
// ❌ Ламає stdio транспорт
console.log("Server started");

// ✓ В stderr — не чіпає протокол
console.error("Server started");
```

### 2. Абсолютні шляхи в конфігурації
`claude_desktop_config.json` не розуміє `~` або відносні шляхи.

```json
// ❌
"args": ["~/Projects/my-server/dist/index.js"]

// ✓
"args": ["/Users/alex/Projects/my-server/dist/index.js"]
```

### 3. Сервер треба перезапустити після змін
Claude Desktop кешує стан серверів. Після зміни коду: **зупини і перезапусти Claude Desktop**.

### 4. `ResourceTemplate` URI — строгий формат
URI мусить бути валідним: `weather://city` а не `weather/city`. Параметри в `{фігурних дужках}`.

### 5. `isError: true` у Tool response ≠ JS exception
Повертай `{ content: [...], isError: true }` — не кидай `throw`. Claude отримає повідомлення про помилку і зможе скоригувати запит.

### 6. Версія протоколу у SDK змінюється
Фіксуй версію: `"@modelcontextprotocol/sdk": "1.x.x"` — не `"latest"`.

---

## Interview Q&A

**Q: What are the three primitive types an MCP server can expose?**
A: Tools — callable functions with side effects (like function calling). Resources — read-only data identified by URI (files, DB records, API responses). Prompts — parameterized message templates that appear as slash commands or shortcuts in the host UI.

---

**Q: Яка різниця між stdio і HTTP транспортом у MCP?**
A: stdio — хост запускає сервер як дочірній процес і спілкується через stdin/stdout. Простий, безпечний, без мережевого порту, лише локально. HTTP/SSE — сервер доступний по мережі, кілька клієнтів одночасно, але потрібна авторизація і складніше налаштування.

---

**Q: Чому не можна використовувати `console.log` в stdio MCP сервері?**
A: Протокол MCP по stdio використовує stdout для JSON-RPC повідомлень. Будь-який `console.log` іде в stdout і корумпує потік протоколу — клієнт не може розпарсити відповідь. Для логів треба `console.error` (stderr).

---

**Q: How does the capability negotiation work in MCP?**
A: During initialization, the client sends its supported capabilities (e.g., "I support roots, sampling"). The server responds with its capabilities (e.g., "I provide tools, resources"). Both sides then know what the other can do. If a server says it has resources but the client doesn't support them, the client ignores that capability.

---

**Q: Як відладити MCP сервер підключений до Claude Desktop?**
A: Дивись логи в `~/Library/Logs/Claude/mcp-server-<name>.log`. Також можна тестувати сервер напряму в терміналі — відправляти JSON-RPC рядки через stdin і читати відповіді зі stdout.

---

## Правила напам'ять

```
Три типи примітивів MCP:
  Tools     → функції з side effects  (Claude викликає)
  Resources → read-only дані по URI   (Host або Claude читає)
  Prompts   → шаблони з параметрами  (юзер вибирає в UI)

Транспорти:
  stdio     → локальний процес, stdin/stdout, простий, безпечний
  HTTP/SSE  → POST /message + GET /sse, для хмарних серверів

Правило stdio:
  console.log  ❌ → корупція протоколу
  console.error ✓ → безпечно (stderr)

Конфіг Claude Desktop:
  ~/Library/Application Support/Claude/claude_desktop_config.json
  Після змін → перезапустити Claude Desktop
  Шляхи → лише абсолютні (/Users/...), не ~ або відносні

Логи: ~/Library/Logs/Claude/mcp-server-<name>.log

Initialize sequence:
  Client → initialize (protocolVersion + capabilities)
  Server → result (capabilities + serverInfo)
  Client → notifications/initialized
  → ready

Методи протоколу:
  tools/list       tools/call
  resources/list   resources/read
  prompts/list     prompts/get
```
