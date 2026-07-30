import type {
  AppUser,
  SupplierOwnershipClaimStatus,
  SupplierOwnershipEvidenceType,
} from "../types/domain";

export const supplierOwnershipStatuses: SupplierOwnershipClaimStatus[] = [
  "pending_review",
  "approved",
  "rejected",
  "withdrawn",
  "expired",
  "superseded",
];

export const supplierOwnershipEvidenceTypes: SupplierOwnershipEvidenceType[] = [
  "company_domain_email",
  "company_website",
  "commercial_registration",
  "authorization_letter",
  "other",
];

export type SupplierOwnershipErrorKey =
  | "feature_disabled"
  | "authentication_required"
  | "email_verification_required"
  | "ineligible_account"
  | "already_linked"
  | "active_claim_exists"
  | "supplier_already_owned"
  | "claim_expired"
  | "stale_claim"
  | "claim_conflict"
  | "rate_limited"
  | "unsafe_evidence"
  | "invalid_input"
  | "permission_denied"
  | "not_found"
  | "unavailable"
  | "internal_error";

export interface SupplierOwnershipValidationErrors {
  claimReason?: "required" | "length";
  evidenceType?: "required";
  evidenceSummary?: "required" | "length";
  referenceLinks?: "too_many" | "unsafe" | "duplicate";
}

export function supplierClaimEligibility(user: AppUser | null, emailVerified: boolean) {
  if (!user) return "authentication_required" as const;
  if (!emailVerified) return "email_verification_required" as const;
  if (user.supplierProfileId?.trim()) return "already_linked" as const;
  if (
    user.accountType !== "supplier"
    || user.role !== "contributor"
    || user.status !== "approved"
    || !["active", "temporary"].includes(user.accessStatus)
  ) {
    return "ineligible_account" as const;
  }
  return "eligible" as const;
}

export function normalizePublicHttpsLink(value: string) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized) return "";
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("unsafe");
  }
  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  const ipv4 = hostname.split(".").map(Number);
  const privateIpv4 = ipv4.length === 4
    && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && (
      ipv4[0] === 0
      || ipv4[0] === 10
      || ipv4[0] === 127
      || (ipv4[0] === 169 && ipv4[1] === 254)
      || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)
      || (ipv4[0] === 192 && ipv4[1] === 168)
    );
  const privateIpv6 = hostname === "::"
    || hostname === "::1"
    || /^f[cd][0-9a-f]{2}:/.test(hostname)
    || /^fe[89ab][0-9a-f]:/.test(hostname);
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || (url.port && url.port !== "443")
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || privateIpv4
    || privateIpv6
    || hostname.startsWith("::ffff:")
  ) {
    throw new Error("unsafe");
  }
  return url.toString();
}

export function validateSupplierOwnershipClaimForm(input: {
  claimReason: string;
  evidenceType: string;
  evidenceSummary: string;
  referenceLinks: string[];
}) {
  const errors: SupplierOwnershipValidationErrors = {};
  const claimReason = input.claimReason.normalize("NFKC").trim();
  const evidenceSummary = input.evidenceSummary.normalize("NFKC").trim();
  if (!claimReason) errors.claimReason = "required";
  else if (claimReason.length < 20 || claimReason.length > 1200) errors.claimReason = "length";
  if (!supplierOwnershipEvidenceTypes.includes(input.evidenceType as SupplierOwnershipEvidenceType)) {
    errors.evidenceType = "required";
  }
  if (!evidenceSummary) errors.evidenceSummary = "required";
  else if (evidenceSummary.length < 20 || evidenceSummary.length > 1600) errors.evidenceSummary = "length";
  const populatedLinks = input.referenceLinks.map((link) => link.trim()).filter(Boolean);
  if (populatedLinks.length > 3) {
    errors.referenceLinks = "too_many";
  } else {
    try {
      const normalizedLinks = populatedLinks.map(normalizePublicHttpsLink);
      if (new Set(normalizedLinks).size !== normalizedLinks.length) errors.referenceLinks = "duplicate";
    } catch {
      errors.referenceLinks = "unsafe";
    }
  }
  return errors;
}

export function supplierOwnershipPayloadSignature(input: {
  supplierProfileId: string;
  claimReason: string;
  evidenceType: string;
  evidenceSummary: string;
  referenceLinks: string[];
}) {
  return JSON.stringify({
    supplierProfileId: input.supplierProfileId,
    claimReason: input.claimReason.normalize("NFKC").trim(),
    evidenceType: input.evidenceType,
    evidenceSummary: input.evidenceSummary.normalize("NFKC").trim(),
    referenceLinks: input.referenceLinks.map((link) => link.trim()).filter(Boolean),
  });
}

export function generateSupplierOwnershipIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `claim-${crypto.randomUUID()}`;
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
    return `claim-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  throw new Error("IDEMPOTENCY_KEY_UNAVAILABLE");
}

function normalizedCallableError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown };
  return {
    code: typeof candidate?.code === "string" ? candidate.code.toLowerCase() : "",
    message: typeof candidate?.message === "string" ? candidate.message.toLowerCase() : String(error || "").toLowerCase(),
  };
}

export function mapSupplierOwnershipError(error: unknown): SupplierOwnershipErrorKey {
  const { code, message } = normalizedCallableError(error);
  if (message.includes("supplier_profile_claim_disabled") || message.includes("claims are disabled")) return "feature_disabled";
  if (code.includes("unauthenticated") || message.includes("authentication is required")) return "authentication_required";
  if (message.includes("verified firebase auth") || message.includes("token is stale") || message.includes("email verification")) return "email_verification_required";
  if (message.includes("already linked")) return "already_linked";
  if (message.includes("active ownership claim")) return "active_claim_exists";
  if (message.includes("already owned")) return "supplier_already_owned";
  if (message.includes("expired")) return "claim_expired";
  if (message.includes("lock is missing") || message.includes("stale") || message.includes("inconsistent")) return "stale_claim";
  if (message.includes("superseded") || message.includes("cannot transition") || message.includes("conflict")) return "claim_conflict";
  if (code.includes("resource-exhausted") || message.includes("rate limit") || message.includes("too many")) return "rate_limited";
  if (message.includes("reference link") || message.includes("https") || message.includes("public host")) return "unsafe_evidence";
  if (code.includes("invalid-argument") || message.includes("invalid")) return "invalid_input";
  if (code.includes("permission-denied")) {
    if (message.includes("eligible supplier")) return "ineligible_account";
    return "permission_denied";
  }
  if (code.includes("not-found")) return "not_found";
  if (code.includes("unavailable") || code.includes("deadline-exceeded") || message.includes("network") || message.includes("timeout")) return "unavailable";
  return "internal_error";
}

export function isRetryableSupplierOwnershipError(error: SupplierOwnershipErrorKey) {
  return error === "unavailable";
}

export function claimIsExpired(expiresAt: unknown, now = Date.now()) {
  if (
    expiresAt
    && typeof expiresAt === "object"
    && "toMillis" in expiresAt
    && typeof (expiresAt as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (expiresAt as { toMillis: () => number }).toMillis() <= now;
  }
  const parsed = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(String(expiresAt || ""));
  return !Number.isFinite(parsed) || parsed <= now;
}