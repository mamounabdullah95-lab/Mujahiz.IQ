import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(emulatorHost, "FIRESTORE_EMULATOR_HOST must be set by firebase emulators:exec");
const separator = emulatorHost.lastIndexOf(":");
const host = emulatorHost.slice(0, separator);
const port = Number(emulatorHost.slice(separator + 1));
const projectId = "demo-mujahiziq-integration";
const rules = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");
let environment;

const future = () => Timestamp.fromMillis(Date.now() + 86_400_000);
const past = () => Timestamp.fromMillis(Date.now() - 86_400_000);

const users = {
  buyer: { uid: "rfq-buyer", role: "contributor", accountType: "buyer", status: "approved", accessStatus: "temporary", accessExpiresAt: future() },
  inactiveBuyer: { uid: "rfq-buyer-inactive", role: "contributor", accountType: "buyer", status: "approved", accessStatus: "pending", accessExpiresAt: null },
  supplier: { uid: "rfq-supplier", role: "contributor", accountType: "supplier", status: "approved", supplierProfileId: "rfq-profile-1" },
  otherSupplier: { uid: "rfq-supplier-other", role: "contributor", accountType: "supplier", status: "approved", supplierProfileId: "rfq-profile-2" },
  admin: { uid: "rfq-admin", role: "admin", accountType: "buyer", status: "approved" },
  owner: { uid: "rfq-owner", role: "owner", accountType: "buyer", status: "approved" },
};

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      ...Object.values(users).map((user) => setDoc(doc(database, "users", user.uid), user)),
      setDoc(doc(database, "suppliers", "rfq-profile-1"), { status: "approved", canReceiveRfqs: true, accountOwnerId: users.supplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-2"), { status: "approved", canReceiveRfqs: true, accountOwnerId: users.otherSupplier.uid }),
    ]);
  });
});

after(async () => {
  await environment?.cleanup();
});

function contextFor(key) {
  const user = users[key];
  return environment.authenticatedContext(user.uid, { email: `${user.uid}@example.test` }).firestore();
}

function rfqData(id, buyerId = users.buyer.uid, overrides = {}) {
  const now = Timestamp.now();
  return {
    buyerId,
    title: `RFQ ${id}`,
    description: "Differential pressure gauge, mechanical, 0-10 bar.",
    quantity: 2,
    unit: "piece",
    unitOther: "",
    location: "baghdad - Karrada, Street 62",
    deliveryGovernorate: "baghdad",
    deliveryAddress: "Karrada, Street 62",
    preferredCurrency: "either",
    paymentTerms: "net_30",
    paymentTermsOther: "",
    deliveryTerms: "supplier_delivery",
    deliveryTermsOther: "",
    referenceLinks: ["https://example.test/specification.pdf"],
    closingDate: "2099-12-31",
    closingAt: future(),
    categoryId: "instrumentation",
    recipientIds: [users.supplier.supplierProfileId],
    status: "published",
    attachmentStatus: "upload_pending_launch",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function responseData(rfqId, supplier = users.supplier, overrides = {}) {
  const id = `${rfqId}_${supplier.uid}`;
  const now = Timestamp.now();
  return {
    id,
    rfqId,
    supplierUserId: supplier.uid,
    supplierProfileId: supplier.supplierProfileId,
    message: "TEST quotation for emulator validation.",
    price: 1000,
    currency: "USD",
    deliveryDays: 7,
    paymentTerms: "net_30",
    paymentTermsOther: "",
    deliveryTerms: "supplier_delivery",
    deliveryTermsOther: "",
    referenceLinks: ["https://example.test/quotation.pdf"],
    status: "submitted",
    attachmentStatus: "upload_pending_launch",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function notificationData(userId, actorId, rfqId, link) {
  return {
    userId,
    actorId,
    type: "rfq",
    referenceType: "rfq",
    referenceId: rfqId,
    titleAr: "اختبار طلب سعر",
    titleEn: "RFQ test",
    bodyAr: "إشعار اختبار آمن.",
    bodyEn: "Safe test notification.",
    link,
    read: false,
    createdAt: Timestamp.now(),
  };
}

async function seedRfq(id, data) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "rfqs", id), data);
  });
}

test("inactive buyer can save a draft but cannot publish an RFQ", async () => {
  const database = contextFor("inactiveBuyer");
  await assertSucceeds(setDoc(doc(database, "rfqs", "rfq-inactive-draft"), rfqData("inactive-draft", users.inactiveBuyer.uid, { status: "draft", recipientIds: [] })));
  await assertFails(setDoc(doc(database, "rfqs", "rfq-inactive-published"), rfqData("inactive-published", users.inactiveBuyer.uid)));
});

test("active buyer cannot publish without a recipient", async () => {
  const database = contextFor("buyer");
  await assertFails(setDoc(doc(database, "rfqs", "rfq-empty-recipient"), rfqData("empty-recipient", users.buyer.uid, { recipientIds: [] })));
});

