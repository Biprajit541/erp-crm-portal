# Amazon Connect IVR integration

> **Status:** the backend endpoints and Lambda are written and tested locally against a real database, but this
> was **not deployed**: Amazon Connect is not available to AWS accounts registered in India (AISPL). The
> `/integrations/connect` endpoints are platform-neutral and can be reused by another contact-center platform.

A cloud contact center for the ERP + CRM Portal. When a customer calls the sales helpline,
Amazon Connect identifies them from their phone number, reads out their order status, and
routes them to an agent who already sees their CRM details. Every call is written back into the
customer's follow-up timeline in the portal.

## Architecture

```
 Caller ──► Amazon Connect ──► Contact flow (IVR)
                                   │  Invoke AWS Lambda function (action=…)
                                   ▼
                               AWS Lambda (Node.js 20, contact-center/lambda)
                                   │  HTTPS + x-api-key
                                   ▼
                     ERP + CRM API on Render  /integrations/connect/*
                                   │
                                   ▼
                         PostgreSQL on Supabase (customers, challans, follow-ups)
```

| Piece | What it does |
|-------|--------------|
| Contact flow | Greeting, caller lookup, IVR menu, keypad input, queue transfer |
| Lambda (`lambda/index.mjs`) | Turns Connect events into API calls; returns flat string attributes and speakable messages; 6s timeout with a fallback to an agent |
| API (`backend/src/routes/contactCenter.ts`) | Caller lookup, order status, call logging; API-key auth (separate from user JWTs) |
| CRM | Calls appear in the customer's follow-up timeline as "Amazon Connect (IVR)" |

## Call flow

```
Greeting
  └─ Lambda: lookupCustomer
       ├─ OK        → "Welcome back, Rajesh." → set contact attributes for the agent
       ├─ NOT_FOUND → "We could not find an account for this number."
       └─ ERROR     → apology → queue (agent)

Main menu: "Press 1 for your latest order. Press 2 to check an order by challan number. Press 0 for our sales team."
  ├─ 1 → play $.External.latestOrderMessage → Lambda: logCall(SELF_SERVICE) → back to menu / disconnect
  ├─ 2 → "Enter the digits of your challan number, then press hash."
  │       └─ Lambda: challanStatus(digits=$.StoredCustomerInput) → play $.External.message
  │            └─ INVALID_INPUT / NOT_FOUND → retry once → menu
  └─ 0 → Lambda: logCall(TRANSFERRED_TO_AGENT) → Set working queue → Transfer to queue
```

Challan numbers look like `CH-20260728-0001`, which can't be typed on a keypad, so callers enter the
digits only (`202607280001`) and the API rebuilds the number.

## API endpoints (API key in `x-api-key`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/integrations/connect/customers/lookup?phone=` | Identify caller; challan counts and latest challan |
| GET | `/integrations/connect/challans/status?phone=&digits=` | Order status, **only if the challan belongs to the calling number** |
| POST | `/integrations/connect/call-log` | Add the call to the CRM timeline; ignores repeats of the same `contactId` |

Design decisions:
- **Separate auth for machines.** The Lambda isn't a user, so it doesn't log in for a JWT. It uses a
  shared API key compared in constant time. If `CONNECT_API_KEY` isn't set, the endpoints return 503
  (fail closed).
- **Privacy.** A caller only hears about orders linked to their own number. "Not yours" and
  "doesn't exist" get the same answer, so the IVR can't be used to probe other customers' orders.
- **Fails over to a human.** If the API is slow or down, the Lambda returns `status=ERROR` within
  6 seconds (Connect waits at most 8) and the flow sends the caller to an agent.
- **Flat responses.** Connect only accepts a flat map of strings from Lambda, so all values are strings.

## Setup

### 1. Backend
1. Generate a key: `openssl rand -hex 32`.
2. Set `CONNECT_API_KEY` in Render's environment variables and redeploy.
3. Run the new index from `backend/sql/schema.sql` in the Supabase SQL editor:
   `CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers (mobile);`
4. Check: `curl -H "x-api-key: <key>" "https://<api>/integrations/connect/customers/lookup?phone=%2B919876543210"`

### 2. Lambda
1. AWS console → Lambda → **Create function** → Node.js 20.x, name `erp-connect-ivr`.
2. Paste `lambda/index.mjs` as the code (handler `index.handler`).
3. Environment variables: `ERP_API_BASE_URL`, `CONNECT_API_KEY`, and for demos only
   `DEMO_CALLER_PHONE` (treats every call as coming from that number, e.g. a seeded customer). For production, store the key in
   AWS Secrets Manager instead of a plain environment variable.
4. Configuration → General → Timeout: **8 seconds**.
5. Test with `lambda/test-events/lookup-customer.json`.

### 3. Amazon Connect
1. Create an Amazon Connect instance (pick a region close to India, e.g. Mumbai if it's offered).
2. In the instance settings → **Flows** → **AWS Lambda**, add `erp-connect-ivr` so the flow can call it.
3. Create a queue `Sales` and a routing profile that includes it; assign it to your agent user.
4. Build the contact flow from the call flow above. Blocks used:
   *Set logging behavior*, *Set voice*, *Invoke AWS Lambda function* (parameter `action`), *Check contact
   attributes* (on `$.External.status`), *Set contact attributes* (copy `customerName`, `openChallans`,
   `latestChallanNumber` etc. as user-defined attributes for the agent), *Play prompt* (text
   `$.External.message`), *Get customer input*, *Store customer input* (max 14 digits, `#` to end),
   *Set working queue*, *Transfer to queue*, *Disconnect*.
5. Publish the flow and either claim a phone number for it or test with the built-in test chat /
   softphone. You don't need a real Indian number; claiming one requires extra documentation.
6. Set an **AWS billing alarm** before testing. Check what Connect usage your account's free tier covers.

### Render free-tier cold starts
Render's free instance sleeps after 15 minutes, and the first request can take 30–50 seconds. That's
longer than Connect will wait, so the first call after idle will go to the agent. For a demo, wake the API
by opening `/health` first, use an uptime pinger, or upgrade the instance.

## Testing locally

The Lambda has no dependencies, so it can be run against a local API with a Connect-shaped event:

```bash
node -e '
process.env.ERP_API_BASE_URL="http://localhost:5000";
process.env.CONNECT_API_KEY="<key>";
import("./contact-center/lambda/index.mjs").then(async ({ handler }) =>
  console.log(await handler(JSON.parse(require("fs").readFileSync("contact-center/lambda/test-events/lookup-customer.json")))));
'
```

## Possible extensions
- **Amazon Lex bot** so callers can say "where's my order" instead of pressing keys.
- **Post-call summary**: send the Contact Lens transcript to an LLM and store the summary through
  `call-log`'s `summary` field.
- **Screen pop**: open the customer's page in the portal for the agent, using the `customerId` attribute.
