export const CLAIM_TTL_DAYS = 30;
export const MAX_REFERENCE_LINKS = 3;
export const MAX_CONFLICTING_CLAIMS = 20;
export const MAX_SEARCH_RESULTS = 10;
export const MAX_SEARCH_READS = 25;

const ARABIC_COMMON_WORDS = new Set([
  "\u0634\u0631\u0643\u0647", "\u0645\u0643\u062a\u0628", "\u0645\u062c\u0645\u0648\u0639\u0647",
  "\u0644\u0644\u062a\u062c\u0627\u0631\u0647", "\u0627\u0644\u062a\u062c\u0627\u0631\u0647",
  "\u0627\u0644\u0639\u0627\u0645\u0647", "\u0627\u0644\u0645\u062d\u062f\u0648\u062f\u0647",
  "\u0644\u0644\u0645\u0642\u0627\u0648\u0644\u0627\u062a", "\u0645\u062c\u0647\u0632",
  "\u0645\u062c\u0647\u064a\u0632", "\u0645\u0624\u0633\u0633\u0647",
]);

const ENGLISH_COMMON_WORDS = new Set([
  "company", "co", "ltd", "llc", "trading", "general", "group", "office", "services",
  "contracting", "corp", "corporation",
]);

export const EVIDENCE_TYPES = Object.freeze([
  "company_domain_email",
  "company_website",
  "commercial_registration",
  "authorization_letter",
  "other",
]);

export const TERMINAL_CLAIM_STATUSES = Object.freeze([
  "approved",
  "rejected",
  "withdrawn",
  "expired",
  "superseded",
]);

export class OwnershipValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OwnershipValidationError";
    this.code = code;
  }
}

export function sanitizeBoundedText(value, fieldName, minimumLength, maximumLength) {
  if (typeof value !== "string") {
    throw new OwnershipValidationError("invalid-argument", `${fieldName} must be a string.`);
  }
  const sanitized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (sanitized.length < minimumLength || sanitized.length > maximumLength) {
    throw new OwnershipValidationError(
      "invalid-argument",
      `${fieldName} must contain ${minimumLength}-${maximumLength} characters.`,
    );
  }
  return sanitized;
}

export function validateEvidenceType(value) {
  if (!EVIDENCE_TYPES.includes(value)) {
    throw new OwnershipValidationError("invalid-argument", "Unsupported evidenceType.");
  }
  return value;
}

export function validateReferenceLinks(value) {
  if (!Array.isArray(value) || value.length > MAX_REFERENCE_LINKS) {
    throw new OwnershipValidationError(
      "invalid-argument",
      `referenceLinks must contain no more than ${MAX_REFERENCE_LINKS} links.`,
    );
  }
  const seen = new Set();
  return value.map((candidate) => {
    const normalized = sanitizeBoundedText(candidate, "referenceLink", 1, 500);
    let url;
    try {
      url = new URL(normalized);
    } catch {
      throw new OwnershipValidationError("invalid-argument", "Each reference link must be a valid HTTPS URL.");
    }
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new OwnershipValidationError("invalid-argument", "Each reference link must be an HTTPS URL without credentials.");
    }
    const canonical = url.toString();
    if (seen.has(canonical)) {
      throw new OwnershipValidationError("invalid-argument", "Duplicate reference links are not allowed.");
    }
    seen.add(canonical);
    return canonical;
  });
}

export function validateClaimInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OwnershipValidationError("invalid-argument", "Claim input must be an object.");
  }
  return {
    supplierProfileId: validateDocumentId(value.supplierProfileId, "supplierProfileId"),
    claimReason: sanitizeBoundedText(value.claimReason, "claimReason", 20, 1200),
    evidenceType: validateEvidenceType(value.evidenceType),
    evidenceSummary: sanitizeBoundedText(value.evidenceSummary, "evidenceSummary", 20, 1600),
    referenceLinks: validateReferenceLinks(value.referenceLinks ?? []),
  };
}

export function normalizeSupplierSearchQuery(value) {
  const text = sanitizeBoundedText(value, "query", 2, 80);
  const arabic = text
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/[^\u0600-\u06FF0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !ARABIC_COMMON_WORDS.has(word))
    .join(" ")
    .trim();
  const english = text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !ENGLISH_COMMON_WORDS.has(word))
    .join(" ")
    .trim();
  const normalized = `${arabic} ${english}`.replace(/\s+/g, " ").trim();
  if (normalized.length < 2 || normalized.length > 80) {
    throw new OwnershipValidationError("invalid-argument", "query must normalize to 2-80 characters.");
  }
  return normalized;
}

export function validateSearchMode(value) {
  if (value !== "exact" && value !== "prefix") {
    throw new OwnershipValidationError("invalid-argument", "mode must be exact or prefix.");
  }
  return value;
}

export function validateDocumentId(value, fieldName = "documentId") {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 128
    || value.includes("/")
    || value === "."
    || value === ".."
  ) {
    throw new OwnershipValidationError("invalid-argument", `${fieldName} is invalid.`);
  }
  return value;
}

export function resolveDecisionTransition(currentStatus, decision) {
  const targetStatus = decision === "approve"
    ? "approved"
    : decision === "reject"
      ? "rejected"
      : null;
  if (!targetStatus) {
    throw new OwnershipValidationError("invalid-argument", "decision must be approve or reject.");
  }
  if (currentStatus === "pending_review") {
    return { targetStatus, idempotent: false };
  }
  if (currentStatus === targetStatus) {
    return { targetStatus, idempotent: true };
  }
  throw new OwnershipValidationError(
    "failed-precondition",
    `A ${currentStatus} claim cannot transition to ${targetStatus}.`,
  );
}

export function ownershipEventId(claimId, status) {
  return `supplier-ownership-${validateDocumentId(claimId, "claimId")}-${status}`;
}

export function ownershipAuditId(claimId, status) {
  return `${ownershipEventId(claimId, status)}-audit`;
}

export function ownershipNotificationId(claimId, status) {
  return `${ownershipEventId(claimId, status)}-notification`;
}

export function submissionSideEffectId(submissionId, suffix) {
  return `supplier-submission-${validateDocumentId(submissionId, "submissionId")}-${suffix}`;
}
export function isClaimExpired(expiresAtMillis, nowMillis = Date.now()) {
  return !Number.isFinite(expiresAtMillis) || expiresAtMillis <= nowMillis;
}

export function terminalStatusReleasesLock(status) {
  return TERMINAL_CLAIM_STATUSES.includes(status);
}
