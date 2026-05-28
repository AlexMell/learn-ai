# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

A hands-on learning repo for the Anthropic Claude API — understanding how LLMs work through working TypeScript examples.

## Setup

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
```

## Running examples

```bash
npx tsx 01_basics/01_hello_claude.ts
npx tsx 02_tools/02_tool_loop.ts
# etc.
```

No build step needed — tsx runs TypeScript directly.

## Structure

```
01_basics/
  01_hello_claude.ts     — messages.create, content blocks, stop_reason, usage
  02_parameters.ts       — temperature, max_tokens, stop_sequences, top_p
  03_system_prompts.ts   — system prompt, multi-turn conversation history
  04_streaming.ts        — stream(), content_block_delta events, finalMessage()
  05_token_counting.ts   — countTokens(), context window limits, cost estimation

02_tools/
  01_simple_tool.ts      — tool definition, tool_use block, tool_result
  02_tool_loop.ts        — agentic loop: repeat until stop_reason = "end_turn"
  03_multi_tools.ts      — multiple tools, tool_choice, parallel tool calls

03_advanced/
  01_prompt_caching.ts   — cache_control, cache_creation vs cache_read tokens
  02_extended_thinking.ts — thinking: { type: "enabled", budget_tokens }
  03_vision.ts           — image input via URL and base64
```

## Key concepts

- **Stateless API** — every request must include the full conversation history.
- **content[]** — responses are an array of blocks (`text` or `tool_use`), not a plain string.
- **stop_reason** drives the agentic loop: `end_turn` = done, `tool_use` = execute tools and continue.
- **Prompt caching** requires the cached text block to be byte-identical across requests (same model too).
- **Extended thinking** requires streaming and `claude-sonnet-4-6` or `claude-opus-4-7`.
