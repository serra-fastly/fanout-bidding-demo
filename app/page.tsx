"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// In production (Fastly), Fanout is same-origin. Locally, use port 7676.
const FANOUT_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:7676"
    : "";

interface Bid {
  bidder: string;
  amount: number;
  timestamp: string;
}

interface AuctionState {
  item: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    startingPrice: number;
  };
  currentBid: number;
  currentBidder: string | null;
  bidCount: number;
  bids: Bid[];
  endTime: number;
  timeRemaining: number;
}

export default function Home() {
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [bidderName, setBidderName] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [connected, setConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Fetch initial auction state
  useEffect(() => {
    fetch("/api/auction")
      .then((res) => res.json())
      .then((data) => {
        setAuction(data);
        setTimeLeft(data.timeRemaining);
        setBidAmount(String(data.currentBid + 10));
      });
  }, []);

  // Connect to SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`${FANOUT_BASE}/test/sse`);

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "bid" || data.type === "reset") {
          setAuction(data);
          setTimeLeft(data.timeRemaining);
          // Update suggested bid amount
          if (data.type === "reset") {
            // Always reset to starting bid + 10 on reset
            setBidAmount(String(data.currentBid + 10));
          } else {
            setBidAmount((prev) => {
              const currentSuggested = parseInt(prev);
              if (currentSuggested <= data.currentBid) {
                return String(data.currentBid + 10);
              }
              return prev;
            });
          }
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const placeBid = async () => {
    if (!bidderName.trim() || !bidAmount) return;

    setSubmitting(true);
    try {
      await fetch("/api/auction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bidder: bidderName.trim(),
          amount: parseInt(bidAmount),
        }),
      });
      // Suggest next bid amount
      setBidAmount(String(parseInt(bidAmount) + 10));
    } catch (error) {
      console.error("Failed to place bid:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetAuction = async () => {
    await fetch("/api/auction", { method: "DELETE" });
    const res = await fetch("/api/auction");
    const data = await res.json();
    setAuction(data);
    setTimeLeft(data.timeRemaining);
    setBidAmount(String(data.currentBid + 10));
  };

  const isEnded = timeLeft <= 0;

  if (!auction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">
          Loading auction...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-8 h-8 text-red-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M13.5 2L3 14h9l-1.5 8L21 10h-9l1.5-8z" />
            </svg>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              Fastly Fanout
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {connected ? "Live" : "Disconnected"}
              </span>
            </div>
            <Link
              href="/demo"
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Connection Demo →
            </Link>
          </div>
        </div>

        {/* Multi-tab hint */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 <strong>Try this:</strong> Open this page in another browser tab
            and place a bid. Watch both tabs update instantly via Fastly Fanout!
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Auction Card */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Item Image */}
            <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
              <img
                src={auction.item.imageUrl}
                alt={auction.item.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Item Details */}
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {auction.item.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {auction.item.description}
              </p>

              {/* Current Bid Display */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Current Bid
                  </div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    ${auction.currentBid}
                  </div>
                  {auction.currentBidder && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      by {auction.currentBidder}
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Time Remaining
                  </div>
                  <div
                    className={`text-3xl font-bold ${
                      isEnded
                        ? "text-red-600 dark:text-red-400"
                        : timeLeft < 60000
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {isEnded ? "ENDED" : formatTime(timeLeft)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {auction.bidCount} bid{auction.bidCount !== 1 ? "s" : ""}{" "}
                    placed
                  </div>
                </div>
              </div>

              {/* Bidding Form */}
              {!isEnded ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={bidderName}
                      onChange={(e) => setBidderName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Your Bid ($)
                    </label>
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      min={auction.currentBid + 1}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={placeBid}
                    disabled={submitting || !bidderName.trim()}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors shadow-md"
                  >
                    {submitting
                      ? "Placing Bid..."
                      : `Place Bid - $${bidAmount}`}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    🎉 Auction Ended!
                  </div>
                  {auction.currentBidder ? (
                    <p className="text-gray-600 dark:text-gray-400">
                      Won by <strong>{auction.currentBidder}</strong> for{" "}
                      <strong>${auction.currentBid}</strong>
                    </p>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400">
                      No bids were placed.
                    </p>
                  )}
                  <button
                    onClick={resetAuction}
                    className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Start New Auction
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bid History Sidebar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Live Bid Activity
              </h2>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {auction.bids.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No bids yet. Be the first!
                </p>
              ) : (
                <div className="space-y-3">
                  {auction.bids.map((bid, index) => (
                    <div
                      key={`${bid.timestamp}-${index}`}
                      className={`p-3 rounded-lg ${
                        index === 0
                          ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                          : "bg-gray-50 dark:bg-gray-700/50"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {bid.bidder}
                        </span>
                        <span
                          className={`font-bold ${
                            index === 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          ${bid.amount}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(bid.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reset button at bottom */}
            {!isEnded && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={resetAuction}
                  className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
                >
                  Reset Auction
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Powered by Fastly Fanout • Real-time at the Edge</p>
        </div>
      </div>
    </div>
  );
}
