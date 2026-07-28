import fs from "node:fs";
import {
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

export const INTERNAL_EMULATOR_PROJECT_ID = "demo-mujahiziq-integration";
export const INTERNAL_EMULATOR_FIXTURE_VERSION = "internal-emulator-accounts-v1";
export const LOCAL_EMULATOR_TEST_PASSWORD = "LocalEmulatorOnly!2026";

const CREATED_AT = Timestamp.fromDate(new Date("2026-07-27T00:00:00.000Z"));
const EXPIRED_AT = Timestamp.fromDate(new Date("2000-01-01T00:00:00.000Z"));
const ACTIVE_UNTIL = Timestamp.fromDate(new Date("2099-12-31T23:59:59.000Z"));
const BUYER_04_CONTRIBUTION_IDS = Array.from(
  { length: 10 },
  (_, index) => `TEST-INTERNAL-CONTRIBUTION-${String(index + 1).padStart(2, "0")}`,
);

export const internalEmulatorAccounts = Object.freeze({
  buyer01: Object.freeze({
    key: "buyer01",
    uid: "buyer-01",
    email: "buyer-01@internal.example.test",
    displayName: "TEST Buyer 01",
    accountType: "buyer",
    fixtureState: "active_standard",
  }),
  buyer02: Object.freeze({
    key: "buyer02",
    uid: "buyer-02",
    email: "buyer-02@internal.example.test",
    displayName: "TEST Buyer 02",
    accountType: "buyer",
    fixtureState: "verified_trial",
  }),
  buyer03: Object.freeze({
    key: "buyer03",
    uid: "buyer-03",
    email: "buyer-03@internal.example.test",
    displayName: "TEST Buyer 03",
    accountType: "buyer",
    fixtureState: "expired_access",
  }),
  buyer04: Object.freeze({
    key: "buyer04",
    uid: "buyer-04",
    email: "buyer-04@internal.example.test",
    displayName: "TEST Buyer 04",
    accountType: "buyer",
    fixtureState: "supplier_contribution_access_extension",
  }),
  supplier01: Object.freeze({
    key: "supplier01",
    uid: "supplier-01",
    email: "supplier-01@internal.example.test",
    displayName: "TEST Supplier 01",
    accountType: "supplier",
    supplierProfileId: "TEST-INTERNAL-SUPPLIER-01",
    fixtureState: "approved_linked_rfq_ready",
  }),
  supplier02: Object.freeze({
    key: "supplier02",
    uid: "supplier-02",
    email: "supplier-02@internal.example.test",
    displayName: "TEST Supplier 02",
    accountType: "supplier",
    fixtureState: "verified_unlinked",
  }),
  supplier03: Object.freeze({
    key: "supplier03",
    uid: "supplier-03",
    email: "supplier-03@internal.example.test",
    displayName: "TEST Supplier 03",
    accountType: "supplier",
    fixtureState: "pending_ownership_unlinked",
  }),
  supplier04: Object.freeze({
    key: "supplier04",
    uid: "supplier-04",
    email: "supplier-04@internal.example.test",
    displayName: "TEST Supplier 04",
    accountType: "supplier",
    supplierProfileId: "TEST-INTERNAL-SUPPLIER-04",
    fixtureState: "approved_linked_rfq_ready",
  }),
});

export const internalEmulatorAccountList = Object.freeze(Object.values(internalEmulatorAccounts));

export const internalSupplierProfiles = Object.freeze({
  supplier01: Object.freeze({
    id: "TEST-INTERNAL-SUPPLIER-01",
    accountOwnerId: internalEmulatorAccounts.supplier01.uid,
    canReceiveRfqs: true,
    fixtureState: "approved_linked_rfq_ready",
  }),
  supplier02: Object.freeze({
    id: "TEST-INTERNAL-SUPPLIER-02",
    accountOwnerId: "",
    canReceiveRfqs: true,
    fixtureState: "approved_unowned",
  }),
  supplier03: Object.freeze({
    id: "TEST-INTERNAL-SUPPLIER-03",
    accountOwnerId: "",
    canReceiveRfqs: false,
    fixtureState: "pending_ownership_unlinked",
  }),
  supplier04: Object.freeze({
    id: "TEST-INTERNAL-SUPPLIER-04",
    accountOwnerId: internalEmulatorAccounts.supplier04.uid,
    canReceiveRfqs: true,
    fixtureState: "approved_linked_rfq_ready",
  }),
});

function parseLoopbackEmulatorHost(variableName) {
  const value = process.env[variableName];
  if (!value) throw new Error(`${variableName} must be set; refusing to use a default or non-Emulator target.`);
  if (value.includes("://")) throw new Error(`${variableName} must not include a protocol.`);

  const separator = value.lastIndexOf(":");
  if (separator <= 0) throw new Error(`${variableName} must contain a loopback host and port.`);
  const host = value.slice(0, separator).replace(/^\[(.*)\]$/, "$1");
  const port = Number(value.slice(separator + 1));
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`${variableName} must use a loopback host; received ${host}.`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${variableName} contains an invalid port.`);
  }
  return { host, port, baseUrl: `http://${value}` };
}

export function requireInternalEmulatorConfiguration() {
  const auth = parseLoopbackEmulatorHost("FIREBASE_AUTH_EMULATOR_HOST");
  const firestore = parseLoopbackEmulatorHost("FIRESTORE_EMULATOR_HOST");
  for (const variableName of ["FIREBASE_PROJECT_ID", "GCLOUD_PROJECT"]) {
    const configuredProjectId = process.env[variableName];
    if (configuredProjectId && configuredProjectId !== INTERNAL_EMULATOR_PROJECT_ID) {
      throw new Error(
        `${variableName} must equal ${INTERNAL_EMULATOR_PROJECT_ID}; refusing project ${configuredProjectId}.`,
      );
    }
  }
  if (!INTERNAL_EMULATOR_PROJECT_ID.startsWith("demo-")) {
    throw new Error("Internal Emulator fixtures require a Firebase demo project ID.");
  }
  return { auth, firestore, projectId: INTERNAL_EMULATOR_PROJECT_ID };
}

export async function createInternalEmulatorTestEnvironment() {
  const { firestore, projectId } = requireInternalEmulatorConfiguration();
  const rules = fs.readFileSync(new URL("../../firestore.rbac.rules", import.meta.url), "utf8");
  return initializeTestEnvironment({
    projectId,
    firestore: { host: firestore.host, port: firestore.port, rules },
  });
}

async function authEmulatorRequest(path, init = {}) {
  const { auth } = requireInternalEmulatorConfiguration();
  const response = await fetch(`${auth.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Auth Emulator request failed (${response.status}) at ${path}.`);
  }
  return payload;
}

