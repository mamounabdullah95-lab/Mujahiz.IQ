import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  defaultMaterialTerms,
  mergeMaterialTerms,
} from "../src/data/materialTerms.ts";
import {
  createFirebaseSupplierTaxonomyDictionaryAdapter,
} from "../src/services/providers/supplierTaxonomyDictionaryFirebaseAdapter.ts";
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
const adapterSource = fs.readFileSync(
  new URL("../src/services/providers/supplierTaxonomyDictionaryFirebaseAdapter.ts", import.meta.url),
  "utf8",
);

function documentSnapshot(id, data) {
  return { id, data: () => data };
}

function activeTerm(id, overrides = {}) {
  return {
    id,
    canonicalEn: id,
    canonicalAr: id,
    category: "test",
    subcategories: [],
    synonyms: [],
    brands: [],
    standards: [],
    status: "active",
    ...overrides,
  };
}

function createHarness({ documents = [], getDocsError } = {}) {
  const calls = [];
  const dependencies = {
    db: { name: "synthetic-firestore" },
    collection: (_db, path) => {
      calls.push(["collection", path]);
      return { path };
    },
    where: (field, operator, value) => ({ kind: "where", field, operator, value }),
    limit: (value) => ({ kind: "limit", value }),
    query: (collection, ...constraints) => {
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
  return { adapter: createFirebaseSupplierTaxonomyDictionaryAdapter(dependencies), calls };
}

function lastQuery(calls) {
  return calls.filter(([name]) => name === "query").at(-1)[1];
}

function manifestWithTaxonomyAuthority(authority) {
  return {
    schema: PROVIDER_MANIFEST_SCHEMA,
    version: PROVIDER_MANIFEST_VERSION,
    revision: "synthetic-taxonomy-selection",
    entries: SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
      entry.feature === "supplier_taxonomy_dictionary" ? { ...entry, authority } : entry
    )),
  };
}

test("the adapter creates no backend read until listMaterialTerms is invoked", async () => {
  const { adapter, calls } = createHarness();
  assert.deepEqual(calls, [["collection", "materialTerms"]]);
  await adapter.listMaterialTerms();
  assert.equal(calls.filter(([name]) => name === "getDocs").length, 1);
});

test("listMaterialTerms preserves the materialTerms active-only 500-record query without an application sort", async () => {
  const firestoreOrder = [
    documentSnapshot("second", activeTerm("second")),
    documentSnapshot("first", activeTerm("first")),
  ];
  const { adapter, calls } = createHarness({ documents: firestoreOrder });

  const terms = await adapter.listMaterialTerms();
  const query = lastQuery(calls);
  assert.deepEqual(calls[0], ["collection", "materialTerms"]);
  assert.deepEqual(query.constraints, [
    { kind: "where", field: "status", operator: "==", value: "active" },
    { kind: "limit", value: 500 },
  ]);
  assert.deepEqual(terms.slice(-2).map((term) => term.id), ["second", "first"]);
});

test("snapshot mapping permits stored ids to overwrite snapshot ids", async () => {
  const { adapter } = createHarness({
    documents: [documentSnapshot("firestore-id", activeTerm("stored-id"))],
  });

  assert.equal((await adapter.listMaterialTerms()).at(-1).id, "stored-id");
});

test("a successful empty Firebase result returns the real repository defaults", async () => {
  const { adapter } = createHarness();
  assert.deepEqual(await adapter.listMaterialTerms(), defaultMaterialTerms);
});

test("the adapter delegates default replacement, append order, duplicate overwrite, and non-active filtering to the real merge helper", async () => {
  const defaultId = defaultMaterialTerms[0].id;
  const documents = [
    documentSnapshot("replace", activeTerm(defaultId, { canonicalEn: "Replacement" })),
    documentSnapshot("new-b", activeTerm("new-b")),
    documentSnapshot("ignored", activeTerm("ignored", { status: "archived" })),
    documentSnapshot("new-a", activeTerm("new-a")),
    documentSnapshot("later", activeTerm("new-b", { canonicalEn: "Later value" })),
  ];
  const { adapter } = createHarness({ documents });

  const terms = await adapter.listMaterialTerms();
  const expected = mergeMaterialTerms(documents.map((item) => ({ id: item.id, ...item.data() })));
  assert.deepEqual(terms, expected);
  assert.equal(terms[0].id, defaultId);
  assert.equal(terms[0].canonicalEn, "Replacement");
  assert.deepEqual(terms.slice(-2).map((term) => term.id), ["new-b", "new-a"]);
  assert.equal(terms.at(-2).canonicalEn, "Later value");
  assert.equal(terms.some((term) => term.id === "ignored"), false);
});

test("the adapter does not normalize missing or malformed ordinary fields", async () => {
  const malformed = { id: "malformed", status: "active", canonicalEn: null, extra: "retained" };
  const { adapter } = createHarness({ documents: [documentSnapshot("firestore-id", malformed)] });

  const returned = (await adapter.listMaterialTerms()).at(-1);
  assert.deepEqual(returned, malformed);
});

test("Firebase getDocs failures propagate as the original error object", async () => {
  const failure = new Error("synthetic Firestore failure");
  await assert.rejects(
    createHarness({ getDocsError: failure }).adapter.listMaterialTerms(),
    (error) => error === failure,
  );
});

test("supplier_taxonomy_dictionary resolves only the shipped Firebase implementation and fails closed for Supabase", async () => {
  let firebaseCalls = 0;
  const firebaseImplementation = {
    listMaterialTerms: async () => {
      firebaseCalls += 1;
      return [];
    },
  };
  const registry = new Map([["supplier_taxonomy_dictionary", new Map([["firebase", firebaseImplementation]])]]);

  const resolved = resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "supplier_taxonomy_dictionary",
    registry,
  });
  assert.strictEqual(resolved, firebaseImplementation);
  assert.deepEqual(await resolved.listMaterialTerms(), []);
  assert.equal(firebaseCalls, 1);

  assert.throws(
    () => resolveProviderImplementation({
      manifest: manifestWithTaxonomyAuthority("supabase"),
      feature: "supplier_taxonomy_dictionary",
      registry,
    }),
    (error) => error instanceof ProviderResolverError && error.code === "provider_implementation_unsupported",
  );
  assert.equal(firebaseCalls, 1);
});

test("the firestore facade keeps Demo/local before the taxonomy resolver and routes configured reads through it", () => {
  assert.match(
    facadeSource,
    /export async function listMaterialTerms\(\) \{\s*if \(!isFirebaseConfigured\) \{\s*return demo\.demoListMaterialTerms\(\);\s*\}\s*return resolveSupplierTaxonomyDictionaryImplementation\(\)\.listMaterialTerms\(\);\s*\}/,
  );
  assert.match(facadeSource, /feature: "supplier_taxonomy_dictionary"/);
});

test("the extracted adapter has no Demo, Supabase, or registration-sector runtime dependency", () => {
  assert.doesNotMatch(adapterSource, /localDemo|demoList|@supabase|supabase-js|import\s*\(/i);
  assert.doesNotMatch(adapterSource, /registration|listRegistrationSectors/i);
});
