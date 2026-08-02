# Storage migration plan

## Current-state finding

- **[Verified current fact]** The Firebase project-level Storage API returned zero buckets on 2026-08-03; therefore there are no Firebase Storage objects to copy from that project at this baseline.
- **[Verified current fact]** The frontend does not import `firebase/storage` and `src/services/uploadService.ts` contains no Storage adapter. File uploads fail closed even if the flag is accidentally enabled.
- **[Verified current fact]** `.env.example` sets `VITE_FILE_UPLOADS_ENABLED=false`; actual secret-bearing local environment values were not inspected.
- **[Verified current fact]** `firebase.json` has no Storage Rules target and no `storage.rules` file is present.
- **[Verified current fact]** Firestore Rules reject `fileUrl`, `downloadUrl`, `storagePath`, raw file/workbook fields, Base64, Blob, bytes, and similar payloads on protected records.
- **[Verified current fact]** Current file-adjacent fields are placeholders or metadata: RFQ/quotation/message `attachmentStatus=upload_pending_launch`, product `mediaStatus=upload_pending_launch`, Supplier document `storageStatus=metadata_only|upload_pending_launch`, and HTTPS `referenceLinks[]` on RFQs/quotations/claims.
- **[Verified current fact]** Supplier Excel workbooks are read locally in the browser, limited to 200 KB, and never persisted or uploaded. They are import inputs, not Storage migration objects.
- **[Unknown]** Supabase Storage buckets/policies/objects could not be inventoried because no authenticated Supabase read path was available.

## Scope decision

- **[Future plan]** The initial database migration has no Firebase object-copy workload under the verified baseline. Storage remains a separately approved feature, not an implied part of adding PostgreSQL.
- **[Future plan]** If future evidence finds objects in another approved bucket/project or uploads are enabled before migration, refresh the inventory and use the copy/verify/cutover procedure below.
- **[Future plan]** Do not treat external `referenceLinks` as owned files. Preserve them as external references unless a separately approved ingestion/licensing/security process applies.

## Proposed ownership model

| File purpose | Proposed ownership and visibility |
|---|---|
| Supplier document/evidence | **[Future plan]** Private by default; owned by Supplier profile and uploading user; Admin/Owner review access is explicit and audited. |
| Claim evidence | **[Future plan]** Private; claimant plus authorized reviewer only; terminal retention policy required. |
| RFQ attachment | **[Future plan]** Buyer-owned; accessible only to eligible targeted Suppliers and authorized operations staff. |
| Quotation attachment | **[Future plan]** Supplier-owned; accessible only to RFQ Buyer, submitting Supplier, and authorized operations staff. |
| Message attachment | **[Future plan]** Conversation-scoped; every download revalidates current participant eligibility. |
| Product media/logo | **[Future plan]** Public only after moderation/approval; original/private upload remains separate from public derivative. |
| Import workbook | **[Future plan]** Continue browser-local processing; do not upload/store unless a later explicit compliance requirement changes the contract. |
| Branding/content assets | **[Future plan]** Owner-managed; public published derivatives may be public, source assets remain controlled. |

## Bucket and path principles

- **[Future plan]** Prefer purpose-separated buckets where policy/retention differs; examples: private documents, private RFQ/quotation attachments, private messaging, and public approved media.
- **[Future plan]** Keep buckets private by default. Public access is an explicit product/security decision, never inherited from a client-supplied URL.
- **[Future plan]** Use opaque immutable object keys such as `<tenant-or-profile>/<entity>/<file-id>/<version>`; never use email, phone, user-provided company name, or original filename as an authorization key.
- **[Future plan]** Store safe original filename and display metadata in `uploaded_files`, not as the canonical object path.
- **[Future plan]** A database row owns the object. Bucket policies verify JWT identity plus relational ownership/participant/recipient state; the path alone is insufficient.
- **[Future plan]** Replacing a file creates a new version/object. Do not overwrite a verified object in place.

## MIME, size, and content controls

- **[Future plan]** Define an allowlist per purpose, not one platform-wide list. Validate extension, declared MIME, detected MIME/magic bytes, and size on a trusted path.
- **[Future plan]** Reject executables, active content, macro-enabled Office content, embedded objects, archives where not required, HTML/SVG where script risk is unacceptable, and polyglot/mismatched content.
- **[Future plan]** Apply malware scanning/quarantine before a file becomes `ready` or receives a download capability.
- **[Future plan]** Preserve the current 200 KB/`.xlsx`/safe-ZIP contract for Supplier imports; imports continue to avoid object storage.
- **[Future plan]** Establish purpose-specific limits for Supplier documents, RFQ/quotation/message attachments, images, and branding before any upload implementation.
- **[Future plan]** Never trust client-calculated hash, MIME, owner, bucket, path, scan status, verification status, or public flag.

## Hash manifest

**[Future plan]** A copy manifest must contain only the minimum operational metadata and must be protected as migration data:

| Field | Requirement |
|---|---|
| Source identity | Provider, bucket, opaque object key/version/generation; do not print private paths in routine PR reports. |
| Target identity | Supabase bucket and opaque object key/version. |
| Ownership | Mapped `uploaded_files.id`, owner/entity IDs, purpose, visibility class. |
| Content verification | Byte length and SHA-256 (or approved stronger equivalent) computed from source and target bytes. |
| Metadata verification | Detected MIME, original safe filename, creation time, source generation/ETag where meaningful. |
| State | `discovered`, `copied`, `verified`, `quarantined`, `failed`, `cutover_ready`, `cutover_complete`, `rollback_retained`. |
| Attempt/audit | Idempotency key, attempt count, tool version, operator/task ID, timestamps, redacted error code. |

- **[Future plan]** The manifest itself must never contain credentials, signed URLs, download tokens, database passwords, service-role keys, message bodies, or file contents.
- **[Future plan]** Re-running a copy uses the source generation plus target file ID as an idempotency key and never creates an untracked duplicate.

## Copy → Verify → Cutover workflow

1. **[Future plan]** Freeze the approved source inventory at a checkpoint without changing source objects.
2. **[Future plan]** Build the protected manifest and reconcile source object count/size against database file references.
3. **[Future plan]** Resolve every owner/entity mapping; quarantine orphaned or ambiguous references.
4. **[Future plan]** Copy bytes to private target objects with new opaque keys. Do not delete or move the source.
5. **[Future plan]** Re-read target bytes or a trusted provider checksum, verify byte length and hash, and validate MIME/scan state.
6. **[Future plan]** Test Storage/RLS policies with Buyer, Supplier, Admin, Owner, unrelated, suspended, expired, and anonymous identities.
7. **[Future plan]** Populate/activate `uploaded_files` references only for verified objects in an approved transaction/migration.
8. **[Future plan]** Switch the feature's resolver/provider manifest during a controlled window; do not rewrite every historical URL blindly.
9. **[Future plan]** Monitor authorization denials, broken downloads, hash mismatches, latency, egress, and orphan counts.
10. **[Future plan]** Retain Firebase/source objects through the approved rollback window; deletion is a later destructive task with separate approval.

## URL and reference strategy

- **[Future plan]** Store stable file IDs/provider-neutral references in application rows, not permanent signed URLs.
- **[Future plan]** Generate short-lived signed URLs only after authorization; never persist them as canonical data.
- **[Future plan]** Keep external HTTPS `referenceLinks` unchanged unless a reviewed link-safety or ownership decision says otherwise.
- **[Future plan]** During transition, a resolver reads the authoritative file-provider field. It does not try Supabase then Firebase on failure.
- **[Future plan]** A versioned deterministic converter may translate known legacy Firebase object references to `uploaded_files.id`; unresolved links enter an exception report.
- **[Future plan]** Preserve redirects only if they do not leak private object existence and have an explicit expiry/rollback purpose.

## Policy requirements

- **[Future plan]** RLS on `uploaded_files` and Storage policies must agree on owner, entity relationship, current account status, and file readiness.
- **[Future plan]** Browser roles cannot set `verified`, `scan_status`, `storage_provider`, `bucket`, `object_key`, `checksum`, `public`, or another user's ownership.
- **[Future plan]** Service-role access is confined to trusted upload finalization, scanning, copy, and migration processes and is never exposed to Vite.
- **[Future plan]** Realtime publication of private file rows is disabled unless separately justified and tested.
- **[Future plan]** Every policy has positive and negative tests, including cross-Supplier and cross-conversation attempts.

## Verification gates

- **[Future plan]** Source count equals manifest discovered count plus documented exclusions.
- **[Future plan]** Verified target count/size equals the cutover-ready manifest set.
- **[Future plan]** Every ready database file row resolves to exactly one verified target object.
- **[Future plan]** No target object is public unless explicitly classified and tested.
- **[Future plan]** Broken-link and unauthorized-access browser tests pass for all roles/locales/routes that expose files.
- **[Future plan]** A sampled byte-level download comparison passes in addition to manifest checksums.
- **[Future plan]** No source deletion, URL rewrite, or provider switch occurs on a failed gate.

## Rollback

- **[Future plan]** Before cutover, discard/retry target copies while Firebase/source remains authoritative.
- **[Future plan]** After read cutover and before any Supabase-only file write, switch the explicit resolver back only if the source references remain complete and parity passes.
- **[Future plan]** After Supabase-only writes, rollback requires a freeze plus reverse copy/reconciliation; a provider flag alone would lose new files.
- **[Future plan]** Keep the target manifest and both object sets until the monitoring/retention window closes.
- **[Future plan]** Deleting Firebase/source objects, buckets, tokens, or references requires a separate destructive-action approval and verified backup/retention evidence.

## Why copy, not move

- **[Future plan]** Copy preserves the last-known-good source for hash comparison, broken-link diagnosis, user UAT, and rollback.
- **[Future plan]** A move couples transfer success with destructive deletion and makes partial failure or policy defects harder to recover.
- **[Future plan]** Verification must happen against two intact sides; only a later retention decision may authorize source deletion.