function userDocument(account) {
  const common = {
    uid: account.uid,
    email: account.email,
    fullName: account.displayName,
    phone: "",
    jobTitle: account.accountType === "buyer" ? "TEST Procurement User" : "TEST Supplier User",
    organization: `TEST Internal Emulator ${account.uid}`,
    governorate: "baghdad",
    city: "baghdad",
    sector: "industrial",
    reasonForJoining: `TEST fixture ${INTERNAL_EMULATOR_FIXTURE_VERSION}`,
    role: "contributor",
    accountType: account.accountType,
    status: "approved",
    emailVerified: true,
    emailVerifiedAt: CREATED_AT,
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
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };

  if (account.key === "buyer01") {
    return {
      ...common,
      accessStatus: "active",
      accessExpiresAt: ACTIVE_UNTIL,
      trialStartedAt: null,
      trialEndsAt: null,
    };
  }
  if (account.key === "buyer02") {
    return {
      ...common,
      accessStatus: "temporary",
      accessExpiresAt: ACTIVE_UNTIL,
      trialStartedAt: CREATED_AT,
      trialEndsAt: ACTIVE_UNTIL,
    };
  }
  if (account.key === "buyer03") {
    return {
      ...common,
      accessStatus: "expired",
      accessExpiresAt: EXPIRED_AT,
      trialStartedAt: EXPIRED_AT,
      trialEndsAt: EXPIRED_AT,
    };
  }
  if (account.key === "buyer04") {
    return {
      ...common,
      accessStatus: "active",
      accessExpiresAt: ACTIVE_UNTIL,
      trialStartedAt: null,
      trialEndsAt: null,
      approvedSubmissions: 10,
      approvedNewSupplierContributions: 10,
      consumedApprovedSupplierContributions: 10,
      unconsumedApprovedSubmissionIds: [],
    };
  }
  return {
    ...common,
    accessStatus: "pending",
    accessExpiresAt: null,
    trialStartedAt: null,
    trialEndsAt: null,
    ...(account.supplierProfileId ? { supplierProfileId: account.supplierProfileId } : {}),
  };
}

