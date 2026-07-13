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

const supplierAccounts = queryResult.flatMap((row) => {
  const userDocument = row.document;
  if (!userDocument) return [];
  return [{
    userId: documentId(userDocument.name),
    email: stringField(userDocument.fields, "email"),
    supplierProfileId: stringField(userDocument.fields, "supplierProfileId"),
    status: stringField(userDocument.fields, "status"),
  }];
});

const claimsByProfile = new Map();
for (const account of supplierAccounts) {
  if (!account.supplierProfileId) continue;
  const claims = claimsByProfile.get(account.supplierProfileId) || [];
  claims.push(account);
  claimsByProfile.set(account.supplierProfileId, claims);
}

const linkable = [];
const unlinkable = [];
const duplicates = [];

for (const account of supplierAccounts) {
  if (!account.supplierProfileId) {
    unlinkable.push({ ...account, reason: "missing_supplier_profile_id" });
    continue;
  }

  const claims = claimsByProfile.get(account.supplierProfileId) || [];
  if (claims.length > 1) {
    duplicates.push({
      ...account,
      reason: "multiple_accounts_claim_same_profile",
      conflictingUserIds: claims.map((item) => item.userId).filter((id) => id !== account.userId),
    });
    continue;
  }

  let supplierDocument;
  try {
    supplierDocument = await api(`${databasePath}/suppliers/${encodeURIComponent(account.supplierProfileId)}`);
  } catch (error) {
    if (error.status === 404) {
      unlinkable.push({ ...account, reason: "missing_supplier_profile" });
      continue;
    }
    throw error;
  }

  const currentOwner = stringField(supplierDocument.fields, "accountOwnerId");
  const currentEligibility = booleanField(supplierDocument.fields, "canReceiveRfqs");
  const desiredEligibility = account.status === "approved";

  if (currentOwner && currentOwner !== account.userId) {
    duplicates.push({
      ...account,
      reason: "supplier_profile_owned_by_another_account",
      currentOwner,
    });
    continue;
  }

  linkable.push({
    ...account,
    currentOwner,
    currentEligibility,
    desiredEligibility,
    requiresUpdate: currentOwner !== account.userId || currentEligibility !== desiredEligibility,
  });
}

const wouldUpdate = linkable.filter((item) => item.requiresUpdate);
const summary = {
  projectId,
  mode: apply ? "apply" : "dry-run",
  supplierAccounts: supplierAccounts.length,
  linkable: linkable.length,
  unlinkable: unlinkable.length,
  duplicates: duplicates.length,
  wouldUpdate: wouldUpdate.length,
  updated: 0,
  writesExecuted: 0,
};

console.log(`PROJECT=${summary.projectId}`);
console.log(`MODE=${summary.mode}`);
console.log(`SUPPLIER_ACCOUNTS=${summary.supplierAccounts}`);
console.log(`LINKABLE=${summary.linkable}`);
console.log(`UNLINKABLE=${summary.unlinkable}`);
console.log(`DUPLICATES=${summary.duplicates}`);
console.log(`WOULD_UPDATE=${summary.wouldUpdate}`);
console.log("UPDATED=0");
console.log("WRITES_EXECUTED=0");
console.log("LINKABLE_ACCOUNTS");
console.table(linkable);
console.log("UNLINKABLE_ACCOUNTS");
console.table(unlinkable);
console.log("DUPLICATE_OR_CONFLICTING_ACCOUNTS");
console.table(duplicates);

if (!apply) {
  console.log("No Firestore documents were changed. Run again with --apply only after reviewing this report.");
  process.exit(0);
}

let updated = 0;
for (const candidate of wouldUpdate) {
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
console.log(`WRITES_EXECUTED=${updated}`);
