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
  claimant: {
    uid: "claimant-1",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    accessStatus: "active",
    emailVerified: true,
  },
  unverified: {
    uid: "claimant-unverified",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    accessStatus: "active",
    emailVerified: false,
  },
  linked: {
    uid: "claimant-linked",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    accessStatus: "active",
    emailVerified: true,
    supplierProfileId: "TEST-LINKED-SUPPLIER",
  },
  partial: {
    uid: "claimant-partial",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    accessStatus: "active",
    emailVerified: true,
    supplierProfileId: "partial-profile",
  },
  other: {
    uid: "claimant-other",
    role: "contributor",
    accountType: "supplier",
    status: "approved",
    accessStatus: "active",
    emailVerified: true,
  },
  buyer: {
    uid: "claim-buyer",
    role: "contributor",
    accountType: "buyer",
    status: "approved",
    accessStatus: "active",
    emailVerified: true,
    accessExpiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
  },
  admin: { uid: "claim-admin", role: "admin", accountType: "buyer", status: "approved", accessStatus: "active" },
  owner: { uid: "claim-owner", role: "owner", accountType: "buyer", status: "approved", accessStatus: "active" },
};

function context(key, verified = true) {
  return environment.authenticatedContext(users[key].uid, { email_verified: verified }).firestore();
}

function claimData(claimantUserId, supplierProfileId, overrides = {}) {
  return {
    claimantUserId,
    supplierProfileId,
    status: "pending_review",
    claimantSnapshot: {
      fullName: "Synthetic Claimant",
      organization: "Synthetic Company",
      jobTitle: "Manager",
      email: "claimant@example.test",
      phone: "+9640000000000",
    },
    claimReason: "Synthetic ownership reason used only in the Emulator suite.",
    evidenceType: "company_domain_email",
    evidenceSummary: "Synthetic evidence summary used only in the Emulator suite.",
    referenceLinks: ["https://example.test/evidence"],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    ...overrides,
  };
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host, port, rules },
  });
  await environment.withSecurityRulesDisabled(async (adminContext) => {
    const database = adminContext.firestore();
    for (const user of Object.values(users)) await setDoc(doc(database, "users", user.uid), user);
    await setDoc(doc(database, "suppliers", "unowned-profile"), {
      status: "approved",
      verificationStatus: "community_submitted",
      nameOriginal: "Unowned Synthetic Supplier",
    });
    await setDoc(doc(database, "suppliers", "TEST-LINKED-SUPPLIER"), {
      status: "approved",
      verificationStatus: "community_submitted",
      accountOwnerId: users.linked.uid,
      canReceiveRfqs: true,
      categories: ["tools_equipment"],
    });
    await setDoc(doc(database, "suppliers", "partial-profile"), {
      status: "approved",
      verificationStatus: "community_submitted",
      accountOwnerId: users.other.uid,
      canReceiveRfqs: true,
    });
    await setDoc(doc(database, "supplierOwnershipClaims", "claim-own"), claimData(users.claimant.uid, "unowned-profile"));
    await setDoc(doc(database, "supplierOwnershipClaims", "claim-unverified"), claimData(users.unverified.uid, "unowned-profile"));
    await setDoc(doc(database, "supplierOwnershipClaims", "claim-buyer"), claimData(users.buyer.uid, "unowned-profile"));
    await setDoc(doc(database, "supplierOwnershipClaims", "claim-linked-history"), claimData(users.other.uid, "TEST-LINKED-SUPPLIER", { status: "rejected" }));
    await setDoc(doc(database, "supplierClaimantLocks", users.claimant.uid), {
      claimantUserId: users.claimant.uid,
      claimId: "claim-own",
      supplierProfileId: "unowned-profile",
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    });
    await setDoc(doc(database, "supplierOwnershipEvents", "event-1"), {
      type: "supplier_ownership.rejected",
      claimId: "claim-linked-history",
      supplierProfileId: "TEST-LINKED-SUPPLIER",
      claimantUserId: users.other.uid,
      actorUserId: users.admin.uid,
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(database, "supplierProducts", "partial-product"), {
      supplierId: "partial-profile",
      ownerUserId: users.partial.uid,
      mediaStatus: "upload_pending_launch",
    });
  });
});

after(async () => {
  await environment.cleanup();
});

test("verified unlinked Supplier reads only their own claims", async () => {
  const database = context("claimant");
  assert.equal((await assertSucceeds(getDoc(doc(database, "supplierOwnershipClaims", "claim-own")))).exists(), true);
  const own = await assertSucceeds(getDocs(query(
    collection(database, "supplierOwnershipClaims"),
    where("claimantUserId", "==", users.claimant.uid),
  )));
  assert.equal(own.size, 1);
  await assertFails(getDoc(doc(database, "supplierOwnershipClaims", "claim-unverified")));
});

