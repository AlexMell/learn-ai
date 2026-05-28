// Task 1: Ask a question
//
// Send a message to Claude and print the response text to the console.
//
// Requirements:
//   - Use model: claude-haiku-4-5-20251001
//   - max_tokens: 256
//   - Ask anything you want
//   - Print only the text of the response (not the full object)
//
// Expected output:
//   Something like: "The capital of France is Paris."
//
// Hint: response.content[0] is a block — check its .type before reading .text

import { Anthropic } from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  messages: [
    {
      role: "user",
      content: "What is the capital of France?"
    },
  ],
});

const block = response.content[0];


if (block.type === "text") {
  console.log(block);
  console.log(response);
  console.log("Answer:", block.text);
}