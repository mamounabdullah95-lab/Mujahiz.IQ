import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createFirebaseManagedContentConfigAdapter,
} from "../src/services/providers/managedContentConfigFirebaseAdapter.ts";
import {
  PROVIDER_MANIFEST_SCHEMA,
  PROVIDER_MANIFEST_VERSION,
  ProviderResolverError,
  SHIPPED_PROVIDER_MANIFEST,
  resolveProviderImplementation,
} from "../src/services/providers/providerContract.ts";

const workspaceSource = fs.readFileSync(
  new URL("../src/services/workspace.ts", import.meta.url),
  "utf8",
);
const adapterSource = fs.readFileSync(
  new URL("../src/services/providers/managedContentConfigFirebaseAdapter.ts", import.meta.url),
  "utf8",
);
const providerSource = fs.readFileSync(
  new URL("../src/services/providers/managedContentConfigProvider.ts", import.meta.url),
  "utf8",
);
const callerSource = fs.readFileSync(
  new URL("../src/pages/PublicContentPage.tsx", import.meta.url),
  "utf8",
);
const firestoreFacadeSource = fs.readFileSync(
  new URL("../src/services/firestore.ts", import.meta.url),
  "utf8",
);
const rulesSource = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");
const indexesSource = fs.readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8");

function documentSnapshot(id, data) {
  return { id, data: () => data };
}

function createHarness({ documents = [], getDocsError } = {}) {
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
      const firestoreQuery = { collection, constraints };
      calls.push(["query", firestoreQuery]);
      return firestoreQuery;
    },
    getDocs: async (firestoreQuery) => {
      calls.push(["getDocs", firestoreQuery]);
      if (getDocsError) throw getDocsError;
      return { empty: documents.length === 0, docs: documents };
    },
  };
  return { adapter: createFirebaseManagedContentConfigAdapter(dependencies), calls };
}

function lastQuery(calls) {
  return calls.filter(([name]) => name === "query").at(-1)[1];
}

function manifestWithManagedContentAuthority(authority) {
  return {
    schema: PROVIDER_MANIFEST_SCHEMA,
    version: PROVIDER_MANIFEST_VERSION,
    revision: "synthetic-managed-content-selection",
    entries: SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
      entry.feature === "managed_content_config" ? { ...entry, authority } : entry
    )),
  };
}

test("adapter construction creates only the contentPages reference and no backend read", () => {
  const { calls } = createHarness();
  assert.deepEqual(calls, [["collection", "contentPages"]]);
});

test("getPublishedContentPage uses the exact published content query once per invocation", async () => {
  const { adapter, calls } = createHarness();

  await adapter.getPublishedContentPage("privacy-policy");
  await adapter.getPublishedContentPage("terms-of-service");

  assert.equal(calls.filter(([name]) => name === "getDocs").length, 2);
  assert.deepEqual(lastQuery(calls), {
    collection: { path: "contentPages" },
    constraints: [
      { kind: "where", field: "slug", operator: "==", value: "terms-of-service" },
      { kind: "where", field: "status", operator: "==", value: "published" },
      { kind: "limit", value: 1 },
    ],
  });
});

test("empty snapshots return null", async () => {
  assert.equal(await createHarness().adapter.getPublishedContentPage("missing"), null);
});

test("the first Firebase result is mapped without normalization and stored id overrides snapshot id", async () => {
  const first = documentSnapshot("firestore-id", {
    id: "stored-id",
    slug: "privacy-policy",
    status: "published",
    titleAr: "العنوان",
    extra: undefined,
  });
  const second = documentSnapshot("ignored-id", { slug: "privacy-policy", status: "published" });

  assert.deepEqual(await createHarness({ documents: [first, second] }).adapter.getPublishedContentPage("privacy-policy"), {
    id: "stored-id",
    slug: "privacy-policy",
    status: "published",
    titleAr: "العنوان",
    extra: undefined,
  });
});

test("Firebase query and mapping errors propagate unchanged instead of returning null", async () => {
  const queryFailure = new Error("synthetic query failure");
  const mappingFailure = new Error("synthetic data failure");

  await assert.rejects(
    createHarness({ getDocsError: queryFailure }).adapter.getPublishedContentPage("privacy-policy"),
    (error) => error === queryFailure,
  );
  await assert.rejects(
    createHarness({ documents: [{ id: "broken", data: () => { throw mappingFailure; } }] }).adapter.getPublishedContentPage("privacy-policy"),
    (error) => error === mappingFailure,
  );
});

