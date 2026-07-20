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
  documentId,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
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

const buyerFields = {
  role: "contributor",
  accountType: "buyer",
  status: "approved",
  emailVerified: true,
  accessStatus: "temporary",
  accessExpiresAt: future(),
};
const supplierFields = {
  role: "contributor",
  accountType: "supplier",
  status: "approved",
  emailVerified: true,
  accessStatus: "pending",
};

const users = {
  buyer: { uid: "rfq-buyer", ...buyerFields },
  legacyBuyer: { uid: "rfq-buyer-legacy", ...buyerFields, accountType: undefined },
  suspendedBuyer: { uid: "rfq-buyer-suspended", ...buyerFields, accessStatus: "suspended" },
  unverifiedBuyer: { uid: "rfq-buyer-unverified", ...buyerFields, emailVerified: false, authVerified: false },
  staleBuyer: { uid: "rfq-buyer-stale", ...buyerFields, emailVerified: false },
  inactiveBuyer: { uid: "rfq-buyer-inactive", ...buyerFields, accessStatus: "pending", accessExpiresAt: null },
  notificationBuyer: { uid: "rfq-buyer-notification", ...buyerFields },
  supplier: { uid: "rfq-supplier", ...supplierFields, supplierProfileId: "rfq-profile-1" },
  notificationSupplier: { uid: "rfq-supplier-notification", ...supplierFields, supplierProfileId: "rfq-profile-notification" },
  otherSupplier: { uid: "rfq-supplier-other", ...supplierFields, supplierProfileId: "rfq-profile-2" },
  staleSupplier: { uid: "rfq-supplier-stale", ...supplierFields, supplierProfileId: "rfq-profile-1" },
  suspendedSupplier: { uid: "rfq-supplier-suspended", ...supplierFields, supplierProfileId: "rfq-profile-suspended", accessStatus: "suspended" },
  unverifiedSupplier: { uid: "rfq-supplier-unverified", ...supplierFields, supplierProfileId: "rfq-profile-unverified", emailVerified: false, authVerified: false },
  unapprovedSupplier: { uid: "rfq-supplier-unapproved", ...supplierFields, supplierProfileId: "rfq-profile-unapproved" },
  inactiveSupplier: { uid: "rfq-supplier-inactive", ...supplierFields, supplierProfileId: "rfq-profile-inactive" },
  admin: { uid: "rfq-admin", ...buyerFields, role: "admin" },
  owner: { uid: "rfq-owner", ...buyerFields, role: "owner" },
  unrelated: { uid: "rfq-unrelated", ...buyerFields },
};

function cleanUser(user) {
  const { uid: _uid, authVerified: _authVerified, ...data } = user;
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      ...Object.values(users).map((user) => setDoc(doc(database, "users", user.uid), cleanUser(user))),
      setDoc(doc(database, "suppliers", "rfq-profile-1"), { status: "approved", canReceiveRfqs: true, accountOwnerId: users.supplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-2"), { status: "approved", canReceiveRfqs: true, accountOwnerId: users.otherSupplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-notification"), { status: "approved", canReceiveRfqs: true, accountOwnerId: users.notificationSupplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-suspended"), { status: "approved", canReceiveRfqs: true, accountOwnerId: users.suspendedSupplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-unverified"), { status: "approved", canReceiveRfqs: true, accountOwnerId: users.unverifiedSupplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-unapproved"), { status: "pending_review", canReceiveRfqs: false, accountOwnerId: users.unapprovedSupplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-inactive"), { status: "approved", canReceiveRfqs: false, accountOwnerId: users.inactiveSupplier.uid }),
      setDoc(doc(database, "suppliers", "rfq-profile-legacy"), { name: "Legacy Supplier" }),
    ]);
  });
});

after(async () => {
  await environment?.cleanup();
});

