import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createFirebaseSupplierDirectoryAdapter,
} from "../src/services/providers/supplierDirectoryFirebaseAdapter.ts";
import {
  PROVIDER_MANIFEST_SCHEMA,
  PROVIDER_MANIFEST_VERSION,
  ProviderResolverError,
  SHIPPED_PROVIDER_MANIFEST,
  resolveProviderImplementation,
} from "../src/services/providers/providerContract.ts";

const facadeSource = fs.readFileSync(
  new URL("../src/services/firestore.ts", import.meta.url),
  "utf8",
);

function documentSnapshot(id, data) {
  return { id, data: () => data };
}

function querySnapshot(documents) {
  return { docs: documents };
}

function createHarness({ documents = [], document = null, getDocsError, getDocError } = {}) {
  const calls = [];
  const dependencies = {
    db: { name: "synthetic-firestore" },
    collection: (_db, path) => {
      calls.push(["collection", path]);
      return { path };
    },
    doc: (collection, path) => {
      calls.push(["doc", collection.path, path]);
      return { collection, path };
    },
    where: (field, operator, value) => ({ kind: "where", field, operator, value }),
    startAfter: (cursor) => ({ kind: "startAfter", cursor }),
    limit: (value) => ({ kind: "limit", value }),
    query: (collection, ...constraints) => {
      const value = { collection, constraints };
      calls.push(["query", value]);
      return value;
    },
    getDocs: async (query) => {
      calls.push(["getDocs", query]);
      if (getDocsError) throw getDocsError;
      return querySnapshot(documents);
    },
    getDoc: async (reference) => {
      calls.push(["getDoc", reference]);
      if (getDocError) throw getDocError;
      return document;
    },
  };
  return { adapter: createFirebaseSupplierDirectoryAdapter(dependencies), calls };
}

function lastQuery(calls) {
  return calls.filter(([name]) => name === "query").at(-1)[1];
}

test("listSuppliers preserves its approved-only Firebase query, result order, and stored-id mapping", async () => {
  const { adapter, calls } = createHarness({
    documents: [
      documentSnapshot("firestore-first", { displayName: "First" }),
      documentSnapshot("firestore-second", { id: "stored-id", displayName: "Second" }),
    ],
  });

  const suppliers = await adapter.listSuppliers();

  assert.deepEqual(suppliers, [
    { id: "firestore-first", displayName: "First" },
    { id: "stored-id", displayName: "Second" },
  ]);
  assert.deepEqual(calls[0], ["collection", "suppliers"]);
  assert.deepEqual(lastQuery(calls).constraints, [
    { kind: "where", field: "status", operator: "==", value: "approved" },
  ]);
});

test("listSuppliersPage preserves first-page, snapshot cursor, numeric cursor, and full-page heuristic behavior", async () => {
  const first = documentSnapshot("first", { status: "approved" });
  const second = documentSnapshot("second", { status: "approved" });
  const { adapter, calls } = createHarness({ documents: [first, second] });

  const firstPage = await adapter.listSuppliersPage(2, null);
  assert.deepEqual(firstPage, {
    items: [{ id: "first", status: "approved" }, { id: "second", status: "approved" }],
    cursor: second,
    hasMore: true,
  });
  assert.deepEqual(lastQuery(calls).constraints, [
    { kind: "where", field: "status", operator: "==", value: "approved" },
    { kind: "limit", value: 2 },
  ]);

  await adapter.listSuppliersPage(50, second);
  assert.deepEqual(lastQuery(calls).constraints, [
    { kind: "where", field: "status", operator: "==", value: "approved" },
    { kind: "startAfter", cursor: second },
    { kind: "limit", value: 50 },
  ]);

  await adapter.listSuppliersPage(50, 100);
  assert.deepEqual(lastQuery(calls).constraints, [
    { kind: "where", field: "status", operator: "==", value: "approved" },
    { kind: "limit", value: 50 },
  ]);
});

test("listSuppliersPage returns null and false for an empty page and false for a partial page", async () => {
  const empty = createHarness();
  assert.deepEqual(await empty.adapter.listSuppliersPage(50, null), {
    items: [], cursor: null, hasMore: false,
  });

  const partial = createHarness({ documents: [documentSnapshot("only", {})] });
  assert.equal((await partial.adapter.listSuppliersPage(2, null)).hasMore, false);
});

