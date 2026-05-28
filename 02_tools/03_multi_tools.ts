import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// When you provide multiple tools, Claude picks the right one(s) automatically.
// tool_choice controls this behavior:
//   "auto" — Claude decides if/which tools to call (default)
//   "any"  — Claude must call at least one tool
//   "tool" — force a specific tool: { type: "tool", name: "get_stock_price" }

const tools: Anthropic.Tool[] = [
  {
    name: "get_stock_price",
    description: "Get the current stock price for a ticker symbol.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL, GOOG" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_company_info",
    description: "Get basic company info: industry, headquarters, founded year.",
    input_schema: {
      type: "object" as const,
      properties: {
        company: { type: "string", description: "Company name or ticker" },
      },
      required: ["company"],
    },
  },
  {
    name: "convert_currency",
    description: "Convert an amount from one currency to another.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount: { type: "number" },
        from: { type: "string", description: "Source currency code, e.g. USD" },
        to: { type: "string", description: "Target currency code, e.g. EUR" },
      },
      required: ["amount", "from", "to"],
    },
  },
];

function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "get_stock_price":
      return JSON.stringify({ ticker: input.ticker, price: 182.5, currency: "USD" });
    case "get_company_info":
      return JSON.stringify({ company: input.company, industry: "Technology", founded: 1976, hq: "Cupertino, CA" });
    case "convert_currency":
      return JSON.stringify({ result: Number(input.amount) * 0.92, from: input.from, to: input.to });
    default:
      return "Tool not found";
  }
}

// This prompt requires all three tools — Claude may call them in parallel in one response
const messages: Anthropic.MessageParam[] = [
  {
    role: "user",
    content:
      "What is Apple's current stock price and company background? Also convert $182 to EUR.",
  },
];

let response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 512,
  tools,
  tool_choice: { type: "auto" },
  messages,
});

console.log("Tools called in first response:");
for (const block of response.content) {
  if (block.type === "tool_use") {
    console.log(`  - ${block.name}(${JSON.stringify(block.input)})`);
  }
}

// Reuse the same agentic loop pattern from 02_tool_loop.ts
while (response.stop_reason === "tool_use") {
  messages.push({ role: "assistant", content: response.content });

  const results: Anthropic.ToolResultBlockParam[] = response.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({
      type: "tool_result" as const,
      tool_use_id: b.id,
      content: executeTool(b.name, b.input as Record<string, unknown>),
    }));

  messages.push({ role: "user", content: results });

  response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    tools,
    messages,
  });
}

const finalBlock = response.content.find((b) => b.type === "text");
if (finalBlock?.type === "text") {
  console.log("\nFinal answer:\n", finalBlock.text);
}