function contextFor(key, claims = {}) {
  const user = users[key];
  return environment.authenticatedContext(user.uid, {
    email: `${user.uid}@example.test`,
    email_verified: user.authVerified !== false,
    ...claims,
  }).firestore();
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

function publishEventData(rfqId, buyer, recipientIds) {
  return {
    type: "rfq_published",
    actorId: buyer.uid,
    buyerId: buyer.uid,
    rfqId,
    recipientIds,
    createdAt: serverTimestamp(),
  };
}

function responseEventData(response, buyerId) {
  return {
    type: "rfq_response_submitted",
    actorId: response.supplierUserId,
    buyerId,
    rfqId: response.rfqId,
    responseId: response.id,
    supplierProfileId: response.supplierProfileId,
    createdAt: serverTimestamp(),
  };
}

function notificationData({ userId, actorId, rfqId, direction, responseId }) {
  const toSupplier = direction === "buyer_to_supplier";
  return {
    userId,
    actorId,
    type: "rfq",
    referenceType: "rfq",
    referenceId: rfqId,
    eventId: toSupplier ? rfqId : responseId,
    ...(toSupplier ? {} : { responseId }),
    titleAr: toSupplier ? "طلب عرض سعر جديد" : "تم استلام عرض سعر",
    titleEn: toSupplier ? "New RFQ request" : "New quotation received",
    bodyAr: toSupplier ? "وصل طلب عرض سعر جديد إلى شركتك." : "استلم طلبك عرض سعر جديداً من أحد المجهزين.",
    bodyEn: toSupplier ? "A new RFQ has been addressed to your company." : "A supplier submitted a quotation for your RFQ.",
    link: toSupplier ? "/supplier/rfqs" : "/buyer/rfqs",
    read: false,
    createdAt: serverTimestamp(),
  };
}

function publishedNotificationId(rfqId, userId) {
  return `rfq-published_${rfqId}_${userId}`;
}

function responseNotificationId(responseId) {
  return `rfq-response_${responseId}`;
}

function createPublishedRfq(database, id, buyer = users.buyer, overrides = {}) {
  const recipientIds = overrides.recipientIds || [users.supplier.supplierProfileId];
  const data = rfqData(id, buyer.uid, {
    ...overrides,
    recipientIds,
    status: "published",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const batch = writeBatch(database);
  batch.set(doc(database, "rfqs", id), data);
  batch.set(doc(database, "rfqPublishEvents", id), publishEventData(id, buyer, recipientIds));
  return batch.commit();
}

function createResponse(database, rfqId, supplier = users.supplier, overrides = {}, buyerId = users.buyer.uid) {
  const response = responseData(rfqId, supplier, {
    ...overrides,
    status: "submitted",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const batch = writeBatch(database);
  batch.set(doc(database, "rfqResponses", response.id), response);
  batch.set(doc(database, "rfqResponseEvents", response.id), responseEventData(response, buyerId));
  return { response, commit: batch.commit() };
}

async function seedRfq(id, data) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "rfqs", id), data);
  });
}

async function seedResponse(response) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "rfqResponses", response.id), response);
  });
}

test("ordinary active verified and legacy Buyers can create drafts", async () => {
  await assertSucceeds(setDoc(doc(contextFor("buyer"), "rfqs", "rfq-active-draft"), rfqData("active-draft", users.buyer.uid, { status: "draft", recipientIds: [] })));
  await assertSucceeds(setDoc(doc(contextFor("legacyBuyer"), "rfqs", "rfq-legacy-buyer-draft"), rfqData("legacy-buyer-draft", users.legacyBuyer.uid, { status: "draft", recipientIds: [] })));
});

test("Admin and Owner accounts with buyer accountType cannot create RFQs", async () => {
  for (const role of ["admin", "owner"]) {
    await assertFails(setDoc(doc(contextFor(role), "rfqs", `rfq-${role}-write`), rfqData(`${role}-write`, users[role].uid, { status: "draft", recipientIds: [] })));
  }
});