test("unverified Supplier, Buyer, unrelated Supplier, and unauthenticated users are denied", async () => {
  await assertFails(getDoc(doc(context("unverified", false), "supplierOwnershipClaims", "claim-unverified")));
  await assertFails(getDoc(doc(context("buyer"), "supplierOwnershipClaims", "claim-buyer")));
  await assertFails(getDoc(doc(context("other"), "supplierOwnershipClaims", "claim-own")));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "supplierOwnershipClaims", "claim-own")));
});

test("canonical linked Supplier reads historical target claims and partial linkage grants nothing", async () => {
  const linked = context("linked");
  assert.equal((await assertSucceeds(getDoc(doc(linked, "supplierOwnershipClaims", "claim-linked-history")))).exists(), true);
  const historical = await assertSucceeds(getDocs(query(
    collection(linked, "supplierOwnershipClaims"),
    where("supplierProfileId", "==", users.linked.supplierProfileId),
  )));
  assert.equal(historical.size, 1);
  await assertFails(getDoc(doc(context("partial"), "suppliers", "partial-profile")));
  await assertFails(getDoc(doc(context("partial"), "supplierProducts", "partial-product")));
});

test("Admin and Owner may read claims but no client may create or decide one", async () => {
  for (const key of ["admin", "owner"]) {
    const database = context(key);
    assert.equal((await assertSucceeds(getDocs(collection(database, "supplierOwnershipClaims")))).size, 4);
  }
  const pending = claimData(users.linked.uid, "unowned-profile");
  await assertFails(setDoc(doc(context("linked"), "supplierOwnershipClaims", "forged-create"), pending));
  await assertFails(updateDoc(doc(context("claimant"), "supplierOwnershipClaims", "claim-own"), {
    status: "approved",
    reviewedBy: users.claimant.uid,
  }));
  await assertFails(updateDoc(doc(context("admin"), "supplierOwnershipClaims", "claim-own"), {
    status: "rejected",
    reviewedBy: users.admin.uid,
  }));
});

test("claimant and privileged clients cannot mutate ownership fields independently", async () => {
  await assertFails(updateDoc(doc(context("claimant"), "users", users.claimant.uid), {
    supplierProfileId: "unowned-profile",
  }));
  await assertFails(updateDoc(doc(context("admin"), "users", users.claimant.uid), {
    supplierProfileId: "unowned-profile",
  }));
  await assertFails(updateDoc(doc(context("admin"), "suppliers", "unowned-profile"), {
    accountOwnerId: users.claimant.uid,
    canReceiveRfqs: true,
  }));
  await assertFails(updateDoc(doc(context("owner"), "suppliers", "TEST-LINKED-SUPPLIER"), {
    canReceiveRfqs: false,
  }));
  await assertFails(deleteDoc(doc(context("owner"), "users", users.linked.uid)));
});

test("claimant locks and ownership events are backend-only and immutable", async () => {
  for (const key of ["claimant", "admin", "owner"]) {
    const database = context(key);
    await assertFails(getDoc(doc(database, "supplierClaimantLocks", users.claimant.uid)));
    await assertFails(getDoc(doc(database, "supplierOwnershipEvents", "event-1")));
  }
  await assertFails(updateDoc(doc(context("admin"), "supplierOwnershipEvents", "event-1"), { actorUserId: users.owner.uid }));
  await assertFails(setDoc(doc(context("claimant"), "supplierClaimantLocks", users.other.uid), {
    claimantUserId: users.claimant.uid,
    claimId: "forged",
    supplierProfileId: "unowned-profile",
  }));
});

test("claim decision audits and notifications cannot be forged by privileged clients", async () => {
  await assertFails(setDoc(doc(context("admin"), "auditLogs", "forged-claim-audit"), {
    actorId: users.admin.uid,
    action: "supplier_ownership.approved",
    targetType: "supplierOwnershipClaim",
    targetId: "claim-own",
    details: {},
    createdAt: Timestamp.now(),
  }));
  await assertFails(setDoc(doc(context("admin"), "notifications", "forged-claim-notification"), {
    userId: users.claimant.uid,
    actorId: users.admin.uid,
    type: "supplier_ownership",
    referenceType: "supplierOwnershipClaim",
    referenceId: "claim-own",
    titleAr: "قرار",
    titleEn: "Decision",
    bodyAr: "نتيجة المطالبة",
    bodyEn: "Claim result",
    read: false,
    createdAt: Timestamp.now(),
  }));
});

test("existing canonical linked TEST-compatible Supplier access remains intact", async () => {
  const database = context("linked");
  const supplierRef = doc(database, "suppliers", "TEST-LINKED-SUPPLIER");
  assert.equal((await assertSucceeds(getDoc(supplierRef))).data().accountOwnerId, users.linked.uid);
  await assertSucceeds(updateDoc(supplierRef, {
    categories: ["tools_equipment", "maintenance_services"],
    updatedAt: Timestamp.now(),
  }));
});
