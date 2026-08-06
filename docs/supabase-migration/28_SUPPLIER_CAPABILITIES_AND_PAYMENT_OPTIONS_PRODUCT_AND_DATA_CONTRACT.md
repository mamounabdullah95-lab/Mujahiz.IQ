# Supplier capabilities and payment options product/data contract

Status: **Capability contract approved; capability-only eighth SQL slice selected; payment options deferred**
Contract date: 6 August 2026; Product/Data Owner approval recorded 7 August 2026
Verified start: `origin/main` `cb51da7267f3fa61af9d35ade66890f096f2c51a` after merged PR #73
Primary task profile: Documentation

## 1. Decision boundary

This document records the approved product/data contract for future `public.supplier_capabilities` and retains the payment-option analysis for later review. The Product/Data Owner approval recorded in section 15 selects the capability-only eighth SQL slice, defers `public.supplier_payment_options`, authorizes no SQL or data work, and resolves no unrelated Open decision gate.

The approved capability boundary and deferred payment-analysis boundary are:

- a capability is a reviewed, time-bounded assertion about what a Supplier can generally do or support; it is not a category, location, payment method, contractual promise, RFQ eligibility fact, or proof of performance;
- a payment option is a reviewed, time-bounded, indicative commercial-profile statement; it is not a quotation term, contract acceptance, account instruction, credit approval, or promise to transact;
- controlled values and reviewed bounded custom capability terms share one capability relation but use mutually exclusive semantic shapes;
- payment methods, currencies, credit terms, and advance-payment terms remain distinct option types within one payment relation;
- ambiguous, contradictory, unknown, or unmapped legacy evidence creates no active canonical row; and
- both base relations remain non-public and unavailable to API roles until a separately approved RLS/projection task.

The capability contract is approved and one empty `public.supplier_capabilities` table is selected as the smallest dependency-safe eighth SQL slice. This approval is planning authority only: a separate task must authorize and select exact SQL/pgTAP. `public.supplier_payment_options` remains deferred and unapproved.

## 2. Verified starting state and current Firebase evidence

