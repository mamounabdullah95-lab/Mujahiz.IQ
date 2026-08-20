import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  defaultMaterialTerms,
  mergeMaterialTerms,
} from "../src/data/materialTerms.ts";
import { defaultRegistrationSectors } from "../src/data/registrationSectors.ts";
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

const firestoreFacadeSource = fs.readFileSync(
  new URL("../src/services/firestore.ts", import.meta.url),
  "utf8",
);
const workspaceFacadeSource = fs.readFileSync(
  new URL("../src/services/workspace.ts", import.meta.url),
  "utf8",
);
const adapterSource = fs.readFileSync(
  new URL("../src/services/providers/supplierTaxonomyDictionaryFirebaseAdapter.ts", import.meta.url),
  "utf8",
);
const providerSource = fs.readFileSync(
  new URL("../src/services/providers/supplierTaxonomyDictionaryProvider.ts", import.meta.url),
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

function registrationSnapshot(data, exists = true) {
  return { exists: () => exists, data: () => data };
}

function createHarness({
  documents = [],
  getDocsError,
  registrationDocument = registrationSnapshot({}, false),
  getDocError,
} = {}) {
  const calls = [];
  const dependencies = {
    db: { name: "synthetic-firestore" },
    collection: (_db, path) => {
      calls.push(["collection", path]);
      return { path };
    },
    doc: (_db, path, ...pathSegments) => {
      const reference = { path: [path, ...pathSegments].join("/") };
      calls.push(["doc", reference]);
      return reference;
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
    getDoc: async (documentReference) => {
      calls.push(["getDoc", documentReference]);
      if (getDocError) throw getDocError;
      return registrationDocument;
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

test("the adapter creates no backend read until one of its methods is invoked", async () => {
  const { adapter, calls } = createHarness();
  assert.deepEqual(calls, [["collection", "materialTerms"]]);
  await adapter.listMaterialTerms();
  assert.equal(calls.filter(([name]) => name === "getDocs").length, 1);
  assert.equal(calls.filter(([name]) => name === "getDoc").length, 0);
});

test("listRegistrationSectors reads publicConfig/registration exactly once when invoked", async () => {
  const { adapter, calls } = createHarness();
  assert.equal(calls.filter(([name]) => name === "doc").length, 0);

  await adapter.listRegistrationSectors();

  assert.deepEqual(calls.filter(([name]) => name === "doc"), [["doc", { path: "publicConfig/registration" }]]);
  assert.deepEqual(calls.filter(([name]) => name === "getDoc"), [["getDoc", { path: "publicConfig/registration" }]]);
});

test("missing, non-array, empty, and inactive-only configured sectors return fresh repository defaults", async (t) => {
  const cases = [
    ["missing document", registrationSnapshot({}, false)],
    ["missing sectors", registrationSnapshot({})],
    ["non-array sectors", registrationSnapshot({ sectors: "not-an-array" })],
    ["empty sectors", registrationSnapshot({ sectors: [] })],
    ["inactive-only sectors", registrationSnapshot({ sectors: [{ active: false, order: 1 }] })],
  ];

  for (const [name, document] of cases) {
    await t.test(name, async () => {
      const result = await createHarness({ registrationDocument: document }).adapter.listRegistrationSectors();
      assert.deepEqual(result, defaultRegistrationSectors);
      assert.notStrictEqual(result, defaultRegistrationSectors);
      assert.strictEqual(result[0], defaultRegistrationSectors[0]);
    });
  }
});

test("configured sectors preserve truthiness, ordinary fields, object references, numeric coercion, and stable equal-order input", async () => {
  const equalFirst = { value: " equal-first ", labelAr: null, labelEn: "First", order: 2, active: "yes", extra: "retained" };
  const inactive = { value: "inactive", labelAr: "", labelEn: "", order: 0, active: 0 };
  const coercedFirst = { value: "coerced", labelAr: "", labelEn: "", order: "1", active: 1 };
  const equalSecond = { value: "equal-second", labelAr: "", labelEn: "Second", order: 2, active: true };
  const configured = [equalFirst, inactive, coercedFirst, equalSecond];
  const result = await createHarness({
    registrationDocument: registrationSnapshot({ sectors: configured }),
  }).adapter.listRegistrationSectors();

  assert.deepEqual(result, [coercedFirst, equalFirst, equalSecond]);
  assert.strictEqual(result[0], coercedFirst);
  assert.strictEqual(result[1], equalFirst);
  assert.equal(result[1].value, " equal-first ");
  assert.equal(result[1].labelAr, null);
  assert.equal(result[1].extra, "retained");
  assert.deepEqual(configured, [equalFirst, inactive, coercedFirst, equalSecond]);
});

test("configured filtering and sorting failures return repository defaults", async (t) => {
  for (const [name, sectors] of [
    ["null element", [null]],
    ["undefined element", [undefined]],
    ["throwing numeric coercion", [
      { active: true, order: Symbol("bad") },
      { active: true, order: 1 },
    ]],
  ]) {
    await t.test(name, async () => {
      const result = await createHarness({
        registrationDocument: registrationSnapshot({ sectors }),
      }).adapter.listRegistrationSectors();
      assert.deepEqual(result, defaultRegistrationSectors);
    });
  }
});

test("configured getDoc failures return defaults without changing the material-term error contract", async () => {
  const registrationFailure = new Error("synthetic registration failure");
  const registrationHarness = createHarness({ getDocError: registrationFailure });
  assert.deepEqual(await registrationHarness.adapter.listRegistrationSectors(), defaultRegistrationSectors);

  const materialFailure = new Error("synthetic material failure");
  await assert.rejects(
    createHarness({ getDocsError: materialFailure }).adapter.listMaterialTerms(),
    (error) => error === materialFailure,
  );
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
    listRegistrationSectors: async () => {
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
    firestoreFacadeSource,
    /export async function listMaterialTerms\(\) \{\s*if \(!isFirebaseConfigured\) \{\s*return demo\.demoListMaterialTerms\(\);\s*\}\s*return resolveSupplierTaxonomyDictionaryImplementation\(\)\.listMaterialTerms\(\);\s*\}/,
  );
  assert.match(firestoreFacadeSource, /from "\.\/providers\/supplierTaxonomyDictionaryProvider"/);
});

test("the workspace facade keeps Demo/local before resolution and leaves the write inline", () => {
  assert.match(
    workspaceFacadeSource,
    /export async function listRegistrationSectors\(\) \{\s*const fallback = [^;]+;\s*if \(!isFirebaseConfigured\) \{\s*const configured = localRead<RegistrationSector>\("registrationSectors"\);\s*const sectors = configured\.filter\(\(item\) => item\.active\)\.sort\(\(a, b\) => a\.order - b\.order\);\s*return sectors\.length \? sectors : fallback\(\);\s*\}\s*return resolveSupplierTaxonomyDictionaryImplementation\(\)\.listRegistrationSectors\(\);\s*\}/,
  );
  assert.match(
    workspaceFacadeSource,
    /export async function saveRegistrationSectors[\s\S]*?setDoc\(doc\(db, "publicConfig", "registration"\), \{ sectors: sanitized, updatedAt: serverTimestamp\(\), updatedBy: actorId \}, \{ merge: true \}\);/,
  );
});

test("both facades share one taxonomy adapter, registry, and resolver composition path", () => {
  assert.match(providerSource, /const firebaseSupplierTaxonomyDictionaryImplementation = createFirebaseSupplierTaxonomyDictionaryAdapter\(/);
  assert.equal((providerSource.match(/ProviderImplementationRegistry<SupplierTaxonomyDictionaryImplementation>/g) || []).length, 1);
  assert.equal((providerSource.match(/function resolveSupplierTaxonomyDictionaryImplementation\(/g) || []).length, 1);
  assert.match(providerSource, /feature: "supplier_taxonomy_dictionary"/);
  assert.doesNotMatch(firestoreFacadeSource, /createFirebaseSupplierTaxonomyDictionaryAdapter|supplierTaxonomyDictionaryImplementations/);
  assert.doesNotMatch(workspaceFacadeSource, /createFirebaseSupplierTaxonomyDictionaryAdapter|supplierTaxonomyDictionaryImplementations|ProviderImplementationRegistry/);
  assert.match(firestoreFacadeSource, /resolveSupplierTaxonomyDictionaryImplementation\(\)\.listMaterialTerms\(\)/);
  assert.match(workspaceFacadeSource, /resolveSupplierTaxonomyDictionaryImplementation\(\)\.listRegistrationSectors\(\)/);
});

test("the extracted adapter and shared composition have no Demo or Supabase runtime dependency", () => {
  assert.doesNotMatch(adapterSource, /localDemo|demoList|@supabase|supabase-js|import\s*\(/i);
  assert.doesNotMatch(providerSource, /localDemo|demoList|@supabase|supabase-js|import\s*\(/i);
});
