"use client";

import { useState, useRef } from "react";

// Fanout endpoint - requests go through the edge at 7676
const FANOUT_BASE = "http://localhost:7676";

export default function Home() {
  const [longPollResponse, setLongPollResponse] = useState("");
  const [sseResponse, setSseResponse] = useState("");
  const [streamResponse, setStreamResponse] = useState("");
  const [websocketResponse, setWebsocketResponse] = useState("");
  const [connected, setConnected] = useState({
    longPoll: false,
    sse: false,
    stream: false,
    websocket: false,
  });
  const [loading, setLoading] = useState({
    longPoll: false,
    sse: false,
    stream: false,
    websocket: false,
  });
  const [publishing, setPublishing] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Publish a message to all connected clients
  const publishMessage = async (format: string) => {
    setPublishing(true);
    try {
      const message = {
        timestamp: new Date().toISOString(),
        text: `Hello from Fanout! (${format})`,
        random: Math.floor(Math.random() * 1000),
      };

      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, message }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Publish failed:", error);
      }
    } catch (error) {
      console.error("Publish error:", error);
    } finally {
      setPublishing(false);
    }
  };

  const handleLongPoll = async () => {
    if (connected.longPoll) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setConnected((prev) => ({ ...prev, longPoll: false }));
      setLongPollResponse("");
      return;
    }

    setLoading((prev) => ({ ...prev, longPoll: true }));
    setLongPollResponse("");
    abortControllerRef.current = new AbortController();

    try {
      setConnected((prev) => ({ ...prev, longPoll: true }));
      setLongPollResponse("[Waiting for message...]\n");

      const response = await fetch(`${FANOUT_BASE}/test/long-poll`, {
        signal: abortControllerRef.current.signal,
      });
      const data = await response.text();
      setLongPollResponse((prev) => prev + data + "\n[Connection Closed]\n");
      setConnected((prev) => ({ ...prev, longPoll: false }));
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== "AbortError") {
        setLongPollResponse((prev) => prev + `Error: ${error}\n`);
      }
      setConnected((prev) => ({ ...prev, longPoll: false }));
    } finally {
      setLoading((prev) => ({ ...prev, longPoll: false }));
    }
  };

  const handleSSE = () => {
    if (connected.sse) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnected((prev) => ({ ...prev, sse: false }));
      setSseResponse("");
      return;
    }

    setLoading((prev) => ({ ...prev, sse: true }));
    setSseResponse("");

    const eventSource = new EventSource(`${FANOUT_BASE}/test/sse`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setLoading((prev) => ({ ...prev, sse: false }));
      setConnected((prev) => ({ ...prev, sse: true }));
      setSseResponse(
        (prev) => prev + "[Connected - waiting for messages...]\n"
      );
    };

    eventSource.onmessage = (event) => {
      setSseResponse((prev) => prev + event.data + "\n");
    };

    eventSource.onerror = () => {
      setSseResponse((prev) => prev + "[Error or Connection Closed]\n");
      eventSource.close();
      setConnected((prev) => ({ ...prev, sse: false }));
      setLoading((prev) => ({ ...prev, sse: false }));
    };
  };

  const handleStream = async () => {
    if (connected.stream) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setConnected((prev) => ({ ...prev, stream: false }));
      setStreamResponse("");
      return;
    }

    setLoading((prev) => ({ ...prev, stream: true }));
    setStreamResponse("");
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${FANOUT_BASE}/test/stream`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      setConnected((prev) => ({ ...prev, stream: true }));
      setLoading((prev) => ({ ...prev, stream: false }));
      setStreamResponse(
        (prev) => prev + "[Connected - waiting for messages...]\n"
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setStreamResponse((prev) => prev + "[Stream Ended]\n");
          setConnected((prev) => ({ ...prev, stream: false }));
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        setStreamResponse((prev) => prev + chunk);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== "AbortError") {
        setStreamResponse((prev) => prev + `Error: ${error}\n`);
      }
      setConnected((prev) => ({ ...prev, stream: false }));
      setLoading((prev) => ({ ...prev, stream: false }));
    }
  };

  const handleWebSocket = () => {
    if (connected.websocket) {
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
      setConnected((prev) => ({ ...prev, websocket: false }));
      setWebsocketResponse("");
      return;
    }

    setLoading((prev) => ({ ...prev, websocket: true }));
    setWebsocketResponse("");

    const ws = new WebSocket(`ws://localhost:7676/test/websocket`);
    websocketRef.current = ws;

    ws.onopen = () => {
      setLoading((prev) => ({ ...prev, websocket: false }));
      setConnected((prev) => ({ ...prev, websocket: true }));
      setWebsocketResponse(
        (prev) => prev + "[Connected - waiting for messages...]\n"
      );
    };

    ws.onmessage = (event) => {
      setWebsocketResponse((prev) => prev + event.data + "\n");
    };

    ws.onerror = () => {
      setWebsocketResponse((prev) => prev + "[Error]\n");
    };

    ws.onclose = () => {
      setWebsocketResponse((prev) => prev + "[Connection Closed]\n");
      setConnected((prev) => ({ ...prev, websocket: false }));
      setLoading((prev) => ({ ...prev, websocket: false }));
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M13.5 2L3 14h9l-1.5 8L21 10h-9l1.5-8z" />
            </svg>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              Fastly
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Fanout Bidding Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Test real-time connection types powered by Fastly Fanout
          </p>
        </div>

        {/* Grid Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Long Poll Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Long Polling
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Traditional request-response pattern with extended timeouts
              </p>
            </div>
            <div className="p-6">
              <div className="flex gap-2">
                <button
                  onClick={handleLongPoll}
                  disabled={loading.longPoll}
                  className={`flex-1 px-6 py-3 ${
                    connected.longPoll
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  } disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg disabled:cursor-not-allowed`}
                >
                  {loading.longPoll
                    ? "Connecting..."
                    : connected.longPoll
                    ? "Disconnect"
                    : longPollResponse
                    ? "Reconnect"
                    : "Connect"}
                </button>
                <button
                  onClick={() => publishMessage("long-poll")}
                  disabled={publishing || !connected.longPoll}
                  className="px-4 py-3 bg-blue-800 hover:bg-blue-900 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-md disabled:cursor-not-allowed"
                >
                  Publish
                </button>
              </div>
              {longPollResponse && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="text-xs font-semibold text-blue-800 dark:text-blue-400 mb-2">
                    RESPONSE
                  </div>
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                    {longPollResponse}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* SSE Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Server-Sent Events
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Unidirectional streaming from server to client
              </p>
            </div>
            <div className="p-6">
              <div className="flex gap-2">
                <button
                  onClick={handleSSE}
                  disabled={loading.sse}
                  className={`flex-1 px-6 py-3 ${
                    connected.sse
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  } disabled:bg-green-400 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg disabled:cursor-not-allowed`}
                >
                  {loading.sse
                    ? "Connecting..."
                    : connected.sse
                    ? "Disconnect"
                    : "Connect"}
                </button>
                <button
                  onClick={() => publishMessage("sse")}
                  disabled={publishing || !connected.sse}
                  className="px-4 py-3 bg-green-800 hover:bg-green-900 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-md disabled:cursor-not-allowed"
                >
                  Publish
                </button>
              </div>
              {sseResponse && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="text-xs font-semibold text-green-800 dark:text-green-400 mb-2">
                    RESPONSE
                  </div>
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                    {sseResponse}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Stream Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                HTTP Streaming
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chunked transfer encoding for continuous data flow
              </p>
            </div>
            <div className="p-6">
              <div className="flex gap-2">
                <button
                  onClick={handleStream}
                  disabled={loading.stream}
                  className={`flex-1 px-6 py-3 ${
                    connected.stream
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-purple-600 hover:bg-purple-700"
                  } disabled:bg-purple-400 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg disabled:cursor-not-allowed`}
                >
                  {loading.stream
                    ? "Connecting..."
                    : connected.stream
                    ? "Disconnect"
                    : "Connect"}
                </button>
                <button
                  onClick={() => publishMessage("stream")}
                  disabled={publishing || !connected.stream}
                  className="px-4 py-3 bg-purple-800 hover:bg-purple-900 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-md disabled:cursor-not-allowed"
                >
                  Publish
                </button>
              </div>
              {streamResponse && (
                <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <div className="text-xs font-semibold text-purple-800 dark:text-purple-400 mb-2">
                    RESPONSE
                  </div>
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                    {streamResponse}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* WebSocket Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                WebSocket
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Full-duplex bidirectional communication channel
              </p>
            </div>
            <div className="p-6">
              <div className="flex gap-2">
                <button
                  onClick={handleWebSocket}
                  disabled={loading.websocket}
                  className={`flex-1 px-6 py-3 ${
                    connected.websocket
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-orange-600 hover:bg-orange-700"
                  } disabled:bg-orange-400 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg disabled:cursor-not-allowed`}
                >
                  {loading.websocket
                    ? "Connecting..."
                    : connected.websocket
                    ? "Disconnect"
                    : "Connect"}
                </button>
                <button
                  onClick={() => publishMessage("websocket")}
                  disabled={publishing || !connected.websocket}
                  className="px-4 py-3 bg-orange-800 hover:bg-orange-900 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-md disabled:cursor-not-allowed"
                >
                  Publish
                </button>
              </div>
              {websocketResponse && (
                <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="text-xs font-semibold text-orange-800 dark:text-orange-400 mb-2">
                    RESPONSE
                  </div>
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">
                    {websocketResponse}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Powered by Fastly Fanout • Real-time at the Edge</p>
        </div>
      </div>
    </div>
  );
}
