# Supplier payment options product/data contract

Status: **Decision-ready recommendation; Product/Data Owner approval required; no SQL selected or authorized**
Contract date: 8 August 2026
Verified start: `origin/main` `25536e09d84adac950023e5903c855cbf847b236` after merged PR #75
Primary task profile: Documentation

## 1. Decision boundary and recommendation

This document defines the recommended product/data contract for future `public.supplier_payment_options` only. It succeeds the deferred payment analysis in `28_SUPPLIER_CAPABILITIES_AND_PAYMENT_OPTIONS_PRODUCT_AND_DATA_CONTRACT.md`; it does not change the approved or implemented `public.supplier_capabilities` boundary.

The recommended contract is:

- one payment-option row is a reviewed, time-bounded, indicative Supplier-profile assertion that a payment method, settlement currency, credit arrangement, or advance-payment arrangement is generally available for consideration;
- the assertion is not a quotation term, purchase-order term, contract acceptance, credit approval, payment instruction, bank detail, promise to transact, or evidence of settlement;
- methods, settlement currencies, positive or negative credit availability, and advance-payment timing use mutually exclusive type-specific row shapes in one table;
- absence of a row means unknown, never a negative assertion;
- ambiguous, contradictory, inferred, unknown, or unmapped evidence creates no active canonical row;
- the base table remains non-public and unavailable to API roles until a separately approved RLS/projection task; and
- RFQs, quotations, purchase orders, and executed contracts independently state their own commercial terms and always take precedence for their transaction. A Supplier payment option never overrides, fills, defaults, or amends those terms.

The smallest dependency-safe future SQL slice is one empty, revoked, local-only `public.supplier_payment_options` table with focused disposable synthetic pgTAP. This is a recommendation, not approval or implementation authority. Product/Data Owner approval and a separate exact SQL/pgTAP selection task are still required.

## 2. Verified starting state

