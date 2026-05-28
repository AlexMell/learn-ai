import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// Prompt caching lets you reuse parts of your prompt across requests.
// Cached tokens are stored server-side for 5 minutes — re-reads cost 10x less.
//
// Best for: large system prompts, reference documents, few-shot examples.
//
// Pricing (claude-sonnet-4-6, verify at anthropic.com/pricing):
//   Normal input: $3.00 / M tokens
//   Cache write:  $3.75 / M tokens  (slightly more to write)
//   Cache read:   $0.30 / M tokens  (10x cheaper to read)

// Simulate a large document (in reality: API docs, a codebase, legal text, etc.)
const LARGE_DOCUMENT = `
TypeScript Best Practices Guide
${"Rule: Use strict mode. Always enable noImplicitAny, strictNullChecks. ".repeat(80)}
Key principles: prefer interfaces over type aliases for object shapes,
avoid 'any' — use 'unknown' instead, always annotate function return types.
`.trim();

// ─── Request 1: CACHE WRITE ───────────────────────────────────────────────────
console.log("=== Request 1 (cache write) ===");

const req1 = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 128,
  system: [
    {
      type: "text",
      text: LARGE_DOCUMENT,
      // cache_control marks this block to be cached after this request
      cache_control: { type: "ephemeral" },
    },
  ],
  messages: [{ role: "user", content: "Summarize the key rules in one sentence." }],
});

// cache_creation_input_tokens > 0 means the cache was written
console.log("Cache write tokens:", req1.usage.cache_creation_input_tokens ?? 0);
console.log("Cache read tokens: ", req1.usage.cache_read_input_tokens ?? 0);
const r1 = req1.content[0];
if (r1.type === "text") console.log("Response:", r1.text);

// ─── Request 2: CACHE READ (run within 5 minutes of request 1) ───────────────
console.log("\n=== Request 2 (cache read) ===");

const req2 = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 128,
  system: [
    {
      type: "text",
      text: LARGE_DOCUMENT, // must be identical to trigger cache hit
      cache_control: { type: "ephemeral" },
    },
  ],
  messages: [{ role: "user", content: "What does the guide say about 'any'?" }],
});

// cache_read_input_tokens > 0 confirms the cache was hit
console.log("Cache write tokens:", req2.usage.cache_creation_input_tokens ?? 0);
console.log("Cache read tokens: ", req2.usage.cache_read_input_tokens ?? 0);
const r2 = req2.content[0];
if (r2.type === "text") console.log("Response:", r2.text);
