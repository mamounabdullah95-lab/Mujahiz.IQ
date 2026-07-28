import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createInternalBuyerDraft,
  createInternalEmulatorTestEnvironment,
  createInternalTargetedRfq,
  internalAccountContext,
  internalEmulatorAccountList,
  internalEmulatorAccounts,
  internalSupplierProfiles,
  listInternalAuthEmulatorAccounts,
  resetInternalEmulatorState,
  seedInternalEmulatorAccounts,
  signInInternalEmulatorAccount,
  submitInternalQuotation,
} from "./helpers/internal-emulator-accounts.mjs";

let environment;

before(async () => {
  environment = await createInternalEmulatorTestEnvironment();
});

beforeEach(async () => {
  await resetInternalEmulatorState(environment);
  await seedInternalEmulatorAccounts(environment);
});

after(async () => {
  if (!environment) return;
  await resetInternalEmulatorState(environment);
  await environment.cleanup();
});

test("creates eight deterministic verified Auth users and matching application roles", async () => {
  const authUsers = await listInternalAuthEmulatorAccounts();
  assert.equal(authUsers.length, 8);
  assert.deepEqual(
    authUsers.map((user) => user.localId).sort(),
    internalEmulatorAccountList.map((account) => account.uid).sort(),
  );
  assert.ok(authUsers.every((user) => user.emailVerified === true));

  for (const account of internalEmulatorAccountList) {
    const signedIn = await signInInternalEmulatorAccount(account.key);
    assert.equal(signedIn.localId, account.uid);
    const profile = await assertSucceeds(getDoc(doc(
      internalAccountContext(environment, account.key),
      "users",
      account.uid,
    )));
    assert.equal(profile.data().accountType, account.accountType);
    assert.equal(profile.data().role, "contributor");
    assert.equal(profile.data().emailVerified, true);
  }
});

test("write helpers reject invalid Emulator hosts before creating a context or Auth request", async () => {
  const originalAuthHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const originalFirestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const originalFetch = globalThis.fetch;
  let authRequestCount = 0;
  let authenticatedContextCount = 0;
  const guardedEnvironment = {
    authenticatedContext() {
      authenticatedContextCount += 1;
      throw new Error("Authenticated context must not be created before Emulator host validation.");
    },
  };
  const invalidConfigurations = [
    {
      label: "missing Auth host",
      authHost: undefined,
      firestoreHost: "127.0.0.1:8080",
      errorPattern: /FIREBASE_AUTH_EMULATOR_HOST/,
    },
    {
      label: "missing Firestore host",
      authHost: "127.0.0.1:9099",
      firestoreHost: undefined,
      errorPattern: /FIRESTORE_EMULATOR_HOST/,
    },
    {
      label: "malformed Auth host",
      authHost: "http://127.0.0.1:9099",
      firestoreHost: "127.0.0.1:8080",
      errorPattern: /FIREBASE_AUTH_EMULATOR_HOST/,
    },
    {
      label: "non-loopback Auth host",
      authHost: "192.0.2.10:9099",
      firestoreHost: "127.0.0.1:8080",
      errorPattern: /FIREBASE_AUTH_EMULATOR_HOST/,
    },
    {
      label: "malformed Firestore host",
      authHost: "127.0.0.1:9099",
      firestoreHost: "127.0.0.1",
      errorPattern: /FIRESTORE_EMULATOR_HOST/,
    },
    {
      label: "non-loopback Firestore host",
      authHost: "127.0.0.1:9099",
      firestoreHost: "192.0.2.10:8080",
      errorPattern: /FIRESTORE_EMULATOR_HOST/,
    },
  ];
  const writeHelpers = [
    {
      name: "createInternalBuyerDraft",
      run: () => createInternalBuyerDraft(guardedEnvironment, "buyer01", "TEST-GUARD-DRAFT"),
    },
    {
      name: "createInternalTargetedRfq",
      run: () => createInternalTargetedRfq(guardedEnvironment),
    },
    {
      name: "submitInternalQuotation",
      run: () => submitInternalQuotation(guardedEnvironment, {
        rfqId: "TEST-GUARD-RFQ",
        supplierKey: "supplier01",
        price: 1,
      }),
    },
  ];

  globalThis.fetch = async () => {
    authRequestCount += 1;
    throw new Error("Auth request must not occur before Emulator host validation.");
  };

  try {
    for (const configuration of invalidConfigurations) {
      if (configuration.authHost === undefined) {
        delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
      } else {
        process.env.FIREBASE_AUTH_EMULATOR_HOST = configuration.authHost;
      }
      if (configuration.firestoreHost === undefined) {
        delete process.env.FIRESTORE_EMULATOR_HOST;
      } else {
        process.env.FIRESTORE_EMULATOR_HOST = configuration.firestoreHost;
      }

      assert.throws(
        () => internalAccountContext(guardedEnvironment, "buyer01"),
        configuration.errorPattern,
        `${configuration.label}: internalAccountContext must reject`,
      );
      for (const helper of writeHelpers) {
        await assert.rejects(
          helper.run(),
          configuration.errorPattern,
          `${configuration.label}: ${helper.name} must reject`,
        );
      }
      assert.equal(
        authenticatedContextCount,
        0,
        `${configuration.label}: no Firestore context may be created`,
      );
      assert.equal(authRequestCount, 0, `${configuration.label}: no Auth request may occur`);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalAuthHost === undefined) {
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    } else {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = originalAuthHost;
    }
    if (originalFirestoreHost === undefined) {
      delete process.env.FIRESTORE_EMULATOR_HOST;
    } else {
      process.env.FIRESTORE_EMULATOR_HOST = originalFirestoreHost;
    }
  }
});

