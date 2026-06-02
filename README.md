# learn-ai

Hands-on learning repo for the Claude API — working TypeScript examples, tasks, and interview prep.

## Setup

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY from console.anthropic.com
```

## Running examples

```bash
npx tsx 01_basics/01_hello_claude.ts
npx tsx tasks/01_ask_a_question.ts
# etc.
```

## Structure

| Folder | What's inside |
|---|---|
| `01_basics/` | Core API: messages, parameters, system prompts, streaming, token counting |
| `02_tools/` | Tool use: single tool, agentic loop, multiple tools |
| `03_advanced/` | Prompt caching, extended thinking, vision |
| `tasks/` | Practical exercises — write the code yourself |
| `tutorial/` | Line-by-line explanations, concept deep-dives, glossary |
| `tutorial/definitions/` | Concept notes: tokens, generation, context window, prompting, eval |
| `tutorial/definitions/review-app/` | Flashcards + Quiz app to study for interviews (open in browser) |

## Commands

Custom slash commands for Claude Code (type in the chat):

| Command | What it does |
|---|---|
| `/define <topic>` | Creates a new study note in `tutorial/definitions/` — interview answer, 7-річному, core concepts, gotchas, Q&A, правила напам'ять. Also updates `glossary.md` with new terms. |
| `/update-review-app` | Syncs `review-app/index.html` with all files in `tutorial/definitions/` — adds new flashcards, quiz questions, filters, and cheatsheet sections for any topic not yet in the app. |
| `/doc-task <filename>` | Creates a tutorial explanation in `tutorial/tasks/` for a given task file. |

**Typical workflow:**
```
/define RAG та embeddings
/update-review-app
```

## Quick reference

| File | Purpose |
|---|---|
| `tutorial/glossary.md` | All terms and abbreviations explained (~60 entries) |
| `tutorial/definitions/tokens.md` | Tokens, BPE, why Ukrainian costs more |
| `tutorial/definitions/generation.md` | Next token prediction, temperature, top-p, hallucinations |
| `tutorial/definitions/context_window.md` | Context window, lost in the middle, RAG strategies |
| `tutorial/definitions/system_prompt.md` | System vs user prompt, what goes where, code examples |
| `tutorial/definitions/prompting_basics.md` | Zero-shot, few-shot, CoT, role prompting |
| `tutorial/definitions/structured_output.md` | JSON output, XML tags, assistant prefill, tool use |
| `tutorial/definitions/prompt_evaluation.md` | Metrics, A/B testing, LLM-as-judge, eval process |
| `tutorial/definitions/review-app/index.html` | Open in browser: 41 flashcards + 27 quiz questions |
