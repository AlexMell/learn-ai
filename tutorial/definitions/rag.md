# RAG — Retrieval-Augmented Generation

> **Interview answer (English):**
> RAG is a pattern where instead of stuffing all documents into the context window, you semantically search for only the relevant chunks and pass those to the LLM. Three steps: chunk documents → embed and store in a vector DB → at query time, embed the question, find nearest chunks, inject into context. RAG solves two problems context window alone can't: documents that don't fit, and data that changes over time.

## Поясни 7-річному

Уяви що тебе спитали: "Що написано на сторінці 347 в бібліотеці з мільйоном книг?" Ти не можеш прочитати всі книги перед відповіддю — занадто довго. Але якщо бібліотекар каже "схоже це про динозаврів — ось три книги де про це є" — ти читаєш лише їх і відповідаєш. RAG — це той бібліотекар: він знаходить потрібні сторінки, а LLM читає і відповідає.

---

## Проблема яку вирішує RAG

```
БЕЗ RAG:
  Твоя knowledge base: 10,000 документів × 500 слів = 5M слів
  Claude context window: ~150,000 слів
  Результат: не влізає ❌

З RAG:
  Запит → знайти 5 релевантних документів → 5 × 500 слів = 2,500 слів
  В context window: влізає ✓, дешево ✓, точно ✓
```

**Три сценарії де context-stuffing не працює:**

| Проблема | Чому | RAG вирішує |
|---|---|---|
| Документів занадто багато | Не влізуть у контекст | Вибирає тільки релевантні |
| Дані змінюються | Перетренований контекст застаріє | Пошук завжди по актуальній DB |
| Запити від N юзерів | Кожен платить за повний контекст | Кожен отримує маленький релевантний шматок |

---

## Embeddings — концепція

**Embedding** — це перетворення тексту в числовий вектор (масив `float`), де **семантична схожість = геометрична близькість**.

```
"собака"  → [0.23, -0.81, 0.45, ..., 0.12]  (1536 чисел)
"пес"     → [0.25, -0.79, 0.43, ..., 0.11]  ← близько ✓
"літак"   → [0.91,  0.03, -0.67, ..., 0.88] ← далеко ✓
```

**Геометрично:**

```
         "пес" ●  ● "собака"     ← близько (схожий смисл)
         "цуценя" ●

                              ● "літак"
                              ● "аеропорт"  ← далеко (інший домен)
```

**Cosine similarity** — стандартна метрика схожості між векторами:
- `1.0` → ідентичні
- `0.9+` → дуже схожі
- `0.5-` → несхожі
- `-1.0` → протилежні

```ts
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}
```

**Важливо:** Anthropic не має свого embedding model. Для RAG з Claude використовують:
- **Voyage AI** — рекомендовано Anthropic, спеціалізований на retrieval
- **OpenAI** `text-embedding-3-small` — дешевий і добрий загальний варіант
- **pgvector + будь-яка модель** — якщо вже є Postgres

---

## Повний RAG pipeline

```
INDEXING (робиться один раз або при оновленні):
┌──────────┐    ┌─────────┐    ┌───────────┐    ┌───────────┐
│Documents │ →  │Chunking │ →  │ Embedding │ →  │ Vector DB │
│(.pdf,    │    │(500-1k  │    │  model    │    │(pgvector, │
│ .md,     │    │ tokens) │    │           │    │ Pinecone) │
│ .txt)    │    └─────────┘    └───────────┘    └───────────┘

RETRIEVAL (кожен запит):
┌──────────┐    ┌───────────┐    ┌───────────┐    ┌────────┐
│  Query   │ →  │ Embedding │ →  │ ANN Search│ →  │Top K   │
│"Як скинути│   │  model    │    │ (cosine)  │    │chunks  │
│ пароль?" │    └───────────┘    └───────────┘    └───┬────┘
└──────────┘                                          │
                                                      ▼
GENERATION:                                    ┌────────────┐
┌─────────────────────────────────────┐       │   Claude   │
│ System: "Answer based on context"   │  ←──  │            │
│ Context: [chunk1, chunk2, chunk3]   │       └────────────┘
│ User: "Як скинути пароль?"          │
└─────────────────────────────────────┘
```

---

## Chunking — як розбивати документи

```ts
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk);
  }

  return chunks;
}
```

**Стратегії chunking:**

```
Fixed-size (за токенами/словами):
  ✓ Простий
  ✗ Може розрізати речення посередині

Sentence/paragraph-based:
  ✓ Зберігає семантичну цілісність
  ✗ Нерівномірний розмір

Recursive (LangChain-style):
  Спочатку по абзацах → якщо великий → по реченнях → якщо великий → по словах
  ✓ Найкращий баланс якості і розміру

Overlap (ковзне вікно):
  Кожен chunk перекривається з сусіднім на N токенів
  ✓ Не втрачаємо контекст на межах chunks
  ✗ Дублюємо токени → більше storage і embedding cost
```

---

## Vector DB — що це

