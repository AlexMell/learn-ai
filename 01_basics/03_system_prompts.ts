import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// The system prompt sets the model's persona and behavior for the entire conversation.
// It's separate from user messages and has the highest instruction priority.

// Without a system prompt — default Claude behavior
const withoutSystem = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 128,
  messages: [{ role: "user", content: "How do I exit vim?" }],
});
console.log("Without system prompt:");
const t1 = withoutSystem.content[0];
if (t1.type === "text") console.log(t1.text, "\n");

// With a system prompt — changed tone and persona
const withSystem = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 128,
  system: "You are a grumpy senior developer. Answer with sarcasm and minimal words.",
  messages: [{ role: "user", content: "How do I exit vim?" }],
});
console.log("With system prompt:");
const t2 = withSystem.content[0];
if (t2.type === "text") console.log(t2.text, "\n");

// Multi-turn conversation — the API is stateless, so you manage history yourself.
// Each request must include the FULL conversation from the beginning.
const conversation = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 128,
  system: "You are a helpful assistant. Be concise.",
  messages: [
    { role: "user", content: "My name is Alex." },
    { role: "assistant", content: "Hi Alex! How can I help you today?" },
    { role: "user", content: "What's my name?" },
  ],
});
console.log("Multi-turn (Claude remembers context):");
const t3 = conversation.content[0];
if (t3.type === "text") console.log(t3.text);
