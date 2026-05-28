// Task 4: Simple tool use
//
// Give Claude a "get_weather" tool and handle the full cycle:
// request → tool_use → execute → tool_result → final answer.
//
// Requirements:
//   - Define a tool "get_weather" that takes: city (string), required
//   - Ask: "What's the weather in London?"
//   - If Claude calls the tool, print: "Tool called: get_weather({ city: 'London' })"
//   - Return this mock result: { city: "London", temp: 18, conditions: "rainy" }
//   - Send the result back and print Claude's final text response
//
// Expected output:
//   Tool called: get_weather({ "city": "London" })
//   Claude: It's 18°C and rainy in London...
//
// Hint: check stop_reason === "tool_use" on the first response
//       block.id is needed for tool_result

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    input_schema: {
      type: "object" as const,
      properties: {
        city: {
          type: "string",
          description: "City name, e.g Kyiv or London",
        },
        unit: {
          type: "string",
          enum: ["celsius"],
          description: "Temperature unit."
        }
      },
      required: ["city"],
    },
  },
]

const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 512,
  tools,
  messages: [{ role: "user", content: "what the weather in london right now?" }]
});

for (const block of response.content) {
  if (block.type === 'tool_use') {
    console.log(`Tool called: ${block.name}(${JSON.stringify(block.input)})`);

    const mockResult = { city: "London", temp: 18, conditions: 'rainy'};

    const finalResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools,
      messages: [
        { role: "user", content: "what the weather in london right now?" },
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(mockResult) }]
        }
      ]
    });

    const finalBlock = finalResponse.content[0];
    if (finalBlock.type === "text") {
      console.log("Claude:", finalBlock.text);
    }
  }
}