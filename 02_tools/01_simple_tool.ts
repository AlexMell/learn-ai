import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// Tools let Claude request data or perform actions that you implement.
// You define available tools → Claude decides when/how to call them → you execute → Claude uses results.

// Step 1: Define tools. The input_schema is JSON Schema — Claude uses it to know what to pass.
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a city. Returns temperature and conditions.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: {
          type: "string",
          description: "City name, e.g. 'Kyiv' or 'London'",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit. Defaults to celsius.",
        },
      },
      required: ["city"],
    },
  },
];

// Step 2: Implement the tool (mock — would call a real API in production)
function getWeather(city: string, unit = "celsius") {
  const data: Record<string, { temp: number; conditions: string }> = {
    kyiv: { temp: 22, conditions: "sunny" },
    london: { temp: 15, conditions: "cloudy" },
    tokyo: { temp: 28, conditions: "humid" },
  };
  const weather = data[city.toLowerCase()] ?? { temp: 20, conditions: "unknown" };
  const temp =
    unit === "fahrenheit" ? (weather.temp * 9) / 5 + 32 : weather.temp;
  return { city, temperature: temp, unit, conditions: weather.conditions };
}

// Step 3: Send the initial request
const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 512,
  tools,
  messages: [{ role: "user", content: "What's the weather like in Kyiv right now?" }],
});

console.log("Stop reason:", response.stop_reason); // "tool_use"

// Step 4: If Claude wants to use a tool, execute it
for (const block of response.content) {
  if (block.type === "tool_use") {
    console.log(`\nClaude called: ${block.name}`);
    console.log("Input:", JSON.stringify(block.input, null, 2));

    const input = block.input as { city: string; unit?: string };
    const result = getWeather(input.city, input.unit);
    console.log("Tool result:", result);

    // Step 5: Send the tool result back — Claude will then write its final answer
    const finalResponse = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools,
      messages: [
        { role: "user", content: "What's the weather like in Kyiv right now?" },
        // Always include the full assistant turn (which contains the tool_use block)
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: block.id, // must match the id from the tool_use block
              content: JSON.stringify(result),
            },
          ],
        },
      ],
    });

    const finalBlock = finalResponse.content[0];
    if (finalBlock.type === "text") {
      console.log("\nClaude's answer:", finalBlock.text);
    }
  }
}