test("active buyer publishes to a targeted supplier and creates only a safe notification", async () => {
  const database = contextFor("buyer");
  const batch = writeBatch(database);
  batch.set(doc(database, "rfqs", "rfq-open"), rfqData("open"));
  batch.set(doc(database, "notifications", "rfq-open-notification"), notificationData(users.supplier.uid, users.buyer.uid, "rfq-open", "/supplier/rfqs"));
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(contextFor("supplier"), "rfqs", "rfq-open")));
  await assertFails(getDoc(doc(contextFor("otherSupplier"), "rfqs", "rfq-open")));

  const unsafeBatch = writeBatch(database);
  unsafeBatch.set(doc(database, "rfqs", "rfq-unsafe-notification"), rfqData("unsafe-notification"));
  unsafeBatch.set(doc(database, "notifications", "rfq-unsafe-notification"), {
    ...notificationData(users.supplier.uid, users.buyer.uid, "rfq-unsafe-notification", "/supplier/rfqs"),
    base64: "forbidden",
  });
  await assertFails(unsafeBatch.commit());
});

test("targeted approved supplier submits a deterministic response and notifies the buyer", async () => {
  const database = contextFor("supplier");
  const response = responseData("rfq-open");
  const batch = writeBatch(database);
  batch.set(doc(database, "rfqResponses", response.id), response);
  batch.set(doc(database, "notifications", "rfq-response-notification"), notificationData(users.buyer.uid, users.supplier.uid, "rfq-open", "/buyer/rfqs"));
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(database, "rfqResponses", response.id)));

  await assertFails(setDoc(doc(database, "rfqResponses", "wrong-id"), responseData("rfq-open")));
  await assertFails(updateDoc(doc(database, "rfqResponses", response.id), { supplierProfileId: users.otherSupplier.supplierProfileId }));
});

test("supplier can update structured quotation terms and safe reference links", async () => {
  const supplierDb = contextFor("supplier");
  const responseId = `rfq-open_${users.supplier.uid}`;
  await assertSucceeds(updateDoc(doc(supplierDb, "rfqResponses", responseId), {
    message: "Updated structured quotation.",
    paymentTerms: "net_45",
    paymentTermsOther: "",
    deliveryTerms: "site_delivery",
    deliveryTermsOther: "",
    referenceLinks: ["https://example.test/revised-quotation.pdf"],
    updatedAt: Timestamp.now(),
  }));
});

test("supplier reads only its deterministic response while buyer, admin, and owner can review", async () => {
  const supplierDb = contextFor("supplier");
  const buyerDb = contextFor("buyer");
  await assertSucceeds(getDoc(doc(supplierDb, "rfqResponses", `rfq-open_${users.supplier.uid}`)));
  await assertSucceeds(getDocs(query(collection(buyerDb, "rfqResponses"), where("rfqId", "==", "rfq-open"))));
  await assertSucceeds(getDocs(query(collection(contextFor("admin"), "rfqResponses"), where("rfqId", "==", "rfq-open"))));
  await assertSucceeds(getDocs(query(collection(contextFor("owner"), "rfqResponses"), where("rfqId", "==", "rfq-open"))));
});

