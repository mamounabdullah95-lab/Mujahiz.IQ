import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = read("src/AppV2.tsx");
const features = read("src/config/features.ts");
const navigation = read("src/config/portalNavigation.ts");
const dashboard = read("src/pages/SupplierDashboardPage.tsx");
const dashboardCard = read("src/components/supplierOwnership/SupplierOwnershipDashboardCard.tsx");
const service = read("src/services/supplierOwnership.ts");
const supplierPage = read("src/pages/supplier/SupplierOwnershipClaimPage.tsx");
const historyPage = read("src/pages/supplier/SupplierOwnershipClaimHistoryPage.tsx");
const adminQueue = read("src/pages/admin/AdminSupplierOwnershipClaimsPage.tsx");
const adminDetail = read("src/pages/admin/SupplierOwnershipClaimDetailPage.tsx");
const components = read("src/components/supplierOwnership/SupplierOwnershipComponents.tsx");
const uiCore = read("src/utils/supplierOwnershipUi.ts");
const copy = read("src/config/supplierOwnershipCopy.ts");
const envExample = read(".env.example");

function gatedBlock(source, needle) {
  const gateIndex = source.lastIndexOf("features.supplierProfileClaim", source.indexOf(needle));
  assert.ok(gateIndex >= 0, `${needle} is not behind the claim feature gate`);
  return source.slice(gateIndex, source.indexOf(needle) + needle.length);
}

test("claim routes, navigation, and dashboard entry are fail-closed behind the existing client gate", () => {
  assert.match(features, /supplierProfileClaim: isStrictlyEnabled\(import\.meta\.env\.VITE_SUPPLIER_PROFILE_CLAIM_ENABLED\)/);
  for (const route of ["supplier/claim-company", "supplier/ownership-claims", "admin/ownership-claims", "admin/ownership-claims/:claimId"]) {
    assert.match(gatedBlock(app, `path=\"${route}\"`), /features\.supplierProfileClaim/);
  }
  for (const target of ["/supplier/claim-company", "/admin/ownership-claims"]) {
    assert.match(gatedBlock(navigation, `to: \"${target}\"`), /features\.supplierProfileClaim/);
  }
  assert.match(dashboard, /features\.supplierProfileClaim \? <SupplierOwnershipDashboardCard \/> : null/);
  assert.match(envExample, /VITE_SUPPLIER_PROFILE_CLAIM_ENABLED=false/);
  assert.doesNotMatch(envExample, /VITE_SUPPLIER_PROFILE_CLAIM_ENABLED=true/);
});

test("Supplier and Admin ownership routes preserve separate role guards", () => {
  assert.match(app, /features\.supplierProfileClaim[\s\S]*?allowedRoles=\{supplierRoles\}[\s\S]*?supplier\/claim-company/);
  assert.match(app, /features\.supplierProfileClaim[\s\S]*?allowedRoles=\{adminRoles\}[\s\S]*?admin\/ownership-claims/);
  assert.doesNotMatch(app, /supplier\/claim-company[\s\S]{0,200}allowPending/);
});