- PR #73 is merged into `origin/main` at `cb51da7267f3fa61af9d35ade66890f096f2c51a` and added the empty local-only `public.supplier_category_assignments` foundation.
- Local SQL now has 13 physical tables representing 11 implemented Core Phase 1 concepts; 25 of 36 Core Phase 1 concepts remain deferred.
- `public.supplier_profiles`, `public.categories`, `public.supplier_locations`, and `public.supplier_category_assignments` exist locally. `public.supplier_capabilities` and `public.supplier_payment_options` do not.
- Firebase remains the live Production backend. Supabase remains local-only. This task accessed neither backend and moved no data.
- The 12 Open approval gates remain `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

Current repository fields and controlled values are evidence, not a canonical relational vocabulary:

| Current field/source | Current shape | Contract finding |
|---|---|---|
| `capabilityTags[]` | Up to 50 bounded strings server-side; UI constants mix operational, service, documentary, experience, payment-method, and currency claims | Split by semantic destination; do not port the array as one undifferentiated code list |
| `coverageAreas[]` | Includes `imports_outside_iraq` | Route only to capability review; never create a location or coverage row |
| `subcategories[]` | Up to 50 free-text values | Category mapping has priority; only a reviewed non-category capability meaning may become a custom capability |
| `relatedMaterialService` | Optional free text, currently bounded to 300 characters server-side | Preserve as phrase evidence; do not assume it is a category or capability |
| `paymentOptions[]` | Current codes: `cash`, `bank_transfer`, `usd`, `iqd`, `official_invoice` | Split methods, currencies, and invoice-issuance capability |
| `acceptsCredit` | Optional boolean | `false` is explicit negative evidence; absence is unknown; `true` alone is incomplete for an active positive term |
| `creditDays[]` | Zero to 12 unique integers, each 1-365 | Each reviewed days/start combination is a semantic credit option; array order has no meaning |
| `creditStart` | `invoice_date`, `delivery_date`, or `invoice_approval` | Current labels do not fully define the legal/business event; preserve pending mapping until owner-approved definitions exist |
| `creditTermsNote` | Optional bounded free text | Supplementary evidence only; it never creates an option by itself |

The UI capability constants and workbook import options are not identical. In particular, payment/currency-like capability constants appear in the UI list but not consistently in the workbook capability list. This drift is migration evidence requiring a versioned source namespace; it is not permission to choose one list silently.

## 3. Domain separation and viable table boundaries

| Option | Boundary | Dependency/risk finding | Disposition |
|---|---|---|---|
| A | One capability table only | Supplier root exists; nullable category scope can use the existing category root; resolves the structural destination already required for `imports_outside_iraq`; commercial credit interpretation remains out | **Approved and selected as the eighth slice** |
| B | One payment-options table only | Supplier root exists and no billing table is required, but current credit-start labels and method/currency/invoice overlaps require owner decisions before exact DDL | **Deferred; not selected** |
| C | Both tables in one slice | Structurally possible after approval, but doubles lifecycle, shape, uniqueness, and pgTAP surface and mixes a capability mapping need with commercial semantics | Reject as the next slice |
| D | One generic Supplier attributes/options table | Weakens type-specific constraints, visibility, normalization, and migration reconciliation; encourages payment/location/category leakage | Reject |
| E | Store the current arrays/free text on `supplier_profiles` or as JSONB | Preserves ambiguity, prevents reliable duplicate/lifecycle rules, and broadens the root profile | Reject |

The capability table is selected as an empty, revoked, local-only eighth slice. Payment options remain deferred and require a later separately approved contract/selection. The relations are not coupled by FK or transaction and must not be implemented together merely because both originate in one Firebase Supplier document.

## 4. Canonical capability semantics

One capability row states that a reviewed Supplier generally has a particular operational ability, service ability, documentary ability, or relevant experience claim. It may be global to the Supplier or explicitly scoped to one canonical Supplier-offering category.

A capability is not:

- a Supplier category or product/service catalog item;
- physical presence, service coverage, international location, or country of origin;
- a payment method, currency, credit term, price, invoice instruction, or bank detail;
- evidence that the Supplier holds local stock at the time of an RFQ;
- proof that a service, warranty, delivery speed, customs clearance, or qualification applies to a specific transaction;
- Supplier ownership, verification, listing approval, search rank, or RFQ eligibility; or
- a contractual representation or warranty.

The following controlled capability taxonomy remains a candidate vocabulary for later exact DDL/mapping review:

| Kind | Meaning | Current candidates after review |
|---|---|---|
| `operational` | Sourcing, stocking, fabrication, or fulfilment ability | `local_stock`, `imports_outside_iraq`, `custom_fabrication`, `fast_delivery`, `obsolete_item_sourcing`, `emergency_sourcing` |
| `service` | Technical or after-sales service generally available | `technical_support`, `site_visit`, `installation`, `warranty`, `repair_overhaul` |
| `documentary` | Ability to provide a governed business document | `official_invoice`, `company_profile_available` |
| `experience` | Reviewed claim of relevant prior work/market experience | `project_experience`, `works_with_ngos`, `works_with_construction`, `works_with_oil_gas`, `works_with_power_plants` |
| `custom` | Reviewed bounded capability not yet in the controlled vocabulary | No automatic current mapping |

This owner decision approves the structural controlled/custom boundary, `imports_outside_iraq`, and `official_invoice` routing; it does not approve or populate the remaining candidate codes as a canonical vocabulary. Labels are presentation content and do not become identity. A future vocabulary-table decision is not required for an empty first capability relation, but the exact DDL code set and every later mapping require separately reviewed governance and synchronized application/import evidence.

## 5. `imports_outside_iraq`

The canonical `imports_outside_iraq` capability means only: the Supplier reports a general ability to source goods from outside Iraq for supply into the Iraqi market.

It does not imply:

- an office, branch, warehouse, service area, or legal presence outside Iraq;
- direct importer-of-record status, customs clearance, exclusivity, a particular origin country, local stock, delivery time, currency, or payment method;
- that every category/product can be imported; or
- acceptance of a specific RFQ or contract term.

Recommended mapping treatment:

- exact `coverageAreas[] = imports_outside_iraq` routes to a reviewed `operational/imports_outside_iraq` capability candidate and creates no location row;
- current `capabilityTags[] = import_only` does **not** map automatically. “Only” may assert absence of local stock and is not proven equivalent to the positive canonical ability. Preserve it as `pending_review` until an approved source-specific rule decides whether it maps, becomes a separate future code, or remains no-target evidence;
- `businessType = importer` is business-type evidence, not a capability row by itself; and
- category scope is nullable. Do not infer a category from adjacent arrays or array position.

## 6. Structured and free-text capabilities

Each row has exactly one semantic shape:

1. **Controlled capability:** required `capability_kind` and `capability_code`; custom/original/normalized text columns are null.
2. **Custom capability:** `capability_kind = custom`; code is null; required bounded original and display values, declared language/script when known, versioned normalized value, and normalizer version.

Rules:

- category scope is nullable and uses `ON DELETE RESTRICT`; when present, later activation validates an active assignable `supplier_offering` leaf;
- custom text is Unicode-normalized for comparison without overwriting the original; Arabic/English translation or transliteration is never invented;
- category, subcategory, product, brand, part number, standard, material phrase, and search synonym meanings are resolved before capability review. Text overlap is insufficient;
- `subcategories[]` and `relatedMaterialService` remain restricted evidence unless a reviewed rule establishes a non-category capability meaning;
- custom capabilities require human moderation before activation and remain excluded from anonymous projection unless a separate product/security decision permits them; and
- a later approved vocabulary promotion closes the custom row and creates a controlled successor; it does not rewrite historical meaning in place.

## 7. Capability provenance, ownership, review, and lifecycle

Capability rows use the same bounded governance pattern as category assignments:

| Field group | Contract |
|---|---|
| Source | Required bounded `source_type` and `source_namespace`; distinguish legacy migration, import/submission, Supplier proposal, and trusted manual curation |
| Evidence | Nullable bounded internal/repository reference; no raw workbook, full Supplier record, secret, token, contact data, or public evidence URL |
| Transformation | Mapping and normalizer versions required when source transformation produced the candidate |
| Review | Provider-neutral reviewer FK and review time required before activation; optional bounded confidence is evidence only |
| Actors/time | Provider-neutral created/updated actor FKs and timestamps; browser identity is never authoritative |
| Lifecycle | `draft`, `active`, `superseded`, `archived`; terminal rows are historical |
| Validity | `valid_from` on activation and later `valid_until` on terminal transition; strict increasing interval |

The Product/Data Owner owns vocabulary, mapping versions, custom-term policy, category-scoping rules, and reviewer delegation. A Supplier owner, contributor, import, or migration process may later propose evidence but cannot activate canonical rows. A designated data reviewer owns the decision. This contract selects no Auth provider, role, grant, RLS policy, or application permission.

Material changes to kind, code, custom normalized meaning, category scope, source decision, or activated order close the current row and create a successor. No normal hard delete is allowed after activation, migration mapping, or downstream historical use.

## 8. Capability normalization and duplicate prevention

A later capability DDL must support:

- one active controlled row per Supplier, category scope, kind, and capability code;
- one active custom row per Supplier, category scope, normalizer version, and normalized value;
- one active row per Supplier position;
- controlled and custom shapes that cannot overlap;
- historical repetition outside active uniqueness; and
- deterministic source child keys that exclude mutable presentation order.

Recommended logical child keys are:

- controlled: `capability:<kind>:<code>:<category-code-or-global>`;
- custom: `capability:custom:<normalizer-version>:<normalized-digest>:<category-code-or-global>`.

Multiple source fields resolving to the same semantic capability produce one active target and retain contributing evidence through the existing reviewed merge/reconciliation contract. Case, Unicode compatibility forms, punctuation, Arabic/English spelling, or source-array duplication must not produce duplicate rows. Fuzzy similarity creates only a review candidate.

## 9. Deferred payment-option analysis

The following payment-option model remains analysis for a later owner decision; it is not approved or selected by this contract update. If later approved, a payment-option row would be an indicative Supplier commercial-profile assertion that a method, currency, credit arrangement, or advance-payment arrangement is generally available for consideration. Availability would remain subject to Supplier review, Buyer approval, transaction value, compliance, bank availability, RFQ, quotation, and executed contract.

No payment-option semantics are approved here except that `official_invoice` is excluded from that future table and belongs to documentary capabilities. A future payment row would not be contract acceptance; an RFQ or quotation would snapshot its own payment terms independently. RFQ-003 remains Open for legacy quotation price/currency transformation and BILL-001 remains Open for platform subscription billing.

The recommended option types are:

| Option type | Required semantic value | Optional parameters | Explicit non-meaning |
|---|---|---|---|
| `method` | `cash`, `bank_transfer`, `cheque`, or `letter_of_credit` | Restricted reviewed note only when needed | No currency, bank account, instrument validity, LC form, or transaction acceptance is inferred |
| `currency` | Uppercase ISO 4217 code; initial current candidates `IQD` and `USD` | None in the first boundary | Pricing/acceptance for every transaction is not promised |
| `credit_term` | `credit_offered` or `credit_not_offered` | Positive rows require days and a defined start-event code; reviewed note may qualify the plan | Credit limit, approval, interest, penalty, security, and legal enforceability are not inferred |
| `payment_timing` | `advance_payment` | Nullable reviewed percentage greater than 0 and at most 100 | Advance is not a payment method and no amount is inferred when percentage is absent |

No unrestricted free-text payment method or currency is canonical in the first boundary. Unknown methods/terms remain review evidence until a controlled code is approved.

## 10. Type-specific payment rules

### Methods and currencies

- `cash` and `bank_transfer` are methods. Neither implies IQD, USD, advance payment, settlement status, or account details.
- `cheque` is the canonical code; spelling variants such as `check` may map only through an approved source rule.
- `letter_of_credit` is the canonical method code. “LC”, “L/C”, confirmed/unconfirmed, sight/usance, issuing bank, and document conditions remain source evidence or future structured parameters; no subtype is inferred.
- currency is a separate row. `paymentOptions[] = usd|iqd` may map to `USD|IQD` after review. `capabilityTags[] = usd_pricing|iqd_pricing` is pricing-language evidence and remains `pending_review` unless the owner approves equivalence to generally accepted payment currency.
- no bank names, account numbers, IBAN/SWIFT details, cheque numbers, or LC document data belong in this table or a public projection.

### Credit periods

- Absence of a credit row means unknown, not “no credit.”
- `acceptsCredit = false` supports one explicit `credit_not_offered` candidate after review. It has no days, start event, or terms note.
- `acceptsCredit = true` supports positive candidates only when each plan has a valid days/start pair. `true` without both is incomplete evidence and creates no active row.
- each distinct reviewed `(credit_days, credit_start_code)` is one active semantic option; days are integers from 1 through 365;
- an active `credit_not_offered` row cannot coexist with an active `credit_offered` row for the same Supplier; and
- a contradictory source such as `acceptsCredit = false` plus days/start enters exception review and creates no active credit row.

The recommended canonical start-event codes are `invoice_issue_date`, `delivery_or_acceptance_date`, and `buyer_invoice_approval_date`. The current Firebase codes do not map automatically because `invoice_date` does not prove issue versus receipt, `delivery_date` is labeled as both delivery and receipt, and `invoice_approval` does not name the approving party. Section 15 requires the owner to approve exact definitions and mappings.

### Advance payment

- Advance payment is a timing term, not cash, bank transfer, cheque, or LC.
- A known reviewed percentage is stored exactly; a source that says only “advance payment” may use a null percentage and must not be represented as 100%.
- Zero is not an advance percentage. A 100% advance is valid only when explicitly evidenced.
- No current Firebase controlled value proves advance payment; future rows require an approved source/workflow.

### Official invoice and notes

- `official_invoice` means the Supplier reports an ability to issue an official invoice. It is a `documentary` capability, not a method, currency, credit term, or payment timing.
- Current `paymentOptions[] = official_invoice` and `capabilityTags[] = official_invoice` may collapse to one reviewed capability target with multiple provenance contributors.
- `creditTermsNote` is supplementary restricted evidence. It becomes a row note only when review attaches it to one exact credit option; otherwise it remains no-target review evidence.

## 11. Payment provenance, lifecycle, and duplicate prevention

Payment rows use the same source, evidence, review, actor, `draft|active|superseded|archived`, validity, and no-normal-hard-delete contract as capabilities. Commercial review authority is delegated by the Product/Data Owner; Supplier input remains a proposal.

Active semantic uniqueness is type-specific:

- method: Supplier plus method code;
- currency: Supplier plus ISO currency code;
- positive credit: Supplier plus days plus canonical start event;
- explicit no-credit: at most one per Supplier, mutually exclusive with positive credit;
- advance payment: Supplier plus nullable reviewed percentage, with null treated as one explicit unknown-percentage semantic value; and
- active position is unique per Supplier within the payment projection.

Source array order never determines identity, precedence, preference, contractual priority, or default currency. Repeated evidence collapses through deterministic child keys and reviewed merge/reconciliation rather than duplicate target rows.

## 12. Legacy routing matrix

| Legacy value | Recommended destination | Mapping state before owner approval |
|---|---|---|
| `coverageAreas.imports_outside_iraq` | Capability `operational/imports_outside_iraq` | Candidate exact route; review still required |
| `capabilityTags.import_only` | No automatic target | `pending_review` |
| operational/service capability tags | Same-kind controlled capability after approved code mapping | `pending_review` as a vocabulary version |
| `capabilityTags.cash_payment` | Payment method `cash` | Candidate route; do not create a capability |
| `capabilityTags.bank_transfer` | Payment method `bank_transfer` | Candidate route; do not create a capability |
| `capabilityTags.usd_pricing|iqd_pricing` | Possible currency `USD|IQD` | `pending_review`; pricing is not proven acceptance |
| either source `official_invoice` | Capability `documentary/official_invoice` | Candidate many-source-to-one route |
| `paymentOptions.cash|bank_transfer` | Corresponding payment method | Candidate exact route |
| `paymentOptions.usd|iqd` | Currency `USD|IQD` | Candidate exact route |
| current credit fields | Positive/negative credit option only under section 10 | `pending_review` for start-event mapping and contradictions |
| `subcategories[]`, `relatedMaterialService` | Restricted category/capability/phrase review evidence | No automatic target |
| unknown method, currency, capability, cheque/LC/advance free text | Restricted exception evidence | `unknown` or `pending_review`; never guessed |

Mapping outcomes are `unknown`, `pending_review`, `mapped`, `unmapped`, and `rejected`. Only reviewed `mapped` evidence may support activation.

## 13. Future RLS and projection boundaries

- Both base tables are non-public. Any empty local implementation revokes all table privileges from `public`, `anon`, `authenticated`, and `service_role`.
- No browser role may directly insert, activate, update, archive, or delete a row. Future proposals and reviews use separately approved trusted commands.
- RLS is not column security. Audience reads require field-minimized security-invoker views or RPC projections after an Extra High Security review.
- A future separately implemented public capability projection may expose only approved active capability labels. It excludes codes unless separately justified, custom/source originals, normalized values, category-scope evidence, position/order metadata, notes, source namespace/reference, mapping/normalizer versions, confidence, reviewer/actor identity, review times, closure reasons, and every ambiguous or unmapped legacy value.
- No payment-option projection is approved or selected. Its audience, fields, and wording remain deferred with the table contract.
- No public projection exposes bank/account/instrument data, internal review evidence, contradictory values, unknown/unmapped values, drafts, or history.
- Anonymous exposure, custom-capability exposure, Supplier-owner proposal access, and Buyer-only versus authenticated-directory access remain explicit Product/Security decisions. Current application visibility is not broadened by this contract.
- Search/ranking, RFQ matching, eligibility, quotation generation, and commercial comparison remain separate later contracts. A capability/payment row never authorizes an RFQ or binds a quotation.

## 14. Evidence required before any data movement

Before capability or payment transformation, a separate reviewed package must contain:

1. authorized bounded source snapshot identity, environment, count, and source-field inventory;
2. distinct-value manifests by collection, field, source namespace, and source version, with safe counts only;
3. approved controlled capability code/version and payment code/start-event definitions;
4. a versioned exact/normalized mapping manifest for every distinct legacy value;
5. Unicode/language normalizer specification and collision report for custom capabilities;
6. explicit treatment of payment/currency tags found in capability fields, `official_invoice`, `import_only`, free text, unknowns, contradictions, duplicates, and zero/one/many outcomes;
7. approved category-scope rules and category fingerprint when any capability is category-scoped;
8. deterministic semantic child keys, ordering inputs, source dispositions, reverse-target rules, and reviewed merge groups;
9. exception report with counts and bounded sample keys only—no full Production records, raw workbooks, secrets, contact data, or unnecessary personal data;
10. dry-run reconciliation by source outcome, Supplier, semantic target, duplicates collapsed, active totals, explicit negatives, unknowns, and deterministic replay;
11. forward/reverse trace and target-content fingerprints, including many-source-to-one `official_invoice` and repeated capability evidence;
12. rollback/supersession plan preserving historical evidence and dependency order;
13. field-minimized projection/RLS plan and positive/negative tests before any client access; and
14. explicit Product/Data Owner approval of the vocabulary/mapping version plus a separately authorized environment/data-migration plan.

Counts alone are insufficient. Any unexplained value, contradiction, collision, target, duplicate, reverse trace, or replay difference blocks movement.

## 15. Recorded Product/Data Owner decision

On 7 August 2026, the Product/Data Owner explicitly approved:

- `public.supplier_capabilities` only as the next empty local-only SQL slice;
- continued deferral of `public.supplier_payment_options`;
- `imports_outside_iraq` as an indicative sourcing capability;
- `import_only` as unresolved, excluded from the canonical capability contract, and ineligible for automatic mapping;
- controlled capabilities and reviewed custom capabilities only with bounded provenance, review, lifecycle, versioned normalization, and semantic duplicate prevention;
- optional, never mandatory, category scope;
- capability assertions as indicative profile claims rather than contractual guarantees;
- a future public projection boundary limited to approved active labels only;
- restriction of notes, provenance, evidence, reviewer identity, normalization/mapping metadata, and ambiguous/unmapped legacy values;
- `official_invoice` as a documentary capability, never a payment option; and
- no SQL, pgTAP, migration, mapping execution, seed, RLS, Auth, Firebase, hosted Supabase, Production, or TEST work in this PR.

This approval confirms the capability contract and selects the capability-only eighth-slice planning boundary. It does not approve the candidate vocabulary beyond the explicitly routed `imports_outside_iraq` and `official_invoice` meanings, approve any source mapping or data row, approve the payment-option model, or authorize implementation.

Remaining later decisions include the exact capability DDL/code set and focused pgTAP contract, reviewer/actor authorization, mapping/vocabulary versions, custom-label moderation/localization, data-migration evidence, and all payment-option semantics. The 12 unrelated Open gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## 16. Selected eighth SQL slice

The selected eighth SQL slice is exactly one future empty `public.supplier_capabilities` table. A later separately authorized implementation-selection task may define:

- UUIDv4 identity and restrictive Supplier/category/reviewer/actor relationships;
- mutually exclusive controlled/custom shapes;
- optional category scope;
- bounded provenance, lifecycle, validity, normalization, and position checks;
- active semantic uniqueness and structural lookup indexes;
- comments and complete API-role privilege revocation; and
- focused disposable synthetic pgTAP plus minimum implementation evidence.

This selection does not authorize SQL or pgTAP. Any later implementation must exclude `public.supplier_payment_options`, vocabulary/reference rows, Supplier/category/location/assignment changes, mapping execution, data rows, triggers, trusted routines, RLS, policies, views, RPCs, grants, application/search/RFQ integration, Firebase, hosted Supabase, and Production/TEST access unless separately approved.

`public.supplier_payment_options` remains deferred. Its method/currency/credit/advance model, legacy mappings, audiences, exact DDL, and tests require a later Product/Data Owner contract and independent slice selection.

If the selected capability-only table were later authorized and merged, the projected state would be 14 physical tables, 12 implemented Core Phase 1 concepts, and 24 deferred concepts. This documentation task leaves the verified state at 13 / 11 / 25.

## 17. Risks

- Current UI and workbook vocabularies drift; using one as authoritative would silently lose or reinterpret source evidence.
- `import_only` may express lack of local stock rather than international-sourcing ability. Automatic equivalence would overstate capability.
- Capability codes include claims that may need evidence or category scope. Public wording without moderation could mislead Buyers.
- Current payment values mix method, currency, and invoice capability. A literal array port would create invalid commercial semantics.
- Current credit-start labels do not identify sufficiently precise business events. Silent mapping could change when credit becomes due.
- Indicative data may be mistaken for accepted contract terms unless every future projection and RFQ flow uses explicit wording and independent quotation snapshots.
- Declarative uniqueness cannot enforce every cross-row contradiction or current-parent lifecycle. Future trusted commands remain necessary before non-synthetic rows.

## 18. Validation and exact stop point

Required validation is documentation-only: latest `origin/main`/PR #73 lineage, 13 physical tables, 11 implemented / 25 deferred Core Phase 1 concepts, 12 unchanged Open gates, links, terminology, sensitive-content review, documentation-only diff, and `git diff --check`.

Do not start Supabase, replay migrations, run pgTAP, access Firebase, run the application build, or run full repository suites.

Exact stop point: PR #74 marked Ready for review with the approved capability contract, selected capability-only eighth-slice planning boundary, and deferred payment options. Stop before SQL/pgTAP implementation selection or implementation, mapping execution, data movement, RLS, hosted work, merge, or deployment.

## 19. References

- [`27_SUPPLIER_CATEGORY_ASSIGNMENT_PRODUCT_AND_DATA_CONTRACT.md`](27_SUPPLIER_CATEGORY_ASSIGNMENT_PRODUCT_AND_DATA_CONTRACT.md)
- [`24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md`](24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md)
- [`21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`](21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md)
- [`18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md`](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md)
- [`15_THIRD_SQL_SLICE_SELECTION.md`](15_THIRD_SQL_SLICE_SELECTION.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
