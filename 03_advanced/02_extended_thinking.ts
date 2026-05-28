import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// Extended thinking gives Claude a private scratchpad to reason through hard problems
// before writing its final answer. Thinking tokens don't appear in the response
// unless you choose to display them.
//
// Use for: complex math, multi-step logic, architecture decisions, puzzles.
// Requires: claude-sonnet-4-6 or claude-opus-4-7 (not haiku).
// Requires: streaming (non-streaming is not supported for extended thinking).

console.log("Solving a logic puzzle with extended thinking...\n");

const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: 16_000,
  thinking: {
    type: "enabled",
    // budget_tokens: how many tokens Claude can spend on thinking.
    // More budget = deeper reasoning, but slower and more expensive.
    budget_tokens: 8_000,
  },
  messages: [
    {
      role: "user",
      content: `
        Alice, Bob, and Carol each like exactly one color: red, blue, or green.
        - Alice does not like red.
        - Bob does not like blue.
        - Carol does not like green.
        Who likes which color?
      `.trim(),
    },
  ],
});

// Streaming emits content_block_start to signal a new block type
for await (const chunk of stream) {
  if (chunk.type === "content_block_start") {
    if (chunk.content_block.type === "thinking") {
      process.stdout.write("\n[THINKING]\n");
    } else if (chunk.content_block.type === "text") {
      process.stdout.write("\n[ANSWER]\n");
    }
  }

  if (chunk.type === "content_block_delta") {
    if (chunk.delta.type === "thinking_delta") {
      process.stdout.write(chunk.delta.thinking);
    } else if (chunk.delta.type === "text_delta") {
      process.stdout.write(chunk.delta.text);
    }
  }
}

const final = await stream.finalMessage();
console.log("\n\n--- Usage ---");
// output_tokens includes both thinking tokens and response tokens
console.log(final.usage);