test("suspended, inactive, unverified, and stale-verification Buyers cannot create RFQs", async () => {
  for (const key of ["suspendedBuyer", "inactiveBuyer", "unverifiedBuyer", "staleBuyer"]) {
    await assertFails(setDoc(doc(contextFor(key), "rfqs", `rfq-${key}-draft`), rfqData(`${key}-draft`, users[key].uid, { status: "draft", recipientIds: [] })));
  }
});

test("invalid Buyers cannot edit, publish, delete, close, or cancel RFQs", async () => {
  for (const key of ["suspendedBuyer", "unverifiedBuyer"]) {
    const draftId = `rfq-${key}-existing-draft`;
    const openId = `rfq-${key}-existing-open`;
    await seedRfq(draftId, rfqData(draftId, users[key].uid, { status: "draft", recipientIds: [] }));
    await seedRfq(openId, rfqData(openId, users[key].uid));
    const database = contextFor(key);
    await assertFails(updateDoc(doc(database, "rfqs", draftId), { title: "Forbidden edit", updatedAt: Timestamp.now() }));
    const publishBatch = writeBatch(database);
    publishBatch.update(doc(database, "rfqs", draftId), {
      recipientIds: [users.supplier.supplierProfileId],
      status: "published",
      updatedAt: serverTimestamp(),
    });
    publishBatch.set(doc(database, "rfqPublishEvents", draftId), publishEventData(draftId, users[key], [users.supplier.supplierProfileId]));
    await assertFails(publishBatch.commit());
    await assertFails(deleteDoc(doc(database, "rfqs", draftId)));
    await assertFails(updateDoc(doc(database, "rfqs", openId), { status: "closed", updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(database, "rfqs", openId), { status: "cancelled", updatedAt: Timestamp.now() }));
  }
});

test("published RFQs require an atomic deterministic publish event", async () => {
  const database = contextFor("buyer");
  await assertFails(setDoc(doc(database, "rfqs", "rfq-no-event"), rfqData("no-event", users.buyer.uid, {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })));
  await assertSucceeds(createPublishedRfq(database, "rfq-open"));
  await assertFails(setDoc(doc(database, "rfqPublishEvents", "rfq-standalone-event"), publishEventData("rfq-standalone-event", users.buyer, [users.supplier.supplierProfileId])));
});

test("active Buyer can publish a draft only with the matching event", async () => {
  const database = contextFor("buyer");
  const id = "rfq-draft-publish";
  await assertSucceeds(setDoc(doc(database, "rfqs", id), rfqData(id, users.buyer.uid, { status: "draft", recipientIds: [] })));
  const batch = writeBatch(database);
  batch.update(doc(database, "rfqs", id), {
    recipientIds: [users.supplier.supplierProfileId],
    status: "published",
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(database, "rfqPublishEvents", id), publishEventData(id, users.buyer, [users.supplier.supplierProfileId]));
  await assertSucceeds(batch.commit());
});

test("RFQ close and cancel transitions work once and cannot reopen", async () => {
  await seedRfq("rfq-close", rfqData("close"));
  await seedRfq("rfq-cancel", rfqData("cancel"));
  const database = contextFor("buyer");
  await assertSucceeds(updateDoc(doc(database, "rfqs", "rfq-close"), { status: "closed", updatedAt: Timestamp.now() }));
  await assertSucceeds(updateDoc(doc(database, "rfqs", "rfq-cancel"), { status: "cancelled", updatedAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(database, "rfqs", "rfq-close"), { status: "published", updatedAt: Timestamp.now() }));
});

test("canonical active Supplier reads targeted RFQs while invalid ownership and status are denied", async () => {
  await seedRfq("rfq-supplier-boundaries", rfqData("supplier-boundaries", users.buyer.uid, {
    recipientIds: [
      users.supplier.supplierProfileId,
      users.suspendedSupplier.supplierProfileId,
      users.unverifiedSupplier.supplierProfileId,
      users.unapprovedSupplier.supplierProfileId,
      users.inactiveSupplier.supplierProfileId,
    ],
  }));
  await assertSucceeds(getDoc(doc(contextFor("supplier"), "rfqs", "rfq-supplier-boundaries")));
  for (const key of ["staleSupplier", "suspendedSupplier", "unverifiedSupplier", "unapprovedSupplier", "inactiveSupplier", "otherSupplier"]) {
    await assertFails(getDoc(doc(contextFor(key), "rfqs", "rfq-supplier-boundaries")));
  }
});
test("first-time Supplier response uses an exact scoped query before deterministic creation", async () => {
  const rfqId = "rfq-first-response";
  const responseId = `${rfqId}_${users.supplier.uid}`;
  const supplierDb = contextFor("supplier");
  await seedRfq(rfqId, rfqData(rfqId));

  await assertFails(getDoc(doc(supplierDb, "rfqResponses", responseId)));

  const scopedQuery = () => query(
    collection(supplierDb, "rfqResponses"),
    where("rfqId", "==", rfqId),
    where("supplierUserId", "==", users.supplier.uid),
    where("supplierProfileId", "==", users.supplier.supplierProfileId),
    limit(2),
  );
  const empty = await assertSucceeds(getDocs(scopedQuery()));
  assert.equal(empty.empty, true);

  const created = createResponse(supplierDb, rfqId);
  await assertSucceeds(created.commit);
  await assertSucceeds(setDoc(
    doc(supplierDb, "notifications", responseNotificationId(responseId)),
    notificationData({
      userId: users.buyer.uid,
      actorId: users.supplier.uid,
      rfqId,
      responseId,
      direction: "supplier_to_buyer",
    }),
  ));

  const existing = await assertSucceeds(getDocs(scopedQuery()));
  assert.equal(existing.size, 1);
  assert.equal(existing.docs[0].id, responseId);
  assert.equal(existing.docs[0].data().supplierUserId, users.supplier.uid);
  assert.equal(existing.docs[0].data().supplierProfileId, users.supplier.supplierProfileId);

  await assertSucceeds(updateDoc(doc(supplierDb, "rfqResponses", responseId), {
    message: "Updated first quotation.",
    updatedAt: Timestamp.now(),
  }));
  const updated = await assertSucceeds(getDocs(scopedQuery()));
  assert.equal(updated.size, 1);
  assert.equal(updated.docs[0].data().message, "Updated first quotation.");

  await assertFails(getDocs(query(
    collection(contextFor("otherSupplier"), "rfqResponses"),
    where("rfqId", "==", rfqId),
    where("supplierUserId", "==", users.supplier.uid),
    where("supplierProfileId", "==", users.supplier.supplierProfileId),
    limit(2),
  )));
  await assertFails(getDocs(query(
    collection(supplierDb, "rfqResponses"),
    where("rfqId", "==", rfqId),
    where("supplierUserId", "==", users.supplier.uid),
    where("supplierProfileId", "==", users.otherSupplier.supplierProfileId),
    limit(2),
  )));

  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const responseRecords = await getDocs(query(collection(database, "rfqResponses"), where("rfqId", "==", rfqId)));
    const eventRecords = await getDocs(query(collection(database, "rfqResponseEvents"), where("rfqId", "==", rfqId)));
    const notificationRecords = await getDocs(query(collection(database, "notifications"), where("referenceId", "==", rfqId)));
    assert.equal(responseRecords.size, 1);
    assert.equal(eventRecords.size, 1);
    assert.equal(notificationRecords.size, 1);
  });
});


test("canonical Supplier response requires an atomic response event", async () => {
  const supplierDb = contextFor("supplier");
  const noEvent = responseData("rfq-open", users.supplier, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await assertFails(setDoc(doc(supplierDb, "rfqResponses", noEvent.id), noEvent));
  const created = createResponse(supplierDb, "rfq-open");
  await assertSucceeds(created.commit);
  await assertSucceeds(getDoc(doc(supplierDb, "rfqResponses", created.response.id)));
  await assertFails(setDoc(doc(supplierDb, "rfqResponseEvents", "standalone-response-event"), {
    ...responseEventData({ ...created.response, id: "standalone-response-event" }, users.buyer.uid),
    responseId: "standalone-response-event",
  }));
});

test("stale, unapproved, inactive, suspended, and unverified Suppliers cannot respond", async () => {
  await seedRfq("rfq-invalid-supplier-response", rfqData("invalid-supplier-response", users.buyer.uid, {
    recipientIds: [
      users.supplier.supplierProfileId,
      users.suspendedSupplier.supplierProfileId,
      users.unverifiedSupplier.supplierProfileId,
      users.unapprovedSupplier.supplierProfileId,
      users.inactiveSupplier.supplierProfileId,
    ],
  }));
  for (const key of ["staleSupplier", "suspendedSupplier", "unverifiedSupplier", "unapprovedSupplier", "inactiveSupplier"]) {
    const result = createResponse(contextFor(key), "rfq-invalid-supplier-response", users[key]);
    await assertFails(result.commit);
  }
});

test("Supplier cannot respond using another Supplier profile", async () => {
  await seedRfq("rfq-other-profile", rfqData("other-profile", users.buyer.uid, {
    recipientIds: [users.supplier.supplierProfileId, users.otherSupplier.supplierProfileId],
  }));
  const forged = createResponse(contextFor("supplier"), "rfq-other-profile", users.supplier, {
    supplierProfileId: users.otherSupplier.supplierProfileId,
  });
  await assertFails(forged.commit);
});
test("Supplier not targeted by the RFQ cannot submit a response", async () => {
  const rfqId = "rfq-supplier-not-targeted";
  await seedRfq(rfqId, rfqData(rfqId, users.buyer.uid, {
    recipientIds: [users.otherSupplier.supplierProfileId],
  }));
  await assertFails(createResponse(contextFor("supplier"), rfqId).commit);
});


test("Supplier can update its own structured response but not immutable identity", async () => {
  const responseId = `rfq-open_${users.supplier.uid}`;
  const database = contextFor("supplier");
  await assertSucceeds(updateDoc(doc(database, "rfqResponses", responseId), {
    message: "Updated structured quotation.",
    paymentTerms: "net_45",
    referenceLinks: ["https://example.test/revised-quotation.pdf"],
    updatedAt: Timestamp.now(),
  }));
  await assertFails(updateDoc(doc(database, "rfqResponses", responseId), {
    supplierProfileId: users.otherSupplier.supplierProfileId,
    updatedAt: Timestamp.now(),
  }));
});

test("expired and closed RFQs reject new Supplier responses", async () => {
  await seedRfq("rfq-expired", rfqData("expired", users.buyer.uid, { closingDate: "2000-01-01", closingAt: past() }));
  await seedRfq("rfq-closed-response", rfqData("closed-response", users.buyer.uid, { status: "closed" }));
  await assertFails(createResponse(contextFor("supplier"), "rfq-expired").commit);
  await assertFails(createResponse(contextFor("supplier"), "rfq-closed-response").commit);
});
test("expired and closed RFQs reject updates to existing Supplier responses", async () => {
  for (const [rfqId, overrides] of [
    ["rfq-expired-update", { closingDate: "2000-01-01", closingAt: past() }],
    ["rfq-closed-update", { status: "closed" }],
  ]) {
    await seedRfq(rfqId, rfqData(rfqId, users.buyer.uid, overrides));
    const response = responseData(rfqId);
    await seedResponse(response);
    await assertFails(updateDoc(doc(contextFor("supplier"), "rfqResponses", response.id), {
      message: "Forbidden late update.",
      updatedAt: Timestamp.now(),
    }));
  }
});


test("safe HTTPS references are allowed and stored file payloads remain denied", async () => {
  await assertSucceeds(setDoc(doc(contextFor("buyer"), "rfqs", "rfq-safe-links"), rfqData("safe-links", users.buyer.uid, { status: "draft", recipientIds: [] })));
  await assertFails(setDoc(doc(contextFor("buyer"), "rfqs", "rfq-http-link"), rfqData("http-link", users.buyer.uid, { status: "draft", recipientIds: [], referenceLinks: ["http://example.test/specification.pdf"] })));
  await assertFails(setDoc(doc(contextFor("buyer"), "rfqs", "rfq-file-payload"), { ...rfqData("file-payload", users.buyer.uid, { status: "draft", recipientIds: [] }), rawFile: "forbidden" }));
});

test("published RFQ notifications are deterministic, event-bound, and non-repeatable", async () => {
  const database = contextFor("buyer");
  const notificationId = publishedNotificationId("rfq-open", users.supplier.uid);
  const payload = notificationData({
    userId: users.supplier.uid,
    actorId: users.buyer.uid,
    rfqId: "rfq-open",
    direction: "buyer_to_supplier",
  });
  await assertSucceeds(setDoc(doc(database, "notifications", notificationId), payload));
  await assertFails(setDoc(doc(database, "notifications", notificationId), payload));
  await assertSucceeds(getDoc(doc(contextFor("supplier"), "notifications", notificationId)));
});

test("standalone and forged published RFQ notifications are denied", async () => {
  const database = contextFor("buyer");
  const missing = notificationData({
    userId: users.supplier.uid,
    actorId: users.buyer.uid,
    rfqId: "rfq-missing-event",
    direction: "buyer_to_supplier",
  });
  await assertFails(setDoc(doc(database, "notifications", publishedNotificationId("rfq-missing-event", users.supplier.uid)), missing));
  const validBase = { ...missing, eventId: "rfq-open", referenceId: "rfq-open" };
  await assertFails(setDoc(doc(database, "notifications", "wrong-notification-id"), validBase));
  await assertFails(setDoc(doc(database, "notifications", publishedNotificationId("rfq-open", users.otherSupplier.uid)), {
    ...validBase,
    userId: users.otherSupplier.uid,
  }));
  await assertFails(setDoc(doc(database, "notifications", publishedNotificationId("rfq-open", users.supplier.uid) + "-sender"), {
    ...validBase,
    actorId: users.otherSupplier.uid,
  }));
  await assertFails(setDoc(doc(database, "notifications", publishedNotificationId("rfq-open", users.supplier.uid) + "-type"), {
    ...validBase,
    type: "message",
  }));
});

test("response notification is deterministic, response-bound, and cannot be repeated or forged", async () => {
  const responseId = `rfq-open_${users.supplier.uid}`;
  const database = contextFor("supplier");
  const id = responseNotificationId(responseId);
  const payload = notificationData({
    userId: users.buyer.uid,
    actorId: users.supplier.uid,
    rfqId: "rfq-open",
    responseId,
    direction: "supplier_to_buyer",
  });
  await assertSucceeds(setDoc(doc(database, "notifications", id), payload));
  await assertFails(setDoc(doc(database, "notifications", id), payload));
  await assertFails(setDoc(doc(database, "notifications", id + "-wrong-buyer"), { ...payload, userId: users.unrelated.uid }));
  await assertFails(setDoc(doc(database, "notifications", id + "-wrong-rfq"), { ...payload, referenceId: "rfq-other" }));
  await assertFails(setDoc(doc(database, "notifications", id + "-wrong-response"), { ...payload, responseId: "wrong", eventId: "wrong" }));
  await assertFails(setDoc(doc(database, "notifications", id + "-wrong-sender"), { ...payload, actorId: users.otherSupplier.uid }));
});

test("notification creation rechecks the current actor status and canonical Supplier owner", async () => {
  const rfqId = "rfq-notification-current-actor";
  const buyerDb = contextFor("notificationBuyer");
  const supplierDb = contextFor("notificationSupplier");
  const recipientIds = [users.notificationSupplier.supplierProfileId];
  await assertSucceeds(createPublishedRfq(buyerDb, rfqId, users.notificationBuyer, { recipientIds }));

  const publishId = publishedNotificationId(rfqId, users.notificationSupplier.uid);
  const publishPayload = notificationData({
    userId: users.notificationSupplier.uid,
    actorId: users.notificationBuyer.uid,
    rfqId,
    direction: "buyer_to_supplier",
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "users", users.notificationBuyer.uid), { accessStatus: "suspended" });
  });
  await assertFails(setDoc(doc(buyerDb, "notifications", publishId), publishPayload));
  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "users", users.notificationBuyer.uid), { accessStatus: "temporary" });
  });
  await assertSucceeds(setDoc(doc(buyerDb, "notifications", publishId), publishPayload));

  const created = createResponse(supplierDb, rfqId, users.notificationSupplier, {}, users.notificationBuyer.uid);
  await assertSucceeds(created.commit);
  const responseId = created.response.id;
  const responseIdForNotification = responseNotificationId(responseId);
  const responsePayload = notificationData({
    userId: users.notificationBuyer.uid,
    actorId: users.notificationSupplier.uid,
    rfqId,
    responseId,
    direction: "supplier_to_buyer",
  });

  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "suppliers", users.notificationSupplier.supplierProfileId), { accountOwnerId: users.otherSupplier.uid });
  });
  await assertFails(setDoc(doc(supplierDb, "notifications", responseIdForNotification), responsePayload));
  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "suppliers", users.notificationSupplier.supplierProfileId), { accountOwnerId: users.notificationSupplier.uid });
    await updateDoc(doc(context.firestore(), "users", users.notificationSupplier.uid), { accessStatus: "suspended" });
  });
  await assertFails(setDoc(doc(supplierDb, "notifications", responseIdForNotification), responsePayload));
  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "users", users.notificationSupplier.uid), { accessStatus: "pending" });
  });
  await assertSucceeds(setDoc(doc(supplierDb, "notifications", responseIdForNotification), responsePayload));
});

