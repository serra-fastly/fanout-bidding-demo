export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send chunks of data over time
      const chunks = [
        "Starting HTTP stream...\n",
        "Processing chunk 1...\n",
        "Processing chunk 2...\n",
        "Processing chunk 3...\n",
        "Processing chunk 4...\n",
        "Processing chunk 5...\n",
        "Stream complete!\n",
      ];

      for (let i = 0; i < chunks.length; i++) {
        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const data = {
          type: "stream",
          chunk: i + 1,
          total: chunks.length,
          timestamp: new Date().toISOString(),
          message: chunks[i].trim(),
        };

        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
