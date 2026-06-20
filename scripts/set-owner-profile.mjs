import { getAccessToken, readServiceAccount } from "./google-service-account-auth.mjs";

const email = process.argv[2] || process.env.OWNER_EMAIL;
if (!email) {
  throw new Error("Usage: node scripts/set-owner-profile.mjs owner@example.com");
}

const serviceAccount = readServiceAccount();
const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID or service account project_id is required.");
}

const token = await getAccessToken([
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/firebase",
  "https://www.googleapis.com/auth/identitytoolkit",
]);

async function api(origin, path, init = {}) {
  const response = await fetch(`${origin}${path}`, {
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

function stringValue(value) {
  return { stringValue: value || "" };
}

function integerValue(value) {
  return { integerValue: String(value || 0) };
}

function doubleValue(value) {
  return { doubleValue: Number(value || 0) };
}

function timestampValue(value) {
  return { timestampValue: value.toISOString() };
}

function arrayValue(values = []) {
  return { arrayValue: values.length ? { values: values.map((value) => stringValue(value)) } : {} };
}

function userProfileFields(user, existingFields = {}) {
  const now = new Date();
  const accessExpiresAt = new Date(now);
  accessExpiresAt.setFullYear(accessExpiresAt.getFullYear() + 10);
  const fallbackName = (user.email || email).split("@")[0].replace(/[._-]+/g, " ");

  return {
    uid: stringValue(user.localId),
    email: stringValue(user.email || email),
    fullName: existingFields.fullName || stringValue(user.displayName || fallbackName || "Mujahiz IQ Owner"),
    phone: existingFields.phone || stringValue(""),
    jobTitle: existingFields.jobTitle || stringValue("Owner"),
    organization: existingFields.organization || stringValue("Mujahiz IQ"),
    governorate: existingFields.governorate || stringValue(""),
    city: existingFields.city || stringValue(""),
    sector: existingFields.sector || stringValue("Administration"),
    reasonForJoining: existingFields.reasonForJoining || stringValue("Initial owner account"),
    role: stringValue("owner"),
    status: stringValue("approved"),
    accessStatus: stringValue("active"),
    accessExpiresAt: timestampValue(accessExpiresAt),
    trustScore: existingFields.trustScore || integerValue(100),
    points: existingFields.points || integerValue(5),
    qualityRatio: existingFields.qualityRatio || doubleValue(0),
    totalSubmissions: existingFields.totalSubmissions || integerValue(0),
    approvedSubmissions: existingFields.approvedSubmissions || integerValue(0),
    rejectedSubmissions: existingFields.rejectedSubmissions || integerValue(0),
    duplicateSubmissions: existingFields.duplicateSubmissions || integerValue(0),
    approvedReviews: existingFields.approvedReviews || integerValue(0),
    approvedNewSupplierContributions: existingFields.approvedNewSupplierContributions || integerValue(0),
    consumedApprovedSupplierContributions: existingFields.consumedApprovedSupplierContributions || integerValue(0),
    badges: existingFields.badges || arrayValue([]),
    language: existingFields.language || stringValue("ar"),
    createdAt: existingFields.createdAt || timestampValue(now),
    updatedAt: timestampValue(now),
  };
}

const queryResponse = await api(
  "https://identitytoolkit.googleapis.com",
  `/v1/projects/${projectId}/accounts:query`,
  {
    method: "POST",
    body: JSON.stringify({
      returnUserInfo: true,
      limit: "1",
      expression: [{ email }],
    }),
  },
);

const user = queryResponse.userInfo?.[0];
if (!user?.localId) {
  throw new Error(`No Firebase Auth user found for ${email}. Register once, then run this script again.`);
}

const documentPath = `/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(user.localId)}`;
let existingFields = {};
try {
  const existingDoc = await api("https://firestore.googleapis.com", documentPath);
  existingFields = existingDoc.fields || {};
} catch (error) {
  if (error.status !== 404) {
    throw error;
  }
}

await api("https://firestore.googleapis.com", documentPath, {
  method: "PATCH",
  body: JSON.stringify({
    fields: userProfileFields(user, existingFields),
  }),
});

await api("https://firestore.googleapis.com", `/v1/projects/${projectId}/databases/(default)/documents/auditLogs`, {
  method: "POST",
  body: JSON.stringify({
    fields: {
      actorId: stringValue(user.localId),
      action: stringValue("user.owner_bootstrapped"),
      targetType: stringValue("user"),
      targetId: stringValue(user.localId),
      details: { mapValue: { fields: { email: stringValue(user.email || email) } } },
      createdAt: timestampValue(new Date()),
    },
  }),
});

console.log(`PROJECT=${projectId}`);
console.log(`OWNER_EMAIL=${user.email || email}`);
console.log(`OWNER_UID=${user.localId}`);
console.log("OWNER_PROFILE_READY=true");

