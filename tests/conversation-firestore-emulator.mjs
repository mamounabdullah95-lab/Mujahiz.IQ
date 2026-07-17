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
  limit,
  query,
  setDoc,
  updateDoc,
  where,
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

const users = {
  buyer: { uid: "conversation-buyer", role: "contributor", accountType: "buyer", status: "approved", emailVerified: true, accessStatus: "temporary", accessExpiresAt: future() },
  otherBuyer: { uid: "conversation-buyer-other", role: "contributor", accountType: "buyer", status: "approved", emailVerified: true, accessStatus: "temporary", accessExpiresAt: future() },
  suspendedBuyer: { uid: "conversation-buyer-suspended", role: "contributor", accountType: "buyer", status: "approved", emailVerified: true, accessStatus: "suspended", accessExpiresAt: future() },
  unverifiedBuyer: { uid: "conversation-buyer-unverified", role: "contributor", accountType: "buyer", status: "approved", emailVerified: false, authVerified: false, accessStatus: "temporary", accessExpiresAt: future() },
  supplier: {
    uid: "conversation-supplier",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    emailVerified: true,
    accessStatus: "pending",
    supplierProfileId: "conversation-profile-1",
  },
  otherSupplier: {
    uid: "conversation-supplier-other",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    emailVerified: true,
    accessStatus: "pending",
    supplierProfileId: "conversation-profile-2",
  },
  suspendedSupplier: { uid: "conversation-supplier-suspended", role: "contributor", accountType: "supplier", status: "approved", emailVerified: true, accessStatus: "suspended", supplierProfileId: "conversation-profile-suspended" },
  staleSupplier: { uid: "conversation-supplier-stale", role: "contributor", accountType: "supplier", status: "approved", emailVerified: true, accessStatus: "pending", supplierProfileId: "conversation-profile-1" },
  admin: { uid: "conversation-admin", role: "admin", accountType: "buyer", status: "approved", emailVerified: true, accessStatus: "active", accessExpiresAt: future() },
  owner: { uid: "conversation-owner", role: "owner", accountType: "buyer", status: "approved", emailVerified: true, accessStatus: "active", accessExpiresAt: future() },
};

function cleanUser(user) {
  const { uid: _uid, authVerified: _authVerified, ...data } = user;
  return data;
}

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      ...Object.values(users).map((user) => setDoc(doc(database, "users", user.uid), cleanUser(user))),
      setDoc(doc(database, "suppliers", "conversation-profile-1"), {
        status: "approved",
        canReceiveRfqs: true,
        accountOwnerId: users.supplier.uid,
      }),
      setDoc(doc(database, "suppliers", "conversation-profile-2"), {
        status: "approved",
        canReceiveRfqs: true,
        accountOwnerId: users.otherSupplier.uid,
      }),
      setDoc(doc(database, "suppliers", "conversation-profile-suspended"), {
        status: "approved",
        canReceiveRfqs: true,
        accountOwnerId: users.suspendedSupplier.uid,
      }),
      setDoc(doc(database, "rfqs", "conversation-rfq"), {
        buyerId: users.buyer.uid,
        recipientIds: [users.supplier.supplierProfileId],
        status: "published",
      }),
    ]);
  });
});

after(async () => {
  await environment?.cleanup();
});

function contextFor(key) {
  const user = users[key];
  return environment.authenticatedContext(user.uid, {
    email: `${user.uid}@example.test`,
    email_verified: user.authVerified !== false,
  }).firestore();
}

