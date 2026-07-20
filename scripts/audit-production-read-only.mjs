import { createHash } from "node:crypto";
import { getAccessToken, readServiceAccount } from "./google-service-account-auth.mjs";

const allowFullScan = process.argv.includes("--allow-full-scan");
const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const serviceAccount = readServiceAccount({ required: false });
const projectId = arg("project") || process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id;
if (!projectId) throw new Error("A Firebase project ID is required.");
if (serviceAccount?.project_id && serviceAccount.project_id !== projectId) throw new Error("Service account project does not match the requested project.");

const token = await getAccessToken();
const origin = "https://firestore.googleapis.com";
const databasePath = `/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
let logicalReadsEstimated = 0;

async function api(path, init = {}) {
  if (init.method && init.method !== "GET" && init.method !== "POST") throw new Error("Read-only audit rejected a non-read method.");
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`Firestore read failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function countCollection(collectionId, where) {
  const structuredQuery = { from: [{ collectionId }], ...(where ? { where } : {}) };
  const rows = await api(`${databasePath}:runAggregationQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery, aggregations: [{ alias: "count", count: {} }] } }),
  });
  logicalReadsEstimated += 1;
  return Number(rows?.[0]?.result?.aggregateFields?.count?.integerValue || 0);
}

async function exactDocument(collectionId, documentId) {
  if (!documentId) return { checked: false, exists: false };
  logicalReadsEstimated += 1;
  try {
    const document = await api(`${databasePath}/${encodeURIComponent(collectionId)}/${encodeURIComponent(documentId)}`);
    return { checked: true, exists: true, id: documentId, fields: document.fields || {} };
  } catch (error) {
    if (error.status === 404) return { checked: true, exists: false, id: documentId };
    throw error;
  }
}

function firestoreValue(value) {
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  return { stringValue: String(value) };
}

async function boundedDocuments(collectionId, filters, queryLimit = 10) {
  const safeLimit = Math.min(10, Math.max(1, Math.trunc(queryLimit)));
  const fieldFilters = filters.map(({ field, op, value }) => ({
    fieldFilter: { field: { fieldPath: field }, op, value: firestoreValue(value) },
  }));
  const where = fieldFilters.length === 1
    ? fieldFilters[0]
    : { compositeFilter: { op: "AND", filters: fieldFilters } };
  const rows = await api(`${databasePath}:runQuery`, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where,
        limit: safeLimit,
      },
    }),
  });
  const documents = rows.flatMap((row) => row.document ? [{
    checked: true,
    exists: true,
    id: decodeURIComponent(row.document.name.split("/").pop() || ""),
    fields: row.document.fields || {},
  }] : []);
  logicalReadsEstimated += documents.length;
  return documents;
}

function decodeField(field) {
  if (!field) return undefined;
  if ("nullValue" in field) return null;
  if ("stringValue" in field) return field.stringValue;
  if ("booleanValue" in field) return field.booleanValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("timestampValue" in field) return field.timestampValue;
  if ("arrayValue" in field) return (field.arrayValue.values || []).map(decodeField);
  return undefined;
}

function summarizeDocument(result, fields) {
  if (!result.checked || !result.exists) return result;
  return {
    checked: true,
    exists: true,
    id: result.id,
    values: Object.fromEntries(fields
      .filter((field) => field in result.fields)
      .map((field) => [field, decodeField(result.fields[field])])),
  };
}

async function latestDocuments(collectionId, limit = 5) {
  const safeLimit = Math.min(10, Math.max(1, Math.trunc(limit)));
  const rows = await api(`${databasePath}:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }], limit: safeLimit } }),
  });
  const documents = rows.flatMap((row) => row.document ? [{ id: decodeURIComponent(row.document.name.split("/").pop() || "") }] : []);
  logicalReadsEstimated += documents.length;
  return documents;
}

const collections = ["suppliers", "supplierSubmissions", "users", "rfqs", "rfqResponses", "rfqResponseRevisions", "rfqResponseEvents", "notifications", "conversations", "messages", "auditLogs", "contributionLogs"];
const counts = Object.fromEntries(await Promise.all(collections.map(async (collectionId) => [collectionId, await countCollection(collectionId)])));

