// In-memory auction state (resets on service restart)
let auctionState = {
  item: {
    id: "vintage-camera",
    title: "Vintage Polaroid Camera",
    description:
      "A beautiful 1970s Polaroid SX-70 Land Camera in excellent condition. Perfect for collectors and photography enthusiasts.",
    imageUrl: "/camera.jpg",
    startingPrice: 50,
  },
  currentBid: 50,
  currentBidder: null,
  bidCount: 0,
  bids: [],
  endTime: Date.now() + 5 * 60 * 1000, // 5 minutes from now
};

function getPublicState() {
  return {
    item: auctionState.item,
    currentBid: auctionState.currentBid,
    currentBidder: auctionState.currentBidder,
    bidCount: auctionState.bidCount,
    bids: auctionState.bids.slice(0, 10),
    endTime: auctionState.endTime,
    timeRemaining: Math.max(0, auctionState.endTime - Date.now()),
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function handleAuctionAPI(req) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // GET - Get current auction state
  if (req.method === "GET") {
    return jsonResponse(getPublicState());
  }

  // DELETE - Reset auction
  if (req.method === "DELETE") {
    auctionState = {
      ...auctionState,
      currentBid: auctionState.item.startingPrice,
      currentBidder: null,
      bidCount: 0,
      bids: [],
      endTime: Date.now() + 5 * 60 * 1000,
    };
    return jsonResponse({ success: true, auction: getPublicState() });
  }

  // POST - Place a bid
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { bidder, amount } = body;

      if (!bidder || !amount) {
        return jsonResponse({ error: "Missing bidder or amount" }, 400);
      }

      // Update state
      auctionState.currentBid = amount;
      auctionState.currentBidder = bidder;
      auctionState.bidCount++;
      auctionState.bids.unshift({
        bidder,
        amount,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 20 bids
      if (auctionState.bids.length > 20) {
        auctionState.bids = auctionState.bids.slice(0, 20);
      }

      // Publish to Fanout
      const publishBody = {
        items: [
          {
            channel: "test",
            formats: {
              "http-stream": {
                content: `data: ${JSON.stringify({
                  type: "bid",
                  ...getPublicState(),
                })}\n\n`,
              },
            },
          },
        ],
      };

      try {
        const resp = await fetch("http://127.0.0.1/publish/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(publishBody),
          backend: "fanout_publisher",
        });
        if (!resp.ok) {
          console.error(
            "Fanout publish failed:",
            resp.status,
            await resp.text()
          );
        }
      } catch (error) {
        console.error("Failed to publish to Fanout:", error);
      }

      return jsonResponse({ success: true, auction: getPublicState() });
    } catch (error) {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
}