**Vector DB** — база даних оптимізована для зберігання та пошуку векторів. Звичайна SQL DB з `LIKE` або `=` не підходить — потрібен **ANN (Approximate Nearest Neighbor)** пошук по мільйонах векторів за мілісекунди.

**Основні операції:**

```ts
// Conceptual API (реальний залежить від провайдера)

// 1. Зберегти chunk + його embedding + metadata
await vectorDB.upsert({
  id: "doc_42_chunk_7",
  vector: [0.23, -0.81, ...],  // 1536 float
  metadata: {
    source: "docs/onboarding.md",
    chunk_index: 7,
    text: "To reset your password, go to Settings → Security...",
  },
});

// 2. Знайти K найближчих сусідів
const results = await vectorDB.query({
  vector: queryEmbedding,  // embedding запиту юзера
  topK: 5,
  filter: { source: "docs/onboarding.md" },  // metadata filter
});
// → [{ id, score: 0.94, metadata: { text: "..." } }, ...]
```

**Популярні варіанти:**

| | Опис | Коли |
|---|---|---|
| **pgvector** | Postgres extension | Вже є Postgres (Supabase = pgvector) |
| **Pinecone** | Managed cloud vector DB | Простота, scale, немає своєї інфри |
| **Weaviate** | Open-source, self-hosted | Потрібна власна інфра або GraphQL API |
| **Qdrant** | Fast, Rust-based | Висока продуктивність, self-hosted |
| **Chroma** | Embedded, for dev | Локальна розробка і прототипи |

---

## Мінімальна RAG реалізація (TypeScript)

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Симуляція vector DB (в реальному проекті — pgvector або Pinecone)
interface Chunk {
  id: string;
  text: string;
  embedding: number[];
}
const vectorStore: Chunk[] = [];

// --- INDEXING ---

async function embedText(text: string): Promise<number[]> {
  // Voyage AI або OpenAI — Claude сам embeddings не генерує
  // Тут — заглушка для прикладу
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: text, model: "voyage-3" }),
  });
  const data = await response.json();
  return data.data[0].embedding;
}

async function indexDocuments(docs: string[]): Promise<void> {
  for (const [i, doc] of docs.entries()) {
    const chunks = chunkText(doc);
    for (const [j, chunk] of chunks.entries()) {
      const embedding = await embedText(chunk);
      vectorStore.push({ id: `doc${i}_chunk${j}`, text: chunk, embedding });
    }
  }
}

// --- RETRIEVAL ---

