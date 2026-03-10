import { Client, Databases, ID, Query } from "node-appwrite";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Appwrite-Project, X-Appwrite-Key",
  "Access-Control-Max-Age": "86400"
};

function json(res, statusCode, body) {
  return res.json(body, statusCode, { ...corsHeaders });
}

function getConfig() {
  const {
    APPWRITE_FUNCTION_API_ENDPOINT,
    APPWRITE_FUNCTION_PROJECT_ID,
    APPWRITE_FUNCTION_API_KEY,
    APPWRITE_DATABASE_ID,
    APPWRITE_COLLECTION_EVENTS,
    APPWRITE_COLLECTION_REFERRALS
  } = process.env;

  if (
    !APPWRITE_FUNCTION_API_ENDPOINT ||
    !APPWRITE_FUNCTION_PROJECT_ID ||
    !APPWRITE_FUNCTION_API_KEY
  ) {
    throw new Error(
      "Missing built-in function env vars. Expected APPWRITE_FUNCTION_API_ENDPOINT / PROJECT_ID / API_KEY"
    );
  }

  if (!APPWRITE_DATABASE_ID || !APPWRITE_COLLECTION_EVENTS || !APPWRITE_COLLECTION_REFERRALS) {
    throw new Error(
      "Missing required env vars: APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_EVENTS, APPWRITE_COLLECTION_REFERRALS"
    );
  }

  return {
    endpoint: APPWRITE_FUNCTION_API_ENDPOINT,
    projectId: APPWRITE_FUNCTION_PROJECT_ID,
    apiKey: APPWRITE_FUNCTION_API_KEY,
    databaseId: APPWRITE_DATABASE_ID,
    eventsCollectionId: APPWRITE_COLLECTION_EVENTS,
    referralsCollectionId: APPWRITE_COLLECTION_REFERRALS
  };
}

function createDb() {
  const cfg = getConfig();
  const client = new Client()
    .setEndpoint(cfg.endpoint)
    .setProject(cfg.projectId)
    .setKey(cfg.apiKey);

  return {
    cfg,
    db: new Databases(client)
  };
}

async function trackEvent({ workspaceId, type, payload, idempotencyKey }) {
  const { cfg, db } = createDb();
  const payloadJson = JSON.stringify(payload ?? {});

  try {
    const eventDoc = await db.createDocument(
      cfg.databaseId,
      cfg.eventsCollectionId,
      ID.unique(),
      { workspaceId, type, idempotencyKey, payload: payloadJson }
    );

    let referralId;
    if (type === "referral.created") {
      const referralDoc = await db.createDocument(
        cfg.databaseId,
        cfg.referralsCollectionId,
        ID.unique(),
        { workspaceId, eventId: eventDoc.$id, payload: payloadJson }
      );
      referralId = referralDoc.$id;
    }

    return { eventId: eventDoc.$id, created: true, referralId };
  } catch (err) {
    const code = err?.code ?? err?.response?.code;
    if (code === 409) {
      const existing = await db.listDocuments(cfg.databaseId, cfg.eventsCollectionId, [
        Query.equal("workspaceId", workspaceId),
        Query.equal("idempotencyKey", idempotencyKey)
      ]);
      const eventDoc = existing.documents?.[0];
      return { eventId: eventDoc?.$id, created: false };
    }
    throw err;
  }
}

async function listEvents({ workspaceId, type }) {
  const { cfg, db } = createDb();
  const queries = [Query.equal("workspaceId", workspaceId)];
  if (type) queries.push(Query.equal("type", type));

  const docs = await db.listDocuments(cfg.databaseId, cfg.eventsCollectionId, queries);
  return { total: docs.total, events: docs.documents };
}

export default async ({ req, res, log, error }) => {
  try {
    if (req.method === "OPTIONS") {
      return res.send("", 204, { ...corsHeaders });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
      const { workspaceId, type, payload, idempotencyKey } = body;
      if (!workspaceId || !type || !idempotencyKey) {
        return json(res, 400, { error: "workspaceId, type, and idempotencyKey are required" });
      }

      const result = await trackEvent({ workspaceId, type, payload, idempotencyKey });
      return json(res, 200, result);
    }

    if (req.method === "GET") {
      const workspaceId = req.query?.workspaceId;
      const type = req.query?.type;
      if (!workspaceId) return json(res, 400, { error: "workspaceId query parameter is required" });

      const result = await listEvents({ workspaceId, type });
      return json(res, 200, result);
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    error(e?.stack || String(e));
    log(e);
    return json(res, 500, { error: "Internal server error", details: e?.message ?? String(e) });
  }
};