test("administrative submission notifications preserve the approved workflow boundary", async () => {
  const notificationId = "admin-submission-notification";
  const payload = {
    userId: users.buyer.uid,
    type: "submission",
    titleAr: "Test supplier submission approved",
    titleEn: "Supplier submission approved",
    bodyAr: "Test approval notification.",
    bodyEn: "The supplier record was approved and added to the directory.",
    link: "/buyer/suppliers/submissions",
    read: false,
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(contextFor("admin"), "notifications", notificationId), payload));
  await assertFails(setDoc(doc(contextFor("buyer"), "notifications", notificationId + "-forged"), payload));
  await assertSucceeds(getDoc(doc(contextFor("buyer"), "notifications", notificationId)));
  await assertSucceeds(updateDoc(doc(contextFor("buyer"), "notifications", notificationId), {
    read: true,
    readAt: serverTimestamp(),
  }));
});

test("actual frontend RFQ, response, and notification queries are allowed while broader queries are denied", async () => {
  const buyerDb = contextFor("buyer");
  const supplierDb = contextFor("supplier");
  await assertSucceeds(getDocs(query(collection(buyerDb, "rfqs"), where("buyerId", "==", users.buyer.uid), limit(200))));
  await assertFails(getDocs(query(collection(buyerDb, "rfqs"), limit(200))));
  await assertSucceeds(getDocs(query(collection(supplierDb, "rfqs"), where("recipientIds", "array-contains", users.supplier.supplierProfileId), limit(100))));
  await assertFails(getDocs(query(collection(supplierDb, "rfqs"), limit(100))));
  await assertSucceeds(getDoc(doc(supplierDb, "rfqResponses", `rfq-open_${users.supplier.uid}`)));
  await assertFails(getDoc(doc(supplierDb, "rfqResponses", `rfq-open_${users.otherSupplier.uid}`)));
  await assertSucceeds(getDocs(query(collection(buyerDb, "rfqResponses"), where("rfqId", "==", "rfq-open"), limit(100))));
  await assertFails(getDocs(query(collection(buyerDb, "rfqResponses"), limit(100))));
  await assertSucceeds(getDocs(query(collection(supplierDb, "notifications"), where("userId", "==", users.supplier.uid), orderBy("createdAt", "desc"), orderBy(documentId(), "desc"), limit(26))));
  await assertFails(getDocs(query(collection(supplierDb, "notifications"), where("userId", "==", users.otherSupplier.uid), orderBy("createdAt", "desc"), orderBy(documentId(), "desc"), limit(26))));
  await assertFails(getDocs(query(collection(supplierDb, "notifications"), orderBy("createdAt", "desc"), limit(26))));
});