function findRelevantChunks(queryEmbedding: number[], topK = 3): string[] {
  return vectorStore
    .map((chunk) => ({
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => r.text);
}

// --- GENERATION ---

async function ragQuery(question: string): Promise<string> {
  const queryEmbedding = await embedText(question);
  const relevantChunks = findRelevantChunks(queryEmbedding);
  const context = relevantChunks.join("\n\n---\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system:
      "Answer the user's question based only on the provided context. " +
      "If the answer is not in the context, say so.",
    messages: [
      {
        role: "user",
        content: `<context>\n${context}\n</context>\n\nQuestion: ${question}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}
```

---

## Коли потрібен RAG, коли ні

```
Потрібен RAG:
  ✓ Knowledge base > ~100 документів або > 50k токенів
  ✓ Дані часто змінюються (оновлення документації, новини)
  ✓ Багато юзерів, у кожного різні запити по одній базі знань
  ✓ Потрібна точна атрибуція ("ця інформація з doc X, розділ Y")
  ✓ Є приватні корпоративні дані що не можна включити в тренування

Не потрібен RAG:
  ✗ Документів мало (< 20 файлів) → просто claude ситкай все в контекст
  ✗ Дані статичні і завжди однакові → хардкоди або system prompt
  ✗ Одноразовий аналіз → завантажуй файл напряму
  ✗ Задача не потребує зовнішніх знань → LLM і без RAG справляється

Альтернативи RAG:
  Context stuffing   → документів мало, запити передбачувані
  Fine-tuning        → стиль і поведінку (не для фактів!)
  Tool use + search  → треба актуальні дані з веб або API
```

**Практичне правило:**

```
< 50k токенів документів    → просто контекст (context stuffing)
50k – 500k токенів          → RAG або prompt caching
> 500k токенів              → RAG обов'язково
```

---

## Worldvote.app — RAG приклад

```ts
// Knowledge base: правила голосування, FAQ, модераційні гайдлайни
// Запит: "Чи можна голосувати двічі по одній темі?"

const worldvoteRagChunks = [
  "Users can vote once per topic per day. Duplicate votes are rejected.",
  "Voting topics are moderated by regional admins. See moderation_guidelines.md",
  "Premium users can change their vote within 1 hour of submission.",
  // ... ще 500 chunks з документації
];

// При запиті юзера → знайти релевантні chunks → відповісти на основі них
const answer = await ragQuery("Can I change my vote after submitting?");
// → "Yes, premium users can change their vote within 1 hour of submission."
```

---

## Підводні камені (Gotchas)

### 1. Chunk розмір впливає на якість більше ніж модель
Занадто маленькі chunks (< 100 токенів) — втрачається контекст. Занадто великі (> 1000) — релевантна інформація "розбавляється". Оптимум для більшості задач: 300–500 токенів з 50-100 overlap.

### 2. Embedding model ≠ LLM
Для Claude RAG потрібна окрема embedding модель (Voyage, OpenAI, etc.). Embeddings і generation — різні моделі, різні API ключі, різна оплата.

### 3. "Lost in the middle" при RAG
Якщо топ-K чанків великі і ти кладеш їх послідовно — найважливіша інформація може опинитись посередині контексту де Claude гірше її використовує. Клади найрелевантніший chunk першим або останнім.

### 4. Metadata filtering — важливіший ніж здається
Без фільтрації по metadata семантичний пошук може повернути чанки з нерелевантних документів з випадково схожим текстом. Завжди зберігай `source`, `date`, `category` і фільтруй.

### 5. RAG не замінює fine-tuning для стилю
RAG дає факти і знання. Якщо потрібно щоб модель відповідала в специфічному тоні або форматі — це system prompt або fine-tuning, не RAG.

---

## Interview Q&A

**Q: What is RAG and why is it better than putting everything in the context window?**
A: RAG retrieves only the relevant document chunks at query time instead of stuffing everything into context. It's better for three reasons: your knowledge base may be too large to fit in any context window; data changes over time while a stuffed context is static; and with many users, each request is cheaper because you inject only 3–5 relevant chunks instead of the full corpus. The tradeoff is added infrastructure — you need an embedding model and a vector DB.

---

**Q: Що таке embedding і чому схожі тексти мають близькі вектори?**
A: Embedding — це перетворення тексту в числовий вектор де семантична схожість відображається як геометрична близькість. Моделі для embeddings натреновані на мільярдах пар "схожих" і "несхожих" текстів — вони вчаться поміщати схожі значення в одну область простору. Cosine similarity між двома векторами вимірює цю близькість: 0.9+ = дуже схожі, 0.5- = різні теми.

---

**Q: What's the difference between a vector DB and a regular database?**
A: A regular database searches by exact match or range (`WHERE text = 'X'`). A vector DB stores high-dimensional float arrays and finds the K nearest vectors using ANN (Approximate Nearest Neighbor) algorithms — this is fundamentally different and can't be done efficiently in SQL without extensions like pgvector. Vector DBs also store metadata alongside vectors for hybrid filtering.

---

**Q: Коли RAG не потрібен?**
A: Коли документів мало (< 50k токенів) — просто передай все в context window, це простіше і надійніше. Коли дані статичні і передбачувані — hardcode або system prompt. Коли потрібен актуальний веб-пошук — tool use з search API, а не RAG. Коли задача не потребує зовнішніх знань — LLM справляється сам.

---

**Q: What chunk size should you use and why does it matter?**
A: 300–500 tokens with 50-token overlap is a good default. Too small (< 100 tokens) and a chunk loses context — the sentence "He rejected it" needs surrounding paragraphs to make sense. Too large (> 1000 tokens) and the relevant fragment gets diluted by unrelated text, lowering the cosine similarity score for that specific query. Overlap prevents information loss at chunk boundaries.

---

**Q: Anthropic не має embedding model — як робити RAG з Claude?**
A: Anthropic рекомендує Voyage AI — вони спеціалізуються на retrieval embeddings і показують кращі результати для RAG задач ніж загальні моделі. Альтернативи: OpenAI `text-embedding-3-small` (дешевий), або локальна модель через `sentence-transformers`. Claude — тільки для generation кроку, embedding — окрема модель і окремий API.

---

## Правила напам'ять

```
RAG = Chunk → Embed → Store → (Query: Embed → Search → Inject) → Generate

Три причини використовувати RAG:
  1. Документи > context window
  2. Дані змінюються
  3. Багато юзерів, кожен отримує свій релевантний шматок

Chunking:
  Розмір оптимум: 300–500 токенів
  Overlap: 50–100 токенів
  Зберігай metadata: source, date, category

Embeddings:
  Claude не має свого embedding model
  Voyage AI → рекомендовано Anthropic
  OpenAI text-embedding-3-small → дешевий і простий

Vector DB вибір:
  Вже є Postgres → pgvector (Supabase = pgvector вбудований)
  Managed cloud  → Pinecone
  Dev/прототип   → Chroma

Поріг вибору:
  < 50k токенів   → context stuffing (простіше)
  50k–500k        → RAG або prompt caching
  > 500k          → RAG обов'язково

Cosine similarity:
  1.0 → ідентичні
  0.9+ → дуже схожі
  0.7+ → схожі (зазвичай достатньо для retrieval)
  0.5- → несхожі

Важливо:
  Найрелевантніший chunk → першим або останнім в context (lost-in-the-middle)
  Фільтруй по metadata — не тільки по семантиці
  RAG дає факти. Стиль і поведінку → system prompt, не RAG
```
