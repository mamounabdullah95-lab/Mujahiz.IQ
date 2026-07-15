import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc } from "firebase/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || "demo-mujahiziq-rfq-uat";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [firestoreHostname, firestorePortValue] = firestoreHost.split(":");
const firestorePort = Number(firestorePortValue);
const authBase = `http://${authHost}`;
const credentialsPath = process.env.UAT_CREDENTIALS_PATH || "C:/tmp/mujahiz-rfq-emulator-uat-credentials.json";

const accounts = [
  { key: "buyer", email: "buyer.rfq.uat@mujahiz.local", password: "LocalBuyer#2026RFQ", displayName: "TEST RFQ Buyer" },
  { key: "supplier", email: "supplier.rfq.uat@mujahiz.local", password: "LocalSupplier#2026RFQ", displayName: "TEST RFQ Supplier" },
];

async function authRequest(path, body) {
  const response = await fetch(`${authBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(payload)}`);
  return payload;
}

async function getOobCodes() {
  const response = await fetch(`${authBase}/emulator/v1/projects/${projectId}/oobCodes`);
  const payload = await response.json();
  if (!response.ok) throw new Error(`oobCodes: ${JSON.stringify(payload)}`);
  return Array.isArray(payload.oobCodes) ? payload.oobCodes : [];
}

async function verifyEmail(account, idToken) {
  let lookup = await authRequest("/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-api-key", { idToken });
  if (lookup.users?.[0]?.emailVerified === true) return { idToken, lookup };

  await authRequest("/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=demo-api-key", {
    requestType: "VERIFY_EMAIL",
    idToken,
  });

  const code = (await getOobCodes())
    .filter((entry) => entry.email === account.email && entry.requestType === "VERIFY_EMAIL")
    .at(-1)?.oobCode;
  if (!code) throw new Error(`No VERIFY_EMAIL OOB code was created for ${account.email}`);

  await authRequest("/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-api-key", { oobCode: code });
  const signedIn = await authRequest("/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
    email: account.email,
    password: account.password,
    returnSecureToken: true,
  });
  lookup = await authRequest("/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-api-key", { idToken: signedIn.idToken });
  if (lookup.users?.[0]?.emailVerified !== true) {
    throw new Error(`Auth email verification did not persist for ${account.email}`);
  }
  return { idToken: signedIn.idToken, lookup };
}

async function createVerifiedAccount(account) {
  let created;
  try {
    created = await authRequest("/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", {
      email: account.email,
      password: account.password,
      displayName: account.displayName,
      returnSecureToken: true,
    });
  } catch (error) {
    if (!String(error).includes("EMAIL_EXISTS")) throw error;
    created = await authRequest("/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key", {
      email: account.email,
      password: account.password,
      returnSecureToken: true,
    });
  }

  const updated = await authRequest("/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-api-key", {
    idToken: created.idToken,
    displayName: account.displayName,
    returnSecureToken: true,
  });

  const verified = await verifyEmail(account, updated.idToken || created.idToken);
  return { ...account, uid: verified.lookup.users[0].localId, emailVerified: true };
}

const created = {};
for (const account of accounts) created[account.key] = await createVerifiedAccount(account);

const environment = await initializeTestEnvironment({
  projectId,
  firestore: { host: firestoreHostname, port: firestorePort },
});

await environment.withSecurityRulesDisabled(async (context) => {
  const database = context.firestore();
  const now = Timestamp.now();
  const accessExpiresAt = Timestamp.fromMillis(now.toMillis() + (30 * 86_400_000));
  await Promise.all([
    setDoc(doc(database, "users", created.buyer.uid), {
      uid: created.buyer.uid,
      email: created.buyer.email,
      displayName: created.buyer.displayName,
      fullName: created.buyer.displayName,
      phone: "+9647700000101",
      jobTitle: "Procurement Specialist",
      organization: "TEST Buyer Organization",
      governorate: "baghdad",
      city: "baghdad",
      sector: "industrial",
      reasonForJoining: "RFQ emulator validation",
      role: "contributor",
      accountType: "buyer",
      status: "approved",
      emailVerified: true,
      emailVerifiedAt: now,
      accessStatus: "temporary",
      accessExpiresAt,
      trialStartedAt: now,
      trialEndsAt: accessExpiresAt,
      trustScore: 0,
      points: 5,
      qualityRatio: 0,
      totalSubmissions: 0,
      approvedSubmissions: 0,
      rejectedSubmissions: 0,
      duplicateSubmissions: 0,
      approvedReviews: 0,
      approvedNewSupplierContributions: 0,
      consumedApprovedSupplierContributions: 0,
      badges: [],
      language: "en",
      createdAt: now,
      updatedAt: now,
    }),
    setDoc(doc(database, "users", created.supplier.uid), {
      uid: created.supplier.uid,
      email: created.supplier.email,
      displayName: created.supplier.displayName,
      fullName: created.supplier.displayName,
      phone: "+9647700000102",
      jobTitle: "Sales Manager",
      organization: "TEST RFQ Supplier Emulator",
      governorate: "baghdad",
      city: "baghdad",
      sector: "instrumentation",
      reasonForJoining: "RFQ emulator validation",
      role: "contributor",
      accountType: "supplier",
      status: "approved",
      emailVerified: true,
      emailVerifiedAt: now,
      accessStatus: "pending",
      accessExpiresAt: null,
      trialStartedAt: null,
      trialEndsAt: null,
      trustScore: 0,
      points: 5,
      qualityRatio: 0,
      totalSubmissions: 0,
      approvedSubmissions: 0,
      rejectedSubmissions: 0,
      duplicateSubmissions: 0,
      approvedReviews: 0,
      approvedNewSupplierContributions: 0,
      consumedApprovedSupplierContributions: 0,
      badges: [],
      language: "en",
      supplierProfileId: "TEST-RFQ-SUPPLIER-EMULATOR",
      createdAt: now,
      updatedAt: now,
    }),
    setDoc(doc(database, "suppliers", "TEST-RFQ-SUPPLIER-EMULATOR"), {
      nameOriginal: "TEST RFQ Supplier Emulator",
      displayName: "TEST RFQ Supplier Emulator",
      normalizedName: "test rfq supplier emulator",
      status: "approved",
      sourceType: "self_registered",
      canReceiveRfqs: true,
      accountOwnerId: created.supplier.uid,
      categories: ["instrumentation"],
      governorate: "baghdad",
      city: "baghdad",
      marketArea: "Industrial Area",
      phones: ["+9647700000000"],
      email: created.supplier.email,
      createdAt: now,
      updatedAt: now,
    }),
  ]);
});

await environment.cleanup();

fs.writeFileSync(credentialsPath, JSON.stringify({
  projectId,
  target: "Firebase Emulator only",
  createdAt: new Date().toISOString(),
  accounts: Object.fromEntries(Object.entries(created).map(([key, value]) => [key, {
    email: value.email,
    password: value.password,
    uid: value.uid,
  }])),
  supplierProfileId: "TEST-RFQ-SUPPLIER-EMULATOR",
}, null, 2));

console.log(JSON.stringify({
  projectId,
  buyerUid: created.buyer.uid,
  supplierUid: created.supplier.uid,
  authEmailVerified: created.buyer.emailVerified && created.supplier.emailVerified,
  supplierProfileId: "TEST-RFQ-SUPPLIER-EMULATOR",
  credentialsPath,
}));
