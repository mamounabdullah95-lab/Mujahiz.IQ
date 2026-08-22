import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createFirebaseSupplierFavoritesAdapter,
} from "../src/services/providers/supplierFavoritesFirebaseAdapter.ts";
import {
  ProviderResolverError,
  SHIPPED_PROVIDER_MANIFEST,
  resolveProviderImplementation,
} from "../src/services/providers/providerContract.ts";

const workspaceSource = fs.readFileSync(new URL("../src/services/workspace.ts", import.meta.url), "utf8");
const adapterSource = fs.readFileSync(new URL("../src/services/providers/supplierFavoritesFirebaseAdapter.ts", import.meta.url), "utf8");
const providerSource = fs.readFileSync(new URL("../src/services/providers/supplierFavoritesProvider.ts", import.meta.url), "utf8");
const buyerDashboardSource = fs.readFileSync(new URL("../src/pages/BuyerDashboardPage.tsx", import.meta.url), "utf8");
const supplierProfileSource = fs.readFileSync(new URL("../src/pages/SupplierProfilePage.tsx", import.meta.url), "utf8");
const buyerWorkspaceSource = fs.readFileSync(new URL("../src/pages/workspace/BuyerWorkspacePages.tsx", import.meta.url), "utf8");
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
    limit: (value) => ({ kind: "limit", value }),
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
  };
  return { adapter: createFirebaseSupplierFavoritesAdapter(dependencies), calls };
}

function manifestWithSupplierFavoritesAuthority(authority) {
  return {
    ...SHIPPED_PROVIDER_MANIFEST,
    entries: SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
      entry.feature === "supplier_favorites" ? { ...entry, authority } : entry
    )),
  };
}

test("adapter construction creates only the favorites reference and performs zero backend reads", () => {
  const { calls } = createHarness();
  assert.deepEqual(calls, [["collection", "favorites"]]);
});

test("listFavorites performs one bounded user query with no Firestore ordering or cursor", async () => {
  const { adapter, calls } = createHarness();
  await adapter.listFavorites("buyer-1");
  assert.deepEqual(calls, [
    ["collection", "favorites"],
    ["query", {
      collection: { path: "favorites" },
      constraints: [
        { kind: "where", field: "userId", operator: "==", value: "buyer-1" },
        { kind: "limit", value: 250 },
      ],
    }],
    ["getDocs", {
      collection: { path: "favorites" },
      constraints: [
        { kind: "where", field: "userId", operator: "==", value: "buyer-1" },
        { kind: "limit", value: 250 },
      ],
    }],
  ]);
});