- PR #75 is merged into `origin/main` at `25536e09d84adac950023e5903c855cbf847b236`; its reviewed head `ce1f76ee2173616a3694b5ee373c64f7d23e13ee` implemented exactly the empty local-only `public.supplier_capabilities` foundation plus focused synthetic pgTAP.
- The tracked local migrations contain 14 physical SQL tables representing 12 implemented Core Phase 1 concepts. Of the 36 Core Phase 1 concepts, 24 remain deferred.
- `public.supplier_profiles`, `public.user_profiles`, and `public.supplier_capabilities` exist locally. `public.supplier_payment_options` does not.
- Firebase remains the live Production backend. Supabase remains local-only. This task accesses neither backend and moves no data.
- The 12 Open approval gates remain `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

Current repository values are source evidence, not the canonical contract:

| Current field/source | Current shape | Contract treatment |
|---|---|---|
| `paymentOptions[]` | `cash`, `bank_transfer`, `usd`, `iqd`, `official_invoice` | Split methods and settlement currencies; route `official_invoice` only to documentary capability |
| `acceptsCredit` | Optional boolean | Absence is unknown; `false` is a reviewed explicit-negative candidate; `true` is incomplete without valid days and an approved exact start-event mapping |
| `creditDays[]` | Zero to 12 unique integers, each 1-365 | Each distinct reviewed days/start pair is a positive credit option; array order has no meaning |
| `creditStart` | `invoice_date`, `delivery_date`, or `invoice_approval` | Preserve as pending evidence; none maps automatically to the exact codes in section 5 |
| `creditTermsNote` | Optional bounded text | Restricted supporting evidence only; it never creates an option or enters the first Buyer projection |
| Commercial-looking `capabilityTags[]` | Includes cash, transfer, and pricing-language tags | Route to payment review, but pricing is not settlement-currency acceptance |
| RFQ payment-term constants and search inference | Transaction request values and derived search intent | Never Supplier-profile provenance and never migrated into this table |

## 3. Canonical semantics and type shapes

The recommended first contract uses exactly four option types. Each active row satisfies exactly one shape; fields for every other shape are null.

| `option_type` | Required value | Type-specific parameters | Exact meaning |
|---|---|---|---|
| `method` | `method_code` | None | The Supplier reports that the method may generally be considered for receiving payment |
| `settlement_currency` | `currency_code` | None | The Supplier reports that the currency may generally be considered as the transaction settlement currency |
| `credit_term` | `credit_availability_code` | Positive rows require `credit_days` and `credit_start_code`; negative rows prohibit them | The Supplier reports either one specific indicative deferred-payment plan or an explicit general no-credit position |
| `payment_timing` | `timing_code = advance_payment` | Nullable `advance_percentage` | The Supplier reports that a transaction may be structured with an advance before performance or delivery |

No unrestricted custom method, currency, credit-start event, or timing code is canonical in the first boundary. Unknown values remain restricted evidence until a later versioned vocabulary decision.

Position is presentation order within the Supplier's active payment-option set only. It is never identity, preference, precedence, a default term, or a promise that one option is commercially better than another.

## 4. Payment methods and supported currencies

### Methods

The recommended initial method codes are:

| Code | Exact indicative meaning | Does not mean |
|---|---|---|
| `cash` | The Supplier may generally consider receiving physical cash where lawful and transactionally agreed | Cash on delivery, advance payment, a currency, receipt of payment, or exemption from cash/compliance limits |
| `bank_transfer` | The Supplier may generally consider receiving a bank or electronic funds transfer | Any bank/account, domestic/international rail, fees, settlement time, currency, or confirmed receipt |
| `cheque` | The Supplier may generally consider receiving a cheque, subject to transaction-specific acceptance and clearance | Personal/corporate/certified/post-dated form, currency, payee, bank, clearing result, guarantee, or cash equivalence |
| `letter_of_credit` | The Supplier may generally consider a documentary letter of credit as a payment mechanism | Sight/usance, confirmed/unconfirmed, revocable/irrevocable, issuing/confirming bank, document set, governing rules, currency, validity, or acceptance of a particular LC |

`cheque` is the canonical spelling. `check` may map only through an approved source-specific rule. `LC`, `L/C`, and similar abbreviations may map only when a reviewed rule proves the generic method meaning; subtype wording remains restricted evidence and is never inferred into this first contract.

### Settlement currencies

The recommended contract version supports exactly `IQD` and `USD`, stored as uppercase ISO 4217 codes. A settlement-currency row means only that the Supplier may generally consider receiving transaction settlement in that currency.

It does not mean that the Supplier prices every quotation in that currency, that the Buyer must pay in it, that conversion is available, that an exchange rate is fixed, or that every method supports that currency. Other currencies remain `unknown` or `pending_review` until a versioned contract expansion approves them.

`paymentOptions[] = iqd|usd` is a candidate exact route after review. `capabilityTags[] = iqd_pricing|usd_pricing` is pricing-language evidence and does not automatically prove settlement-currency acceptance. This distinction does not resolve RFQ-003, which remains the Open gate for legacy quotation price/currency meaning.

## 5. Credit availability, duration, and start events

### Availability and explicit no credit

- `credit_availability_code = credit_offered` states one specific indicative deferred-payment plan and requires both `credit_days` and `credit_start_code`.
- `credit_availability_code = credit_not_offered` is the sole explicit no-credit representation. It has no days, start event, advance percentage, or public note.
- Absence of any active credit row means unknown, not `credit_not_offered`.
- At most one active `credit_not_offered` row exists per Supplier, and it cannot coexist with any active `credit_offered` row.
- Multiple positive credit plans may coexist only when their `(credit_days, credit_start_code)` pairs differ.
- `acceptsCredit = false` is only a candidate for `credit_not_offered` after review. `acceptsCredit = true` alone creates no active row.
- Any contradiction, including `false` with days/start or `true` with invalid/incomplete terms, creates no active credit row and enters exception review.

### Duration

`credit_days` is a whole number from 1 through 365 and means that the payment due date is the transaction's applicable start-event date plus that many calendar days. The start-event date is day zero. It does not mean business days, banking days, months, grace days, or an interest-free/legal-enforceability conclusion.

The Supplier-profile row does not calculate a payable amount, due timestamp, holiday adjustment, late fee, interest, penalty, credit limit, collateral, security, or approval status. Any later quotation/contract that adopts a credit plan must state its own amount, event evidence, timezone/cutoff, holiday treatment, and enforceable terms.

### Exact credit-start codes

The recommended exact codes are:

| Code | Exact start-event meaning | Explicit exclusions |
|---|---|---|
| `invoice_issue_date` | The issue date printed on the Supplier's final transaction invoice | Draft/pro-forma date, Buyer receipt date, submission date, or approval date |
| `goods_receipt_date` | The calendar date on which the Buyer acknowledges physical receipt of the goods at the transaction's agreed delivery point | Dispatch date, carrier pickup, estimated delivery, inspection completion, or acceptance unless the transaction explicitly makes them the same event |
| `service_acceptance_date` | The calendar date on which the Buyer records formal acceptance of the completed service under the transaction's acceptance process | Work start, informal completion claim, invoice issue, or mere invoice receipt |
| `buyer_invoice_approval_date` | The calendar date on which the Buyer's authorized workflow gives final approval of the invoice for payment | Supplier approval, invoice issue, invoice receipt, data entry, or an intermediate review |

No combined `delivery_or_acceptance_date` or generic `invoice_date` code is canonical because either would hide materially different events. The current Firebase values remain pending:

- `invoice_date` does not prove issue versus receipt or another invoice date;
- `delivery_date` is labeled as delivery in English and receipt in Arabic and does not distinguish goods receipt from service acceptance; and
- `invoice_approval` does not identify the approving party or finality of approval.

A later source-specific mapping may activate only when versioned evidence proves one exact event. Otherwise the value remains `pending_review`, `unmapped`, or `rejected` with no target row.

## 6. Advance-payment semantics

`timing_code = advance_payment` means only that the Supplier reports a transaction may be structured with some payment due before the Supplier begins the transaction-specific performance, procurement, manufacture, service, or delivery milestone agreed in the quotation/contract.

- It is a timing arrangement, not a payment method, currency, credit plan, deposit receipt, or default requirement.
- A null `advance_percentage` means the existence of an indicative advance arrangement is reviewed but no percentage is proven. It never means 100%.
- A known percentage is greater than 0 and at most 100, recorded exactly to a later selected bounded decimal scale. Zero is invalid; 100 is allowed only with explicit evidence.
- The percentage applies to the transaction total as that later quotation/contract defines it. The Supplier-profile assertion does not define tax, freight, retention, installment base, or payable amount and therefore does not resolve RFQ-003.
- Evidence that says an advance is mandatory, refundable, milestone-specific, secured, or conditional is more specific than this first profile assertion and remains restricted review evidence unless a later contract adds that meaning.
- Current Supplier Firebase controlled values prove no advance-payment option. RFQ constants such as `full_advance` and `partial_advance` describe a transaction request, not a Supplier profile, and create no Supplier payment row.

## 7. Notes and information boundaries

The first base-table boundary permits one optional bounded `review_note` attached by a commercial reviewer to one exact option. It is internal restricted evidence.

- `review_note` never creates an option, supplies a missing required code/parameter, repairs a contradiction, or changes canonical semantics.
- Current `creditTermsNote` may become a row note only when review can attach it unambiguously to one exact credit plan. Otherwise it remains no-target source evidence.
- No note is exposed to anonymous users, authenticated directory users, Buyers, Supplier owners, search, RFQs, quotations, exports, or public projections in the first boundary.
- A later Buyer-facing explanatory note, if approved, must use a separate moderated bilingual field/projection contract. It must not repurpose internal evidence.
- Bank names, account numbers, IBAN/SWIFT values, cheque numbers/images, payee data, LC documents/clauses, signatures, payment credentials, personal contact data, and full source records are prohibited from this table, its notes, evidence reference, and every public/Buyer projection.

The `public` schema name is not a visibility decision. The base relation remains revoked and non-public.

## 8. Provenance, review, lifecycle, ownership, and freshness

Payment rows follow the bounded governance pattern already used for reviewed Supplier children:

| Field group | Contract |
|---|---|
| Source | Required bounded `source_type` and `source_namespace`; distinguish legacy migration, import/submission, Supplier proposal, and trusted manual curation |
| Evidence | Nullable bounded internal/repository reference only; never a raw workbook, full Supplier record, secret, credential, contact value, payment instrument, or public evidence URL |
| Transformation | `mapping_version` required when a transformed legacy/import candidate produced the decision; no fabricated mapping version for direct proposals/manual curation |
| Review | Provider-neutral reviewer FK and review time required before activation; a note and confidence value are evidence only |
| Actors/time | Provider-neutral created/updated actor FKs and timestamps; browser identity and client timestamps are never authoritative |
| Lifecycle | `draft`, `active`, `superseded`, `archived`; terminal rows are retained as history |
| Validity | `valid_from` on activation; `valid_until` on reviewed terminal closure; strict increasing interval |

The Product/Data Owner owns the contract vocabulary, method/currency/start-event versions, mapping versions, note policy, projection wording, review cadence, and reviewer delegation. A designated commercial data reviewer owns activation and closure decisions. A Supplier owner, contributor, import, migration process, or administrator may later propose evidence only under separately approved authority; none may self-activate a canonical row merely by writing source data.

Material changes to option type/code, currency, credit availability/days/start, advance percentage, source decision, or canonical meaning close the active row and create a reviewed successor. Presentation-only order may use a later trusted update when history and concurrency checks allow it. No normal hard delete is allowed after activation, migration mapping, or downstream historical reference.

This contract recommends time-bounded validity but does not silently choose a universal review interval. Product/Data Owner approval must select the initial freshness/review-cadence policy before non-synthetic activation or projection.

## 9. Normalization and duplicate prevention

Controlled codes are stored exactly in canonical case. No Unicode, translation, transliteration, fuzzy matching, array position, or display label becomes identity.

Active semantic uniqueness is:

- method: Supplier plus `method_code`;
- settlement currency: Supplier plus uppercase `currency_code`;
- positive credit: Supplier plus `credit_days` plus `credit_start_code`;
- explicit no credit: at most one per Supplier and mutually exclusive with every positive credit row;
- advance payment: Supplier plus nullable reviewed percentage, with null treated as one explicit unknown-percentage semantic value; and
- position: one active row per Supplier position.

Recommended deterministic logical child keys are:

- `payment:method:<method-code>`;
- `payment:currency:<currency-code>`;
- `payment:credit:offered:<days>:<start-code>`;
- `payment:credit:not_offered`; and
- `payment:timing:advance:<percentage-or-unspecified>`.

Multiple source fields or repeated array values that resolve to the same semantic option produce one active target. Contributing evidence uses the existing reviewed merge/reconciliation contract rather than duplicate target rows. Fuzzy or natural-language similarity creates only a review candidate.

Declarative shape and partial uniqueness can enforce duplicate prevention. The cross-row no-credit/positive-credit exclusion, lifecycle transitions, current-parent checks, and safe reordering require a later trusted mutation command before any non-synthetic active row; an empty foundation does not need a trigger or routine.

## 10. Firebase and other ambiguous-value routing

| Source value/evidence | Recommended destination | State before an approved mapping version |
|---|---|---|
| `paymentOptions.cash` | Method `cash` | Exact candidate; review required |
| `paymentOptions.bank_transfer` | Method `bank_transfer` | Exact candidate; review required |
| `paymentOptions.iqd` or `paymentOptions.usd` | Settlement currency `IQD` or `USD` | Exact candidate; review required |
| `paymentOptions.official_invoice` | Capability `documentary/official_invoice` | No payment target |
| `capabilityTags.cash_payment` | Method `cash` | Candidate alias route; review required |
| `capabilityTags.bank_transfer` | Method `bank_transfer` | Candidate cross-field route; review required |
| `capabilityTags.iqd_pricing` or `capabilityTags.usd_pricing` | No automatic settlement-currency target | `pending_review`; pricing does not prove settlement acceptance |
| `acceptsCredit` absent | No credit row | `unknown` |
| `acceptsCredit = false` with no positive-term evidence | Explicit `credit_not_offered` candidate | Review required |
| `acceptsCredit = true` plus valid days but current start code | Positive credit candidate only after exact start-event proof | `pending_review` |
| `acceptsCredit = true` without both valid days and exact start | No active row | Incomplete evidence |
| `acceptsCredit = false` plus days/start/note implying credit | No active credit row | Contradiction exception |
| Duplicate/unsorted `creditDays[]` | Deduplicated reviewed positive candidates only after exact start mapping | Array order ignored |
| `creditTermsNote` alone | No target | Restricted supporting evidence |
| Cheque/LC/advance wording in free text | Candidate only when an approved exact source rule proves the generic contract meaning | `unknown` or `pending_review`; never guessed |
| RFQ payment terms or derived/AI search intent | No Supplier payment target | Different domain; prohibited provenance |

Mapping outcomes remain `unknown`, `pending_review`, `mapped`, `unmapped`, and `rejected`. Only reviewed `mapped` evidence supports activation. No ambiguous value is coerced to the nearest code, and no unrecognized value is dropped without an explicit source disposition.

## 11. Future RLS and projection boundaries

- The base table is non-public and revoked from `public`, `anon`, `authenticated`, and `service_role` in any future empty local slice.
- No browser role directly inserts, activates, changes, archives, or deletes a row. Future proposals and reviews use separately approved trusted commands.
- RLS is not column security. Audience reads require field-minimized security-invoker views or RPC projections after an Extra High Security review under SEC-001.
- No anonymous payment-option projection is recommended.
- A future separately approved authenticated-Buyer projection may expose only active, in-validity standardized labels: method, settlement currency, positive/negative credit label with days/start label, and advance label/percentage, always accompanied by clear indicative/non-binding wording.
- The Buyer projection excludes internal notes, evidence, source namespace/reference, mapping versions, confidence, reviewer/actor identity, review timestamps unless separately justified as a freshness label, position metadata, drafts/history, contradictions, unknown/unmapped values, and prohibited bank/instrument data.
- Whether explicit `credit_not_offered` is shown to Buyers is an owner product decision; it must never be inferred from absence.
- Supplier-owner proposal/view access, reviewer access, freshness wording, localization, and exact Buyer eligibility remain later Product/Security decisions. This contract selects no Auth provider, role, grant, policy, view, RPC, or command.
- Payment options do not participate in search ranking, RFQ eligibility, automatic RFQ defaults, quotation generation, commercial comparison, or billing. Each requires a separate contract and implementation.

## 12. Evidence required before any data movement

Before any Supplier payment transformation, population, backfill, reconciliation, or cutover, a separate reviewed package must contain:

1. authorized bounded source snapshot identity, environment, count, source-field inventory, and source version;
2. distinct-value manifests with safe counts for `paymentOptions[]`, commercial-looking capability tags, `acceptsCredit`, `creditDays[]`, `creditStart`, and presence/attachment patterns for `creditTermsNote`;
3. approved contract/vocabulary version for method codes, `IQD|USD`, credit availability, exact start events, and advance semantics;
4. a versioned exact/alias mapping manifest for every distinct source value and source namespace;
5. explicit treatment of `official_invoice`, pricing-versus-settlement tags, absent booleans, incomplete positives, explicit negatives, contradictions, invalid/out-of-range days, duplicate days, current start labels, cheque/LC/advance free text, unknowns, and zero/one/many outcomes;
6. a collision report for semantic child keys and active uniqueness, including many-source-to-one method/currency evidence and null advance percentage;
7. deterministic source dispositions, child keys, ordering inputs, merge groups, reverse-target rules, and transformation version;
8. an exception report with counts and bounded sample keys only—no complete Supplier records, raw workbooks, notes, contact data, bank/instrument data, secrets, or personal data;
9. dry-run reconciliation by source outcome, Supplier, option type/code, explicit negatives, positive credit pairs, duplicates collapsed, contradictions, unknowns, and deterministic replay;
10. forward/reverse trace and target-content fingerprints for every active target and reviewed merge contributor;
11. rollback/supersession plan preserving source dispositions, historical rows, shared targets, and dependency order;
12. Product/Data Owner-approved freshness/review-cadence and stale-row handling;
13. separately approved field-minimized projection/RLS design with positive/negative tests before any client access; and
14. explicit Product/Data Owner approval of the contract/mapping versions plus separately authorized environment and data-migration plans.

Counts alone are insufficient. Any unexplained value, contradiction, collision, target, duplicate, reverse trace, source disposition, or replay difference blocks movement.

## 13. Viable table-boundary options

| Option | Boundary | Benefit | Cost/risk | Disposition |
|---|---|---|---|---|
| A | One typed `supplier_payment_options` table with mutually exclusive method/currency/credit/advance shapes | One Core Phase 1 concept, one Supplier/reviewer lifecycle, one provenance contract, and type-specific active uniqueness without new reference-table dependencies | Some cross-row rules require a later trusted command; nullable typed columns require exact shape checks | **Recommended smallest dependency-safe slice after owner approval** |
| B | Methods and currencies now; defer credit and advance columns/constraints | Smallest immediate semantic surface | Partially implements one logical concept, invites a second schema expansion, and leaves the central credit contract unresolved | Do not select |
| C | Four tables: methods, currencies, credit terms, and timing | Homogeneous rows and simpler per-table checks | Four tables, repeated governance columns, broader pgTAP/RLS/projection surface, and unnecessary joins for the current scale | Reject for the next slice |
| D | One payment-profile header plus four type-specific child tables | Strong extensibility and shared review header | Five tables and a parent lifecycle not justified by current evidence | Reject for the next slice |
| E | Arrays, JSONB, free text, or payment columns on `supplier_profiles` | Superficially close to Firebase | Preserves ambiguity, weakens duplicate/lifecycle/projection rules, and broadens the Supplier root | Reject |
| F | Reuse `supplier_capabilities`, RFQ terms, quotation terms, or billing tables | Avoids a new table | Collapses distinct domains and risks treating an indicative profile claim as a transaction or platform-billing fact | Reject |

Option A depends only on the existing restrictive `public.supplier_profiles` root and existing provider-neutral `public.user_profiles` reviewer/actor identities. It needs no capability/category/location relation, currency reference table, organization, RFQ/quotation table, billing table, Auth bridge, RLS, hosted environment, or data row.

## 14. Recommended smallest SQL slice

After Product/Data Owner approval and a separate implementation-selection task, the recommended ninth SQL slice is exactly one future empty `public.supplier_payment_options` table plus its focused disposable synthetic pgTAP contract.

The later exact selection may include:

- database-generated UUIDv4 identity;
- restrictive Supplier and nullable provider-neutral reviewer/actor FKs;
- mutually exclusive type-specific shapes and the controlled codes in this contract;
- bounded internal note, provenance, mapping, lifecycle, validity, and position checks;
- active type-specific semantic and position uniqueness;
- structural lookup indexes, table/column comments, and complete API-role privilege revocation; and
- focused synthetic pgTAP proving accepted/rejected shapes, duplicate boundaries, restrictive FKs, absence of rows/access objects, and continued deferral of all out-of-scope concepts.

The empty table is dependency-safe as the next SQL slice only after the contract and exact DDL/test boundary are explicitly approved. Non-synthetic activation remains blocked until a trusted mutation path can enforce cross-row credit contradiction and lifecycle rules. Data movement remains blocked on section 12.

If that one-table slice were later authorized and merged, the projected local state would be 15 physical tables, 13 implemented Core Phase 1 concepts, and 23 deferred concepts. This documentation task leaves the verified state at 14 / 12 / 24.

## 15. Remaining owner decisions

The Product/Data Owner must explicitly approve, reject, or amend:

1. the indicative/non-binding Supplier-profile meaning and the rule that transaction terms always remain independent and authoritative;
2. the one-table Option A boundary and four mutually exclusive option types;
3. method codes `cash`, `bank_transfer`, `cheque`, and `letter_of_credit`;
4. initial settlement currencies `IQD` and `USD`, including the pricing-versus-settlement distinction;
5. `credit_offered`/`credit_not_offered`, absence-as-unknown, positive/negative mutual exclusion, and 1-365 calendar-day meaning;
6. the four exact credit-start codes and the decision not to auto-map any current Firebase start label;
7. the advance-availability meaning, nullable percentage, and treatment of mandatory/refundable/milestone wording as later evidence;
8. internal-only first-boundary notes and the prohibition on note-driven semantics;
9. no anonymous projection, the future authenticated-Buyer projection boundary, and whether explicit no-credit may be shown;
10. the initial freshness/review cadence, stale-row handling, and commercial reviewer delegation; and
11. whether `public.supplier_payment_options` may proceed to a separate exact SQL/pgTAP selection task as the ninth slice.

Technical-owner decisions remain later and do not belong to this product approval: exact column names/types/lengths, decimal scale, constraint/index expressions, comment wording, and the focused pgTAP assertion plan.

## 16. Unchanged approval gates and domain separation

This recommendation creates no new decision ID and resolves none of the 12 Open gates.

- RFQ-003 remains Open for legacy quotation price, amount, currency, tax, freight, and comparison semantics. A Supplier settlement-currency or advance row does not answer it.
- BILL-001 remains Open for platform subscription/billing ownership. Supplier-to-Buyer commercial options are not platform billing.
- SEC-001 remains the recommended later RLS/projection delivery gate; this task designs no policy or client access.
- ID-001, ORG-001, ORG-002, MSG-002, MSG-003, SEARCH-001, FILE-001, AUD-001, RES-001, and MIG-002 remain unchanged and outside this contract.

Open means not approved. Neither this document nor a Draft PR approval silently closes a gate or authorizes SQL, data movement, hosted work, merge, or deployment.

## 17. Risks

- Current fields mix methods, currencies, invoice capability, and free text. Literal array porting would create false commercial meaning.
- Current credit-start labels are bilingual but not semantically equivalent enough for exact due-date rules. Automatic mapping could materially change when payment becomes due.
- Pricing-language tags can be mistaken for settlement-currency acceptance.
- Explicit no-credit can be incorrectly inferred from absence or allowed to coexist with positive plans without a trusted cross-row mutation boundary.
- Indicative values can be mistaken for accepted terms unless every projection carries non-binding wording and every RFQ/quotation snapshots independent terms.
- Cheque, LC, advance, and notes can attract bank, instrument, personal, or commercially sensitive data that this table must prohibit.
- Stale payment assertions may mislead Buyers unless review cadence and validity behavior are approved before activation/projection.
- A one-table design needs rigorous mutually exclusive checks; implementation before exact review would allow invalid mixed shapes.

## 18. Validation and exact stop point

Required validation is documentation-only: latest refreshed `origin/main`/PR #75 lineage, 14 physical tables, 12 implemented / 24 deferred Core Phase 1 concepts, 12 unchanged Open gates, links, terminology, sensitive-content review, documentation-only diff, and `git diff --check`.

Do not start Supabase, replay migrations, run pgTAP, access Firebase, run the application build, run repository suites, implement SQL, or create data.

Exact stop point: one Draft PR containing the decision-ready payment-options-only contract and synchronized documentation. Stop before Product/Data Owner approval, Ready-for-review transition, exact SQL/pgTAP selection, SQL implementation, mapping execution, data movement, RLS, Auth, hosted work, merge, or deployment.

## 19. References

- [`28_SUPPLIER_CAPABILITIES_AND_PAYMENT_OPTIONS_PRODUCT_AND_DATA_CONTRACT.md`](28_SUPPLIER_CAPABILITIES_AND_PAYMENT_OPTIONS_PRODUCT_AND_DATA_CONTRACT.md)
- [`27_SUPPLIER_CATEGORY_ASSIGNMENT_PRODUCT_AND_DATA_CONTRACT.md`](27_SUPPLIER_CATEGORY_ASSIGNMENT_PRODUCT_AND_DATA_CONTRACT.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
- [`../ai-context/11_DECISION_LOG.md`](../ai-context/11_DECISION_LOG.md)
