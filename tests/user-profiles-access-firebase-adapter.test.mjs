import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PROVIDER_MANIFEST_SCHEMA,
  PROVIDER_MANIFEST_VERSION,
  ProviderResolverError,
  SHIPPED_PROVIDER_MANIFEST,
  resolveProviderImplementation,
} from "../src/services/providers/providerContract.ts";
import {
  createFirebaseUserProfilesAccessAdapter,
} from "../src/services/providers/userProfilesAccessFirebaseAdapter.ts";

const facadeSource = fs.readFileSync(
  new URL("../src/services/adminUsers.ts", import.meta.url),
  "utf8",
);

function firebaseAdapterDouble({ docs = [], error } = {}) {
  const calls = [];
  const collectionReference = { kind: "collection" };
  const order = { kind: "order" };
  const max = { kind: "limit" };
  const firestoreQuery = { kind: "query" };

  return {
    calls,
    adapter: createFirebaseUserProfilesAccessAdapter({
      db: { kind: "db" },
      collection: (db, path) => {
        calls.push(["collection", db, path]);
        return collectionReference;
      },
      orderBy: (field, direction) => {
        calls.push(["orderBy", field, direction]);
        return order;
      },
      limit: (value) => {
        calls.push(["limit", value]);
        return max;
      },
      query: (reference, ...constraints) => {
        calls.push(["query", reference, constraints]);
        return firestoreQuery;
      },
      getDocs: async (receivedQuery) => {
        calls.push(["getDocs", receivedQuery]);
        if (error) throw error;
        return { docs };
      },
    }),
  };
}

function manifestWithUserProfilesAuthority(authority) {
  return {
    schema: PROVIDER_MANIFEST_SCHEMA,
    version: PROVIDER_MANIFEST_VERSION,
    revision: "d4-test-manifest",
    entries: SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
      entry.feature === "user_profiles_access" ? { ...entry, authority } : entry
    )),
  };
}

test("the shipped user_profiles_access selection resolves and invokes only the Firebase adapter", async () => {
  const { adapter } = firebaseAdapterDouble();
  let adapterCalls = 0;
  const implementation = async () => {
    adapterCalls += 1;
    return adapter();
  };
  const registry = new Map([["user_profiles_access", new Map([["firebase", implementation]])]]);

  const resolved = resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "user_profiles_access",
    registry,
  });

  assert.strictEqual(resolved, implementation);
  assert.deepEqual(await resolved(), []);
  assert.equal(adapterCalls, 1);
});

test("a valid Supabase selection with no implementation fails closed and does not invoke Firebase", () => {
  let firebaseCalls = 0;
  const registry = new Map([["user_profiles_access", new Map([["firebase", () => {
    firebaseCalls += 1;
    return Promise.resolve([]);
  }]])]]);

  assert.throws(
    () => resolveProviderImplementation({
      manifest: manifestWithUserProfilesAuthority("supabase"),
      feature: "user_profiles_access",
      registry,
    }),
    (error) => error instanceof ProviderResolverError && error.code === "provider_implementation_unsupported",
  );
  assert.equal(firebaseCalls, 0);
});

test("the Firebase adapter preserves the Firestore users query and document-ID mapping", async () => {
  const docs = [
    { id: "z-user", data: () => ({ uid: "stored-uid", fullName: "Z", optional: undefined }) },
    { id: "a-user", data: () => ({ fullName: "A" }) },
  ];
  const { adapter, calls } = firebaseAdapterDouble({ docs });

  assert.deepEqual(await adapter(), [
    { uid: "z-user", fullName: "Z", optional: undefined },
    { uid: "a-user", fullName: "A" },
  ]);
  assert.deepEqual(calls.slice(0, 4).map(([name, ...args]) => [name, ...args.map((value) => (
    Array.isArray(value) ? value.map((item) => item.kind) : value?.kind || value
  ))]), [
    ["collection", "db", "users"],
    ["orderBy", "createdAt", "desc"],
    ["limit", 500],
    ["query", "collection", ["order", "limit"]],
  ]);
  assert.equal(calls[4][0], "getDocs");
});

test("the adapter leaves Firestore result ordering and boundary semantics untouched", async () => {
  const firestoreOrderedBoundary = Array.from({ length: 500 }, (_, index) => ({
    id: `tied-${String(500 - index).padStart(3, "0")}`,
    data: () => ({ createdAt: "same-timestamp", position: index }),
  }));
  const { adapter } = firebaseAdapterDouble({ docs: firestoreOrderedBoundary });

  const result = await adapter();
  assert.equal(result.length, 500);
  assert.deepEqual(result.map((item) => item.uid), firestoreOrderedBoundary.map((item) => item.id));
  assert.equal(result.some((item) => item.createdAt === undefined), false);
});

test("Firebase errors propagate without a Demo or alternate-provider substitute", async () => {
  const failure = new Error("synthetic Firestore failure");
  const { adapter } = firebaseAdapterDouble({ error: failure });
  await assert.rejects(adapter, failure);
});

test("the caller-facing facade keeps Demo/local explicit and provider choice internal", () => {
  assert.match(facadeSource, /if \(!isFirebaseConfigured\) return listUsers\(\);/);
  assert.match(facadeSource, /resolveProviderImplementation\(\{[\s\S]*feature: "user_profiles_access"/);
  assert.doesNotMatch(facadeSource, /supabase|catch\s*\(/i);
});