test("listSupplierCandidates avoids reads for no categories and preserves cap, limit-before-filter, and retained order", async () => {
  const { adapter, calls } = createHarness({
    documents: [
      documentSnapshot("ineligible", { status: "watchlist", canReceiveRfqs: true }),
      documentSnapshot("eligible", { status: "approved", canReceiveRfqs: true }),
      documentSnapshot("disabled", { status: "approved", canReceiveRfqs: false }),
    ],
  });

  assert.deepEqual(await adapter.listSupplierCandidates([]), []);
  assert.equal(calls.filter(([name]) => name === "getDocs").length, 0);

  const categories = Array.from({ length: 12 }, (_value, index) => `category-${index + 1}`);
  assert.deepEqual(await adapter.listSupplierCandidates(categories), [
    { id: "eligible", status: "approved", canReceiveRfqs: true },
  ]);
  assert.deepEqual(lastQuery(calls).constraints, [
    {
      kind: "where",
      field: "categories",
      operator: "array-contains-any",
      value: categories.slice(0, 10),
    },
    { kind: "limit", value: 100 },
  ]);
});

test("getSupplier reads the exact path, maps found documents, and returns null for missing documents", async () => {
  const found = createHarness({ document: { exists: () => true, ...documentSnapshot("firestore-id", { id: "stored-id", status: "archived" }) } });
  assert.deepEqual(await found.adapter.getSupplier("supplier-42"), { id: "stored-id", status: "archived" });
  assert.deepEqual(found.calls.filter(([name]) => name === "doc"), [["doc", "suppliers", "supplier-42"]]);

  const missing = createHarness({ document: { exists: () => false } });
  assert.equal(await missing.adapter.getSupplier("missing"), null);
});

test("Firebase read failures propagate unchanged", async () => {
  const queryFailure = new Error("synthetic query failure");
  const readFailure = new Error("synthetic document failure");
  await assert.rejects(
    createHarness({ getDocsError: queryFailure }).adapter.listSuppliers(),
    (error) => error === queryFailure,
  );
  await assert.rejects(
    createHarness({ getDocError: readFailure }).adapter.getSupplier("supplier-1"),
    (error) => error === readFailure,
  );
});

test("supplier_directory resolves and invokes only the shipped Firebase implementation, then fails closed for synthetic Supabase", async () => {
  let firebaseCalls = 0;
  const firebaseImplementation = {
    listSuppliers: async () => {
      firebaseCalls += 1;
      return [];
    },
  };
  const registry = new Map([["supplier_directory", new Map([["firebase", firebaseImplementation]])]]);

  const resolved = resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "supplier_directory",
    registry,
  });
  assert.strictEqual(resolved, firebaseImplementation);
  assert.deepEqual(await resolved.listSuppliers(), []);
  assert.equal(firebaseCalls, 1);

  const supabaseManifest = {
    schema: PROVIDER_MANIFEST_SCHEMA,
    version: PROVIDER_MANIFEST_VERSION,
    revision: "synthetic-supabase-selection",
    entries: SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
      entry.feature === "supplier_directory" ? { ...entry, authority: "supabase" } : entry
    )),
  };
  assert.throws(() => resolveProviderImplementation({
    manifest: supabaseManifest,
    feature: "supplier_directory",
    registry,
  }), (error) => error instanceof ProviderResolverError && error.code === "provider_implementation_unsupported");
  assert.equal(firebaseCalls, 1);
});

test("the caller-facing facade keeps Demo/local before internal provider resolution", () => {
  assert.match(facadeSource, /export async function listSuppliers\(\) \{\s*if \(!isFirebaseConfigured\) \{\s*return demo\.demoListSuppliers\(\);/);
  assert.match(facadeSource, /export async function listSuppliersPage\(pageSize = 50, cursor: SupplierPageCursor = null\)/);
  assert.match(facadeSource, /return resolveSupplierDirectoryImplementation\(\)\.listSuppliersPage\(pageSize, cursor\);/);
  assert.match(facadeSource, /return resolveSupplierDirectoryImplementation\(\)\.listSupplierCandidates\(categories\);/);
  assert.match(facadeSource, /return resolveSupplierDirectoryImplementation\(\)\.getSupplier\(supplierId\);/);
});

test("the extracted adapter has no Demo or Supabase runtime dependency", () => {
  const source = fs.readFileSync(
    new URL("../src/services/providers/supplierDirectoryFirebaseAdapter.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /localDemo|demoList|@supabase|supabase-js|import\s*\(/i);
});