test("Buyer access states and verified-token requirement match the current model", async () => {
  await assert.doesNotReject(createInternalBuyerDraft(environment, "buyer01", "TEST-BUYER-01-DRAFT"));
  await assert.doesNotReject(createInternalBuyerDraft(environment, "buyer02", "TEST-BUYER-02-TRIAL-DRAFT"));
  await assert.rejects(createInternalBuyerDraft(environment, "buyer03", "TEST-BUYER-03-EXPIRED-DRAFT"));
  await assert.doesNotReject(createInternalBuyerDraft(environment, "buyer04", "TEST-BUYER-04-EXTENDED-DRAFT"));

  const unverifiedToken = internalAccountContext(environment, "buyer01", { email_verified: false });
  const activeUntil = Timestamp.fromDate(new Date("2099-12-31T23:59:59.000Z"));
  const now = Timestamp.fromDate(new Date("2026-07-27T00:00:00.000Z"));
  await assertFails(setDoc(
    doc(unverifiedToken, "rfqs", "TEST-BUYER-01-UNVERIFIED-TOKEN"),
    {
      buyerId: internalEmulatorAccounts.buyer01.uid,
      title: "TEST blocked unverified token",
      description: "TEST",
      quantity: 1,
      unit: "piece",
      unitOther: "",
      location: "baghdad",
      deliveryGovernorate: "baghdad",
      deliveryAddress: "TEST",
      preferredCurrency: "either",
      paymentTerms: "net_30",
      paymentTermsOther: "",
      deliveryTerms: "supplier_delivery",
      deliveryTermsOther: "",
      referenceLinks: [],
      closingDate: "2099-12-31",
      closingAt: activeUntil,
      categoryId: "instrumentation",
      recipientIds: [],
      status: "draft",
      attachmentStatus: "upload_pending_launch",
      createdAt: now,
      updatedAt: now,
    },
  ));

  const buyer04 = await getDoc(doc(
    internalAccountContext(environment, "buyer04"),
    "users",
    internalEmulatorAccounts.buyer04.uid,
  ));
  assert.equal(buyer04.data().approvedNewSupplierContributions, 10);
  assert.equal(buyer04.data().consumedApprovedSupplierContributions, 10);
  await assertSucceeds(getDoc(doc(
    internalAccountContext(environment, "buyer04"),
    "accessGrants",
    "TEST-INTERNAL-BUYER-04-CONTRIBUTION",
  )));
});

test("linked Suppliers own only their profiles while unlinked and pending ownership states own none", async () => {
  const supplier01 = internalAccountContext(environment, "supplier01");
  const supplier02 = internalAccountContext(environment, "supplier02");
  const supplier03 = internalAccountContext(environment, "supplier03");
  const supplier04 = internalAccountContext(environment, "supplier04");

  await assertSucceeds(getDoc(doc(supplier01, "suppliers", internalSupplierProfiles.supplier01.id)));
  await assertSucceeds(getDoc(doc(supplier04, "suppliers", internalSupplierProfiles.supplier04.id)));
  await assertFails(getDoc(doc(supplier01, "suppliers", internalSupplierProfiles.supplier04.id)));
  await assertFails(getDoc(doc(supplier02, "suppliers", internalSupplierProfiles.supplier02.id)));
  await assertFails(getDoc(doc(supplier02, "suppliers", internalSupplierProfiles.supplier01.id)));
  await assertFails(getDoc(doc(supplier03, "suppliers", internalSupplierProfiles.supplier03.id)));
  await assertFails(getDoc(doc(supplier03, "suppliers", internalSupplierProfiles.supplier01.id)));
});

