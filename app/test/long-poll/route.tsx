export const dynamic = "force-dynamic";

// Simulate waiting for an event (e.g., new data becoming available)
function waitForEvent(): Promise<object> {
  return new Promise((resolve) => {
    // Simulate a random delay between 2-5 seconds before "event" occurs
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      resolve({
        type: "long-poll",
        timestamp: new Date().toISOString(),
        message: "New data available!",
        data: {
          value: Math.floor(Math.random() * 100),
          source: "long-poll-demo",
        },
      });
    }, delay);
  });
}

export async function GET() {
  // Wait for an "event" to occur
  const data = await waitForEvent();

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