test("closed RFQ cannot be reopened, edited, or answered", async () => {
  const buyerDb = contextFor("buyer");
  await assertSucceeds(updateDoc(doc(buyerDb, "rfqs", "rfq-open"), { status: "closed", updatedAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(buyerDb, "rfqs", "rfq-open"), { status: "published", updatedAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(buyerDb, "rfqs", "rfq-open"), { title: "Changed after publish", updatedAt: Timestamp.now() }));

  const supplierDb = contextFor("supplier");
  await assertFails(setDoc(doc(supplierDb, "rfqResponses", `rfq-open_${users.supplier.uid}`), responseData("rfq-open", users.supplier, { message: "Updated after close" }), { merge: true }));
});

test("expired RFQ cannot receive a response even if its status still says published", async () => {
  await seedRfq("rfq-expired", rfqData("expired", users.buyer.uid, { closingDate: "2000-01-01", closingAt: past() }));
  const database = contextFor("supplier");
  const response = responseData("rfq-expired");
  await assertFails(setDoc(doc(database, "rfqResponses", response.id), response));
});

test("RFQ and quotation documents accept safe HTTPS references and reject unsafe links", async () => {
  const buyerDb = contextFor("buyer");
  await assertSucceeds(setDoc(doc(buyerDb, "rfqs", "rfq-safe-links"), rfqData("safe-links")));
  await assertFails(setDoc(doc(buyerDb, "rfqs", "rfq-http-link"), rfqData("http-link", users.buyer.uid, { referenceLinks: ["http://example.test/specification.pdf"] })));

  await seedRfq("rfq-link-response", rfqData("link-response"));
  const supplierDb = contextFor("supplier");
  const safeResponse = responseData("rfq-link-response");
  await assertSucceeds(setDoc(doc(supplierDb, "rfqResponses", safeResponse.id), safeResponse));
  const unsafeResponse = responseData("rfq-link-response", users.supplier, { referenceLinks: ["javascript:alert(1)"] });
  await assertFails(setDoc(doc(supplierDb, "rfqResponses", unsafeResponse.id), unsafeResponse, { merge: true }));
});

test("RFQ and quotation documents reject stored file payloads", async () => {
  const buyerDb = contextFor("buyer");
  await assertFails(setDoc(doc(buyerDb, "rfqs", "rfq-file-payload"), { ...rfqData("file-payload"), rawFile: "forbidden" }));

  await seedRfq("rfq-file-response", rfqData("file-response"));
  const supplierDb = contextFor("supplier");
  const response = responseData("rfq-file-response");
  await assertFails(setDoc(doc(supplierDb, "rfqResponses", response.id), { ...response, attachmentUrl: "https://example.test/file" }));
});

test("buyer identity and immutable RFQ ownership are enforced", async () => {
  const buyerDb = contextFor("buyer");
  await assertFails(setDoc(
    doc(buyerDb, "rfqs", "rfq-impersonated-buyer"),
    rfqData("impersonated-buyer", users.inactiveBuyer.uid, { status: "draft", recipientIds: [] }),
  ));

  await assertSucceeds(setDoc(
    doc(buyerDb, "rfqs", "rfq-owned-draft"),
    rfqData("owned-draft", users.buyer.uid, { status: "draft", recipientIds: [] }),
  ));
  await assertSucceeds(updateDoc(doc(buyerDb, "rfqs", "rfq-owned-draft"), {
    title: "Updated owned draft",
    updatedAt: Timestamp.now(),
  }));
  await assertFails(updateDoc(doc(buyerDb, "rfqs", "rfq-owned-draft"), {
    buyerId: users.inactiveBuyer.uid,
    updatedAt: Timestamp.now(),
  }));
  await assertSucceeds(updateDoc(doc(buyerDb, "rfqs", "rfq-owned-draft"), {
    recipientIds: [users.supplier.supplierProfileId],
    status: "published",
    updatedAt: Timestamp.now(),
  }));
});

test("only targeted supplier profiles can read and answer RFQs", async () => {
  await seedRfq("rfq-target-boundary", rfqData("target-boundary"));
  const otherSupplierDb = contextFor("otherSupplier");
  const otherResponse = responseData("rfq-target-boundary", users.otherSupplier);
  await assertFails(getDoc(doc(otherSupplierDb, "rfqs", "rfq-target-boundary")));
  await assertFails(setDoc(doc(otherSupplierDb, "rfqResponses", otherResponse.id), otherResponse));

  await seedRfq("rfq-legacy-uid-target", rfqData("legacy-uid-target", users.buyer.uid, {
    recipientIds: [users.supplier.uid],
  }));
  const supplierDb = contextFor("supplier");
  const legacyResponse = responseData("rfq-legacy-uid-target");
  await assertFails(getDoc(doc(supplierDb, "rfqs", "rfq-legacy-uid-target")));
  await assertFails(setDoc(doc(supplierDb, "rfqResponses", legacyResponse.id), legacyResponse));
});

test("response identity cannot be impersonated by buyers or other suppliers", async () => {
  await seedRfq("rfq-response-identity", rfqData("response-identity"));
  const response = responseData("rfq-response-identity");
  await assertFails(setDoc(doc(contextFor("buyer"), "rfqResponses", response.id), response));
  await assertFails(setDoc(
    doc(contextFor("otherSupplier"), "rfqResponses", `rfq-response-identity_${users.otherSupplier.uid}`),
    responseData("rfq-response-identity", users.otherSupplier, {
      supplierProfileId: users.supplier.supplierProfileId,
    }),
  ));
});

test("admin and owner retain review access without implicit RFQ mutation rights", async () => {
  await seedRfq("rfq-admin-boundary", rfqData("admin-boundary"));
  const response = responseData("rfq-admin-boundary");
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "rfqResponses", response.id), response);
  });

  for (const role of ["admin", "owner"]) {
    const database = contextFor(role);
    await assertSucceeds(getDoc(doc(database, "rfqs", "rfq-admin-boundary")));
    await assertSucceeds(getDoc(doc(database, "rfqResponses", response.id)));
    await assertFails(updateDoc(doc(database, "rfqs", "rfq-admin-boundary"), {
      status: "closed",
      updatedAt: Timestamp.now(),
    }));
    await assertFails(deleteDoc(doc(database, "rfqs", "rfq-admin-boundary")));
    await assertFails(deleteDoc(doc(database, "rfqResponses", response.id)));
  }
});

test("buyers cannot mutate supplier quotation documents", async () => {
  const responseId = `rfq-admin-boundary_${users.supplier.uid}`;
  await assertFails(updateDoc(doc(contextFor("buyer"), "rfqResponses", responseId), {
    message: "Buyer must not edit this quotation.",
    updatedAt: Timestamp.now(),
  }));
});