test("ownership reads are gated, bounded, and match the merged indexed query shapes", () => {
  assert.match(service, /function requireClaimReads\(\)[\s\S]*?features\.supplierProfileClaim[\s\S]*?isFirebaseConfigured/);
  assert.match(service, /where\("claimantUserId", "==", claimantUserId\)[\s\S]*?orderBy\("createdAt", "desc"\)/);
  assert.match(service, /where\("status", "==", status\)[\s\S]*?orderBy\("createdAt", "desc"\)/);
  assert.match(service, /where\("supplierProfileId", "==", supplierProfileId\)[\s\S]*?where\("status", "==", status\)[\s\S]*?orderBy\("createdAt", "desc"\)/);
  assert.match(service, /boundedPageSize\(pageSize\)/);
  assert.match(adminQueue, /listAdminSupplierOwnershipClaims\(status, 25/);
  assert.match(adminDetail, /listSupplierProfileOwnershipClaims\(loadedClaim\.supplierProfileId, "pending_review", 21\)/);
});

test("claim search and all ownership state changes use trusted callable Functions only", () => {
  for (const callable of [
    "searchSupplierProfilesForClaim",
    "createSupplierOwnershipClaim",
    "withdrawSupplierOwnershipClaim",
    "decideSupplierOwnershipClaim",
  ]) assert.match(service, new RegExp(`httpsCallable[\\s\\S]*?\"${callable}\"`));
  assert.doesNotMatch(service, /\b(?:setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\b/);
  assert.doesNotMatch(supplierPage + adminDetail, /\b(?:setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\b/);
});

test("Supplier search is debounced, bounded, and renders only the safe callable projection", () => {
  assert.match(supplierPage, /SEARCH_DEBOUNCE_MS = 650/);
  assert.match(supplierPage, /window\.setTimeout\(\(\) => \{ void runSearch/);
  assert.match(supplierPage, /searchSupplierProfilesForClaim\(normalizedQuery, "prefix"\)/);
  assert.match(supplierPage, /setSearchResults\(items\.slice\(0, 10\)\)/);
  assert.doesNotMatch(supplierPage, /result\.(?:email|phone|normalizedName|accountOwnerId|claimantUserId|uid)/);
  for (const safeField of ["nameAr", "nameEn", "governorate", "city", "website"]) assert.match(supplierPage, new RegExp(`result\\.${safeField}`));
});

test("claim form mirrors backend bounds and rejects unsafe, private, duplicate, or excessive evidence links", () => {
  assert.match(uiCore, /claimReason\.length < 20 \|\| claimReason\.length > 1200/);
  assert.match(uiCore, /evidenceSummary\.length < 20 \|\| evidenceSummary\.length > 1600/);
  assert.match(uiCore, /populatedLinks\.length > 3/);
  assert.match(uiCore, /url\.protocol !== "https:"/);
  assert.match(uiCore, /hostname === "localhost"/);
  assert.match(uiCore, /hostname\.startsWith\("::ffff:"\)/);
  assert.match(uiCore, /ipv4\[0\] === 10/);
  assert.match(uiCore, /new Set\(normalizedLinks\)\.size !== normalizedLinks\.length/);
  assert.doesNotMatch(supplierPage, /type="file"|FileReader|Base64|firebase\/storage/);
});

test("claim submission preserves one idempotency key across retry and blocks duplicate clicks", () => {
  assert.match(supplierPage, /submissionAttemptRef = useRef<\{ signature: string; key: string \}/);
  assert.match(supplierPage, /submissionAttemptRef\.current\.signature !== signature/);
  assert.match(supplierPage, /idempotencyKey: submissionAttemptRef\.current\.key/);
  assert.match(supplierPage, /if \(!isRetryableSupplierOwnershipError\(semanticError\)\) submissionAttemptRef\.current = null/);
  assert.match(supplierPage, /if \(submitting \|\| !selected\)/);
  assert.match(supplierPage, /disabled=\{submitting\}/);
  assert.match(uiCore, /crypto\.randomUUID/);
});

test("Supplier journey handles eligibility, pending status, withdrawal, history, and canonical refresh", () => {
  assert.match(uiCore, /user\.accountType !== "supplier"[\s\S]*?user\.role !== "contributor"[\s\S]*?user\.status !== "approved"/);
  assert.match(uiCore, /\["active", "temporary"\]\.includes\(user\.accessStatus\)/);
  assert.match(supplierPage, /claims\.find\(\(claim\) => claim\.status === "pending_review"\)/);
  assert.match(supplierPage, /withdrawSupplierOwnershipClaim\(pendingClaim\.id\)/);
  assert.match(supplierPage, /DecisionConfirmation[\s\S]*?confirmWithdraw/);
  assert.match(supplierPage, /await refreshUser\(\)/);
  assert.match(historyPage, /listMySupplierOwnershipClaims\(firebaseUser\.uid, 20/);
  assert.match(dashboardCard, /linked[\s\S]*?pending[\s\S]*?terminal[\s\S]*?eligibility/);
});

test("Admin and Owner decisions require confirmation, reject notes, stale refresh, and terminal read-only behavior", () => {
  assert.match(adminDetail, /requestDecision\(nextDecision: "approve" \| "reject"\)/);
  assert.match(adminDetail, /nextDecision === "reject" && !notes\.trim\(\)/);
  assert.match(adminDetail, /decideSupplierOwnershipClaim\(claim\.id, requestedDecision, notes\.trim\(\)\)/);
  assert.match(adminDetail, /claim\.status !== "pending_review" \|\| claimIsExpired\(claim\.expiresAt\)/);
  assert.match(adminDetail, /\["stale_claim", "claim_conflict", "claim_expired", "supplier_already_owned"\]/);
  assert.match(adminDetail, /await load\(\);[\s\S]*?setError\(semanticError\);/);
  assert.match(adminDetail, /disabled=\{busy\}/);
  assert.match(adminDetail, /pending \? <div[\s\S]*?: <p[\s\S]*?terminal/);
  assert.match(components, /aria-modal="true"[\s\S]*?role="dialog"/);
});

test("external evidence links are never embedded or previewed and open with safe rel attributes", () => {
  assert.match(components, /rel="noopener noreferrer nofollow"/);
  assert.match(components, /target="_blank"/);
  assert.doesNotMatch(components + adminDetail, /iframe|embed|object|fetch\(|link preview/i);
  assert.match(adminDetail, /SafeEvidenceLinks links=\{claim\.referenceLinks \|\| \[\]\}/);
});

test("callable errors remain semantic until render and cover required safe states", () => {
  for (const key of [
    "feature_disabled", "authentication_required", "email_verification_required", "ineligible_account",
    "already_linked", "active_claim_exists", "supplier_already_owned", "claim_expired", "stale_claim",
    "claim_conflict", "rate_limited", "unsafe_evidence", "invalid_input", "permission_denied",
    "not_found", "unavailable", "internal_error",
  ]) {
    assert.match(uiCore, new RegExp(`\"${key}\"`));
    assert.match(copy, new RegExp(`${key}:`));
  }
  assert.match(supplierPage, /setError\(mapSupplierOwnershipError\(caught\)\)/);
  assert.match(adminDetail, /text\.errors\[error\]/);
  assert.doesNotMatch(supplierPage + adminQueue + adminDetail, /caught\.message|error\.message|JSON\.stringify\(caught/);
});

test("Arabic and English ownership UI are complete and direction-safe", () => {
  assert.match(copy, /const en = \{/);
  assert.match(copy, /direction: "ltr"/);
  assert.match(copy, /const ar = \{/);
  assert.match(copy, /direction: "rtl"/);
  for (const status of ["pending_review", "approved", "rejected", "withdrawn", "expired", "superseded"]) {
    assert.equal((copy.match(new RegExp(`${status}:`, "g")) || []).length >= 2, true, `missing bilingual ${status}`);
  }
  for (const page of [supplierPage, historyPage, adminQueue, adminDetail]) {
    assert.match(page, /dir=\{text\.direction\}/);
    assert.match(page, /i18n\.language\.startsWith\("ar"\) \? "ar" : "en"/);
  }
});