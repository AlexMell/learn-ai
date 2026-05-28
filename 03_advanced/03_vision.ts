import Anthropic from "@anthropic-ai/sdk";
// import { readFileSync } from "fs"; // needed for the base64 local file method below
import "dotenv/config";

const client = new Anthropic();

// Claude can process images alongside text.
// Two ways to provide an image:
//   1. URL    — public image URL (simpler, no upload needed)
//   2. Base64 — encode and send the image bytes directly (works for local files)

// ─── Method 1: URL ─────────────────────────────────────────────────────────
console.log("=== Method 1: Image from URL ===");

const urlResponse = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 128,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "url",
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
          },
        },
        {
          type: "text",
          text: "What do you see in this image? One sentence.",
        },
      ],
    },
  ],
});

const urlText = urlResponse.content[0];
if (urlText.type === "text") console.log(urlText.text);

// ─── Method 2: Base64 (local file) ─────────────────────────────────────────
// Uncomment to test with a local image:

/*
console.log("\n=== Method 2: Local image (base64) ===");
const imageBuffer = readFileSync("./path/to/image.png");

const base64Response = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 128,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png", // or image/jpeg, image/gif, image/webp
            data: imageBuffer.toString("base64"),
          },
        },
        { type: "text", text: "Describe what you see." },
      ],
    },
  ],
});

const base64Text = base64Response.content[0];
if (base64Text.type === "text") console.log(base64Text.text);
*/

// ─── Multiple images in one request ────────────────────────────────────────
console.log("\n=== Multiple images ===");

const multiResponse = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 128,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "For each image below, state what color dominates." },
        {
          type: "image",
          source: {
            type: "url",
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
          },
        },
        { type: "text", text: "Image 1 above. Image 2 below:" },
        {
          type: "image",
          source: {
            type: "url",
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png",
          },
        },
      ],
    },
  ],
});

const multiText = multiResponse.content[0];
if (multiText.type === "text") console.log(multiText.text);