function supplierDocument(profile) {
  const number = profile.id.slice(-2);
  return {
    id: profile.id,
    nameOriginal: `TEST Internal Supplier ${number}`,
    displayName: `TEST Internal Supplier ${number}`,
    nameLanguage: "english",
    nameEn: `TEST Internal Supplier ${number}`,
    shortDescription: `TEST fixture ${INTERNAL_EMULATOR_FIXTURE_VERSION}`,
    businessType: "company",
    governorate: "baghdad",
    governorates: ["baghdad"],
    branches: [],
    city: "baghdad",
    marketArea: "TEST Internal Emulator",
    coverageAreas: ["baghdad"],
    phones: [],
    normalizedPhones: [],
    whatsappAvailable: "unknown",
    email: `${profile.id.toLowerCase()}@internal.example.test`,
    normalizedEmail: `${profile.id.toLowerCase()}@internal.example.test`,
    website: `https://internal.example.test/suppliers/${number}`,
    contactPerson: "TEST Internal Contact",
    contactPersonRole: "TEST fixture",
    categories: ["instrumentation"],
    subcategories: [],
    capabilityTags: ["test_fixture"],
    paymentOptions: ["bank_transfer"],
    acceptsCredit: false,
    creditDays: [],
    sourceType: "other",
    confidenceLevel: "high",
    hasDirectExperience: "yes",
    sourceNote: `TEST fixture ${INTERNAL_EMULATOR_FIXTURE_VERSION}`,
    completionScore: 100,
    normalizedName: `test internal supplier ${number}`,
    searchKeywords: ["test", "internal", "supplier", number],
    status: "approved",
    verificationStatus: "verified",
    sourceSummary: INTERNAL_EMULATOR_FIXTURE_VERSION,
    canReceiveRfqs: profile.canReceiveRfqs,
    accountOwnerId: profile.accountOwnerId,
    averageRating: 0,
    reviewCount: 0,
    createdBy: "TEST-INTERNAL-FIXTURE",
    approvedBy: "TEST-INTERNAL-FIXTURE",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

export async function resetInternalEmulatorState(environment) {
  requireInternalEmulatorConfiguration();
  if (!environment?.clearFirestore) {
    throw new Error("A RulesTestEnvironment is required to reset the internal Emulator fixtures.");
  }
  await Promise.all([
    environment.clearFirestore(),
    authEmulatorRequest(`/emulator/v1/projects/${INTERNAL_EMULATOR_PROJECT_ID}/accounts`, {
      method: "DELETE",
    }),
  ]);
}

export async function seedInternalEmulatorAccounts(environment) {
  requireInternalEmulatorConfiguration();
  if (!environment?.withSecurityRulesDisabled) {
    throw new Error("A RulesTestEnvironment is required to seed the internal Emulator fixtures.");
  }

  const authResult = await authEmulatorRequest(
    `/identitytoolkit.googleapis.com/v1/projects/${INTERNAL_EMULATOR_PROJECT_ID}/accounts:batchCreate`,
    {
      method: "POST",
      headers: { authorization: "Bearer owner" },
      body: JSON.stringify({
        allowOverwrite: true,
        sanityCheck: true,
        users: internalEmulatorAccountList.map((account) => ({
          localId: account.uid,
          email: account.email,
          emailVerified: true,
          displayName: account.displayName,
          rawPassword: LOCAL_EMULATOR_TEST_PASSWORD,
        })),
      }),
    },
  );
  if (authResult.error?.length || authResult.errors?.length) {
    throw new Error("Auth Emulator rejected one or more deterministic internal accounts.");
  }

  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const batch = writeBatch(database);
    for (const account of internalEmulatorAccountList) {
      batch.set(doc(database, "users", account.uid), userDocument(account));
    }
    for (const profile of Object.values(internalSupplierProfiles)) {
      batch.set(doc(database, "suppliers", profile.id), supplierDocument(profile));
    }
    batch.set(doc(database, "accessCredits", "TEST-INTERNAL-BUYER-04-CONTRIBUTION"), {
      userId: internalEmulatorAccounts.buyer04.uid,
      source: "supplier_contribution",
      approvedSupplierCount: 10,
      daysGranted: 30,
      status: "applied",
      createdAt: CREATED_AT,
      appliedAt: CREATED_AT,
    });
    batch.set(doc(database, "accessGrants", "TEST-INTERNAL-BUYER-04-CONTRIBUTION"), {
      userId: internalEmulatorAccounts.buyer04.uid,
      grantType: "supplier_contribution",
      approvedSubmissionIds: BUYER_04_CONTRIBUTION_IDS,
      approvedSupplierCount: 10,
      daysGranted: 30,
      grantedAt: CREATED_AT,
      previousExpiry: null,
      newExpiry: ACTIVE_UNTIL,
      createdBy: "TEST-INTERNAL-FIXTURE",
      auditReference: "TEST-INTERNAL-BUYER-04-CONTRIBUTION",
      createdAt: CREATED_AT,
    });
    await batch.commit();
  });

  return internalEmulatorAccounts;
}

