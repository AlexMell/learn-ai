import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// Streaming returns tokens as they are generated instead of waiting for the full response.
// This makes UIs feel responsive and is how Claude.ai works.

console.log("=== Method 1: Manual event loop ===\n");

const stream = await client.messages.stream({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  messages: [{ role: "user", content: "Write a haiku about TypeScript." }],
});

// Each chunk has a type. Print text deltas as they arrive.
for await (const chunk of stream) {
  if (
    chunk.type === "content_block_delta" &&
    chunk.delta.type === "text_delta"
  ) {
    process.stdout.write(chunk.delta.text);
  }
}

// finalMessage() waits for the stream to end and returns the complete message object.
const final = await stream.finalMessage();
console.log("\n\nStop reason:", final.stop_reason);
console.log("Usage:", final.usage);

// ─────────────────────────────────────────────────────────────────────────────

console.log("\n=== Method 2: Event callbacks (.on) ===\n");

// .on("text", cb) is a shortcut that fires for every text delta
const stream2 = client.messages.stream({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 128,
  messages: [{ role: "user", content: "Name three programming languages in a list." }],
});

stream2.on("text", (text) => process.stdout.write(text));

// finalText() resolves with the full concatenated text when streaming is done
const fullText = await stream2.finalText();
console.log("\n\nFull text collected:", fullText);
