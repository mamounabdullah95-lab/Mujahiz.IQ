import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BRANDING_SETTINGS_FALLBACK,
  createAdminOperationsSettingsFallback,
  createFirebaseManagedContentConfigAdapter,
} from "../src/services/providers/managedContentConfigFirebaseAdapter.ts";
import {
  PROVIDER_MANIFEST_SCHEMA,
  PROVIDER_MANIFEST_VERSION,
  ProviderResolverError,
  SHIPPED_PROVIDER_MANIFEST,
  resolveProviderImplementation,
} from "../src/services/providers/providerContract.ts";

const workspaceSource = fs.readFileSync(new URL("../src/services/workspace.ts", import.meta.url), "utf8");
const adapterSource = fs.readFileSync(new URL("../src/services/providers/managedContentConfigFirebaseAdapter.ts", import.meta.url), "utf8");
const providerSource = fs.readFileSync(new URL("../src/services/providers/managedContentConfigProvider.ts", import.meta.url), "utf8");
const publicCallerSource = fs.readFileSync(new URL("../src/pages/PublicContentPage.tsx", import.meta.url), "utf8");
const brandingCallerSource = fs.readFileSync(new URL("../src/pages/workspace/AdminWorkspacePages.tsx", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../src/AppV2.tsx", import.meta.url), "utf8");
const authorizationSource = fs.readFileSync(new URL("../src/utils/authorization.ts", import.meta.url), "utf8");
const disabledFileUploadSource = fs.readFileSync(new URL("../src/components/DisabledFileUpload.tsx", import.meta.url), "utf8");
const firestoreFacadeSource = fs.readFileSync(new URL("../src/services/firestore.ts", import.meta.url), "utf8");
const rulesSource = fs.readFileSync(new URL("../firestore.rbac.rules", import.meta.url), "utf8");
const indexesSource = fs.readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8");

function documentSnapshot(id, data) {
  return { id, data: () => data };
}

function brandingSnapshot({ exists = true, data = {}, existsError, dataError } = {}) {
  return {
    exists: () => {
      if (existsError) throw existsError;
      return exists;
    },
    data: () => {
      if (dataError) throw dataError;
      return data;
    },
  };
}

function createHarness({ documents = [], getDocsError, queryError, snapshot = brandingSnapshot(), adminOperationsSnapshot = snapshot, getDocError } = {}) {
  const calls = [];
  const dependencies = {
    db: { kind: "synthetic-firestore" },
    collection: (_db, path) => {
      calls.push(["collection", path]);
      return { path };
    },
    doc: (collection, id) => {
      const reference = { collection, id };
      calls.push(["doc", reference]);
      return reference;
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
      return { empty: documents.length === 0, docs: documents };
    },
    getDoc: async (documentReference) => {
      calls.push(["getDoc", documentReference]);
      if (getDocError) throw getDocError;
      return documentReference.id === "adminOperations" ? adminOperationsSnapshot : snapshot;
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

test("adapter construction creates references only and performs zero backend reads", () => {
  const { calls } = createHarness();
  assert.deepEqual(calls, [
    ["collection", "contentPages"],
    ["collection", "settings"],
    ["doc", { collection: { path: "settings" }, id: "branding" }],
    ["doc", { collection: { path: "settings" }, id: "adminOperations" }],
  ]);
  assert.equal(calls.filter(([name]) => name === "getDocs" || name === "getDoc").length, 0);
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

test("empty published-content snapshots return null", async () => {
  assert.equal(await createHarness().adapter.getPublishedContentPage("missing"), null);
});

test("the first Firebase content result is mapped without normalization and stored id overrides snapshot id", async () => {
  const first = documentSnapshot("firestore-id", { id: "stored-id", slug: "privacy-policy", status: "published", titleAr: "العنوان", extra: undefined });
  const second = documentSnapshot("ignored-id", { slug: "privacy-policy", status: "published" });
  assert.deepEqual(await createHarness({ documents: [first, second] }).adapter.getPublishedContentPage("privacy-policy"), {
    id: "stored-id", slug: "privacy-policy", status: "published", titleAr: "العنوان", extra: undefined,
  });
});

test("Firebase published-content query and mapping errors propagate unchanged instead of returning null", async () => {
  const queryFailure = new Error("synthetic query failure");
  const mappingFailure = new Error("synthetic data failure");
  await assert.rejects(createHarness({ getDocsError: queryFailure }).adapter.getPublishedContentPage("privacy-policy"), (error) => error === queryFailure);
  await assert.rejects(createHarness({ documents: [{ id: "broken", data: () => { throw mappingFailure; } }] }).adapter.getPublishedContentPage("privacy-policy"), (error) => error === mappingFailure);
});

test("getBrandingSettings reads exactly settings/branding once per invocation without a query", async () => {
  const { adapter, calls } = createHarness();
  await adapter.getBrandingSettings();
  await adapter.getBrandingSettings();
  assert.deepEqual(calls.filter(([name]) => name === "getDoc"), [
    ["getDoc", { collection: { path: "settings" }, id: "branding" }],
    ["getDoc", { collection: { path: "settings" }, id: "branding" }],
  ]);
  assert.equal(calls.filter(([name]) => name === "getDocs" || name === "query").length, 0);
});

test("a missing Branding document returns the exact six-field fallback", async () => {
  assert.deepEqual(await createHarness({ snapshot: brandingSnapshot({ exists: false }) }).adapter.getBrandingSettings(), BRANDING_SETTINGS_FALLBACK);
  assert.deepEqual(Object.keys(BRANDING_SETTINGS_FALLBACK), ["primaryColor", "secondaryColor", "accentColor", "introAr", "introEn", "assetUploadStatus"]);
});

test("configured Branding overlays stored fields, including upload status and unexpected fields, without an id", async () => {
  const stored = { primaryColor: "#ffffff", assetUploadStatus: "stored-status", unexpected: "preserved" };
  const result = await createHarness({ snapshot: brandingSnapshot({ data: stored }) }).adapter.getBrandingSettings();
  assert.deepEqual(result, { ...BRANDING_SETTINGS_FALLBACK, ...stored });
  assert.equal("id" in result, false);
});

test("configured Branding getDoc, exists, and data failures propagate unchanged", async () => {
  const getDocFailure = new Error("getDoc failure");
  const existsFailure = new Error("exists failure");
  const dataFailure = new Error("data failure");
  await assert.rejects(createHarness({ getDocError: getDocFailure }).adapter.getBrandingSettings(), (error) => error === getDocFailure);
  await assert.rejects(createHarness({ snapshot: brandingSnapshot({ existsError: existsFailure }) }).adapter.getBrandingSettings(), (error) => error === existsFailure);
  await assert.rejects(createHarness({ snapshot: brandingSnapshot({ dataError: dataFailure }) }).adapter.getBrandingSettings(), (error) => error === dataFailure);
});

test("getAdminOperationsSettings reads exactly settings/adminOperations once per invocation without a query", async () => {
  const { adapter, calls } = createHarness();
  await adapter.getAdminOperationsSettings();
  await adapter.getAdminOperationsSettings();
  assert.deepEqual(calls.filter(([name]) => name === "getDoc"), [
    ["getDoc", { collection: { path: "settings" }, id: "adminOperations" }],
    ["getDoc", { collection: { path: "settings" }, id: "adminOperations" }],
  ]);
  assert.equal(calls.filter(([name]) => name === "getDocs" || name === "query").length, 0);
});

test("a missing Admin Operations document returns a fresh exact four-field fallback", async () => {
  const adapter = createHarness({ adminOperationsSnapshot: brandingSnapshot({ exists: false }) }).adapter;
  const first = await adapter.getAdminOperationsSettings();
  const second = await adapter.getAdminOperationsSettings();
  assert.deepEqual(first, createAdminOperationsSettingsFallback());
  assert.deepEqual(second, createAdminOperationsSettingsFallback());
  assert.notStrictEqual(first, second);
  first.reviewNotifications = false;
  assert.deepEqual(await adapter.getAdminOperationsSettings(), createAdminOperationsSettingsFallback());
});

test("configured Admin Operations overlays partial and complete stored fields, preserving unexpected fields without an id", async () => {
  const partial = await createHarness({
    adminOperationsSnapshot: brandingSnapshot({ data: { reviewNotifications: false } }),
  }).adapter.getAdminOperationsSettings();
  assert.deepEqual(partial, { ...createAdminOperationsSettingsFallback(), reviewNotifications: false });

  const stored = {
    reviewNotifications: false,
    showIncompleteSuppliers: true,
    requireDuplicateReason: false,
    dictionarySuggestionMinimum: 9,
    unexpected: "preserved",
  };
  const result = await createHarness({ adminOperationsSnapshot: brandingSnapshot({ data: stored }) }).adapter.getAdminOperationsSettings();
  assert.deepEqual(result, { ...createAdminOperationsSettingsFallback(), ...stored });
  assert.equal("id" in result, false);
});

test("configured Admin Operations getDoc, exists, and data failures propagate unchanged", async () => {
  const getDocFailure = new Error("getDoc failure");
  const existsFailure = new Error("exists failure");
  const dataFailure = new Error("data failure");
  await assert.rejects(createHarness({ getDocError: getDocFailure }).adapter.getAdminOperationsSettings(), (error) => error === getDocFailure);
  await assert.rejects(createHarness({ adminOperationsSnapshot: brandingSnapshot({ existsError: existsFailure }) }).adapter.getAdminOperationsSettings(), (error) => error === existsFailure);
  await assert.rejects(createHarness({ adminOperationsSnapshot: brandingSnapshot({ dataError: dataFailure }) }).adapter.getAdminOperationsSettings(), (error) => error === dataFailure);
});

test("listContentPages preserves the false-mode query when false or omitted, with one read per invocation", async () => {
  const { adapter, calls } = createHarness();
  await adapter.listContentPages(false);
  await adapter.listContentPages();
  assert.equal(calls.filter(([name]) => name === "getDocs").length, 2);
  assert.deepEqual(calls.filter(([name]) => name === "query").map(([, firestoreQuery]) => firestoreQuery), [
    { collection: { path: "contentPages" }, constraints: [{ kind: "limit", value: 100 }] },
    { collection: { path: "contentPages" }, constraints: [{ kind: "limit", value: 100 }] },
  ]);
});

test("listContentPages true mode uses the published-status query with one read", async () => {
  const { adapter, calls } = createHarness();
  await adapter.listContentPages(true);
  assert.equal(calls.filter(([name]) => name === "getDocs").length, 1);
  assert.deepEqual(lastQuery(calls), {
    collection: { path: "contentPages" },
    constraints: [
      { kind: "where", field: "status", operator: "==", value: "published" },
      { kind: "limit", value: 100 },
    ],
  });
});

test("listContentPages maps then numerically sorts Firebase-selected documents, preserving stored id overwrite", async () => {
  const documents = [
    documentSnapshot("third", { id: "stored-third", order: 3 }),
    documentSnapshot("first", { order: 1 }),
    documentSnapshot("second", { order: 2 }),
  ];
  assert.deepEqual(await createHarness({ documents }).adapter.listContentPages(false), [
    { id: "first", order: 1 },
    { id: "second", order: 2 },
    { id: "stored-third", order: 3 },
  ]);
});

test("listContentPages returns an empty configured snapshot unchanged", async () => {
  assert.deepEqual(await createHarness().adapter.listContentPages(false), []);
});

test("listContentPages query, read, mapping, and sort failures propagate unchanged", async () => {
  const queryFailure = new Error("list query failure");
  const readFailure = new Error("list read failure");
  const mappingFailure = new Error("list mapping failure");
  await assert.rejects(createHarness({ queryError: queryFailure }).adapter.listContentPages(false), (error) => error === queryFailure);
  await assert.rejects(createHarness({ getDocsError: readFailure }).adapter.listContentPages(false), (error) => error === readFailure);
  await assert.rejects(createHarness({ documents: [{ id: "broken", data: () => { throw mappingFailure; } }] }).adapter.listContentPages(false), (error) => error === mappingFailure);
  await assert.rejects(createHarness({ documents: [documentSnapshot("a", { order: Symbol("a") }), documentSnapshot("b", { order: 1 })] }).adapter.listContentPages(false), TypeError);
});

test("the shipped selection resolves Firebase and a synthetic Supabase selection fails closed without invoking Firebase", async () => {
  let firebaseCalls = 0;
  const firebaseImplementation = {
    getPublishedContentPage: async () => { firebaseCalls += 1; return null; },
    getBrandingSettings: async () => { firebaseCalls += 1; return BRANDING_SETTINGS_FALLBACK; },
    getAdminOperationsSettings: async () => { firebaseCalls += 1; return createAdminOperationsSettingsFallback(); },
    listContentPages: async () => { firebaseCalls += 1; return []; },
  };
  const registry = new Map([["managed_content_config", new Map([["firebase", firebaseImplementation]])]]);
  const resolved = resolveProviderImplementation({ manifest: SHIPPED_PROVIDER_MANIFEST, feature: "managed_content_config", registry });
  assert.strictEqual(resolved, firebaseImplementation);
  assert.equal(await resolved.getPublishedContentPage("privacy-policy"), null);
  assert.equal(await resolved.getBrandingSettings(), BRANDING_SETTINGS_FALLBACK);
  assert.deepEqual(await resolved.getAdminOperationsSettings(), createAdminOperationsSettingsFallback());
  assert.deepEqual(await resolved.listContentPages(false), []);
  assert.equal(firebaseCalls, 4);
  assert.throws(() => resolveProviderImplementation({ manifest: manifestWithManagedContentAuthority("supabase"), feature: "managed_content_config", registry }), (error) => error instanceof ProviderResolverError && error.code === "provider_implementation_unsupported");
  assert.equal(firebaseCalls, 4);
});

test("listContentPages preserves Demo/local filtering before resolver and configured delegation without fallback", () => {
  assert.match(workspaceSource, /export async function listContentPages\(publishedOnly = false\) \{\s*if \(!isFirebaseConfigured\) return localRead<ContentPageRecord>\("contentPages"\)\.filter\(\(item\) => !publishedOnly \|\| item\.status === "published"\);\s*return resolveManagedContentConfigImplementation\(\)\.listContentPages\(publishedOnly\);\s*\}/);
  assert.doesNotMatch(workspaceSource, /listContentPages\(publishedOnly = false\)[\s\S]*?catch\s*\(/);
});

test("configured Branding resolves only after preserving its Demo/local raw-first-record branch", () => {
  assert.match(workspaceSource, /export async function getBrandingSettings\(\): Promise<BrandingSettings> \{\s*if \(!isFirebaseConfigured\) return localRead<BrandingSettings & \{ id: string \}>\("branding"\)\[0\] \|\| BRANDING_SETTINGS_FALLBACK;\s*return resolveManagedContentConfigImplementation\(\)\.getBrandingSettings\(\);\s*\}/);
  assert.doesNotMatch(workspaceSource, /getBrandingSettings\(\)[\s\S]*?catch\s*\(/);
  assert.doesNotMatch(workspaceSource, /getBrandingSettings\(\)[\s\S]*?\{\s*\.\.\.BRANDING_SETTINGS_FALLBACK/);
});

test("configured Admin Operations resolves only after preserving its Demo/local raw-first-record branch and fresh fallback", () => {
  assert.match(workspaceSource, /export async function getAdminOperationsSettings\(\): Promise<AdminOperationsSettings> \{\s*if \(!isFirebaseConfigured\) return localRead<AdminOperationsSettings & \{ id: string \}>\("adminOperations"\)\[0\] \|\| createAdminOperationsSettingsFallback\(\);\s*return resolveManagedContentConfigImplementation\(\)\.getAdminOperationsSettings\(\);\s*\}/);
  assert.doesNotMatch(workspaceSource, /getAdminOperationsSettings\(\)[\s\S]*?catch\s*\(/);
  assert.doesNotMatch(workspaceSource, /getAdminOperationsSettings\(\)[\s\S]*?\{\s*\.\.\.createAdminOperationsSettingsFallback/);
});

test("the configured published-content facade retains its existing Demo/local behavior", () => {
  assert.match(workspaceSource, /export async function getPublishedContentPage\(slug: string\) \{\s*if \(!isFirebaseConfigured\) return localRead<ContentPageRecord>\("contentPages"\)\.find\(\(item\) => item\.slug === slug && item\.status === "published"\) \|\| null;\s*return resolveManagedContentConfigImplementation\(\)\.getPublishedContentPage\(slug\);\s*\}/);
  assert.doesNotMatch(workspaceSource, /getPublishedContentPage\(slug: string\)[\s\S]*?catch\s*\(/);
});

test("the Demo/local helper preserves stored-order filtering and malformed-data behavior", () => {
  assert.match(workspaceSource, /function localRead<T>\(key: string\): T\[\] \{\s*try \{\s*return JSON\.parse\(localStorage\.getItem\(`\$\{localPrefix\}\$\{key\}`\) \|\| "\[\]"\) as T\[\];\s*\} catch \{\s*return \[\];\s*\}\s*\}/);
  assert.match(workspaceSource, /\.find\(\(item\) => item\.slug === slug && item\.status === "published"\) \|\| null/);
  assert.match(workspaceSource, /localRead<ContentPageRecord>\("contentPages"\)\.filter\(\(item\) => !publishedOnly \|\| item\.status === "published"\)/);
});

test("real production composition binds the shipped manifest, managed-content feature, and sole registry in one resolver call", () => {
  assert.match(adapterSource, /export interface ManagedContentConfigImplementation \{\s*getPublishedContentPage\(slug: string\): Promise<ContentPageRecord \| null>;\s*getBrandingSettings\(\): Promise<BrandingSettings>;\s*getAdminOperationsSettings\(\): Promise<AdminOperationsSettings>;\s*listContentPages\(publishedOnly\?: boolean\): Promise<ContentPageRecord\[\]>;\s*\}/);
  assert.equal((providerSource.match(/createFirebaseManagedContentConfigAdapter\(/g) || []).length, 1);
  assert.equal((providerSource.match(/\["managed_content_config", new Map/g) || []).length, 1);
  assert.match(providerSource, /resolveProviderImplementation\(\{\s*manifest: SHIPPED_PROVIDER_MANIFEST,\s*feature: "managed_content_config",\s*registry: managedContentConfigImplementations,\s*\}\)/);
  assert.equal((workspaceSource.match(/managed_content_config/g) || []).length, 0);
});

test("the adapter has no Firestore ordering, pagination, Demo, Supabase, retry, or import-time read capability", () => {
  assert.doesNotMatch(adapterSource, /orderBy|startAfter|endBefore|offset|onSnapshot|localStorage|supabase|retry|catch\s*\(/i);
  assert.match(adapterSource, /const contentPages = collection\(db, "contentPages"\);/);
  assert.match(adapterSource, /const settings = collection\(db, "settings"\);/);
  assert.match(adapterSource, /const branding = doc\(settings, "branding"\);/);
  assert.match(adapterSource, /const adminOperations = doc\(settings, "adminOperations"\);/);
});

test("callers, routes, adjacent writes, other settings, Rules, and indexes remain outside this adapter", () => {
  assert.match(publicCallerSource, /getPublishedContentPage\(slugs\[pageKey\]\)\.then\(setManaged\)\.catch\(\(\) => setManaged\(null\)\)/);
  assert.equal((brandingCallerSource.match(/getBrandingSettings\(/g) || []).length, 1);
  assert.match(brandingCallerSource, /void getBrandingSettings\(\)\.then\(setSettings\)/);
  assert.equal((brandingCallerSource.match(/getAdminOperationsSettings\(/g) || []).length, 1);
  assert.match(brandingCallerSource, /void getAdminOperationsSettings\(\)\.then\(setSettings\)/);
  assert.match(brandingCallerSource, /const load = async \(\) => setItems\(await listContentPages\(false\)\);/);
  assert.match(brandingCallerSource, /async function save\(\) \{ if \(!firebaseUser\) return; await saveContentPage\(\{ \.\.\.selected, updatedBy: firebaseUser\.uid \}\); setMessage\(text\.saved\); await load\(\); \}/);
  assert.match(appSource, /<Route path="super-admin\/content" element=\{<OwnerContentPage \/>\} \/>/);
  assert.match(authorizationSource, /if \(user\.role === "owner"\) return "super_admin";/);
  assert.match(disabledFileUploadSource, /disabled aria-disabled="true"/);
  assert.match(workspaceSource, /export async function saveBrandingSettings\(settings: BrandingSettings, actorId: string\) \{\s*const payload = \{ \.\.\.settings, assetUploadStatus: "upload_pending_launch" as const, updatedAt: isFirebaseConfigured \? serverTimestamp\(\) : nowIso\(\), updatedBy: actorId \};\s*if \(!isFirebaseConfigured\) return localUpsert\("branding", \{ id: "branding", \.\.\.payload \}\);\s*await setDoc\(doc\(settingsRef, "branding"\), payload, \{ merge: true \}\);\s*\}/);
  assert.match(workspaceSource, /export async function saveAdminOperationsSettings\(settings: AdminOperationsSettings, actorId: string\) \{\s*const payload = \{ \.\.\.settings, updatedAt: isFirebaseConfigured \? serverTimestamp\(\) : nowIso\(\), updatedBy: actorId \};\s*if \(!isFirebaseConfigured\) return localUpsert\("adminOperations", \{ id: "adminOperations", \.\.\.payload \}\);\s*await setDoc\(doc\(settingsRef, "adminOperations"\), payload, \{ merge: true \}\);\s*\}/);
  for (const operation of ["listContentPages", "saveContentPage", "getAdminOperationsSettings", "saveAdminOperationsSettings"]) assert.match(workspaceSource, new RegExp(`export async function ${operation}\\(`));
  for (const operation of ["getPlatformSettings", "savePlatformSettings"]) assert.match(firestoreFacadeSource, new RegExp(`export async function ${operation}\\(`));
  assert.doesNotMatch(adapterSource, /saveContentPage|saveAdminOperationsSettings|PlatformSettings|storage/i);
  assert.match(adapterSource, /async listContentPages\(publishedOnly = false\) \{\s*const snapshot = await getDocs\(publishedOnly\s*\? query\(contentPages, where\("status", "==", "published"\), limit\(100\)\)\s*: query\(contentPages, limit\(100\)\)\);\s*return snapshot\.docs\s*\.map\(\(item\) => withContentPageId\(item\)\)\s*\.sort\(\(a, b\) => a\.order - b\.order\);\s*\}/);
  assert.match(rulesSource, /match \/settings\/\{settingId\} \{\s*allow read: if signedIn\(\);/);
  assert.doesNotMatch(indexesSource, /contentPages|settings/);
});
