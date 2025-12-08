/// <reference types="@fastly/js-compute" />
import { getStaticFile } from "./statics.js";
import { handleAuctionAPI } from "./api/auction.js";
import { handlePublishAPI } from "./api/publish.js";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const req = event.request;
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle API routes
  if (path === "/api/auction") {
    return handleAuctionAPI(req);
  }

  if (path === "/api/publish") {
    return handlePublishAPI(req);
  }

  // Serve static files
  let staticFile = getStaticFile(path);

  // Try adding .html for page routes
  if (!staticFile && !path.includes(".") && path !== "/") {
    staticFile = getStaticFile(path + ".html");
  }

  // Handle root path
  if (!staticFile && path === "/") {
    staticFile = getStaticFile("/index.html");
  }

  if (staticFile) {
    let body;
    if (staticFile.binary) {
      // Decode base64 for binary files
      const binaryString = atob(staticFile.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      body = bytes;
    } else {
      body = staticFile.content;
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": staticFile.mimeType,
        // Disable caching for demo - always serve fresh content
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // 404 fallback
  const notFoundFile = getStaticFile("/404.html");
  if (notFoundFile) {
    return new Response(notFoundFile.content, {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response("Not Found", { status: 404 });
}
