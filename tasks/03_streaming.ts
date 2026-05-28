// Task 3: Streaming
//
// Stream a response token by token and print each chunk as it arrives.
// At the end, print the total token usage from the final message.
//
// Requirements:
//   - Ask Claude to write a short poem (4 lines) about JavaScript
//   - Print each text chunk immediately as it arrives (no newline between chunks)
//   - After the stream ends, print on a new line: "Tokens: X input, Y output"
//
// Expected output (roughly):
//   JavaScript flows like a stream,
//   ...rest of poem...
//   Tokens: 24 input, 41 output
//
// Hint: use client.messages.stream(), iterate with for await
//       finalMessage() gives you usage after the loop

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

const stream = client.messages.stream({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  messages: [{ role: "user", content: "write a short poem (4 lines) about JavaScript" }]
});

for await (const chunk of stream) {
  if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
    console.log(chunk.delta.text);
    console.log('=====');
  }
}

const final = await stream.finalMessage();

console.log(final.stop_reason);
console.log("usage", final.usage);
console.log(`\nTokens: ${final.usage.input_tokens} input, ${final.usage.output_tokens} output`);