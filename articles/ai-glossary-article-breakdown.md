# 📖 Розбір статті: "Software Engineer's AI Stack in 2026"

> **Оригінал:** [Software Engineer's AI Stack in 2026 — Fran Soto](https://strategizeyourcareer.com/p/ai-glossary-for-software-engineers?ref=dailydev)  
> **Автор оригіналу:** Fran Soto (Strategize Your Career)  
> **Дата публікації:** 22 лютого 2026  
> **Розбір підготовлено:** для вивчення AI термінів на шляху до AI Native Engineer

---

## 🎯 Головна ідея статті

> *"Stop vibe coding and start engineering."*

2026 рік — це перехід від інтуїтивного використання AI до **справжнього AI engineering**.  
Щоб будувати надійні production-системи з агентами, MCP і контекстом — потрібна спільна мова.  
Ця стаття (і цей розбір) — твій AI глосарій як інженера.

---

## 📚 Блок 1: Foundations

### 1️⃣ Foundation Models & LLMs

**Коротко:**  
Foundation Model — велика модель, навчена на величезній кількості даних, яку можна використовувати для різних задач. LLM (Large Language Model) — підвид, оптимізований для тексту.

**Аналогія:**  
> Foundation Model — це як **оераційна система** (Windows/macOS). Ти не пишеш ОС з нуля для кожного додатку — ти будуєш поверх неї. LLM — це ОС для мовних задач.

**Приклади моделей:**

| Модель | Компанія | Тип |
|---|---|---|
| Claude 3.5 | Anthropic | LLM (text + vision) |
| GPT-4o | OpenAI | Multimodal LLM |
| Gemini 1.5 | Google | Multimodal LLM |
| Llama 3 | Meta | Open-source LLM |

**На інтерв'ю (EN):**
> *"A Foundation Model is a large model pre-trained on diverse data that can be adapted to many downstream tasks. LLMs are foundation models specialized for language understanding and generation."*

---

### 2️⃣ Transformer Architecture & Attention

**Коротко:**  
Transformer — архітектура нейромережі, яка обробляє весь текст **одночасно** (паралельно), а не слово за словом. Це стало можливим завдяки механізму **Attention**.

**Аналогія:**  
> Уяви речення: *"The bank by the river was steep."*  
> Слово "bank" — банк чи берег? **Attention** дозволяє моделі одразу **подивитися на "river"** і зрозуміти контекст.

**Як це працює (спрощено):**
```
Input: "Fix the bug in the auth module"
         ↓
Attention: "bug" → сильний зв'язок з "auth", "module"
         ↓
Model розуміє: це про код, авторизацію, потрібен фікс
```

**На інтерв'ю (EN):**
> *"Transformer uses a self-attention mechanism to process all tokens in parallel, allowing the model to capture long-range dependencies in text — this is what makes LLMs so powerful."*

---

### 3️⃣ Training, Fine-tuning, RLHF

**Три етапи:**
```
Pre-training → Fine-tuning → RLHF
(загальні знання) (спеціалізація) (вирівнювання під людину)
```

| Етап | Що відбувається | Аналогія |
|---|---|---|
| **Pre-training** | Модель читає весь інтернет + книги | Університет |
| **Fine-tuning** | Донавчання на специфічних даних | Стажування в компанії |
| **RLHF** | Люди оцінюють відповіді → модель вчиться | Фідбек від ментора |

**Практичний приклад:**
```
Base LLM (GPT) 
  → Fine-tune на кодових репозиторіях 
  → Codex (GitHub Copilot)

Base LLM (Claude) 
  → Fine-tune на медичних даних 
  → Medical Assistant
```

**На інтерв'ю (EN):**
> *"Pre-training gives the model general knowledge. Fine-tuning specializes it for a domain. RLHF aligns it with human preferences — making outputs safer and more useful."*

---

### 4️⃣ Tokens, Context Window, Cache Tokens

**Що таке токен:**
```
"Hello"       → 1 token
"Hello world" → 2 tokens
"unhappy"     → може бути 2 tokens: "un" + "happy"
```
> **Правило thumb:** ~1 токен ≈ ¾ слова (англійська)

**Context Window — пам'ять моделі:**

| Модель | Context Window |
|---|---|
| Claude 3.5 Sonnet | 200,000 токенів |
| GPT-4o | 128,000 токенів |

⚠️ Якщо контекст переповнений — модель **"забуває"** початок розмови. Якість деградує.

**Cache Tokens:**
```
Без cache:  кожен запит → обробляється з нуля → дорого + повільно
З cache:    повторні частини промпту → беруться з кешу → дешевше + швидше
```

**Код (приклад):**
```js
// System prompt однаковий для всіх запитів → кешуємо
const systemPrompt = "You are a voting analysis assistant..."; // cached

// User message — динамічний → не кешується
const userMessage = `Analyze votes for question: ${question}`;
```

**На інтерв'ю (EN):**
> *"Tokens are the basic units models process. The context window is the model's working memory — exceeding it causes reasoning degradation. Cache tokens reduce cost by reusing repeated prompt prefixes."*

---

### 🎯 Cheat Sheet — Блок 1

| Термін | Одне речення |
|---|---|
| Foundation Model | Велика модель для багатьох задач |
| LLM | Foundation Model для тексту |
| Transformer | Архітектура з паралельною обробкою |
| Attention | Механізм розуміння контексту |
| Pre-training | Загальне навчання на великих даних |
| Fine-tuning | Спеціалізація на конкретній задачі |
| RLHF | Вирівнювання під людські переваги |
| Token | Мінімальна одиниця обробки тексту |
| Context Window | Ліміт пам'яті моделі |
| Cache Tokens | Кешування частин промпту |

---

## 📚 Блок 2: The Interface

### 1️⃣ Prompt Engineering & Prompt Libraries

**Коротко:**  
Prompt Engineering — це **системний підхід** до написання запитів до моделі. Не просто "написав — отримав", а версіонування, тестування, оптимізація.

**Аналогія:**  
> Промпт — це як **технічне завдання для джуна**. Чим чіткіше ТЗ — тим кращий результат.

**Техніки:**

| Техніка | Що робить | Приклад |
|---|---|---|
| **Zero-shot** | Без прикладів | *"Translate to French: Hello"* |
| **Few-shot** | З прикладами | *"cat→кіт, dog→собака, bird→?"* |
| **Chain of Thought** | Крок за кроком | *"Think step by step..."* |
| **Role prompting** | Задаєш роль | *"You are a senior React developer..."* |
| **Constraints** | Обмеження | *"Reply in JSON only, max 100 words"* |

**Prompt Library — код:**
```js
// prompts/index.js
export const PROMPTS = {
  analyzeVotes: (question, data) => `
    You are a data analyst for a global voting app.
    Analyze the following voting data for: "${question}"
    Data: ${JSON.stringify(data)}
    Return JSON: { summary, topCountries, insight }
  `,
  generateQuestion: (topic) => `
    Generate a viral, thought-provoking poll question about: ${topic}
    Rules: neutral tone, global appeal, yes/no or 3 options max
  `
}
```

**На інтерв'ю (EN):**
> *"Prompt Engineering is the systematic practice of designing inputs to maximize model output quality. Prompt Libraries are versioned, reusable collections of tested prompts used consistently across a team or application."*

---

### 2️⃣ Static Context vs Dynamic Context

**Коротко:**
```
Static Context  = стабільна інформація (не змінюється)
Dynamic Context = тимчасова інформація (специфічна для задачі)
```

**Аналогія:**  
> **Static** = твоє резюме (не змінюється щодня)  
> **Dynamic** = питання на конкретному інтерв'ю (кожного разу нове)

**Код:**
```js
// STATIC — system prompt, однаковий завжди → кешуємо
const staticContext = `
  You are an AI analyst for worldvote.app.
  App concept: one daily question, global votes, analytics by country.
  Always respond in JSON format.
`;

// DYNAMIC — змінюється кожен запит
const dynamicContext = `
  Current question: "${currentQuestion}"
  Votes today: ${votesCount}
  User asking: ${userQuery}
`;

const messages = [
  { role: "system", content: staticContext },  // cached
  { role: "user", content: dynamicContext }     // dynamic
];
```

**На інтерв'ю (EN):**
> *"Static context is stable, long-lived information like system instructions. Dynamic context is task-specific and changes per interaction. Managing both efficiently is critical for model performance and cost."*

---

### 3️⃣ Multi-Turn Conversations

**Коротко:**  
Multi-turn = розмова з **кількох повідомлень** туди-назад. Модель "пам'ятає" попередні кроки в межах контексту.

**Аналогія:**  
> Це як **code review з колегою**: ти показуєш код → він каже що виправити → ти виправляєш → він перевіряє знову.

**Код:**
```js
const conversationHistory = [];

async function chat(userMessage) {
  conversationHistory.push({ role: "user", content: userMessage });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: staticContext,
    messages: conversationHistory
  });

  const assistantMessage = response.content[0].text;
  conversationHistory.push({ role: "assistant", content: assistantMessage });
  return assistantMessage;
}

await chat("Analyze votes for today");
await chat("Now filter only European countries");  // знає контекст
await chat("Make a summary");                      // знає обидва попередні
```

⚠️ Чим довша розмова → більше токенів → дорожче + ризик переповнення контексту.

**На інтерв'ю (EN):**
> *"Multi-turn conversations maintain state across multiple exchanges, enabling the model to plan and adapt dynamically. This is the foundation of agentic behavior — but requires careful context window management."*

---

### 4️⃣ Hallucinations & Grounding

**Коротко:**  
**Hallucination** — модель вигадує факти, які звучать переконливо але є неправдою.  
**Grounding** — техніка "прив'язки" моделі до реальних, верифікованих даних.

**Аналогія:**  
> Hallucination — як **впевнений джун**, який не знає відповіді але вигадує її.  
> Grounding — це **code review + документація** поруч.

**Приклад:**
```
❌ Без grounding: "worldvote.app has approximately 2.3 million users"
   (вигадала! модель не знає реальних даних)

✅ З grounding: передаємо реальні дані з Supabase → модель відповідає на основі них
```

**Методи Grounding:**

| Метод | Що робить |
|---|---|
| **RAG** | Підтягує релевантні документи з бази знань |
| **MCP** | Підключає зовнішні інструменти і джерела даних |
| **Function Calling** | Модель викликає реальні API для отримання даних |
| **Direct injection** | Вставляєш реальні дані прямо в промпт |

**На інтерв'ю (EN):**
> *"Hallucination occurs when a model generates plausible but incorrect information. Grounding prevents this by providing verifiable context — through RAG, MCP, or direct data injection."*

---

### 🎯 Cheat Sheet — Блок 2

| Термін | Одне речення |
|---|---|
| Prompt Engineering | Системний підхід до написання запитів |
| Prompt Library | Версіоновані, перевірені промпти |
| Static Context | Стабільна інформація (system prompt) |
| Dynamic Context | Тимчасова інформація (поточна задача) |
| Multi-Turn | Розмова з пам'яттю між кроками |
| Hallucination | Модель вигадує переконливу неправду |
| Grounding | Прив'язка моделі до реальних даних |

---

## 📚 Блок 3: The Action Layer

### 1️⃣ RAG — Retrieval-Augmented Generation

**Коротко:**  
RAG = модель спочатку **знаходить релевантну інформацію** з твоєї бази знань, потім генерує відповідь на основі неї.

**Аналогія:**  
> Без RAG — студент на іспиті **без шпаргалки**: відповідає з пам'яті, може помилитись.  
> З RAG — студент **з відкритою книгою**: спочатку знаходить потрібну сторінку.

**Як працює:**
```
1. User запитує: "What countries voted YES on climate question?"
        ↓
2. RAG шукає релевантні дані у векторній БД
        ↓
3. Знаходить: [{ country: "Germany", vote: "YES" }, ...]
        ↓
4. Передає в промпт як контекст
        ↓
5. Модель генерує відповідь на основі РЕАЛЬНИХ даних
```

**Код (Supabase + pgvector):**
```js
// 1. Зберігаємо embeddings
const embedding = await anthropic.embeddings.create({
  model: "voyage-3",
  input: questionText
});

await supabase.from('questions_embeddings').insert({
  question_id: id,
  embedding: embedding.data[0].embedding
});

// 2. Шукаємо схожі при запиті
const { data: relevantDocs } = await supabase.rpc(
  'match_questions',
  { query_embedding: userEmbedding, match_count: 5 }
);

// 3. Передаємо в промпт
const ragPrompt = `
  Based on these relevant voting records:
  ${JSON.stringify(relevantDocs)}
  Answer: ${userQuery}
`;
```

**На інтерв'ю (EN):**
> *"RAG combines retrieval and generation — instead of relying on training data, the model first retrieves relevant documents from a knowledge base, then generates a grounded response. This reduces hallucinations and keeps answers up-to-date."*

---

### 2️⃣ MCP — Model Context Protocol

**Коротко:**  
MCP = **стандартний протокол** який дозволяє моделі підключатись до зовнішніх інструментів і сервісів.

**Аналогія:**  
> MCP — це як **USB стандарт** для AI. Раніше кожен пристрій мав свій роз'єм (хаос). USB стандартизував все. MCP робить те саме для AI інструментів.

**Архітектура:**
```
┌─────────────┐     MCP Protocol      ┌─────────────────┐
│   Claude    │ ◄──────────────────► │   MCP Server    │
│  (Client)   │                       │  (Notion, DB,   │
└─────────────┘                       │  GitHub, etc.)  │
                                       └─────────────────┘
```

**Що надає MCP Server:**
```
MCP Server надає моделі:
├── Tools     → функції які модель може викликати
├── Resources → дані які модель може читати
└── Prompts   → готові шаблони промптів
```

**Ти вже використовуєш MCP:**
```
Claude.ai + Notion MCP     → Claude читає/пише нотатки
Claude.ai + Supabase MCP   → Claude запитує БД
Claude.ai + Google Drive   → Claude бачить файли
```

**На інтерв'ю (EN):**
> *"MCP is an open protocol that standardizes how AI models connect to external tools and data sources. Like USB for AI — it provides a universal interface enabling models to read resources, call tools, and use prompt templates from any MCP-compatible server."*

---

### 3️⃣ AI Agents

**Коротко:**  
AI Agent = модель яка не просто **відповідає** на питання, а **планує і виконує** послідовність дій для досягнення мети.

**LLM vs Agent:**
```
LLM (без агента):
User: "Fix this bug" → Model: "Here's the fix: ..."
(тільки відповідь)

AI Agent:
User: "Fix this bug"
  → читає файл
  → аналізує код
  → пише фікс
  → запускає тести
  → робить commit
```

**Компоненти агента:**
```
┌─────────────────────────────────┐
│           AI AGENT              │
│                                 │
│  Planning  → що робити далі     │
│  Memory    → що вже зробив      │
│  Tools     → що може викликати  │
│  Action    → виконує кроки      │
└─────────────────────────────────┘
```

**ReAct патерн (Reason + Act):**
```
Думає: "Потрібно знайти топ країни за голосуванням"
  ↓
Діє: викликає get_votes_by_country()
  ↓
Думає: "Отримав дані, тепер відсортую"
  ↓
Діє: викликає sort_by_count()
  ↓
Відповідає: "Top country is Germany with 45% YES votes"
```

**На інтерв'ю (EN):**
> *"An AI Agent autonomously plans and executes multi-step tasks using tools and memory. Unlike a simple LLM call, an agent reasons about what action to take next, executes it, observes the result, and continues until the goal is achieved."*

---

### 4️⃣ Function Calling / Tool Use

**Коротко:**  
Function Calling = модель може **викликати твої функції**. Ти описуєш що функція робить → модель сама вирішує коли її викликати.

**Аналогія:**  
> Ти кажеш асистенту: *"У тебе є доступ до календаря і email. Використовуй їх коли потрібно."* Асистент сам вирішує — для цього питання потрібен календар чи email.

**Код:**
```js
const tools = [
  {
    name: "get_votes_by_country",
    description: "Get voting results filtered by country",
    input_schema: {
      type: "object",
      properties: {
        country: { type: "string", description: "Country code, e.g. 'UA'" },
        question_id: { type: "string" }
      },
      required: ["question_id"]
    }
  }
];

const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  tools: tools,
  messages: [{ role: "user", content: "How did Ukraine vote today?" }]
});

if (response.stop_reason === "tool_use") {
  const toolCall = response.content.find(b => b.type === "tool_use");
  const result = await executeFunction(toolCall.name, toolCall.input);
  // → повертаємо результат моделі для фінальної відповіді
}
```

**На інтерв'ю (EN):**
> *"Function calling allows the model to invoke developer-defined tools when needed. You describe the function's purpose and parameters — the model decides when and how to call it. This bridges language understanding and real-world actions."*

---

### 5️⃣ Agentic Workflows

**Коротко:**  
Agentic Workflow = **пайплайн з кількох AI кроків**, де кожен крок може використовувати інструменти, приймати рішення, і передавати результат далі.

**Патерни:**
```
1. SEQUENTIAL:   Step1 → Step2 → Step3 → Result

2. PARALLEL:     Step1 ─┬→ Step2a ─┬→ Merge → Result
                        └→ Step2b ─┘

3. CONDITIONAL:  Input → Check → if YES: path A / if NO: path B

4. LOOP:         Generate → Evaluate → if OK: done / if not: Generate again
```

**Реальний приклад для worldvote.app:**
```
Agentic Workflow: "Generate viral question"

Step 1: Research Agent  → шукає trending topics (web_search)
Step 2: Generation Agent → генерує 5 варіантів питань
Step 3: Evaluation Agent → оцінює (viral score, neutrality, clarity)
Step 4: Decision         → score > 8: публікує / score < 8: → Step 2
Step 5: Translation Agent → перекладає на 10 мов
```

**На інтерв'ю (EN):**
> *"Agentic workflows are multi-step AI pipelines where each step can use tools, make decisions, and pass results forward. Key patterns: sequential, parallel, conditional, loop. The main challenge is reliability — each step can fail, so verification and fallback logic are critical."*

---

### 🎯 Cheat Sheet — Блок 3

| Термін | Одне речення |
|---|---|
| RAG | Пошук реальних даних перед генерацією |
| MCP | USB-стандарт для підключення AI до інструментів |
| AI Agent | Модель що планує і виконує дії автономно |
| Function Calling | Модель викликає твої функції коли потрібно |
| Agentic Workflow | Пайплайн з кількох AI кроків з логікою |
| ReAct | Патерн: думати → діяти → думати → діяти |

---

## 🏆 Мастер Cheat Sheet — Всі терміни

| Термін | Одне речення |
|---|---|
| Foundation Model | Велика модель для багатьох задач |
| LLM | Foundation Model для тексту |
| Transformer | Архітектура з паралельною обробкою |
| Attention | Механізм розуміння контексту |
| Pre-training | Загальне навчання на великих даних |
| Fine-tuning | Спеціалізація на конкретній задачі |
| RLHF | Вирівнювання під людські переваги |
| Token | Мінімальна одиниця обробки тексту |
| Context Window | Ліміт пам'яті моделі |
| Cache Tokens | Кешування частин промпту |
| Prompt Engineering | Системний підхід до написання запитів |
| Prompt Library | Версіоновані, перевірені промпти |
| Static Context | Стабільна інформація (system prompt) |
| Dynamic Context | Тимчасова інформація (поточна задача) |
| Multi-Turn | Розмова з пам'яттю між кроками |
| Hallucination | Модель вигадує переконливу неправду |
| Grounding | Прив'язка моделі до реальних даних |
| RAG | Пошук реальних даних перед генерацією |
| MCP | USB-стандарт для підключення AI до інструментів |
| AI Agent | Модель що планує і виконує дії автономно |
| Function Calling | Модель викликає твої функції коли потрібно |
| Agentic Workflow | Пайплайн з кількох AI кроків з логікою |
| ReAct | Патерн: думати → діяти → думати → діяти |

---

*Розбір підготовлено на основі статті Fran Soto. Всі приклади коду адаптовані під реальний проект worldvote.app.*
