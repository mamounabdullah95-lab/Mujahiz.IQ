import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createFirebaseSupplierReviewsAdapter,
} from "../src/services/providers/supplierReviewsFirebaseAdapter.ts";
import {
  ProviderResolverError,
  SHIPPED_PROVIDER_MANIFEST,
  resolveProviderImplementation,
} from "../src/services/providers/providerContract.ts";

const firestoreSource = fs.readFileSync(new URL("../src/services/firestore.ts", import.meta.url), "utf8");
const adapterSource = fs.readFileSync(new URL("../src/services/providers/supplierReviewsFirebaseAdapter.ts", import.meta.url), "utf8");
const providerSource = fs.readFileSync(new URL("../src/services/providers/supplierReviewsProvider.ts", import.meta.url), "utf8");
const myReviewsPageSource = fs.readFileSync(new URL("../src/pages/MyReviewsPage.tsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../src/AppV2.tsx", import.meta.url), "utf8");
const rulesSource = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");
const indexesSource = fs.readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8");

function documentSnapshot(id, data) {
  return { id, data: () => data };
}

function createHarness({ documents = [], getDocsError, queryError } = {}) {
  const calls = [];
  const dependencies = {
    db: { kind: "synthetic-firestore" },
    collection: (_db, path) => {
      calls.push(["collection", path]);
      return { path };
    },
    where: (field, operator, value) => ({ kind: "where", field, operator, value }),
    query: (collection, ...constraints) => {
      if (queryError) throw queryError;
      const firestoreQuery = { collection, constraints };
      calls.push(["query", firestoreQuery]);
      return firestoreQuery;
    },
    getDocs: async (firestoreQuery) => {
      calls.push(["getDocs", firestoreQuery]);
      if (getDocsError) throw getDocsError;
      return { docs: documents };
    },
    toDate: (value) => {
      if (!value) return null;
      if (value instanceof Date) return value;
      if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return value.toDate();
      return null;
    },
  };
  return { adapter: createFirebaseSupplierReviewsAdapter(dependencies), calls };
}

function manifestWithSupplierReviewsAuthority(authority) {
  return {
    ...SHIPPED_PROVIDER_MANIFEST,
    entries: SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
      entry.feature === "supplier_reviews" ? { ...entry, authority } : entry
    )),
  };
}

test("adapter construction creates only the reviews reference and performs zero backend reads", () => {
  const { calls } = createHarness();
  assert.deepEqual(calls, [["collection", "reviews"]]);
});

test("listMyReviews performs one user query with no Firestore order, limit, or cursor", async () => {
  const { adapter, calls } = createHarness();
  await adapter.listMyReviews("buyer-1");
  assert.deepEqual(calls, [
    ["collection", "reviews"],
    ["query", {
      collection: { path: "reviews" },
      constraints: [
        { kind: "where", field: "reviewedBy", operator: "==", value: "buyer-1" },
      ],
    }],
    ["getDocs", {
      collection: { path: "reviews" },
      constraints: [
        { kind: "where", field: "reviewedBy", operator: "==", value: "buyer-1" },
      ],
    }],
  ]);
});

test("listMyReviews maps stored ids, sorts after the unbounded Firebase read, limits client results, and preserves empty results", async () => {
  const documents = [
    documentSnapshot("older", { id: "stored-older", createdAt: "2026-08-20T00:00:00.000Z" }),
    documentSnapshot("newer", { createdAt: "2026-08-21T00:00:00.000Z" }),
    documentSnapshot("invalid", { createdAt: "not-a-date" }),
  ];
  assert.deepEqual(await createHarness({ documents }).adapter.listMyReviews("buyer-1"), [
    { id: "newer", createdAt: "2026-08-21T00:00:00.000Z" },
    { id: "stored-older", createdAt: "2026-08-20T00:00:00.000Z" },
    { id: "invalid", createdAt: "not-a-date" },
  ]);
  const manyDocuments = Array.from({ length: 101 }, (_, index) => documentSnapshot(String(index), {
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
  }));
  assert.equal((await createHarness({ documents: manyDocuments }).adapter.listMyReviews("buyer-1")).length, 100);
  assert.deepEqual(await createHarness().adapter.listMyReviews("buyer-1"), []);
});

