## testapp Appwrite Function (Backend)

This folder is a **GitHub-ready Appwrite Function** that replaces the Express backend with an Appwrite-native serverless API.

### What it provides

- **POST**: track event (idempotent via unique index on `(workspaceId, idempotencyKey)`)
- **GET**: list events by `workspaceId` (optional `type`)
- **Referral behavior**: creates a referral when `type = "referral.created"`

### Required Function Environment Variables

Set these in **Function → Settings → Variables**:

- `APPWRITE_DATABASE_ID`
- `APPWRITE_COLLECTION_EVENTS`
- `APPWRITE_COLLECTION_REFERRALS`

Appwrite also injects these built-ins automatically:

- `APPWRITE_FUNCTION_API_ENDPOINT`
- `APPWRITE_FUNCTION_PROJECT_ID`
- `APPWRITE_FUNCTION_API_KEY`

### Database requirements

In your Appwrite Database:

- `events` collection attributes: `workspaceId` (string), `type` (string), `idempotencyKey` (string), `payload` (string)
- `referrals` collection attributes: `workspaceId` (string), `eventId` (string), `payload` (string)
- **Unique index** on `events(workspaceId, idempotencyKey)` (critical for idempotency)

### How to deploy from GitHub

In Appwrite Console:

1. **Functions → Create Function** (Node.js runtime)
2. Go to **Deployments → Create deployment → Git**
3. Repository: your repo
4. Root directory / path: `appwrite-function`
5. Install command: `npm install`
6. Build command: *(leave empty)*
7. Entrypoint: `index.js`
8. Deploy

### How to call it

- **POST**:

```bash
curl -X POST "<FUNCTION_URL>" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"ws_123","type":"referral.created","payload":{"referrerEmail":"a@a.com","referredEmail":"b@b.com"},"idempotencyKey":"k-1"}'
```

- **GET**:

```bash
curl "<FUNCTION_URL>?workspaceId=ws_123"
```

