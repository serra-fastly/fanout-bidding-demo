# Fanout Bidding Demo - Compute@Edge Origin

This is the Fastly Compute service that serves the static Next.js app and handles API routes for the real-time bidding demo.

## Setup

### 1. Create a Fastly Compute Service

```bash
fastly compute init
# Or create via the Fastly dashboard
```

### 2. Copy the config templates

```bash
cp fastly.toml.example fastly.toml
```

Edit `fastly.toml` and add your service ID.

### 3. Create a Config Store

Create a Config Store in the Fastly dashboard or via CLI:

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

### 4. Link the Config Store

```bash
fastly resource-link create --service-id YOUR_SERVICE_ID --version latest --resource-id YOUR_STORE_ID --autoclone
fastly service-version activate --version latest --service-id YOUR_SERVICE_ID
```

### 5. Create a KV Store (for auction state persistence)

```bash
fastly kv-store create --name auction_state
fastly resource-link create --service-id YOUR_SERVICE_ID --version latest --resource-id YOUR_KV_STORE_ID --autoclone
fastly service-version activate --version latest --service-id YOUR_SERVICE_ID
```

### 6. Build and Deploy

```bash
# Build the Next.js app first (from parent directory)
cd .. && npm run build && cd compute-js

# Build and deploy the Compute service
npm run build
fastly compute publish
```

## Environment Variables in Config Store

| Key                 | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `FASTLY_API_TOKEN`  | Your Fastly API token (needs global scope for Fanout publishing) |
| `FANOUT_SERVICE_ID` | The service ID of your Fanout-enabled Compute service            |

## Architecture

- **Origin Service** (this service): Serves static files and handles `/api/auction` endpoints
- **Fanout Service**: A separate Compute service with Fanout enabled that proxies requests to this origin and handles real-time connections (SSE, WebSocket, etc.)
