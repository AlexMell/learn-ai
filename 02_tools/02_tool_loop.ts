import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// A real agent may call tools multiple times before arriving at an answer.
// This is the core agentic loop:
//   1. Send messages → 2. Execute tool calls → 3. Add results → repeat until end_turn

const tools: Anthropic.Tool[] = [
  {
    name: "calculator",
    description: "Perform one arithmetic operation at a time: add, subtract, multiply, divide.",
    input_schema: {
      type: "object" as const,
      properties: {
        operation: { type: "string", enum: ["add", "subtract", "multiply", "divide"] },
        a: { type: "number" },
        b: { type: "number" },
      },
      required: ["operation", "a", "b"],
    },
  },
];

function calculate(op: string, a: number, b: number): number {
  if (op === "add") return a + b;
  if (op === "subtract") return a - b;
  if (op === "multiply") return a * b;
  if (op === "divide") return a / b;
  throw new Error(`Unknown operation: ${op}`);
}

const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: "What is (25 * 4) + (100 / 5)? Work through each step.",
  },
];

console.log("Starting agentic loop...\n");
let iteration = 0;

while (true) {
  iteration++;
  console.log(`--- Iteration ${iteration} ---`);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    tools,
    messages,
  });

  console.log("Stop reason:", response.stop_reason);

  if (response.stop_reason === "end_turn") {
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock?.type === "text") {
      console.log("\nFinal answer:", textBlock.text);
    }
    break;
  }

  if (response.stop_reason === "tool_use") {
    // Append Claude's turn (with tool_use blocks) to history
    messages.push({ role: "assistant", content: response.content });

    // Execute every tool call in this turn, collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const input = block.input as { operation: string; a: number; b: number };
        console.log(`  ${input.operation}(${input.a}, ${input.b})`);

        const result = calculate(input.operation, input.a, input.b);
        console.log(`  = ${result}`);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(result),
        });
      }
    }

    // All tool results go in a single user turn
    messages.push({ role: "user", content: toolResults });
  }
}