test("Buyer and Supplier protected data remain role-isolated", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, "supplierDocuments", "TEST-INTERNAL-SUPPLIER-01-DOCUMENT"), {
      supplierId: internalSupplierProfiles.supplier01.id,
      ownerUserId: internalEmulatorAccounts.supplier01.uid,
      name: "TEST internal certificate",
      documentType: "certificate",
      description: "TEST metadata-only Supplier document",
      certificateNumber: "TEST-001",
      issuer: "TEST issuer",
      issuedAt: new Date(),
      expiresAt: null,
      storageStatus: "metadata_only",
      verificationStatus: "unverified",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  await createInternalBuyerDraft(environment, "buyer01", "TEST-INTERNAL-BUYER-PRIVATE-RFQ");

  const buyer = internalAccountContext(environment, "buyer01");
  const supplier = internalAccountContext(environment, "supplier01");
  await assertFails(getDoc(doc(buyer, "supplierDocuments", "TEST-INTERNAL-SUPPLIER-01-DOCUMENT")));
  await assertSucceeds(getDoc(doc(supplier, "supplierDocuments", "TEST-INTERNAL-SUPPLIER-01-DOCUMENT")));
  await assertFails(getDoc(doc(supplier, "rfqs", "TEST-INTERNAL-BUYER-PRIVATE-RFQ")));
  await assertFails(getDoc(doc(supplier, "users", internalEmulatorAccounts.buyer01.uid)));
  await assertFails(getDoc(doc(buyer, "users", internalEmulatorAccounts.supplier01.uid)));
});

test("two linked Suppliers submit competing quotations with cross-account denial", async () => {
  const rfqId = "TEST-INTERNAL-MULTI-SUPPLIER-RFQ";
  await createInternalTargetedRfq(environment, { rfqId });

  const supplier01 = internalAccountContext(environment, "supplier01");
  const supplier02 = internalAccountContext(environment, "supplier02");
  const supplier04 = internalAccountContext(environment, "supplier04");
  await assertSucceeds(getDoc(doc(supplier01, "rfqs", rfqId)));
  await assertSucceeds(getDoc(doc(supplier04, "rfqs", rfqId)));
  await assertFails(getDoc(doc(supplier02, "rfqs", rfqId)));

  const quotation01 = await submitInternalQuotation(environment, {
    rfqId,
    supplierKey: "supplier01",
    price: 300_000,
    deliveryDays: 4,
  });
  const quotation04 = await submitInternalQuotation(environment, {
    rfqId,
    supplierKey: "supplier04",
    price: 325_000,
    deliveryDays: 5,
  });

  const buyer = internalAccountContext(environment, "buyer01");
  const buyerResponses = await assertSucceeds(getDocs(query(
    collection(buyer, "rfqResponses"),
    where("rfqId", "==", rfqId),
    limit(100),
  )));
  assert.equal(buyerResponses.size, 2);
  assert.deepEqual(
    buyerResponses.docs.map((snapshot) => snapshot.data().price).sort((left, right) => left - right),
    [300_000, 325_000],
  );

  await assertSucceeds(getDoc(doc(supplier01, "rfqResponses", quotation01.responseId)));
  await assertSucceeds(getDoc(doc(supplier04, "rfqResponses", quotation04.responseId)));
  await assertFails(getDoc(doc(supplier01, "rfqResponses", quotation04.responseId)));
  await assertFails(getDoc(doc(supplier04, "rfqResponses", quotation01.responseId)));
  await assertFails(updateDoc(doc(supplier01, "rfqResponses", quotation04.responseId), { price: 1 }));
});

test("re-seeding is deterministic and does not duplicate fixture artifacts", async () => {
  await seedInternalEmulatorAccounts(environment);
  const authUsers = await listInternalAuthEmulatorAccounts();
  assert.equal(authUsers.length, 8);

  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const [users, suppliers, credits, grants] = await Promise.all([
      getDocs(collection(database, "users")),
      getDocs(collection(database, "suppliers")),
      getDocs(collection(database, "accessCredits")),
      getDocs(collection(database, "accessGrants")),
    ]);
    assert.equal(users.size, 8);
    assert.equal(suppliers.size, 4);
    assert.equal(credits.size, 1);
    assert.equal(grants.size, 1);
  });
});
