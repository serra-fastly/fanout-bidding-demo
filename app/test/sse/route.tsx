import { appendFileSync } from "fs";

// This log runs at module load time - if you see this, the file is being loaded
console.error("=== SSE ROUTE MODULE LOADED ===");

export const dynamic = "force-dynamic";

const CHANNEL = "test";
const PUBLISH_URL = "http://localhost:5561/publish/";

// Write to both stderr and a file for debugging
const log = (...args: unknown[]) => {
  const message = `[SSE] ${args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
    .join(" ")}\n`;
  console.error(message);
  process.stderr.write(message);
  try {
    appendFileSync(
      "/tmp/sse-debug.log",
      `${new Date().toISOString()} ${message}`
    );
  } catch {
    // Ignore file write errors
  }
};

log("Module initialization complete");

// Helper to publish SSE events via Fanout
async function publishSSE(data: string) {
  log("Publishing to Fanout:", data);

  const body = JSON.stringify({
    items: [
      {
        channel: CHANNEL,
        formats: {
          "http-stream": {
            content: `data: ${data}\n\n`,
          },
        },
      },
    ],
  });

  log("Publish request body:", body);

  try {
    const response = await fetch(PUBLISH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    const responseText = await response.text();
    log("Publish response status:", response.status);
    log("Publish response body:", responseText);

    return response;
  } catch (error) {
    log("Publish fetch error:", error);
    throw error;
  }
}

export async function GET(request: Request) {
  log("Received GET request");
  log("Request headers:", Object.fromEntries(request.headers.entries()));

  // Check if request came through Fanout (has Grip-Sig header)
  const gripSig = request.headers.get("Grip-Sig");
  log("Grip-Sig header:", gripSig);

  if (gripSig) {
    log("Request came through Fanout - setting up GRIP hold");

    // Request came through Fanout - subscribe to channel and hold connection
    // Return GRIP hold response to subscribe to the channel
    const gripHold = {
      hold: {
        mode: "stream",
        channels: [{ name: CHANNEL }],
      },
    };

    log("Grip-Hold value:", JSON.stringify(gripHold));

    // Start publishing messages in the background
    log("Starting background publishing...");
    startPublishing();

    const response = new Response("", {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Grip-Hold": JSON.stringify(gripHold),
      },
    });

    log("Returning GRIP hold response");
    return response;
  }

  // Not through Fanout yet - this shouldn't happen if Fanout is proxying
  log("No Grip-Sig header - request not through Fanout");
  return new Response("SSE endpoint - connect through Fanout proxy", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

// Background publishing function
function startPublishing() {
  let count = 0;
  log("Background publisher started");

  const interval = setInterval(async () => {
    count++;
    const message = {
      type: "sse",
      count,
      timestamp: new Date().toISOString(),
      message: `SSE message #${count}`,
    };

    log(`Attempting to publish message #${count}`);

    try {
      await publishSSE(JSON.stringify(message));
      log(`Successfully published message #${count}`);
    } catch (error) {
      log("Failed to publish:", error);
    }

    // Stop after 10 messages for demo
    if (count >= 10) {
      log("Reached 10 messages, stopping publisher");
      clearInterval(interval);
    }
  }, 2000);
}
