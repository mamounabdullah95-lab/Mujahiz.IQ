export const PROVIDER_IDENTITIES = Object.freeze([
  "firebase",
  "supabase",
] as const);

export const PROVIDER_FEATURE_IDS = Object.freeze([
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
] as const);

export const PROVIDER_MANIFEST_SCHEMA = "mujahiz.provider-contract";
export const PROVIDER_MANIFEST_VERSION = 1;

export const PROVIDER_RESOLVER_ERROR_CODES = Object.freeze([
  "provider_config_missing",
  "provider_config_invalid",
  "provider_feature_unknown",
  "provider_identity_invalid",
  "provider_implementation_unsupported",
] as const);

export type ProviderIdentity = (typeof PROVIDER_IDENTITIES)[number];
export type ProviderFeatureId = (typeof PROVIDER_FEATURE_IDS)[number];
export type ProviderResolverErrorCode = (typeof PROVIDER_RESOLVER_ERROR_CODES)[number];

export interface ProviderManifestEntry {
  readonly feature: ProviderFeatureId;
  readonly authority: ProviderIdentity;
}

export interface ProviderManifest {
  readonly schema: typeof PROVIDER_MANIFEST_SCHEMA;
  readonly version: typeof PROVIDER_MANIFEST_VERSION;
  readonly revision: string;
  readonly entries: readonly ProviderManifestEntry[];
}

export type ProviderImplementationRegistry<TImplementation = unknown> = ReadonlyMap<
  ProviderFeatureId,
  ReadonlyMap<ProviderIdentity, TImplementation>
>;

export interface ResolveProviderImplementationInput<TImplementation = unknown> {
  readonly manifest: ProviderManifest | null | undefined;
  readonly feature: ProviderFeatureId;
  readonly registry: ProviderImplementationRegistry<TImplementation>;
}

export class ProviderResolverError extends Error {
  readonly code: ProviderResolverErrorCode;
  readonly messageKey: string;
  readonly feature?: ProviderFeatureId;
  readonly provider?: ProviderIdentity;

  constructor(code: ProviderResolverErrorCode, details: {
    feature?: ProviderFeatureId;
    provider?: ProviderIdentity;
  } = {}) {
    super(code);
    this.name = "ProviderResolverError";
    this.code = code;
    this.messageKey = `provider_contract.${code}`;
    this.feature = details.feature;
    this.provider = details.provider;
  }
}

function isProviderIdentity(value: unknown): value is ProviderIdentity {
  return typeof value === "string" && PROVIDER_IDENTITIES.includes(value as ProviderIdentity);
}

function isProviderFeatureId(value: unknown): value is ProviderFeatureId {
  return typeof value === "string" && PROVIDER_FEATURE_IDS.includes(value as ProviderFeatureId);
}

function manifestError(manifest: unknown): ProviderResolverErrorCode | undefined {
  if (!manifest || typeof manifest !== "object") return "provider_config_invalid";

  const candidate = manifest as Partial<ProviderManifest>;
  if (
    candidate.schema !== PROVIDER_MANIFEST_SCHEMA
    || candidate.version !== PROVIDER_MANIFEST_VERSION
    || typeof candidate.revision !== "string"
    || candidate.revision.length === 0
    || !Array.isArray(candidate.entries)
  ) {
    return "provider_config_invalid";
  }

  const seenFeatures = new Set<ProviderFeatureId>();
  for (const entry of candidate.entries) {
    if (!entry || typeof entry !== "object" || !isProviderFeatureId(entry.feature)) {
      return "provider_config_invalid";
    }
    if (!isProviderIdentity(entry.authority)) return "provider_identity_invalid";
    if (seenFeatures.has(entry.feature)) return "provider_config_invalid";
    seenFeatures.add(entry.feature);
  }

  if (
    candidate.entries.length !== PROVIDER_FEATURE_IDS.length
    || seenFeatures.size !== PROVIDER_FEATURE_IDS.length
  ) {
    return "provider_config_invalid";
  }

  return undefined;
}

function frozenFirebaseManifest(): ProviderManifest {
  const entries = PROVIDER_FEATURE_IDS.map((feature) => Object.freeze({
    feature,
    authority: "firebase" as const,
  }));

  return Object.freeze({
    schema: PROVIDER_MANIFEST_SCHEMA,
    version: PROVIDER_MANIFEST_VERSION,
    revision: "firebase-all-v1",
    entries: Object.freeze(entries),
  });
}

export const SHIPPED_PROVIDER_MANIFEST = frozenFirebaseManifest();

export function resolveProviderImplementation<TImplementation>({
  manifest,
  feature,
  registry,
}: ResolveProviderImplementationInput<TImplementation>): TImplementation {
  if (manifest === null || manifest === undefined) {
    throw new ProviderResolverError("provider_config_missing");
  }

  const configurationError = manifestError(manifest);
  if (configurationError) throw new ProviderResolverError(configurationError);

  if (!isProviderFeatureId(feature)) {
    throw new ProviderResolverError("provider_feature_unknown");
  }

  const selected = manifest.entries.find((entry) => entry.feature === feature);
  if (!selected) {
    throw new ProviderResolverError("provider_feature_unknown", { feature });
  }

  const implementations = registry.get(feature);
  if (!implementations || !implementations.has(selected.authority)) {
    throw new ProviderResolverError("provider_implementation_unsupported", {
      feature,
      provider: selected.authority,
    });
  }

  return implementations.get(selected.authority) as TImplementation;
}
