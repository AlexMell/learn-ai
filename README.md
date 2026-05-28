# learn-ai

Hands-on learning repo for the Claude API — working TypeScript examples, tasks, and tutorials.

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
| `01_basics/` | Core API concepts: messages, parameters, system prompts, streaming, token counting |
| `02_tools/` | Tool use: single tool, agentic loop, multiple tools |
| `03_advanced/` | Prompt caching, extended thinking, vision |
| `tasks/` | Practical exercises — write the code yourself |
| `tutorial/` | Line-by-line explanations, concept deep-dives, glossary |

## Quick reference

- `tutorial/glossary.md` — all terms and abbreviations explained
- `tutorial/tasks/` — breakdown of every task solution
- `tutorial/01_basics/` … `tutorial/03_advanced/` — concept tutorials with interview tips
