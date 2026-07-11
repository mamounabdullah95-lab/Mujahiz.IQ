import { getAccessToken, readServiceAccount } from "./google-service-account-auth.mjs";

const apply = process.argv.includes("--apply");
const serviceAccount = readServiceAccount();
const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
if (!projectId) throw new Error("FIREBASE_PROJECT_ID or service account project_id is required.");

const token = await getAccessToken(["https://www.googleapis.com/auth/cloud-platform"]);
const firestoreOrigin = "https://firestore.googleapis.com";
const databasePath = `/v1/projects/${projectId}/databases/(default)/documents`;

async function api(path, init = {}) {
  const response = await fetch(`${firestoreOrigin}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${text}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function stringField(fields, key) {
  return fields?.[key]?.stringValue || "";
}

function booleanField(fields, key) {
  return fields?.[key]?.booleanValue;
}

function documentId(name) {
  return decodeURIComponent(name.split("/").pop() || "");
}

const queryResult = await api(`${databasePath}:runQuery`, {
  method: "POST",
  body: JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "accountType" },
          op: "EQUAL",
          value: { stringValue: "supplier" },
        },
      },
      limit: 1000,
    },
  }),
});

const candidates = [];
for (const row of queryResult) {
  const userDocument = row.document;
  if (!userDocument) continue;
  const userId = documentId(userDocument.name);
  const supplierProfileId = stringField(userDocument.fields, "supplierProfileId");
  if (!supplierProfileId) continue;
  const status = stringField(userDocument.fields, "status");
  const desiredEligibility = status === "approved";
  let supplierDocument;
  try {
    supplierDocument = await api(`${databasePath}/suppliers/${encodeURIComponent(supplierProfileId)}`);
  } catch (error) {
    if (error.status === 404) {
      candidates.push({ userId, supplierProfileId, status, action: "missing_supplier_profile" });
      continue;
    }
    throw error;
  }
  const currentOwner = stringField(supplierDocument.fields, "accountOwnerId");
  const currentEligibility = booleanField(supplierDocument.fields, "canReceiveRfqs");
  if (currentOwner === userId && currentEligibility === desiredEligibility) continue;
  candidates.push({
    userId,
    supplierProfileId,
    status,
    currentOwner,
    currentEligibility,
    desiredEligibility,
    action: "update_link",
  });
}

console.log(`PROJECT=${projectId}`);
console.log(`MODE=${apply ? "apply" : "dry-run"}`);
console.log(`CANDIDATES=${candidates.length}`);
console.table(candidates);

if (!apply) {
  console.log("No Firestore documents were changed. Run again with --apply only after reviewing this report.");
  process.exit(0);
}

let updated = 0;
for (const candidate of candidates) {
  if (candidate.action !== "update_link") continue;
  const query = new URLSearchParams();
  for (const field of ["accountOwnerId", "canReceiveRfqs", "updatedAt"]) query.append("updateMask.fieldPaths", field);
  await api(`${databasePath}/suppliers/${encodeURIComponent(candidate.supplierProfileId)}?${query}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: {
        accountOwnerId: { stringValue: candidate.userId },
        canReceiveRfqs: { booleanValue: candidate.desiredEligibility },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  updated += 1;
}

console.log(`UPDATED=${updated}`);
