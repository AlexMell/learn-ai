import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// countTokens() estimates how many input tokens your request will use,
// without actually running inference. Use it to:
// - Prevent "prompt too long" errors before they happen
// - Estimate costs before sending expensive requests
// - Decide when to summarize/truncate conversation history

const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "Explain quantum entanglement in simple terms." },
];

const tokenCount = await client.messages.countTokens({
  model: "claude-sonnet-4-6",
  system: "You are a physics teacher for high school students.",
  messages,
});

console.log("Input tokens (prompt + system):", tokenCount.input_tokens);

// Context window = maximum total tokens (input + output) per request
const CONTEXT_WINDOWS = {
  "claude-haiku-4-5-20251001": 200_000,
  "claude-sonnet-4-6": 200_000,
  "claude-opus-4-7": 200_000,
};

const model = "claude-sonnet-4-6" as keyof typeof CONTEXT_WINDOWS;
const contextWindow = CONTEXT_WINDOWS[model];

console.log(`Context window:   ${contextWindow.toLocaleString()}`);
console.log(`Tokens remaining: ${(contextWindow - tokenCount.input_tokens).toLocaleString()}`);

// Rough cost estimate — verify current prices at anthropic.com/pricing
// claude-sonnet-4-6: $3 / million input tokens
const estimatedCost = (tokenCount.input_tokens / 1_000_000) * 3;
console.log(`Estimated input cost: $${estimatedCost.toFixed(6)}`);

// ─────────────────────────────────────────────────────────────────────────────
// Token count grows with every turn — important to track in long conversations

console.log("\n=== Token growth per turn ===");

const history: Anthropic.MessageParam[] = [];

for (const userMsg of [
  "Hi!",
  "Tell me about the moon.",
  "How far is it from Earth?",
  "What's its diameter?",
]) {
  history.push({ role: "user", content: userMsg });

  const count = await client.messages.countTokens({
    model: "claude-sonnet-4-6",
    messages: history,
  });

  console.log(`After "${userMsg}": ${count.input_tokens} tokens`);

  // Simulate adding an assistant turn to the history
  history.push({
    role: "assistant",
    content: "This is a placeholder assistant response for demonstration purposes.",
  });
}
