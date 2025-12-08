import { ConfigStore } from "fastly:config-store";

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function handlePublishAPI(req) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { format, message } = body;

    let formats = {};

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
        return jsonResponse({ error: "Invalid format" }, 400);
    }

    const publishBody = {
      items: [
        {
          channel: "test",
          formats,
        },
      ],
    };

    try {
      // Get config from Config Store
      const config = new ConfigStore("fanout_bidding_config");
      const FANOUT_SERVICE_ID = config.get("FANOUT_SERVICE_ID") || "";
      const apiToken = config.get("FASTLY_API_TOKEN") || "";

      const headers = { "Content-Type": "application/json" };
      if (apiToken) {
        headers["Fastly-Key"] = apiToken;
      }

      const response = await fetch(
        `https://api.fastly.com/service/${FANOUT_SERVICE_ID}/publish/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(publishBody),
          backend: "fanout_publisher",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        return jsonResponse(
          { error: "Failed to publish", details: text },
          response.status
        );
      }

      return jsonResponse({ success: true });
    } catch (error) {
      console.error("Failed to publish to Fanout:", error);
      return jsonResponse(
        { error: "Failed to publish", details: String(error) },
        500
      );
    }
  } catch (error) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }
}
