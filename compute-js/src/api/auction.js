import { ConfigStore } from "fastly:config-store";
import { KVStore } from "fastly:kv-store";
import { jsonResponse, corsPreflightResponse } from "./utils.js";

const AUCTION_KEY = "current_auction";
const AUCTION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_ITEM = {
  id: "vintage-camera",
  title: "Vintage Polaroid Camera",
  description:
    "A beautiful 1970s Polaroid SX-70 Land Camera in excellent condition. Perfect for collectors and photography enthusiasts.",
  imageUrl: "/camera.jpg",
  startingPrice: 50,
};

function createNewAuction() {
  return {
    item: DEFAULT_ITEM,
    currentBid: DEFAULT_ITEM.startingPrice,
    currentBidder: null,
    bidCount: 0,
    bids: [],
    endTime: Date.now() + AUCTION_DURATION_MS,
  };
}

async function getAuctionState(kvStore) {
  try {
    const entry = await kvStore.get(AUCTION_KEY);
    if (entry) {
      const state = JSON.parse(await entry.text());

      // Ensure item exists
      if (!state.item) {
        state.item = DEFAULT_ITEM;
      }

      // Check if auction has ended
      if (Date.now() > state.endTime) {
        // Auction ended, create a new one
        const newState = createNewAuction();
        await kvStore.put(AUCTION_KEY, JSON.stringify(newState));
        return newState;
      }
      return state;
    }
  } catch (e) {
    console.error("Error reading from KV store:", e);
  }

  // No existing auction, create a new one
  const newState = createNewAuction();
  await kvStore.put(AUCTION_KEY, JSON.stringify(newState));
  return newState;
}

async function saveAuctionState(kvStore, state) {
  await kvStore.put(AUCTION_KEY, JSON.stringify(state));
}

function formatStateForClient(state) {
  return {
    item: state.item,
    currentBid: state.currentBid,
    currentBidder: state.currentBidder,
    bidCount: state.bidCount,
    bids: state.bids.slice(0, 10),
    endTime: state.endTime,
    timeRemaining: Math.max(0, state.endTime - Date.now()),
  };
}

// Publish an event to all connected clients via Fanout
async function publishToFanout(eventType, state) {
  const publishBody = {
    items: [
      {
        channel: "test",
        formats: {
          "http-stream": {
            content: `data: ${JSON.stringify({
              type: eventType,
              ...formatStateForClient(state),
            })}\n\n`,
          },
        },
      },
    ],
  };

  try {
    const config = new ConfigStore("fanout_bidding_config");
    const FANOUT_SERVICE_ID = config.get("FANOUT_SERVICE_ID") || "";
    const apiToken = config.get("FASTLY_API_TOKEN") || "";

    const headers = { "Content-Type": "application/json" };
    if (apiToken) {
      headers["Fastly-Key"] = apiToken;
    }

    const resp = await fetch(
      `https://api.fastly.com/service/${FANOUT_SERVICE_ID}/publish/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(publishBody),
        backend: "fanout_publisher",
      }
    );

    if (!resp.ok) {
      console.error("Fanout publish failed:", resp.status, await resp.text());
    }
  } catch (error) {
    console.error(`Failed to publish ${eventType} to Fanout:`, error);
  }
}

export async function handleAuctionAPI(req) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsPreflightResponse("GET, POST, DELETE, OPTIONS");
  }

  // Open KV Store for persistent state
  const kvStore = new KVStore("auction_state");

  // GET - Get current auction state
  if (req.method === "GET") {
    const state = await getAuctionState(kvStore);
    return jsonResponse(formatStateForClient(state));
  }

  // DELETE - Reset auction
  if (req.method === "DELETE") {
    const newState = createNewAuction();
    await saveAuctionState(kvStore, newState);

    // Broadcast reset to all connected clients
    await publishToFanout("reset", newState);

    return jsonResponse({
      success: true,
      auction: formatStateForClient(newState),
    });
  }

  // POST - Place a bid
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { bidder, amount } = body;

      if (!bidder || !amount) {
        return jsonResponse({ error: "Missing bidder or amount" }, 400);
      }

      // Get current state from KV Store
      const state = await getAuctionState(kvStore);

      // Check if auction has ended
      if (Date.now() > state.endTime) {
        return jsonResponse({ error: "Auction has ended" }, 400);
      }

      // Validate bid amount
      if (amount <= state.currentBid) {
        return jsonResponse(
          {
            error: `Bid must be higher than current bid of $${state.currentBid}`,
          },
          400
        );
      }

      // Update state
      state.currentBid = amount;
      state.currentBidder = bidder;
      state.bidCount++;
      state.bids.unshift({
        bidder,
        amount,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 20 bids
      if (state.bids.length > 20) {
        state.bids = state.bids.slice(0, 20);
      }

      // Save updated state to KV Store
      await saveAuctionState(kvStore, state);

      // Broadcast new bid to all connected clients
      await publishToFanout("bid", state);

      return jsonResponse({
        success: true,
        auction: formatStateForClient(state),
      });
    } catch (error) {
      console.error("Error processing bid:", error);
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}
