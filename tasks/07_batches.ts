// Task 7: Batch sentiment analysis
//
// Use the Batches API to classify the sentiment of 4 customer reviews
// in a single batch request instead of 4 separate API calls.
//
// Requirements:
//   - Create a batch with 4 requests (one per review below)
//   - Each request asks Claude to reply with one word: "positive", "negative", or "neutral"
//   - Poll until the batch status is "ended"
//   - Print results as: "[custom_id] sentiment"
//
// Reviews:
//   review-1: "This product exceeded all my expectations. Absolutely love it!"
//   review-2: "Terrible quality. Broke after one day. Never buying again."
//   review-3: "It works. Nothing special, but gets the job done."
//   review-4: "Fast shipping, great packaging, the item is perfect. 10/10"
//
// Expected output (order may vary):
//   [review-1] positive
//   [review-2] negative
//   [review-3] neutral
//   [review-4] positive
//
// Hints:
//   - client.messages.batches.create({ requests: [...] })
//   - client.messages.batches.retrieve(id)  → check .processing_status === "ended"
//   - client.messages.batches.results(id)   → async iterable, result.result.type === "succeeded"

import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic();

const reviews = [
  {
    "id": "review-1",
   "text": "This product exceeded all my expectations. Absolutely love it!"
  },
  {
    "id": "review-2",
   "text": "Terrible quality. Broke after one day. Never buying again."
  },
  {
    "id": "review-3",
   "text": "It works. Nothing special, but gets the job done."
  },
  {
    "id": "review-4",
   "text": "Fast shipping, great packaging, the item is perfect. 10/10"
  }
]

const batch = await client.messages.batches.create({
  requests: reviews.map( ({ id, text }) => ({
    custom_id: id,
    params: {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: `Make your opinition about review from user, see ${text}, is it positive, netural or negative.`
        }
      ]
    }
  }))
});

console.log("Batch ID", batch.id)
console.log("Status", batch.processing_status);
console.log("Requests", batch.request_counts.processing);

let current = batch;
while (current.processing_status !== "ended") {
  await new Promise((r) => setTimeout(r, 30_000));
  current = await client.messages.batches.retrieve(batch.id);
  const { processing, succeeded, errored, expired } = current.request_counts

  console.log('Status', current.processing_status);
}

for await (const result of await client.messages.batches.results(batch.id)) {
  switch (result.result.type) {
    case "succeeded": {
      const block = result.result.message.content[0];
      const text = block.type === 'text' ? block.text.trim() : "(no exit)";
      console.log(`[${result.custom_id}] ${text}`);
      break;
    }
    case "errored": {
      const errType = result.result.error.type;
      console.log(`[${result.custom_id}] ERROR (${errType})`);
      break
    }
    case "expired": {
      console.log(`[${result.custom_id}] EXPERIED - re-submit`);
      break;
    }
  }
}