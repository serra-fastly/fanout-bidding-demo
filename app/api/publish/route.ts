export const dynamic = "force-dynamic";

const PUBLISH_URL = "http://localhost:5561/publish/";
const CHANNEL = "test";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { format, message } = body;

    let formats: Record<string, unknown> = {};

    // Build the appropriate format based on connection type
    switch (format) {
      case "sse":
        formats["http-stream"] = {
          content: `data: ${JSON.stringify(message)}\n\n`,
        };
        break;
      case "stream":
        formats["http-stream"] = {
          content: `${JSON.stringify(message)}\n`,
        };
        break;
      case "long-poll":
        formats["http-response"] = {
          body: JSON.stringify(message),
        };
        break;
      case "websocket":
        formats["ws-message"] = {
          content: JSON.stringify(message),
        };
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    const publishBody = {
      items: [
        {
          channel: CHANNEL,
          formats,
        },
      ],
    };

    console.error("[Publish] Sending to Fanout:", JSON.stringify(publishBody));

    const response = await fetch(PUBLISH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(publishBody),
    });

    const responseText = await response.text();
    console.error("[Publish] Fanout response:", response.status, responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to publish", details: responseText }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Publish] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
