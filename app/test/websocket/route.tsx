export const dynamic = "force-dynamic";

// Note: Next.js doesn't natively support WebSocket in API routes.
// For a real WebSocket implementation, you would need:
// 1. A custom server (e.g., using ws package with custom server.js)
// 2. Or use a service like Fastly Fanout, Pusher, or Ably
//
// This is a placeholder that returns info about WebSocket setup

export async function GET() {
  return new Response(
    JSON.stringify({
      type: "websocket",
      status: "not-available",
      message:
        "WebSocket requires a custom server or Fastly Fanout integration",
      alternatives: [
        "Use Fastly Fanout for WebSocket support at the edge",
        "Set up a custom Node.js server with the 'ws' package",
        "Use a third-party service like Pusher or Ably",
      ],
      documentation: "https://developer.fastly.com/learning/concepts/fanout/",
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
