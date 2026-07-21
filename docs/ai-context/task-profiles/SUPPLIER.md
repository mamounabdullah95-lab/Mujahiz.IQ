# Task Profile — Supplier

Use for supplier profiles, directory records, linking/claiming, supplier dashboard, submissions, documents, products, feedback, and Excel import.

## Load

- `docs/ai-context/03_PRODUCT_AND_BUSINESS_RULES.md`
- Relevant supplier pages, services, validation, import utilities, role routes, Rules sections, and supplier tests only.

## Preserve

- Distinction between listed, claimed, verified, RFQ-ready, active, and paying suppliers.
- Canonical ownership from both user linkage and Supplier document.
- Protected `supplierProfileId`, ownership, verification, and status fields.
- Import limit of 50 companies and 200 KB where the current approved import applies.
- Duplicate prevention, normalization, and full-dataset behavior.
- Supplier accounts cannot use Buyer/Admin bulk import.
- No raw workbook persistence or stored file payloads.

## Avoid by default

- RFQ lifecycle changes unless supplier eligibility requires them.
- Full supplier collection scans or hash generation.
- Bulk normalization, migration, backfill, or Production repair.

## Verification

Use focused supplier access/import tests, role routing checks, build, and Emulator tests only when authorization changes.

Suggested reasoning: High; Extra High for ownership, linking, Rules, or Production data changes.