test("Admin and Owner retain review reads without implicit RFQ mutation rights", async () => {
  const response = responseData("rfq-open");
  for (const role of ["admin", "owner"]) {
    const database = contextFor(role);
    await assertSucceeds(getDoc(doc(database, "rfqs", "rfq-open")));
    await assertSucceeds(getDoc(doc(database, "rfqResponses", response.id)));
    await assertFails(updateDoc(doc(database, "rfqs", "rfq-open"), { status: "closed", updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(doc(database, "rfqs", "rfq-open")));
  }
});

test("representative legacy RFQ data preserves safe draft edits while insecure writes stay blocked", async () => {
  const legacyDraft = {
    buyerId: users.buyer.uid,
    title: "Legacy draft",
    description: "Older minimal draft",
    quantity: 1,
    unit: "piece",
    location: "Baghdad",
    closingDate: "2099-12-31",
    closingAt: future(),
    categoryId: "legacy",
    recipientIds: [],
    status: "draft",
    attachmentStatus: "upload_pending_launch",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const legacyResponse = {
    id: "legacy-response",
    rfqId: "legacy-rfq",
    supplierUserId: users.supplier.uid,
    supplierProfileId: users.supplier.supplierProfileId,
    message: "Legacy response",
    status: "submitted",
    createdAt: Timestamp.now(),
  };
  await seedRfq("legacy-rfq", legacyDraft);
  await seedResponse(legacyResponse);
  await assertSucceeds(getDoc(doc(contextFor("buyer"), "rfqs", "legacy-rfq")));
  await assertSucceeds(getDoc(doc(contextFor("buyer"), "rfqResponses", "legacy-response")));
  await assertSucceeds(updateDoc(doc(contextFor("buyer"), "rfqs", "legacy-rfq"), { title: "Partial legacy edit", updatedAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(contextFor("buyer"), "rfqs", "legacy-rfq"), { buyerId: users.unrelated.uid, updatedAt: Timestamp.now() }));
  await assertFails(updateDoc(doc(contextFor("buyer"), "rfqs", "legacy-rfq"), { status: "published", updatedAt: Timestamp.now() }));

  await seedRfq("legacy-supplier-rfq", rfqData("legacy-supplier-rfq", users.buyer.uid, { recipientIds: ["rfq-profile-legacy"] }));
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "legacy-supplier-user"), {
      role: "contributor",
      accountType: "supplier",
      status: "approved",
      emailVerified: true,
      accessStatus: "pending",
      supplierProfileId: "rfq-profile-legacy",
    });
  });
  const legacyUser = environment.authenticatedContext("legacy-supplier-user", { email_verified: true }).firestore();
  await assertFails(getDoc(doc(legacyUser, "rfqs", "legacy-supplier-rfq")));
});
