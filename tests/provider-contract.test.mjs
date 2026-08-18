import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PROVIDER_FEATURE_IDS,
  PROVIDER_IDENTITIES,
  PROVIDER_MANIFEST_SCHEMA,
  PROVIDER_MANIFEST_VERSION,
  PROVIDER_RESOLVER_ERROR_CODES,
  ProviderResolverError,
  SHIPPED_PROVIDER_MANIFEST,
  resolveProviderImplementation,
} from "../src/services/providers/providerContract.ts";

const kernelSource = fs.readFileSync(
  new URL("../src/services/providers/providerContract.ts", import.meta.url),
  "utf8",
);

function registryFor(feature, provider, reference) {
  return new Map([[feature, new Map([[provider, reference]])]]);
}

function manifestWith(entries = SHIPPED_PROVIDER_MANIFEST.entries) {
  return {
    schema: PROVIDER_MANIFEST_SCHEMA,
    version: PROVIDER_MANIFEST_VERSION,
    revision: "test-manifest-v1",
    entries,
  };
}

function resolverCode(action) {
  assert.throws(action, (error) => error instanceof ProviderResolverError);
  try {
    action();
  } catch (error) {
    return error.code;
  }
  throw new Error("Expected resolver to throw");
}

test("the closed vocabulary contains exactly the approved providers and 17 unique feature IDs", () => {
  assert.deepEqual(PROVIDER_IDENTITIES, ["firebase", "supabase"]);
  assert.deepEqual(PROVIDER_FEATURE_IDS, [
    "auth_identity",
    "user_profiles_access",
    "supplier_directory",
    "supplier_taxonomy_dictionary",
    "supplier_reviews",
    "supplier_feedback",
    "supplier_favorites",
    "supplier_submissions",
    "supplier_ownership_claims",
    "rfq_quotations",
    "notification_inbox",
    "conversations_messages",
    "supplier_private_catalog",
    "managed_content_config",
    "operational_reporting",
    "audit_evidence",
    "supplier_search_ai_intent",
  ]);
  assert.equal(new Set(PROVIDER_FEATURE_IDS).size, 17);
});

test("the shipped manifest is complete, explicit, deterministic, and deeply immutable", () => {
  assert.equal(SHIPPED_PROVIDER_MANIFEST.entries.length, 17);
  assert.deepEqual(
    SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => entry.feature),
    PROVIDER_FEATURE_IDS,
  );
  assert.ok(SHIPPED_PROVIDER_MANIFEST.entries.every((entry) => entry.authority === "firebase"));
  assert.ok(Object.isFrozen(SHIPPED_PROVIDER_MANIFEST));
  assert.ok(Object.isFrozen(SHIPPED_PROVIDER_MANIFEST.entries));
  assert.ok(SHIPPED_PROVIDER_MANIFEST.entries.every(Object.isFrozen));
  assert.throws(() => {
    SHIPPED_PROVIDER_MANIFEST.entries[0].authority = "supabase";
  }, TypeError);
});

test("the resolver exposes only the five approved configuration and resolution errors", () => {
  assert.deepEqual(PROVIDER_RESOLVER_ERROR_CODES, [
    "provider_config_missing",
    "provider_config_invalid",
    "provider_feature_unknown",
    "provider_identity_invalid",
    "provider_implementation_unsupported",
  ]);
});

test("missing, malformed, wrong-version, duplicate, and conflicting manifests fail closed", () => {
  const feature = "auth_identity";
  const reference = {};
  const registry = registryFor(feature, "firebase", reference);
  assert.equal(resolverCode(() => resolveProviderImplementation({ manifest: undefined, feature, registry })), "provider_config_missing");
  assert.equal(resolverCode(() => resolveProviderImplementation({ manifest: {}, feature, registry })), "provider_config_invalid");
  assert.equal(resolverCode(() => resolveProviderImplementation({
    manifest: { ...manifestWith(), version: 2 }, feature, registry,
  })), "provider_config_invalid");
  assert.equal(resolverCode(() => resolveProviderImplementation({
    manifest: manifestWith([...SHIPPED_PROVIDER_MANIFEST.entries, SHIPPED_PROVIDER_MANIFEST.entries[0]]), feature, registry,
  })), "provider_config_invalid");
  assert.equal(resolverCode(() => resolveProviderImplementation({
    manifest: manifestWith([...SHIPPED_PROVIDER_MANIFEST.entries, { feature, authority: "supabase" }]), feature, registry,
  })), "provider_config_invalid");
});

test("unknown or missing requested features and invalid provider identities are rejected", () => {
  const registry = new Map();
  assert.equal(resolverCode(() => resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST, feature: "not_a_feature", registry,
  })), "provider_feature_unknown");
  assert.equal(resolverCode(() => resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST, feature: undefined, registry,
  })), "provider_feature_unknown");
  for (const provider of ["demo", "emulator", "local", "auto", "default"]) {
    const entries = SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
      entry.feature === "auth_identity" ? { ...entry, authority: provider } : entry
    ));
    assert.equal(resolverCode(() => resolveProviderImplementation({
      manifest: manifestWith(entries), feature: "auth_identity", registry,
    })), "provider_identity_invalid", provider);
  }
});

test("a recognized but unregistered implementation fails closed without Firebase fallback", () => {
  const entries = SHIPPED_PROVIDER_MANIFEST.entries.map((entry) => (
    entry.feature === "auth_identity" ? { ...entry, authority: "supabase" } : entry
  ));
  const firebaseReference = () => {
    throw new Error("Firebase reference must not be invoked");
  };
  const registry = registryFor("auth_identity", "firebase", firebaseReference);
  assert.equal(resolverCode(() => resolveProviderImplementation({
    manifest: manifestWith(entries), feature: "auth_identity", registry,
  })), "provider_implementation_unsupported");
});

test("the resolver returns exactly the selected reference and never invokes it or alternatives", () => {
  let selectedCalls = 0;
  let alternateCalls = 0;
  const selectedReference = () => {
    selectedCalls += 1;
  };
  const alternateReference = () => {
    alternateCalls += 1;
  };
  const registry = new Map([
    ["auth_identity", new Map([["firebase", selectedReference], ["supabase", alternateReference]])],
    ["supplier_directory", new Map([["firebase", alternateReference]])],
  ]);
  const resolved = resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "auth_identity",
    registry,
  });
  assert.strictEqual(resolved, selectedReference);
  assert.equal(selectedCalls, 0);
  assert.equal(alternateCalls, 0);
});

test("the kernel has no runtime provider capability, environment selector, or dynamic provider import", () => {
  assert.doesNotMatch(kernelSource, /from\s+["']firebase|from\s+["']@supabase|import\s*\(/);
  assert.doesNotMatch(kernelSource, /VITE_|fetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(kernelSource, /Promise\.(any|race)|fallback|dual-write/i);
});
