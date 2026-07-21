# Product and Business Rules

These rules describe approved or important product behavior. Codex must distinguish between an existing rule and a planned feature by inspecting the current implementation.

## Accounts and access

- Public registration supports Buyer and Supplier accounts.
- Owner/Admin privileges must never be obtained through public registration.
- Buyer and Supplier routes must remain separated.
- Invalid or unsupported account states must fail closed with a clear user-facing message.
- Email verification, resend, already-registered, permission, and rate-limit states require specific and helpful messages.

## Buyer trial and supplier-referral incentive

Current business requirement:

- A newly registered buyer receives a 3-day initial access period.
- Ten new, non-duplicate, administration-approved supplier submissions grant 30 days of directory access.
- Only valid and approved supplier records count.
- The system must prevent duplicate, incomplete, fabricated, or repeatedly rewarded submissions.
- Changes to this incentive require a product decision, not an incidental code change.

## Supplier profile linkage

- A Supplier account may be linked to an approved supplier profile through a trusted workflow.
- The protected `supplierProfileId` relationship must not be editable by the normal user.
- Supplier ownership/claim verification is a strategic priority.
- A listed supplier, claimed supplier, verified supplier, RFQ-ready supplier, active supplier, and paying supplier are different states and must not be conflated.

## Supplier creation and Excel import

Known approved behavior:

- Manual supplier creation is supported for authorized roles.
- Excel import is available to Buyer, Admin, and Owner where enabled.
- Supplier accounts must not use bulk Excel supplier import.
- Maximum batch: 50 companies.
- Maximum uploaded workbook size: 200 KB.
- Approved template: 4 worksheets, 35 fields, and up to 50 data rows.
- Do not persist the raw workbook, Blob, Base64 payload, or full file content after extraction.
- Imported data must pass normalization, duplicate checks, validation, and role authorization.

## Supplier search and terminology

- Multi-word technical phrases must be preserved as phrases when meaningful; for example, `differential pressure gauge` must not be treated only as three unrelated dictionary entries.
- Arabic and English synonyms, spelling variants, abbreviations, part numbers, brands, categories, and technical phrases should be normalized without destroying precise meaning.
- Search must cover the full eligible supplier dataset, not merely the first loaded page.
- Search ranking should prioritize relevance and trustworthy data, not paid placement unless clearly labeled.

## RFQ lifecycle

At minimum, the RFQ workflow must protect:

- Buyer identity.
- Target supplier eligibility.
- RFQ status transitions.
- Response ownership.
- No response after closure or cancellation.
- No reopening of a closed RFQ unless an explicitly approved rule exists.
- Comparable quotation data.
- Auditability of meaningful actions.
- Notification integrity and duplicate prevention.

Production RFQ testing must use controlled TEST records, explicit approval for writes, and explicit approval before cleanup.

## Messaging and notifications

- Conversation participants must have a legitimate relationship.
- A creator must be a participant.
- Arbitrary user IDs must not be accepted.
- Third parties must not read or write a conversation.
- Buyer-Supplier communication may arise from a supplier profile or an RFQ.
- Admin/Owner access must be limited to legitimate operational needs and auditable.
- The notification bell must read the canonical notification source.
- Polling should be minimized and duplicate notifications prevented.

## Localization

- Arabic mode shows Arabic content and RTL layout.
- English mode shows English content and LTR layout.
- Do not mix interface languages in the same rendered view.
- Supplier descriptions and user-entered content must not be transformed by naive word replacement.
- Machine-assisted translation must be reviewable and must preserve technical terms, brands, models, numbers, and proper names.
