export const dynamic = "force-dynamic";

// In-memory auction state (resets on server restart)
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
  currentBidder: null as string | null,
  bidCount: 0,
  bids: [] as Array<{ bidder: string; amount: number; timestamp: string }>,
  endTime: Date.now() + 5 * 60 * 1000, // 5 minutes from now
};

// Reset auction (called on page load or manually)
export async function DELETE() {
  auctionState = {
    ...auctionState,
    currentBid: auctionState.item.startingPrice,
    currentBidder: null,
    bidCount: 0,
    bids: [],
    endTime: Date.now() + 5 * 60 * 1000,
  };

  return Response.json({ success: true, auction: getPublicState() });
}

// Get current auction state
export async function GET() {
  return Response.json(getPublicState());
}

// Place a bid
export async function POST(request: Request) {
  const body = await request.json();
  const { bidder, amount } = body;

  if (!bidder || !amount) {
    return Response.json(
      { error: "Missing bidder or amount" },
      { status: 400 }
    );
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

  // Keep only last 20 bids in memory
  if (auctionState.bids.length > 20) {
    auctionState.bids = auctionState.bids.slice(0, 20);
  }

  // Publish to Fanout so all connected clients get the update
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
    await fetch("http://localhost:5561/publish/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publishBody),
    });
  } catch (error) {
    console.error("Failed to publish to Fanout:", error);
  }

  return Response.json({ success: true, auction: getPublicState() });
}

function getPublicState() {
  return {
    item: auctionState.item,
    currentBid: auctionState.currentBid,
    currentBidder: auctionState.currentBidder,
    bidCount: auctionState.bidCount,
    bids: auctionState.bids.slice(0, 10), // Send last 10 bids
    endTime: auctionState.endTime,
    timeRemaining: Math.max(0, auctionState.endTime - Date.now()),
  };
}