test("the shipped selection resolves Firebase and a synthetic Supabase selection fails closed without invoking it", async () => {
  let firebaseCalls = 0;
  const firebaseImplementation = {
    getPublishedContentPage: async () => {
      firebaseCalls += 1;
      return null;
    },
  };
  const registry = new Map([["managed_content_config", new Map([["firebase", firebaseImplementation]])]]);

  const resolved = resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "managed_content_config",
    registry,
  });
  assert.strictEqual(resolved, firebaseImplementation);
  assert.equal(await resolved.getPublishedContentPage("privacy-policy"), null);
  assert.equal(firebaseCalls, 1);

  assert.throws(() => resolveProviderImplementation({
    manifest: manifestWithManagedContentAuthority("supabase"),
    feature: "managed_content_config",
    registry,
  }), (error) => error instanceof ProviderResolverError && error.code === "provider_implementation_unsupported");
  assert.equal(firebaseCalls, 1);
});

test("the configured facade resolves only after preserving the existing Demo/local expression", () => {
  assert.match(workspaceSource, /export async function getPublishedContentPage\(slug: string\) \{\s*if \(!isFirebaseConfigured\) return localRead<ContentPageRecord>\("contentPages"\)\.find\(\(item\) => item\.slug === slug && item\.status === "published"\) \|\| null;\s*return resolveManagedContentConfigImplementation\(\)\.getPublishedContentPage\(slug\);\s*\}/);
  assert.doesNotMatch(workspaceSource, /getPublishedContentPage\(slug: string\)[\s\S]*?catch\s*\(/);
});

test("the Demo/local helper preserves stored-order matching, null cases, and malformed non-array behavior", () => {
  assert.match(workspaceSource, /function localRead<T>\(key: string\): T\[\] \{\s*try \{\s*return JSON\.parse\(localStorage\.getItem\(`\$\{localPrefix\}\$\{key\}`\) \|\| "\[\]"\) as T\[\];\s*\} catch \{\s*return \[\];\s*\}\s*\}/);
  assert.match(workspaceSource, /\.find\(\(item\) => item\.slug === slug && item\.status === "published"\) \|\| null/);
});

test("production composition has one Firebase instance, one managed-content registry, and one resolver path", () => {
  assert.match(providerSource, /createFirebaseManagedContentConfigAdapter\(/);
  assert.equal((providerSource.match(/createFirebaseManagedContentConfigAdapter\(/g) || []).length, 1);
  assert.equal((providerSource.match(/\["managed_content_config", new Map/g) || []).length, 1);
  assert.match(providerSource, /resolveProviderImplementation\(\{[\s\S]*feature: "managed_content_config"/);
  assert.equal((workspaceSource.match(/managed_content_config/g) || []).length, 0);
});

test("the adapter introduces no ordering, pagination, Demo, Supabase, retry, or import-time read capability", () => {
  assert.doesNotMatch(adapterSource, /orderBy|startAfter|endBefore|offset|onSnapshot|localStorage|supabase|retry|catch\s*\(/i);
  assert.match(adapterSource, /const contentPages = collection\(db, "contentPages"\);/);
  assert.match(adapterSource, /async getPublishedContentPage\(slug\)/);
});

test("the sole caller retains its caller-level rejection fallback", () => {
  assert.match(callerSource, /import \{ getPublishedContentPage \} from "\.\.\/services\/workspace";/);
  assert.match(callerSource, /getPublishedContentPage\(slugs\[pageKey\]\)\.then\(setManaged\)\.catch\(\(\) => setManaged\(null\)\)/);
  assert.equal((callerSource.match(/getPublishedContentPage\(/g) || []).length, 1);
});

test("active Rules and indexes remain outside the adapter boundary", () => {
  assert.match(rulesSource, /match \/contentPages\/\{pageId\} \{\s*allow read: if resource\.data\.status == "published" \|\| isOwner\(\);/);
  assert.doesNotMatch(indexesSource, /contentPages/);
});

test("adjacent content and settings operations remain in workspace", () => {
  for (const operation of [
    "listContentPages", "saveContentPage", "getBrandingSettings", "saveBrandingSettings",
    "getAdminOperationsSettings", "saveAdminOperationsSettings",
  ]) {
    assert.match(workspaceSource, new RegExp(`export async function ${operation}\\(`));
  }
  for (const operation of ["getPlatformSettings", "savePlatformSettings"]) {
    assert.match(firestoreFacadeSource, new RegExp(`export async function ${operation}\\(`));
  }
  assert.doesNotMatch(adapterSource, /saveContentPage|listContentPages|BrandingSettings|AdminOperationsSettings|PlatformSettings/);
});