export async function listInternalAuthEmulatorAccounts() {
  const result = await authEmulatorRequest(
    `/identitytoolkit.googleapis.com/v1/projects/${INTERNAL_EMULATOR_PROJECT_ID}/accounts:batchGet?maxResults=1000`,
    { headers: { authorization: "Bearer owner" } },
  );
  return Array.isArray(result.users) ? result.users : [];
}

export async function signInInternalEmulatorAccount(accountKey) {
  const account = internalEmulatorAccounts[accountKey];
  if (!account) throw new Error(`Unknown internal Emulator account: ${accountKey}`);
  return authEmulatorRequest(
    "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key",
    {
      method: "POST",
      body: JSON.stringify({
        email: account.email,
        password: LOCAL_EMULATOR_TEST_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
}

export function internalAccountContext(environment, accountKey, claims = {}) {
  requireInternalEmulatorConfiguration();
  const account = internalEmulatorAccounts[accountKey];
  if (!account) throw new Error(`Unknown internal Emulator account: ${accountKey}`);
  return environment.authenticatedContext(account.uid, {
    email: account.email,
    email_verified: true,
    ...claims,
  }).firestore();
}

function rfqData(rfqId, buyerId, recipientIds, status) {
  return {
    buyerId,
    title: `TEST Internal RFQ ${rfqId}`,
    description: "TEST deterministic Emulator-only RFQ.",
    quantity: 2,
    unit: "piece",
    unitOther: "",
    location: "baghdad - TEST location",
    deliveryGovernorate: "baghdad",
    deliveryAddress: "TEST Internal Emulator",
    preferredCurrency: "either",
    paymentTerms: "net_30",
    paymentTermsOther: "",
    deliveryTerms: "supplier_delivery",
    deliveryTermsOther: "",
    referenceLinks: ["https://internal.example.test/specification"],
    closingDate: "2099-12-31",
    closingAt: ACTIVE_UNTIL,
    categoryId: "instrumentation",
    recipientIds,
    status,
    attachmentStatus: "upload_pending_launch",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function createInternalBuyerDraft(environment, buyerKey, rfqId) {
  const buyer = internalEmulatorAccounts[buyerKey];
  const database = internalAccountContext(environment, buyerKey);
  const batch = writeBatch(database);
  batch.set(doc(database, "rfqs", rfqId), rfqData(rfqId, buyer.uid, [], "draft"));
  await batch.commit();
  return { database, rfqId };
}

export async function createInternalTargetedRfq(
  environment,
  { rfqId = "TEST-INTERNAL-MULTI-SUPPLIER-RFQ", buyerKey = "buyer01", supplierKeys = ["supplier01", "supplier04"] } = {},
) {
  const buyer = internalEmulatorAccounts[buyerKey];
  const recipientIds = supplierKeys.map((key) => {
    const supplierProfileId = internalEmulatorAccounts[key]?.supplierProfileId;
    if (!supplierProfileId) throw new Error(`${key} is not linked to a Supplier profile.`);
    return supplierProfileId;
  });
  const database = internalAccountContext(environment, buyerKey);
  const batch = writeBatch(database);
  batch.set(doc(database, "rfqs", rfqId), rfqData(rfqId, buyer.uid, recipientIds, "published"));
  batch.set(doc(database, "rfqPublishEvents", rfqId), {
    type: "rfq_published",
    actorId: buyer.uid,
    buyerId: buyer.uid,
    rfqId,
    recipientIds,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { buyer, recipientIds, rfqId };
}

function responseRevisionData(response, buyerId) {
  return {
    id: `${response.id}_v1`,
    responseId: response.id,
    rfqId: response.rfqId,
    buyerId,
    supplierUserId: response.supplierUserId,
    supplierProfileId: response.supplierProfileId,
    revisionNumber: 1,
    changeType: "submitted",
    message: response.message,
    price: response.price,
    currency: response.currency,
    deliveryDays: response.deliveryDays,
    paymentTerms: response.paymentTerms,
    paymentTermsOther: response.paymentTermsOther,
    deliveryTerms: response.deliveryTerms,
    deliveryTermsOther: response.deliveryTermsOther,
    referenceLinks: response.referenceLinks,
    responseStatus: response.status,
    createdBy: response.supplierUserId,
    createdAt: serverTimestamp(),
  };
}

export async function submitInternalQuotation(
  environment,
  { rfqId, supplierKey, buyerKey = "buyer01", price, deliveryDays = 7 },
) {
  const buyer = internalEmulatorAccounts[buyerKey];
  const supplier = internalEmulatorAccounts[supplierKey];
  if (!supplier?.supplierProfileId) throw new Error(`${supplierKey} is not linked to a Supplier profile.`);
  const database = internalAccountContext(environment, supplierKey);
  const responseId = `${rfqId}_${supplier.uid}`;
  const response = {
    id: responseId,
    rfqId,
    supplierUserId: supplier.uid,
    supplierProfileId: supplier.supplierProfileId,
    message: `TEST quotation from ${supplier.uid}.`,
    price,
    currency: "IQD",
    deliveryDays,
    paymentTerms: "net_30",
    paymentTermsOther: "",
    deliveryTerms: "supplier_delivery",
    deliveryTermsOther: "",
    referenceLinks: ["https://internal.example.test/quotation"],
    status: "submitted",
    attachmentStatus: "upload_pending_launch",
    revisionNumber: 1,
    revisionId: `${responseId}_v1`,
    firstSubmittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(database);
  batch.set(doc(database, "rfqResponses", responseId), response);
  batch.set(doc(database, "rfqResponseRevisions", response.revisionId), responseRevisionData(response, buyer.uid));
  batch.set(doc(database, "rfqResponseEvents", responseId), {
    type: "rfq_response_submitted",
    actorId: supplier.uid,
    buyerId: buyer.uid,
    rfqId,
    responseId,
    supplierProfileId: supplier.supplierProfileId,
    revisionNumber: 1,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(database, "notifications", `rfq-response_${responseId}`), {
    userId: buyer.uid,
    actorId: supplier.uid,
    type: "rfq",
    referenceType: "rfq",
    referenceId: rfqId,
    eventId: responseId,
    responseId,
    titleAr: "\u062a\u0645\u0020\u0627\u0633\u062a\u0644\u0627\u0645\u0020\u0639\u0631\u0636\u0020\u0633\u0639\u0631",
    titleEn: "New quotation received",
    bodyAr: "\u0627\u0633\u062a\u0644\u0645\u0020\u0637\u0644\u0628\u0643\u0020\u0639\u0631\u0636\u0020\u0633\u0639\u0631\u0020\u062c\u062f\u064a\u062f\u0627\u064b\u0020\u0645\u0646\u0020\u0623\u062d\u062f\u0020\u0627\u0644\u0645\u062c\u0647\u0632\u064a\u0646\u002e",
    bodyEn: "A supplier submitted a quotation for your RFQ.",
    link: "/buyer/rfqs",
    read: false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { response, responseId };
}
