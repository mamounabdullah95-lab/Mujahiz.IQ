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
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(emulatorHost, "FIRESTORE_EMULATOR_HOST must be set by firebase emulators:exec");
const separator = emulatorHost.lastIndexOf(":");
const host = emulatorHost.slice(0, separator);
const port = Number(emulatorHost.slice(separator + 1));
const projectId = "demo-mujahiziq-integration";
const rules = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");
let environment;

const users = {
  buyer: { uid: "conversation-buyer", role: "contributor", accountType: "buyer", status: "approved" },
  otherBuyer: { uid: "conversation-buyer-other", role: "contributor", accountType: "buyer", status: "approved" },
  supplier: {
    uid: "conversation-supplier",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    supplierProfileId: "conversation-profile-1",
  },
  otherSupplier: {
    uid: "conversation-supplier-other",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    supplierProfileId: "conversation-profile-2",
  },
  admin: { uid: "conversation-admin", role: "admin", accountType: "buyer", status: "approved" },
  owner: { uid: "conversation-owner", role: "owner", accountType: "buyer", status: "approved" },
};

before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { host, port, rules } });
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await Promise.all([
      ...Object.values(users).map((user) => setDoc(doc(database, "users", user.uid), user)),
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
});

test("read receipts can only add actual participants and cannot remove prior receipts", async () => {
  const messageRef = doc(contextFor("supplier"), "messages", "conversation-message-1");
  await assertSucceeds(updateDoc(messageRef, {
    readBy: [users.buyer.uid, users.supplier.uid],
  }));
  await assertFails(updateDoc(messageRef, {
    readBy: [users.supplier.uid],
  }));
  await assertFails(updateDoc(messageRef, {
    readBy: [users.buyer.uid, users.supplier.uid, users.otherBuyer.uid],
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