test("configured query, read, and mapping failures propagate unchanged", async () => {
  const queryFailure = new Error("reviews query failure");
  const readFailure = new Error("reviews read failure");
  const mappingFailure = new Error("reviews mapping failure");
  await assert.rejects(createHarness({ queryError: queryFailure }).adapter.listMyReviews("buyer-1"), (error) => error === queryFailure);
  await assert.rejects(createHarness({ getDocsError: readFailure }).adapter.listMyReviews("buyer-1"), (error) => error === readFailure);
  await assert.rejects(createHarness({ documents: [{ id: "broken", data: () => { throw mappingFailure; } }] }).adapter.listMyReviews("buyer-1"), (error) => error === mappingFailure);
});

test("the shipped selection resolves Firebase and a synthetic Supabase selection fails closed without invoking Firebase", async () => {
  let firebaseCalls = 0;
  const firebaseImplementation = { listMyReviews: async () => { firebaseCalls += 1; return []; } };
  const registry = new Map([["supplier_reviews", new Map([["firebase", firebaseImplementation]])]]);
  const resolved = resolveProviderImplementation({ manifest: SHIPPED_PROVIDER_MANIFEST, feature: "supplier_reviews", registry });
  assert.strictEqual(resolved, firebaseImplementation);
  assert.deepEqual(await resolved.listMyReviews("buyer-1"), []);
  assert.equal(firebaseCalls, 1);
  assert.throws(() => resolveProviderImplementation({ manifest: manifestWithSupplierReviewsAuthority("supabase"), feature: "supplier_reviews", registry }), (error) => error instanceof ProviderResolverError && error.code === "provider_implementation_unsupported");
  assert.equal(firebaseCalls, 1);
});

test("the Firestore facade preserves Demo/local before Provider resolution without configured fallback", () => {
  assert.match(firestoreSource, /export async function listMyReviews\(userId: string\) \{\s*if \(!isFirebaseConfigured\) \{\s*return demo\.demoListMyReviews\(userId\);\s*\}\s*return resolveSupplierReviewsImplementation\(\)\.listMyReviews\(userId\);\s*\}/);
  const listMyReviewsSource = firestoreSource.match(/export async function listMyReviews[\s\S]*?\r?\n\}/)?.[0] || "";
  assert.doesNotMatch(listMyReviewsSource, /catch\s*\(/);
});

test("the real composition has one Firebase instance, registry, resolver, and no facade feature literal", () => {
  assert.equal((providerSource.match(/createFirebaseSupplierReviewsAdapter\(/g) || []).length, 1);
  assert.equal((providerSource.match(/\["supplier_reviews", new Map/g) || []).length, 1);
  assert.match(providerSource, /resolveProviderImplementation\(\{\s*manifest: SHIPPED_PROVIDER_MANIFEST,\s*feature: "supplier_reviews",\s*registry: supplierReviewsImplementations,\s*\}\)/);
  assert.equal((firestoreSource.match(/supplier_reviews/g) || []).length, 0);
});

test("the adapter has no Firestore ordering, pagination, Demo, Supabase, retry, cache, or import-time read capability", () => {
  assert.doesNotMatch(adapterSource, /orderBy|limit\(|startAfter|endBefore|offset|onSnapshot|localStorage|supabase|retry|cache|catch\s*\(/i);
  assert.match(adapterSource, /const reviews = collection\(db, "reviews"\);/);
});

test("the active buyer caller, identity, route, Rules, index boundary, and adjacent writes remain unchanged", () => {
  assert.match(myReviewsPageSource, /listMyReviews\(firebaseUser\.uid\)/);
  assert.match(appSource, /<Route element=\{<RoleProtectedRoute allowedRoles=\{\["buyer"\]\} allowPending \/>\}>[\s\S]*?<Route path="my-reviews" element=\{<MyReviewsPage \/>\} \/>/);
  assert.match(rulesSource, /match \/reviews\/\{reviewId\} \{\s*allow create:[\s\S]*?allow read: if isAdmin\(\) \|\| \(isBuyer\(\) && hasActiveAccess\(\) && resource\.data\.status == "approved"\) \|\| \(isBuyer\(\) && resource\.data\.reviewedBy == request\.auth\.uid\)/);
  assert.match(indexesSource, /"collectionGroup": "reviews"[\s\S]*?"fieldPath": "reviewedBy"[\s\S]*?"fieldPath": "createdAt"/);
  assert.match(firestoreSource, /export async function submitSupplierReview\(/);
  assert.match(firestoreSource, /await addDoc\(reviewsRef,/);
  assert.match(firestoreSource, /export async function moderateReview\(/);
  assert.match(firestoreSource, /transaction\.update\(reviewDoc,/);
});
