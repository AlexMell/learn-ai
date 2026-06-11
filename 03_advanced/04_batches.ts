import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

// The Batches API processes requests asynchronously — up to 100 000 per batch.
// Trade-off: results take up to 24 h (usually < 1 h), but you pay 50% less.
// Great for: bulk processing, evaluation runs, data pipelines.

// ─── Step 1: Create a batch ────────────────────────────────────────────────
// Each request needs a unique custom_id (your reference) and params
// (same shape as a regular messages.create call).

console.log("=== Step 1: Creating batch ===");

const LANGUAGES = [
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "ja", name: "Japanese" },
  { id: "uk", name: "Ukrainian" },
];

const batch = await client.messages.batches.create({
  requests: LANGUAGES.map(({ id, name }) => ({
    custom_id: `translate-${id}`,
    params: {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: `Translate "Hello, world!" to ${name}. Reply with the translation only.`,
        },
      ],
    },
  })),
});

console.log(`Batch ID:  ${batch.id}`);
console.log(`Status:    ${batch.processing_status}`);
console.log(`Requests:  ${batch.request_counts.processing} queued\n`);

// ─── Step 2: Poll until done ───────────────────────────────────────────────
// processing_status transitions: in_progress → ended
// Batches typically finish in minutes; 24 h is the hard deadline.

console.log("=== Step 2: Polling for completion ===");

let current = batch;
while (current.processing_status !== "ended") {
  await new Promise((r) => setTimeout(r, 30_000)); // wait 30 s between polls
  current = await client.messages.batches.retrieve(batch.id);
  const { processing, succeeded, errored, expired } = current.request_counts;
  console.log(
    `Status: ${current.processing_status} | ` +
      `processing=${processing} succeeded=${succeeded} errored=${errored} expired=${expired}`
  );
}

console.log(
  `\nBatch ended — succeeded: ${current.request_counts.succeeded}, ` +
    `errored: ${current.request_counts.errored}, expired: ${current.request_counts.expired}\n`
);

// ─── Step 3: Process results ───────────────────────────────────────────────
// batches.results() returns an async iterable of BatchResult objects.
// Each result has:
//   custom_id  — the id you set when creating the request
//   result.type — "succeeded" | "errored" | "expired"

console.log("=== Step 3: Results ===");

for await (const result of await client.messages.batches.results(batch.id)) {
  switch (result.result.type) {
    case "succeeded": {
      const block = result.result.message.content[0];
      const text = block.type === "text" ? block.text.trim() : "(no text)";
      console.log(`[${result.custom_id}]  ${text}`);
      break;
    }
    case "errored": {
      // invalid_request = your fault (bad params) — fix and re-submit
      // api_error       = Anthropic's fault — safe to retry as-is
      const errType = result.result.error.type;
      console.log(`[${result.custom_id}]  ERROR (${errType})`);
      break;
    }
    case "expired": {
      // Request wasn't processed within 24 h — re-submit
      console.log(`[${result.custom_id}]  EXPIRED — re-submit`);
      break;
    }
  }
}
