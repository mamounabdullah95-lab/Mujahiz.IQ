# Task Profile — RFQ

Use for RFQ creation, publication, targeting, quotations, revisions, lifecycle history, comparison, and RFQ notifications.

## Load

- `docs/ai-context/03_PRODUCT_AND_BUSINESS_RULES.md`
- `docs/ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md`
- Relevant RFQ pages, components, services, types, Rules sections, indexes, and RFQ tests only.

## Preserve

- Buyer ownership and eligible Supplier targeting.
- Deterministic response, revision, event, and notification identities.
- Valid status transitions and deadline rules.
- Immutable historical revisions.
- Closed/cancelled/expired history visibility without permitting new quotation writes.
- Bounded queries, pagination, lazy revision loading, and no polling.
- Arabic/English parity and role-correct routes.

## Avoid by default

- Supplier directory redesign.
- Messaging, awarding, negotiation, email, PDFs, uploads, scoring, or analytics unless explicitly in scope.
- Production UAT writes, cleanup, Rules/index deployment, or Hosting deployment.

## Verification

Use targeted RFQ tests first. Add Emulator allow/deny coverage when Rules or data boundaries change. Run the production build. Use a fresh bounded read-only audit only when Production compatibility is materially relevant.

Suggested reasoning: High; Extra High when Rules, transactions, or deployment boundaries change.