const supplierId = arg("supplier-id");
const userId = arg("user-id");
const rfqReference = arg("rfq-id");
let rawRfq = await exactDocument("rfqs", rfqReference);
if (!rawRfq.exists && supplierId) {
  const candidates = await boundedDocuments("rfqs", [
    { field: "recipientIds", op: "ARRAY_CONTAINS", value: supplierId },
  ], 5);
  rawRfq = candidates.find((candidate) => {
    const title = decodeField(candidate.fields.title);
    return typeof title === "string" && title.includes(rfqReference);
  }) || (candidates.length === 1 ? candidates[0] : rawRfq);
}
const rfqId = rawRfq.exists ? rawRfq.id : "";
let responseId = arg("response-id") || (rfqId && userId ? `${rfqId}_${userId}` : "");
let rawResponse = await exactDocument("rfqResponses", responseId);
if (!rawResponse.exists && rfqId) {
  const candidates = await boundedDocuments("rfqResponses", [
    { field: "rfqId", op: "EQUAL", value: rfqId },
  ], 10);
  rawResponse = candidates.find((candidate) => (
    decodeField(candidate.fields.supplierUserId) === userId
      && decodeField(candidate.fields.supplierProfileId) === supplierId
  )) || rawResponse;
  if (rawResponse.exists) responseId = rawResponse.id;
}
const currentRevision = Math.max(2, Number(arg("revision") || 2));
const rawExactChecks = {
  supplier: await exactDocument("suppliers", supplierId),
  user: await exactDocument("users", userId),
  rfq: rawRfq,
  response: rawResponse,
  revisionV1: await exactDocument("rfqResponseRevisions", responseId ? `${responseId}_v1` : ""),
  revisionCurrent: await exactDocument("rfqResponseRevisions", responseId ? `${responseId}_v${currentRevision}` : ""),
  firstEvent: await exactDocument("rfqResponseEvents", responseId),
  updateEvent: await exactDocument("rfqResponseEvents", responseId ? `${responseId}_v${currentRevision}` : ""),
  firstNotification: await exactDocument("notifications", responseId ? `rfq-response_${responseId}` : ""),
  updateNotification: await exactDocument("notifications", responseId ? `rfq-response-updated_${responseId}_v${currentRevision}` : ""),
};
const exactChecks = {
  supplier: summarizeDocument(rawExactChecks.supplier, ["status", "canReceiveRfqs", "accountOwnerId"]),
  user: summarizeDocument(rawExactChecks.user, ["role", "accountType", "status", "emailVerified", "accessStatus", "supplierProfileId"]),
  rfq: summarizeDocument(rawExactChecks.rfq, ["status", "buyerId", "recipientIds", "closingAt"]),
  response: summarizeDocument(rawExactChecks.response, ["rfqId", "supplierUserId", "supplierProfileId", "status", "revisionNumber", "revisionId", "price", "currency", "deliveryDays"]),
  revisionV1: summarizeDocument(rawExactChecks.revisionV1, ["responseId", "rfqId", "buyerId", "supplierUserId", "supplierProfileId", "revisionNumber", "changeType"]),
  revisionCurrent: summarizeDocument(rawExactChecks.revisionCurrent, ["responseId", "rfqId", "buyerId", "supplierUserId", "supplierProfileId", "revisionNumber", "changeType", "previousRevisionNumber"]),
  firstEvent: summarizeDocument(rawExactChecks.firstEvent, ["type", "actorId", "buyerId", "rfqId", "responseId", "supplierProfileId", "revisionNumber"]),
  updateEvent: summarizeDocument(rawExactChecks.updateEvent, ["type", "actorId", "buyerId", "rfqId", "responseId", "supplierProfileId", "revisionNumber", "previousRevisionNumber"]),
  firstNotification: summarizeDocument(rawExactChecks.firstNotification, ["userId", "actorId", "type", "referenceType", "referenceId", "eventId", "responseId", "revisionNumber"]),
  updateNotification: summarizeDocument(rawExactChecks.updateNotification, ["userId", "actorId", "type", "referenceType", "referenceId", "eventId", "responseId", "revisionNumber"]),
};
const latestAudit = await latestDocuments("auditLogs", 5);

const report = { projectId, mode: "low-read", counts, exactChecks, latestAudit, logicalReadsEstimated, writesAttempted: false, fullScanExecuted: false };
console.log(JSON.stringify(report, null, 2));

if (!allowFullScan) {
  console.log("FULL_SCAN_BLOCKED: full collection downloads and Supplier hashes require --allow-full-scan.");
  process.exit(0);
}

const estimatedSupplierReads = counts.suppliers;
console.warn(`FULL_SCAN_WARNING: proceeding may read at least ${estimatedSupplierReads} Supplier documents plus query overhead.`);
const supplierRows = await api(`${databasePath}:runQuery`, {
  method: "POST",
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "suppliers" }], orderBy: [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }] } }),
});
const supplierDocuments = supplierRows.flatMap((row) => row.document ? [row.document] : []);
const ids = supplierDocuments.map((document) => decodeURIComponent(document.name.split("/").pop() || ""));
const hash = (value) => createHash("sha256").update(value).digest("hex");
console.log(JSON.stringify({
  fullScanExecuted: true,
  supplierDocumentsRead: supplierDocuments.length,
  supplierIdsHash: hash(ids.join("\n")),
  supplierContentHash: hash(JSON.stringify(supplierDocuments.map(({ name, fields }) => ({ id: decodeURIComponent(name.split("/").pop() || ""), fields })))),
  writesAttempted: false,
}, null, 2));