function conversationData(id, overrides = {}) {
  const participantIds = [users.buyer.uid, users.supplier.uid].sort();
  return {
    id,
    participantIds,
    participantLabels: {
      [users.buyer.uid]: "Buyer",
      [users.supplier.uid]: "Supplier",
    },
    supplierId: users.supplier.supplierProfileId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

function messageData(conversationId, senderId, overrides = {}) {
  return {
    conversationId,
    senderId,
    body: "Security boundary test message.",
    readBy: [senderId],
    attachmentStatus: "upload_pending_launch",
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

test("buyer can create a direct conversation only with the trusted supplier owner", async () => {
  const buyerDb = contextFor("buyer");
  const id = "conversation-direct";
  await assertSucceeds(setDoc(doc(buyerDb, "conversations", id), conversationData(id)));
  await assertSucceeds(getDoc(doc(buyerDb, "conversations", id)));
  await assertSucceeds(getDoc(doc(contextFor("supplier"), "conversations", id)));
  await assertFails(getDoc(doc(contextFor("otherBuyer"), "conversations", id)));
  await assertFails(getDoc(doc(contextFor("admin"), "conversations", id)));
  await assertFails(getDoc(doc(contextFor("owner"), "conversations", id)));
});

test("anonymous users cannot read conversations or create messages", async () => {
  const anonymousDb = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymousDb, "conversations", "conversation-direct")));
  await assertFails(setDoc(
    doc(anonymousDb, "messages", "conversation-message-anonymous"),
    messageData("conversation-direct", users.buyer.uid),
  ));
});

test("unrelated users cannot inject or replace conversation participants", async () => {
  const injectedId = "conversation-injected";
  await assertFails(setDoc(
    doc(contextFor("otherBuyer"), "conversations", injectedId),
    conversationData(injectedId),
  ));
  await assertFails(setDoc(
    doc(contextFor("otherSupplier"), "conversations", "conversation-supplier-created"),
    conversationData("conversation-supplier-created"),
  ));
  await assertFails(updateDoc(doc(contextFor("buyer"), "conversations", "conversation-direct"), {
    participantIds: [users.buyer.uid, users.otherBuyer.uid],
    participantLabels: {
      [users.buyer.uid]: "Buyer",
      [users.otherBuyer.uid]: "Injected",
    },
    updatedAt: Timestamp.now(),
  }));
});

test("RFQ conversations require a targeted supplier and exact buyer-owner participants", async () => {
  const id = "conversation-rfq-targeted";
  await assertSucceeds(setDoc(
    doc(contextFor("supplier"), "conversations", id),
    conversationData(id, { rfqId: "conversation-rfq" }),
  ));

  const otherId = "conversation-rfq-not-targeted";
  const otherParticipants = [users.buyer.uid, users.otherSupplier.uid].sort();
  await assertFails(setDoc(doc(contextFor("otherSupplier"), "conversations", otherId), {
    ...conversationData(otherId),
    participantIds: otherParticipants,
    participantLabels: {
      [users.buyer.uid]: "Buyer",
      [users.otherSupplier.uid]: "Other supplier",
    },
    supplierId: users.otherSupplier.supplierProfileId,
    rfqId: "conversation-rfq",
  }));
});

test("RFQ conversation creation validates the current status of both sides", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "rfqs", "conversation-rfq-suspended-buyer"), {
      buyerId: users.suspendedBuyer.uid,
      recipientIds: [users.supplier.supplierProfileId],
      status: "published",
    });
    await setDoc(doc(database, "rfqs", "conversation-rfq-suspended-supplier"), {
      buyerId: users.buyer.uid,
      recipientIds: [users.suspendedSupplier.supplierProfileId],
      status: "published",
    });
  });

  const suspendedBuyerParticipants = [users.suspendedBuyer.uid, users.supplier.uid].sort();
  await assertFails(setDoc(doc(contextFor("supplier"), "conversations", "conversation-rfq-suspended-buyer"), {
    id: "conversation-rfq-suspended-buyer",
    participantIds: suspendedBuyerParticipants,
    participantLabels: {
      [users.suspendedBuyer.uid]: "Suspended buyer",
      [users.supplier.uid]: "Supplier",
    },
    supplierId: users.supplier.supplierProfileId,
    rfqId: "conversation-rfq-suspended-buyer",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }));

  const suspendedSupplierParticipants = [users.buyer.uid, users.suspendedSupplier.uid].sort();
  await assertFails(setDoc(doc(contextFor("suspendedSupplier"), "conversations", "conversation-rfq-suspended-supplier"), {
    id: "conversation-rfq-suspended-supplier",
    participantIds: suspendedSupplierParticipants,
    participantLabels: {
      [users.buyer.uid]: "Buyer",
      [users.suspendedSupplier.uid]: "Suspended supplier",
    },
    supplierId: users.suspendedSupplier.supplierProfileId,
    rfqId: "conversation-rfq-suspended-supplier",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }));
});

