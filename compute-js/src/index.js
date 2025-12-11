/// <reference types="@fastly/js-compute" />
import { getStaticFile } from "./statics.js";
import { handleAuctionAPI } from "./api/auction.js";
import { handlePublishAPI } from "./api/publish.js";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const req = event.request;
  const path = new URL(req.url).pathname;

  // Handle API routes
  if (path === "/api/auction") {
    return handleAuctionAPI(req);
  }

  if (path === "/api/publish") {
    return handlePublishAPI(req);
  }

  // Serve static files
  let staticFile = getStaticFile(path);

  // Add .html extension for clean URLs (/demo -> /demo.html)
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

    // Cache images and other static assets, but not HTML pages
    // HTML pages need to be fresh to ensure SSE connections work properly
    const isHtml = staticFile.mimeType === "text/html";
    const cacheControl = isHtml
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=3600";

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": staticFile.mimeType,
        "Cache-Control": cacheControl,
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
