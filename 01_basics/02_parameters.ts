import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// ─── TEMPERATURE ──────────────────────────────────────────────────────────────
// Controls randomness of token selection. Range: 0 to 1.
// 0 = always pick the most likely next token (deterministic, consistent)
// 1 = sample freely from the distribution (creative, varied)
console.log("=== Temperature ===");
const prompt = "Give me a one-word name for a robot.";

for (const temperature of [0, 0, 1, 1]) {
  const r = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    temperature,
    messages: [{ role: "user", content: prompt }],
  });
  const text = r.content[0];
  if (text.type === "text") {
    console.log(`  temperature=${temperature}: "${text.text.trim()}"`);
  }
}
// At temperature=0, both outputs should be identical.
// At temperature=1, they'll likely differ.

// ─── MAX TOKENS ───────────────────────────────────────────────────────────────
// Hard cap on response length. The SDK requires you to set this explicitly.
// If the model hits this limit, stop_reason = "max_tokens" (response is cut off).
console.log("\n=== max_tokens ===");
const truncated = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 5,
  messages: [{ role: "user", content: "Count from 1 to 20." }],
});
const truncatedText = truncated.content[0];
if (truncatedText.type === "text") {
  console.log(`  Response: "${truncatedText.text}"`);
  console.log(`  Stop reason: ${truncated.stop_reason}`); // "max_tokens"
}

// ─── STOP SEQUENCES ───────────────────────────────────────────────────────────
// Custom strings that stop generation when produced. The string itself is NOT
// included in the response. Useful for structured outputs or role-play boundaries.
console.log("\n=== stop_sequences ===");
const stopped = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 64,
  stop_sequences: ["3"],
  messages: [{ role: "user", content: "Count from 1 to 10, one number per line." }],
});
const stoppedText = stopped.content[0];
if (stoppedText.type === "text") {
  console.log("  Response (stops before '3'):\n", stoppedText.text);
  console.log("  Stop reason:", stopped.stop_reason); // "stop_sequence"
}

// ─── TOP P (nucleus sampling) ─────────────────────────────────────────────────
// Restricts token selection to the top-p% most probable tokens.
// top_p=0.1 → very conservative (only very likely tokens considered)
// top_p=1.0 → all tokens considered (default)
// Anthropic recommends changing temperature OR top_p, not both simultaneously.
console.log("\n=== top_p ===");
const conservative = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 30,
  top_p: 0.1,
  messages: [{ role: "user", content: "Describe clouds in one sentence." }],
});
const conservativeText = conservative.content[0];
if (conservativeText.type === "text") {
  console.log("  top_p=0.1:", conservativeText.text.trim());
}
