// Task 2: Multi-turn conversation
//
// Build a 3-turn conversation where Claude remembers context between messages.
// The API is stateless — you manage history yourself.
//
// Requirements:
//   - system prompt: "You are a concise assistant. Answer in max 2 sentences."
//   - Turn 1 — user: "My name is Alex and I'm learning Claude API."
//   - Turn 2 — user: "What am I learning?"
//   - Turn 3 — user: "What's my name?"
//   - After each turn, print: "Claude: <response text>"
//
// Expected: Claude should correctly answer turns 2 and 3 using conversation history.
//
// Hint: after each turn you need to append both the user message
//       and the assistant response to the messages array before the next request.

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config"; // читає ANTHROPIC_API_KEY з .env

// клієнт автоматично бере ключ з process.env.ANTHROPIC_API_KEY
const client = new Anthropic();

// API stateless — ми самі зберігаємо всю історію розмови
const messages: Anthropic.MessageParam[] = [];

const turns = [
  "My name is Alex and I'm learning Claude API.",
  "What am I learning?",
  "What's my name?"
]

for (const userText of turns) {
  // спочатку додаємо хід юзера, щоб він потрапив у контекст запиту
  messages.push({role: "user", content: userText });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: "You are a concise assistant. Answer in max 2 sentences.",
    messages // передаємо всю історію щоразу — так модель "пам'ятає" контекст
  });

  // content — масив блоків (текст, інструменти тощо), беремо перший
  const block = response.content[0];

  if (block.type === "text") {
    console.log(`Claude: ${block.text}`);
    // зберігаємо відповідь асистента — інакше наступний хід не матиме контексту
    messages.push({role: "assistant", content: block.text})
  }

}