test("invalid existing participants retain history reads but cannot write messages or previews", async () => {
  const fixtures = [
    ["suspendedBuyer", users.suspendedBuyer, users.supplier, users.supplier.supplierProfileId],
    ["unverifiedBuyer", users.unverifiedBuyer, users.supplier, users.supplier.supplierProfileId],
    ["suspendedSupplier", users.buyer, users.suspendedSupplier, users.suspendedSupplier.supplierProfileId],
    ["staleSupplier", users.buyer, users.staleSupplier, users.supplier.supplierProfileId],
  ];
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    for (const [key, buyer, supplier, supplierId] of fixtures) {
      const id = `conversation-invalid-${key}`;
      const participantIds = [buyer.uid, supplier.uid].sort();
      await setDoc(doc(database, "conversations", id), {
        id,
        participantIds,
        participantLabels: {
          [buyer.uid]: "Buyer",
          [supplier.uid]: "Supplier",
        },
        supplierId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  });

  for (const [key, buyer, supplier] of fixtures) {
    const invalidUser = key.includes("Buyer") ? buyer : supplier;
    const id = `conversation-invalid-${key}`;
    const database = contextFor(key);
    await assertSucceeds(getDoc(doc(database, "conversations", id)));
    await assertFails(setDoc(doc(database, "messages", `message-invalid-${key}`), messageData(id, invalidUser.uid)));
    await assertFails(updateDoc(doc(database, "conversations", id), {
      lastMessage: "Forbidden preview",
      lastMessageAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
  }
});

test("messages are parent-bound and visible only to conversation participants", async () => {
  const messageId = "conversation-message-1";
  await assertSucceeds(setDoc(
    doc(contextFor("buyer"), "messages", messageId),
    messageData("conversation-direct", users.buyer.uid),
  ));
  await assertSucceeds(getDoc(doc(contextFor("buyer"), "messages", messageId)));
  await assertSucceeds(getDoc(doc(contextFor("supplier"), "messages", messageId)));
  await assertFails(getDoc(doc(contextFor("otherBuyer"), "messages", messageId)));
  await assertFails(getDoc(doc(contextFor("admin"), "messages", messageId)));
  await assertFails(getDoc(doc(contextFor("owner"), "messages", messageId)));

  await assertFails(setDoc(
    doc(contextFor("otherBuyer"), "messages", "conversation-message-injected"),
    messageData("conversation-direct", users.otherBuyer.uid),
  ));
  await assertFails(setDoc(
    doc(contextFor("buyer"), "messages", "conversation-message-impersonated"),
    messageData("conversation-direct", users.supplier.uid),
  ));
  await assertSucceeds(setDoc(
    doc(contextFor("supplier"), "messages", "conversation-message-supplier"),
    messageData("conversation-direct", users.supplier.uid),
  ));
});

test("read receipts add only the caller UID, preserve entries, and remain idempotent", async () => {
  const supplierMessageRef = doc(contextFor("supplier"), "messages", "conversation-message-1");
  const buyerMessageRef = doc(contextFor("buyer"), "messages", "conversation-message-1");
  await assertFails(updateDoc(buyerMessageRef, {
    readBy: [users.buyer.uid, users.supplier.uid],
  }));
  await assertSucceeds(updateDoc(supplierMessageRef, {
    readBy: [users.buyer.uid, users.supplier.uid],
  }));
  await assertSucceeds(updateDoc(supplierMessageRef, {
    readBy: [users.buyer.uid, users.supplier.uid],
  }));
  await assertFails(updateDoc(buyerMessageRef, {
    readBy: [users.buyer.uid],
  }));
  await assertFails(updateDoc(supplierMessageRef, {
    readBy: [users.buyer.uid, users.supplier.uid, users.otherBuyer.uid],
  }));
  await assertFails(updateDoc(supplierMessageRef, {
    body: "Protected content must not change.",
    readBy: [users.buyer.uid, users.supplier.uid],
  }));
  await assertFails(updateDoc(doc(contextFor("otherBuyer"), "messages", "conversation-message-1"), {
    readBy: [users.buyer.uid, users.otherBuyer.uid],
  }));
});

test("participants can update message previews but nobody receives blanket delete access", async () => {
  await assertSucceeds(updateDoc(doc(contextFor("supplier"), "conversations", "conversation-direct"), {
    lastMessage: "Updated by a participant.",
    lastMessageAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }));
  await assertFails(deleteDoc(doc(contextFor("supplier"), "conversations", "conversation-direct")));
  await assertFails(deleteDoc(doc(contextFor("admin"), "conversations", "conversation-direct")));
  await assertFails(deleteDoc(doc(contextFor("owner"), "messages", "conversation-message-1")));
});

test("existing valid conversation documents remain readable and updatable", async () => {
  const id = "conversation-existing-valid";
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "conversations", id), conversationData(id));
  });
  await assertSucceeds(getDoc(doc(contextFor("buyer"), "conversations", id)));
  await assertSucceeds(updateDoc(doc(contextFor("supplier"), "conversations", id), {
    lastMessage: "Existing conversation still works.",
    lastMessageAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }));
});

test("actual frontend conversation and message queries are allowed while broader queries are denied", async () => {
  const buyerDb = contextFor("buyer");
  await assertSucceeds(getDocs(query(
    collection(buyerDb, "conversations"),
    where("participantIds", "array-contains", users.buyer.uid),
    limit(100),
  )));
  await assertFails(getDocs(query(collection(buyerDb, "conversations"), limit(100))));
  await assertSucceeds(getDocs(query(
    collection(buyerDb, "messages"),
    where("conversationId", "==", "conversation-direct"),
    limit(250),
  )));
  await assertFails(getDocs(query(collection(buyerDb, "messages"), limit(250))));
});

test("legacy conversations and messages remain readable but unsafe legacy writes are denied", async () => {
  const conversationId = "conversation-legacy";
  const messageId = "message-legacy";
  const participantIds = [users.buyer.uid, users.supplier.uid].sort();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "conversations", conversationId), {
      id: conversationId,
      participantIds,
      participantLabels: {
        [users.buyer.uid]: "Buyer",
        [users.supplier.uid]: "Supplier",
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await setDoc(doc(database, "messages", messageId), {
      conversationId,
      senderId: users.buyer.uid,
      body: "Legacy message",
      readBy: [users.buyer.uid],
      createdAt: Timestamp.now(),
    });
  });

  await assertSucceeds(getDoc(doc(contextFor("buyer"), "conversations", conversationId)));
  await assertSucceeds(getDoc(doc(contextFor("supplier"), "messages", messageId)));
  await assertFails(updateDoc(doc(contextFor("buyer"), "conversations", conversationId), {
    lastMessage: "Legacy preview write",
    lastMessageAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }));
  await assertFails(setDoc(
    doc(contextFor("buyer"), "messages", "message-legacy-new"),
    messageData(conversationId, users.buyer.uid),
  ));
});
