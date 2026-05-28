import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();
// API key is read from ANTHROPIC_API_KEY env var automatically

const response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 256,
  messages: [
    {
      role: "user",
      content: "What is 2 + 2? Answer in one sentence.",
    },
  ],
});

// response.content is an array — it can contain text blocks and tool_use blocks
const block = response.content[0];
if (block.type === "text") {
  console.log("Answer:", block.text);
}

// stop_reason explains why the model stopped generating:
// "end_turn"      — model finished naturally
// "max_tokens"    — hit the max_tokens limit (response was cut off)
// "tool_use"      — model wants to call a tool
// "stop_sequence" — hit one of your custom stop sequences
console.log("Stop reason:", response.stop_reason);

// usage tracks token consumption — important for understanding costs
// input_tokens  = tokens you sent (prompt + system)
// output_tokens = tokens the model generated
console.log("Usage:", response.usage);
