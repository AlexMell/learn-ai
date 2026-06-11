// Task 8: Safe agentic loop
//
// Task 05 showed you how to build an agentic loop.
// This task shows you why that loop is dangerous in production —
// and how to make it safe.
//
// Without guards, an agent can:
//   - loop forever if it gets confused (infinite API calls → infinite bill)
//   - silently repeat the same tool call without making progress
//   - cost $50 on a task you expected to cost $0.01
//
// You'll add three production guards that every real agent needs:
//   MAX_ITERATIONS  — hard stop so it can't loop forever
//   cost budget     — abort if spend exceeds a dollar threshold
//   loop detection  — catch when the agent is stuck (same call twice in a row)
//
// Build a tool-using agent that won't run forever or burn your budget.
// The agent solves simple math word problems using a calculator tool.
//
// Requirements:
//   1. MAX_ITERATIONS = 8 — hard stop, no exceptions
//   2. Cost budget — track input + output tokens, stop if cost exceeds $0.01
//      (Haiku pricing: input $1/1M tokens, output $5/1M tokens)
//   3. Loop detection — if the same tool call (name + JSON args) repeats
//      twice in a row, abort with "loop detected"
//   4. Structured return — the agent function returns:
//        { success: true,  result: string, iterations: number, costUsd: number }
//      or
//        { success: false, error: string,  iterations: number, costUsd: number }
//   5. Print a one-line summary after each iteration:
//        [iter 1] tool: calculate | expr: "2 + 2"
//        [iter 2] end_turn — done
//
// Tool to implement:
//   name: "calculate"
//   description: "Evaluate a math expression. Returns the numeric result."
//   input: { expression: string }
//   implementation: use Function() or eval() to compute it, return result as string
//
// Test goals (run the agent on each):
//   "What is 123 * 456?"
//   "If a train travels 60 km/h for 2.5 hours, how far does it go?"
//
// Expected output (example):
//   [iter 1] tool: calculate | expr: "123 * 456"
//   [iter 2] end_turn — done
//   Result: 56088 | iterations: 2 | cost: $0.000021
//
// Hints:
//   - tool_use blocks have: id, name, input
//   - tool_result goes into messages as: { role: "user", content: [{ type: "tool_result", tool_use_id, content }] }
//   - track totalInputTokens and totalOutputTokens across all iterations
//   - loop detection: compare JSON.stringify({ name, input }) of current tool call
//     with the previous one

import { Anthropic } from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

const MAX_ITERATIONS = 8;

const tools: Anthropic.Tool[] = [
  {
    name: "calculator",
    description: "Evaluate a math expression. Returns the numeric result.",
    input_schema: {
      type: "object" as const,
      properties: {
        expression: { type: "string" }
      },
      required: ["expression"]
    }
  }
]

const runAgent = async (goal: string) => {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: goal }];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastToolCall = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      tools,
      messages,
    });

    messages.push({role: "assistant", content: res.content})

    const textBlock = res.content.find(b => b.type === "text");
    const resultText = textBlock?.type === "text" ? textBlock.text : '';
    totalInputTokens += res.usage.input_tokens;
    totalOutputTokens += res.usage.output_tokens;
    const costUsed = (totalInputTokens / 1_000_000) * 1 + (totalOutputTokens / 1_000_000) * 5;

    if (costUsed > 0.01) return { success: false, error: "budget exceeded", iterations: i + 1, costUsd: costUsed };
    if (res.stop_reason === 'end_turn') {
      console.log(`[iter ${i + 1}] end_turn — done`);
      return {
        success: true, result: resultText, iterations: i+1, costUsd: costUsed
      };
    }
    if (res.stop_reason === "tool_use") {
      const toolUseBlock = res.content.find(b => b.type === "tool_use");
      if (!toolUseBlock || toolUseBlock.type !== "tool_use") break;

      const { id, name, input } = toolUseBlock;
      const expr = (input as { expression: string }).expression;
      
      const callSignature = JSON.stringify({ name, input });
      if (callSignature === lastToolCall) return { success: false, error: "loop detected", iterations: i + 1, costUsd: costUsed };
      lastToolCall = callSignature;

      const calcResult = String(Function(`"use strict"; return (${expr})`)());

      console.log(`[iter ${i + 1}] tool: ${name} | expr: "${expr}"`);

      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: id, content: calcResult }]
      });

      
    }
  }

  const costUsed = (totalInputTokens / 1_000_000) * 1 + (totalOutputTokens / 1_000_000) * 5;
  return { success: false, error: "MAX_ITERATIONS exceeded", iterations: MAX_ITERATIONS, costUsd: costUsed };
}

const goals = [
  "What is 123 * 456?",
  "If a train travels 60 km/h for 2.5 hours, how far does it go?"
];

for (const goal of goals) {
  console.log(`\nGoal: ${goal}`);
  const result = await runAgent(goal);
  if (result.success) {
    console.log(`Result: ${result.result} | iterations: ${result.iterations} | cost: $${result.costUsd.toFixed(6)}`);
  } else {
    console.log(`Failed: ${result.error} | iterations: ${result.iterations}`);
  }
}