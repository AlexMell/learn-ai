// Task 5: Agentic loop
//
// Build a loop that keeps calling Claude until it stops asking for tools.
// Claude will need multiple tool calls to solve the problem.
//
// Requirements:
//   - Tool "calculator" with: operation ("add" | "subtract" | "multiply" | "divide"), a (number), b (number)
//   - Ask: "What is (10 * 5) - (100 / 4)?"
//   - Loop until stop_reason === "end_turn"
//   - Each iteration print: "Iteration X — stop_reason: Y"
//   - Each tool call print: "  > operation(a, b) = result"
//   - At the end print Claude's final answer
//
// Expected output:
//   Iteration 1 — stop_reason: tool_use
//     > multiply(10, 5) = 50
//     > divide(100, 4) = 25
//   Iteration 2 — stop_reason: tool_use
//     > subtract(50, 25) = 25
//   Iteration 3 — stop_reason: end_turn
//   Claude: The result of (10 * 5) - (100 / 4) is 25.
//
// Hint: push { role: "assistant", content: response.content } before tool results
//       all tool results go in one user turn as an array

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "calculator",
    description: "Perform one arithemetic operation at a time: add, subtract, multiply, divide.",
    input_schema: {
      type: "object" as const,
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
        },
        a: {type: "number"},
        b: {type: "number"},
      },
      required: ["operation", "a", "b"]
    }
  }
]

const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: 'What is (25 * 4) + (100 / 5)? work through each step.',
  }
]

function calculate(op: string, a: number, b: number): number {
  if (op === "add") {
    console.log(`> add(${a}, ${b} = ${a + b})`);
    return a + b;
  }
  if (op === "subtract") {
    console.log(`> subtract(${a}, ${b} = ${a - b})`);
    return a - b;
  }
  if (op === "multiply") {
    console.log(`> multiply(${a}, ${b} = ${a * b})`);
    return a * b;
  }
  if (op === "divide") {
    console.log(`> divide(${a}, ${b} = ${a / b})`);
    return a / b
  };

  throw new Error(`Unknown operation: ${op}`);
}

const MAX_ITERATIONS = 10;
let iteration = 0;


while (iteration < MAX_ITERATIONS) {
  iteration++;
  console.log('Itertation --->', iteration);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    tools,
    messages
  });

  console.log("Stop reason: ", response.stop_reason);

  if(response.stop_reason === "end_turn") {
    const textBlock = response.content.find((b) => b.type === "text");

    if (textBlock?.type === "text"){
      console.log("\nClaude:", textBlock.text);
    }

    break;
  }

  if(response.stop_reason === "tool_use") {
    messages.push({ role: "assistant", content: response.content});

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const input = block.input as {operation: string; a: number; b:number};
        const result = calculate(input.operation, input.a, input.b);

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: String(result)
        });
      }
    }

    messages.push({role: "user", content: toolResults})
  }
}