test("listFavorites maps stored ids, sorts newest after the Firebase limit, and preserves empty results", async () => {
  const documents = [
    documentSnapshot("older", { id: "stored-older", createdAt: "2026-08-20T00:00:00.000Z" }),
    documentSnapshot("newer", { createdAt: "2026-08-21T00:00:00.000Z" }),
    documentSnapshot("updated", { createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" }),
  ];
  assert.deepEqual(await createHarness({ documents }).adapter.listFavorites("buyer-1"), [
    { id: "updated", createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" },
    { id: "newer", createdAt: "2026-08-21T00:00:00.000Z" },
    { id: "stored-older", createdAt: "2026-08-20T00:00:00.000Z" },
  ]);
  assert.deepEqual(await createHarness().adapter.listFavorites("buyer-1"), []);
});

test("configured query, read, and mapping failures propagate unchanged", async () => {
  const queryFailure = new Error("favorites query failure");
  const readFailure = new Error("favorites read failure");
  const mappingFailure = new Error("favorites mapping failure");
  await assert.rejects(createHarness({ queryError: queryFailure }).adapter.listFavorites("buyer-1"), (error) => error === queryFailure);
  await assert.rejects(createHarness({ getDocsError: readFailure }).adapter.listFavorites("buyer-1"), (error) => error === readFailure);
  await assert.rejects(createHarness({ documents: [{ id: "broken", data: () => { throw mappingFailure; } }] }).adapter.listFavorites("buyer-1"), (error) => error === mappingFailure);
});

test("the shipped selection resolves Firebase and a synthetic Supabase selection fails closed without invoking Firebase", async () => {
  let firebaseCalls = 0;
  const firebaseImplementation = { listFavorites: async () => { firebaseCalls += 1; return []; } };
  const registry = new Map([["supplier_favorites", new Map([["firebase", firebaseImplementation]])]]);
  const resolved = resolveProviderImplementation({ manifest: SHIPPED_PROVIDER_MANIFEST, feature: "supplier_favorites", registry });
  assert.strictEqual(resolved, firebaseImplementation);
  assert.deepEqual(await resolved.listFavorites("buyer-1"), []);
  assert.equal(firebaseCalls, 1);
  assert.throws(() => resolveProviderImplementation({ manifest: manifestWithSupplierFavoritesAuthority("supabase"), feature: "supplier_favorites", registry }), (error) => error instanceof ProviderResolverError && error.code === "provider_implementation_unsupported");
  assert.equal(firebaseCalls, 1);
});

test("the workspace preserves Demo/local filtering and sorting before Provider resolution without configured fallback", () => {
  assert.match(workspaceSource, /export async function listFavorites\(userId: string\) \{\s*if \(!isFirebaseConfigured\) return sortNewest\(localRead<FavoriteSupplier>\("favorites"\)\.filter\(\(item\) => item\.userId === userId\)\);\s*return resolveSupplierFavoritesImplementation\(\)\.listFavorites\(userId\);\s*\}/);
  const listFavoritesSource = workspaceSource.match(/export async function listFavorites[\s\S]*?\r?\n\}/)?.[0] || "";
  assert.doesNotMatch(listFavoritesSource, /catch\s*\(/);
});

test("the real composition has one Firebase instance, registry, resolver, and no workspace feature literal", () => {
  assert.equal((providerSource.match(/createFirebaseSupplierFavoritesAdapter\(/g) || []).length, 1);
  assert.equal((providerSource.match(/\["supplier_favorites", new Map/g) || []).length, 1);
  assert.match(providerSource, /resolveProviderImplementation\(\{\s*manifest: SHIPPED_PROVIDER_MANIFEST,\s*feature: "supplier_favorites",\s*registry: supplierFavoritesImplementations,\s*\}\)/);
  assert.equal((workspaceSource.match(/supplier_favorites/g) || []).length, 0);
});

test("the adapter has no ordering, pagination, Demo, Supabase, retry, cache, or import-time read capability", () => {
  assert.doesNotMatch(adapterSource, /orderBy|startAfter|endBefore|offset|onSnapshot|localStorage|supabase|retry|cache|catch\s*\(/i);
  assert.match(adapterSource, /const favorites = collection\(db, "favorites"\);/);
});

test("callers, buyer identity, route boundaries, Rules, indexes, and adjacent writes remain unchanged", () => {
  assert.match(buyerDashboardSource, /listFavorites\(firebaseUser\.uid\)/);
  assert.match(supplierProfileSource, /appUser\?\.accountType !== "buyer"/);
  assert.match(supplierProfileSource, /listFavorites\(firebaseUser\.uid\)/);
  assert.match(buyerWorkspaceSource, /listFavorites\(firebaseUser\.uid\)/);
  assert.match(appSource, /<Route element=\{<RoleProtectedRoute allowedRoles=\{\["buyer"\]\} allowPending \/>\}>\s*<Route path="buyer" element=\{<BuyerDashboardPage \/>\} \/>\s*<Route path="buyer\/categories"[\s\S]*?<Route path="buyer\/favorites" element=\{<BuyerFavoritesPage \/>\} \/>/);
  assert.match(appSource, /<Route element=\{<RoleProtectedRoute allowedRoles=\{buyerRoles\} requireAccess \/>\}>\s*<Route path="directory"[\s\S]*?<Route path="suppliers\/:id" element=\{<SupplierProfilePage \/>\} \/>/);
  assert.match(rulesSource, /match \/favorites\/\{favoriteId\} \{\s*allow read: if signedIn\(\) && resource\.data\.userId == request\.auth\.uid;/);
  assert.doesNotMatch(indexesSource, /favorites/);
  assert.match(workspaceSource, /export async function saveFavorite\(userId: string, supplier:/);
  assert.match(workspaceSource, /await setDoc\(doc\(favoritesRef, id\), payload\);/);
  assert.match(workspaceSource, /export async function removeFavorite\(userId: string, supplierId: string\) \{/);
  assert.match(workspaceSource, /await deleteDoc\(doc\(favoritesRef, id\)\);/);
});
