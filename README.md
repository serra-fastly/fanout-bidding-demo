# Fanout Bidding Demo

A real-time auction demo showcasing [Fastly Fanout](https://www.fastly.com/documentation/guides/concepts/real-time-messaging/fanout/) for live updates across multiple browser tabs.

Access on [https://hugely-ideal-hedgehog.edgecompute.app/](https://hugely-ideal-hedgehog.edgecompute.app/)

## Architecture

- **Origin Service** (`compute-js/`): Serves the Next.js static app and handles API routes
- **Fanout Service**: A separate Compute service with Fanout enabled for real-time SSE/WebSocket connections

## Project Structure

```
fanout-bidding-demo/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Main auction UI
│   └── demo/page.tsx      # Connection type demo page
├── compute-js/            # Fastly Compute service
│   ├── src/
│   │   ├── index.js       # Main entry point
│   │   └── api/           # API route handlers
│   ├── fastly.toml.example
│   └── package.json
├── public/                # Static assets
└── package.json           # Next.js dependencies
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Fastly CLI](https://developer.fastly.com/reference/cli/)
- A Fastly account with two Compute services:
  - An **Origin service** (this project)
  - A **Fanout service** (with Fanout feature enabled, pointing to the origin)

### 1. Install dependencies

```bash
npm install
cd compute-js && npm install
```

### 2. Configure the Compute service

```bash
cd compute-js
cp fastly.toml.example fastly.toml
```

Edit `fastly.toml` and add your origin service ID.

### 3. Create a Config Store

```bash
fastly config-store create --name fanout_bidding_config
```

Add the required keys:

```bash
# Your Fastly API token with global scope
fastly config-store-entry create --store-id YOUR_STORE_ID --key FASTLY_API_TOKEN --value "your-api-token"

# The service ID of your Fanout service
fastly config-store-entry create --store-id YOUR_STORE_ID --key FANOUT_SERVICE_ID --value "your-fanout-service-id"
```

Link the Config Store to your service:

```bash
fastly resource-link create --service-id YOUR_SERVICE_ID --version latest --resource-id YOUR_STORE_ID --autoclone
fastly service-version activate --version latest --service-id YOUR_SERVICE_ID
```

### 4. Create a KV Store (for persistent auction state)

```bash
fastly kv-store create --name auction_state
fastly resource-link create --service-id YOUR_SERVICE_ID --version latest --resource-id YOUR_KV_STORE_ID --autoclone
fastly service-version activate --version latest --service-id YOUR_SERVICE_ID
```

### 5. Build and Deploy

```bash
# Build the Next.js static export
npm run build

# Build and deploy the Compute service
cd compute-js
npm run build
fastly compute publish
```

## Config Store Keys

| Key                 | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `FASTLY_API_TOKEN`  | Your Fastly API token (needs global scope for Fanout publishing) |
| `FANOUT_SERVICE_ID` | The service ID of your Fanout-enabled Compute service            |
