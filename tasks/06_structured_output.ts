// Task 6: Structured output
//
// Force Claude to always return data in a specific JSON shape
// by using tool_choice instead of asking for JSON in the prompt.
//
// Requirements:
//   - Define a tool "save_person" with: name (string), age (number), city (string) — all required
//   - Force Claude to call it using tool_choice
//   - Ask: "Extract the person: John is 28 years old and lives in Kyiv."
//   - Print the extracted data as: "Name: X, Age: Y, City: Z"
//
// Expected output:
//   Name: John, Age: 28, City: Kyiv
//
// Hint: tool_choice: { type: "tool", name: "save_person" } forces Claude to call it
//       the data you need is in block.input, no second request needed

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "save_person",
    description: "save person by name age and city",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "name of person"
        },
        age: {
          type: "number",
          description: "age of person"
        },
        city: {
          type: "string",
          description: "city of person"
        }
      },
      required: ["name", "age", "city"]
    }
  }
]

const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content: "Extract the person: Oleksii is 34 years old and lives in Kyiv."
  }
]

let response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 512,
  tools,
  tool_choice: { type: "tool", name: "save_person" },
  messages
});

for (const block of response.content) {
  if (block.type === "tool_use") {
    const input = block.input as { name: string; age: number; city: string };
    console.log(`Name: ${input.name}, Age: ${input.age}, City: ${input.city}`);
  }
}