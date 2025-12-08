// Shared utilities for API handlers

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Needed for local development
    },
  });
}

export function corsPreflightResponse(allowedMethods = "GET, POST, OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": allowedMethods,
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
