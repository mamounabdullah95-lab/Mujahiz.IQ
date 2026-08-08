# Supplier contacts product/data/security contract

Status: **Decision-ready recommendation; Product/Data/Security/Privacy Owner approval required; no SQL slice selected or authorized**
Contract date: 8 August 2026
Verified refresh: `origin/main` `52d81cf19102b07c1aa378ac7b3548e3f11822a6` after merged PR #77
Primary task profile: Documentation

## 1. Decision boundary and recommendation

This document defines the decision-ready contract for future `public.supplier_contacts`. It does not approve the contract, resolve SUP-005, select an ordinal SQL slice, or authorize SQL/pgTAP, RLS, Auth, mapping, data movement, Firebase access, hosted work, or Production behavior.

The recommended contract is:

- one row represents one normalized contact endpoint associated with exactly one Supplier profile;
- channel, phone kind, subject, scope, purpose, verification, disclosure, and legal-basis concepts remain separate rather than being inferred from one another;
- the first channel set is `phone`, `email`, and `website`; a phone is further classified as `fixed_line`, `mobile`, or `unspecified` only when evidence supports that technical classification;
- a company phone is a phone endpoint whose reviewed subject is `generic_company`; `mobile` describes the number type and does not prove company ownership, personal ownership, consent, WhatsApp availability, or public exposure;
- a named person is a contact subject, not a channel type. A named-person row must name one person and one endpoint; person-only legacy values create no canonical contact row;
- every row has a non-null Supplier owner. An optional location link may name only a physical location owned by that same Supplier;
- base rows and exact normalized values remain restricted. No anonymous, authenticated, Supplier-owner, Buyer, search, or RFQ projection is approved by this contract;
- named-person and uncertain-subject phone/email data are treated as personal or potentially personal. Absence of consent or other approved basis never becomes consent; and
- ambiguous, incomplete, multi-valued, contradictory, or unproven Firebase evidence creates no active row and remains in restricted review/quarantine evidence.

Subject to owner approval of section 17, the smallest dependency-safe future SQL boundary is one empty, revoked, local-only `public.supplier_contacts` table plus the narrow supporting uniqueness object on `public.supplier_locations` needed for a declarative same-Supplier physical-location foreign key. That boundary is structurally safe before RLS and migration only while it contains no rows, grants no API/browser access, and authorizes no activation.

## 2. Verified starting state and domain separation

- PR #77 is merged into `origin/main` at `52d81cf19102b07c1aa378ac7b3548e3f11822a6`. It approved the Supplier payment-options contract and proposed ninth-slice direction but implemented no SQL.
- The tracked local migrations contain 14 physical SQL tables representing 12 implemented Core Phase 1 concepts. Of the 36 Core Phase 1 concepts, 24 remain deferred.
- `public.supplier_profiles`, `public.supplier_locations`, and `public.user_profiles` exist locally. `public.supplier_contacts` and `public.supplier_payment_options` do not.
- The active Supplier payment-options implementation work is not merged and is not a dependency of this contract. This contract does not modify or select the ninth slice.
- Firebase remains authoritative in Production. Supabase remains local-only. This task accesses neither backend and moves no data.
- The 12 Open approval gates remain `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.
- SUP-005 remains a Recommended, unresolved contact/audience decision. This document makes it decision-ready but does not record owner approval.

Current repository values are source evidence, not canonical contact facts:

| Current field/source | Current shape | Contract treatment |
|---|---|---|
| `phones[]` / `normalizedPhones[]` | Ordered strings plus application-generated digit normalization | Each source item is a candidate phone endpoint; array order is evidence only, and the current normalization is not canonical E.164 proof |
| `email` / `normalizedEmail` | One string; current normalizer lowercases the whole address | Candidate email endpoint; preserve display form and apply the stricter section 10 boundary before activation |
| `website` | One string; current normalizer strips scheme, `www`, and a trailing slash | Candidate website endpoint; current duplicate key is discovery evidence, not a canonical URL |
| `contactPerson` / `contactPersonRole` | One optional name and role, with no explicit channel relationship | Restricted person evidence; never attach automatically to every phone/email and never create a person-only contact row |
| `branches[].phone` | Optional phone nested under a branch ordinal | Location candidate only when the exact branch maps to one physical location for the same Supplier |
| `whatsappAvailable` | `yes`, `no`, or `unknown` about the UI's primary phone concept | No first-boundary channel or capability row; association is ambiguous when multiple phones exist |
| `facebook` / `instagramLinkedin` / free text | URLs or mixed social/contact text | Outside the initial channel set; preserve for later reviewed expansion and never coerce to `website` |

## 3. Contact endpoint, channel, phone kind, and subject

### 3.1 One endpoint per row

One row stores one usable endpoint only. It cannot contain a phone and email, several phone numbers, a list of websites, or a JSON contact bundle. A value containing several endpoints must be split only by an approved deterministic parser with complete source disposition; otherwise it remains quarantined.

The initial channel codes are:

| `channel_type` | Required endpoint shape | Additional rule |
|---|---|---|
| `phone` | One canonical international phone number; optional separately parsed extension | Requires one `phone_kind`; no email or URL fields |
| `email` | One syntactically valid mailbox with normalized domain | No phone kind or URL fields |
| `website` | One absolute `http` or `https` URL under the section 10 rules | Subject must be `generic_company`; no person fields or phone kind |

Phone kind is exactly `fixed_line`, `mobile`, or `unspecified`. It is a technical number classification. It does not prove who owns, controls, answers, or may disclose the number. A source value that merely resembles an Iraqi mobile number may become a review candidate, but no active `mobile` classification is created until the approved phone library/numbering-plan version validates it.

### 3.2 Generic company, named person, and uncertain subject

`subject_kind` is exactly:

- `generic_company` — reviewed evidence identifies a Supplier-wide or location-wide organizational endpoint such as a switchboard, generic mailbox, or company website;
- `named_person` — the endpoint is explicitly associated with one named individual in the source/evidence; or
- `unspecified` — the Supplier association is reviewed but the evidence does not safely distinguish an organizational endpoint from a personal endpoint.

A `named_person` row requires one bounded person display name and may include one bounded role/title. Generic-company and unspecified rows prohibit person name/role. A website row is always generic-company in this first boundary.

`supplier_profile_id` means the row is associated with and governed under that Supplier profile. It does **not** prove legal ownership or control of a telephone number, mailbox, domain, or person's employment. Those claims require separate evidence and must not be inferred from document placement.

Person-only records are deliberately excluded. A legacy name/role without a proven endpoint association remains restricted source evidence. If the product later needs reusable people, several channels per person, shared assistants, or organization-wide address books, it requires a separately approved `supplier_contact_people` model rather than silently stretching this table.

## 4. Supplier ownership, company/location scope, and location integrity

Every contact row has exactly one non-null `supplier_profile_id`. There is no organization owner, user owner, or shared cross-Supplier contact in the initial contract.

- `location_id is null` means Supplier-wide/company-level scope. It does not imply headquarters.
- A non-null `location_id` means the evidence identifies that endpoint with one exact physical Supplier location.
- Service-coverage rows cannot receive contacts.
- A top-level Supplier phone/email/website is never assigned to headquarters or the first branch by default.
- `branches[].phone` may link only after the corresponding source branch deterministically maps to one physical location. A missing, rejected, ambiguous, or many-target branch mapping leaves the phone unlinked or quarantined according to the approved mapping rule; it is never guessed.

Same-Supplier and physical-location integrity must be declarative in the future foundation:

1. add a non-partial unique key/index on `supplier_locations (supplier_profile_id, id, record_class)` solely to support the child reference;
2. store the linked location class beside the nullable location ID in `supplier_contacts`;
3. require both location fields to be null together, or require the class to equal `physical_location`; and
4. use a restrictive composite foreign key from `(supplier_profile_id, location_id, linked_location_class)` to the corresponding location key.

A simple `location_id` foreign key plus application validation is insufficient because it allows a cross-Supplier or service-coverage link. Active-contact versus archived-location coherence remains a cross-row lifecycle rule for a future trusted mutation command; an empty table needs no trigger or routine, and no non-synthetic row may be activated before that command exists.

## 5. Purpose, person role, and primary/preferred semantics

Contact purpose and a person's job role are separate:

- initial purpose codes are `general`, `sales`, `procurement`, `accounts`, `support`, and `management`;
- null purpose means unknown, not `general`;
- a purpose may be recorded only from exact reviewed evidence; mailbox wording, role title, array position, page location, or search intent does not prove it;
- a named-person role/title is descriptive personal evidence and never grants application, Supplier, reviewer, procurement, or contractual authority; and
- ambiguous/custom purposes and roles remain restricted evidence until an approved controlled mapping or bounded display policy exists.

Use one positive `preference_rank` rather than separate `is_primary` and `is_preferred` flags. Rank 1 means the reviewed preferred/default routing endpoint only within the exact `(Supplier, company-or-location scope, purpose-or-unknown)` contact set. Higher ranks are alternates, and active ranks are unique within that set.

Preference does not mean public, verified, consented, legally usable, currently reachable, owned by the Supplier, or suitable for an RFQ. Source array order is not preference. A future trusted command must keep ranking contiguous or otherwise deterministically ordered and must not leave two active rank-1 rows in one set.

## 6. Recommended row contract

The exact SQL names, types, lengths, constraint/index expressions, and assertion counts remain a later technical review. The product/data/security field groups are:

| Field group | Recommended contract |
|---|---|
| Identity/owner | Database UUID; non-null restrictive Supplier FK |
| Scope | Nullable physical-location ID plus constant linked class under the composite same-Supplier FK |
| Endpoint | Channel type, phone kind only for phone, display value, normalized value, optional phone extension |
| Subject | `generic_company`, `named_person`, or `unspecified`; person name/role only for named-person rows |
| Routing | Nullable controlled purpose and positive preference rank within the exact scope/purpose set |
| Verification | State, method/version, verified/failed time, nullable provider-neutral actor, and restricted evidence reference under section 7 |
| Privacy/disclosure | Personal-data classification, legal-basis status/reference where required, and maximum disclosure classification defaulting to `restricted` |
| Source/mapping | Bounded source type/namespace/field/ordinal, evidence reference, mapping/normalizer versions, mapping outcome, reviewer/time |
| Lifecycle | `draft`, `active`, `superseded`, `archived`, or `erased`; validity dates and provider-neutral created/updated actors/times |

Type-specific shape checks prohibit mixed channels. Display values are preserved for presentation but never become identity. Normalized values are protected internal identifiers and never enter a public URL, client log, analytics payload, or unrestricted search index.

Material changes to endpoint, subject/person, Supplier, location, purpose, normalization version/result, verification meaning, legal-basis state, or maximum disclosure close the current row and create a reviewed successor. Presentation-only changes may use a later trusted update only where history, privacy, and concurrency rules permit.

## 7. Verification status and provenance

Recommended verification states are `unverified`, `pending`, `verified`, `failed`, and `stale`.

- `verified` means only that an approved verification method confirmed the exact fact named by that method and version at the recorded time.
- Endpoint reachability, Supplier association, company control, person identity, employment/role, legal basis, consent, and public disclosure are different facts. One cannot stand in for another.
- Verified rows require an approved method/version, authoritative timestamp, bounded restricted evidence reference, and either a provider-neutral human verifier or an approved system-source code.
- Endpoint mutation always creates/supersedes and resets verification; it never carries verification to the new value.
- Failed, stale, expired, bounced, disconnected, or complained-about endpoints are immediately excluded from future projections/routing and enter trusted review.
- No universal freshness interval, re-verification cadence, or automatic expiry is invented here. The Owner must approve it per verification method before non-synthetic activation.

Reviewer/verifier/creator/updater identities are provenance only. Recording a user FK grants no review, activation, disclosure, deletion, or Supplier authority. Those permissions belong to later trusted commands and security policy.

## 8. Privacy, consent/legal basis, and PII minimization

The default disclosure classification is `restricted`. A named person, named mailbox, direct-dial phone, mobile, uncertain-subject endpoint, person role, exact normalized endpoint, verification evidence, legal-basis evidence, source reference, reviewer identity, and lifecycle history are personal or potentially personal and remain restricted.

- No consent/evidence means no recorded consent/evidence. It never becomes implied consent, legitimate interest, Supplier ownership, verification, or public permission.
- Consent, if selected as the applicable basis, must record the exact person/data/audience/purpose scope, capture method, authoritative time, evidence reference, and withdrawal state. Consent for internal review does not imply authenticated or public disclosure.
- Other legal bases may be represented only after the Privacy/Legal Owner approves the jurisdiction, controlled basis codes, evidence standard, notices, purpose limitation, retention, rights handling, and audience consequences.
- A Supplier's proposal, a Firebase field, a public webpage, a company domain, or a reviewer decision does not by itself prove the legal basis to store or disclose a named person's contact data.
- Named-person or potentially personal rows require a documented approved basis before activation. Until then they remain absent from the canonical active set and are handled only in restricted quarantine/review evidence under an approved retention rule.
- Generic business endpoints remain restricted by default even when reviewed as non-personal. Their future disclosure still requires explicit audience approval.
- Do not store identity documents, consent documents, message bodies, call recordings, passwords, tokens, raw Firebase records, full workbooks, unrelated notes, or secret evidence in this table.

The schema must support prompt suppression and eventual erasure. Personal data must not be retained indefinitely merely to preserve a convenient history or duplicate hash.

## 9. Lifecycle, removal, deactivation, and retention

- `draft` is non-canonical and non-projectable.
- `active` is the current reviewed endpoint, but still restricted unless a later projection independently permits it.
- `superseded` closes a materially changed endpoint while preserving the minimum permitted lineage.
- `archived` is inactive because it is obsolete, unreachable, withdrawn from use, or no longer associated with the Supplier/location.
- `erased` records only the minimum non-PII tombstone/audit fact permitted by the approved policy after values, person fields, normalized keys, and unnecessary evidence are removed.

Consent withdrawal, a substantiated removal request, failed association, verified compromise, or other privacy/security stop immediately disables projection and routing before final retention disposition. Normal product deletion must not silently destroy required audit/migration integrity, but audit convenience must not override an approved erasure right.

Exact retention periods, legal holds, evidence segregation, redaction versus physical deletion, downstream cache/search removal, and source-evidence retention remain Privacy/Legal Owner decisions required before any personal contact ingestion. No fixed period, indefinite retention, or hash-retention workaround is inferred by this contract.

## 10. Normalization and duplicate prevention

Normalization is versioned and channel-specific. Current application normalizers remain discovery evidence only.

### Phone

- Canonical phone identity is E.164 with a leading `+`, produced only after an approved library and numbering-plan version validates country context and length.
- Do not assume Iraq from locale, Supplier location, `0`/`7` prefixes, or the current digit-only normalizer.
- Extension is a separate bounded component and is never appended ambiguously to the E.164 value.
- Formatting punctuation is presentation only. Carrier, mobile/fixed-line classification, WhatsApp capability, person ownership, and reachability are not inferred from normalization.

### Email

- Trim surrounding space, require one syntactically valid address, normalize Unicode/IDNA domain handling, and lowercase the domain.
- Preserve the local part for canonical identity. Do not remove dots, plus tags, or provider-specific characters, and do not assume all providers treat local-part case or aliases equally.
- A lowercased-whole-address or provider-specific variant may support protected review matching only; it never auto-merges or rewrites the canonical address.

### Website

- Accept one absolute `http` or `https` URL, lowercase and IDNA-normalize the host, remove only a default port and empty root trailing slash, and reject credentials/fragments.
- Do not silently upgrade `http` to `https`, strip meaningful paths/queries, collapse subdomains, or treat the registered domain as the exact endpoint.
- Cross-domain redirects and ownership require separate verification; the current scheme/`www` stripping normalizer is duplicate-discovery evidence only.

Active exact uniqueness is one row per `(Supplier, company-or-location scope, channel type, canonical endpoint, extension)` regardless of purpose, subject, source, reviewer, or rank. A repeated endpoint in the same scope is one contact whose conflicting person/purpose/preference evidence must be reconciled; it is not several active rows. The same endpoint at company and location scopes, or at several locations, is allowed only with explicit evidence and appears in the collision report.

Many source values that resolve to one semantic endpoint produce one target and preserve contributing evidence through the existing migration merge/reconciliation contract. Cross-Supplier endpoint equality is a protected duplicate-review signal only; it never reassigns, merges, verifies, publishes, or proves ownership.

## 11. Ambiguous and incomplete Firebase routing

| Source evidence | Canonical outcome before an approved mapping version |
|---|---|
| Valid-looking top-level phone with unproved country/type/subject | No active row; `pending_review` with source ordinal preserved |
| Current `normalizedPhones[]` value | Discovery/collision evidence only; never canonical identity by itself |
| Several numbers in one string | No active row unless an approved deterministic parser produces complete, reviewable dispositions |
| Top-level email with no subject evidence | Candidate `email` with `subject_kind = unspecified`; restricted and not active until association/privacy requirements pass |
| Generic mailbox/domain inferred from label or address text | No automatic `generic_company` or purpose classification |
| Website with missing/unsafe/ambiguous scheme or mixed social value | No active website row; preserve as pending/unmapped evidence |
| `contactPerson` and role plus several phones and one email | Do not attach the person to any endpoint without exact association evidence; preserve all coordinates for review |
| `contactPerson`/role only | No contact row; restricted person evidence pending a later people model or exact endpoint association |
| `branches[].phone` and one exact mapped physical branch | Location-scoped phone candidate for the same Supplier; review/normalization/privacy still required |
| `branches[].phone` with missing/ambiguous/non-physical branch target | No linked contact row; preserve the branch ordinal and mapping exception |
| `whatsappAvailable = yes` with one or many phones | No automatic messaging capability or preferred-phone claim |
| Blank, placeholder, malformed, contradictory, or unknown value | No target; explicit `unmapped`, `rejected`, or `pending_review` disposition with no silent drop |

Mapping outcomes remain `unknown`, `pending_review`, `mapped`, `unmapped`, and `rejected`. Only reviewed `mapped` evidence may support a later activation, and activation additionally requires the verification/privacy/lifecycle rules in this contract.

## 12. Migration quarantine and evidence required before movement

Ambiguous or incomplete source values do not belong in active `supplier_contacts`. They remain in restricted migration-control evidence and exception artifacts with bounded identifiers and dispositions. Quarantine is not a public-schema contact status, a public review queue, or permission to retain raw personal data indefinitely.

Before any contact population, backfill, reconciliation, or cutover, a separately approved package must include:

1. authorized bounded source snapshot identity, environment, count, source version, and per-field presence counts without full records;
2. safe distinct-shape manifests for phone/email/website/person/role/branch/WhatsApp/social fields, including blanks, placeholders, multi-value strings, malformed values, and cross-field attachment patterns;
3. approved channel, subject, purpose, normalization, verification, privacy/legal-basis, disclosure, lifecycle, and retention versions;
4. versioned exact parsing/mapping rules with an explicit outcome for every source shape and no inferred country, subject, person-channel link, purpose, location, verification, or consent;
5. deterministic source child keys/ordinals and exact branch-to-physical-location mappings before any location link;
6. same-Supplier/location, endpoint, scope, person-association, and cross-Supplier collision reports with bounded sample keys only;
7. exception counts for unknown/pending/unmapped/rejected/quarantined values and zero-target/one-target/many-target outcomes;
8. dry-run reconciliation, replay determinism, forward/reverse traces, target-content fingerprints, merge groups, and rollback/supersession order;
9. an approved retention/removal plan for canonical and quarantine data, including withdrawal/erasure and downstream cache/search cleanup;
10. separately approved trusted activation/deactivation commands, reviewer authority, RLS/projections, and positive/negative security tests before any client or operational use; and
11. explicit approval of environment, data authority, mapping version, privacy/legal basis, audience, and migration plan.

Counts alone are insufficient. Any unexplained value, attachment, collision, cross-Supplier link, location class, source disposition, replay difference, or personal-data basis blocks movement.

## 13. Future RLS and audience projections

The `public` schema name is not a visibility decision.

- A future empty foundation revokes all privileges from `public`, `anon`, `authenticated`, and `service_role` and creates no policy, view, RPC, publication, trigger, or browser/API grant.
- No browser role directly inserts, verifies, activates, ranks, discloses, archives, erases, or relinks contacts. Proposals and reviews require separately approved trusted commands.
- RLS is not column security. Any future read uses field-minimized security-invoker views or RPC projections after a separate Extra High Security review under SEC-001/SUP-005.
- No anonymous/public or authenticated projection is approved now.
- A future public projection may be considered only for reviewed active generic-company endpoints that are verified for the exact disclosed fact, separately approved for public disclosure, and stripped of person, exact provenance, evidence, normalized key, actor, legal-basis, and history fields. Named-person and unspecified-subject endpoints are never public by default.
- A future authenticated projection may disclose no more than the approved business purpose requires. Named-person data needs an independently approved audience/purpose/legal-basis rule and cannot be unlocked merely because a user is signed in, is a Buyer, or can view the Supplier.
- Internal reviewers receive role- and task-minimized access. Internal does not mean universally visible to staff, and raw source/quarantine evidence remains segregated from the contact projection.
- Supplier-owner self-service, if later approved, is a proposal/review workflow; Supplier ownership does not grant direct base-table mutation or automatic public-disclosure authority.

## 14. Search, duplicate review, and RFQ exposure

- Contact endpoints, person names/roles, normalized values, and exact-match keys do not enter anonymous/authenticated full-text search, autocomplete, ranking, analytics, or public duplicate APIs.
- Protected exact endpoint comparison may support trusted duplicate review, but a match is evidence only. It cannot auto-merge Suppliers, reveal another Supplier's contact, or create ownership/verification.
- SEARCH-001 remains Open. This contract approves no contact-based ranking, keyword generation, filter, or index technology.
- RFQ discovery, eligibility, recipient selection, publication, and response authority do not depend on the presence, verification, or preference rank of a contact.
- RFQs and recipient snapshots do not copy Supplier contacts by default. Platform notifications/messaging remain the routing boundary until a separately approved RFQ contact-delivery contract establishes purpose, audience, retention, and immutable snapshot rules.
- A Buyer viewing or sending an RFQ receives no named-person endpoint merely from authentication or Supplier selection. RFQ-003 and the messaging gates remain unchanged.

## 15. Viable table-boundary options

| Option | Boundary | Benefit | Cost/risk | Disposition |
|---|---|---|---|---|
| A | One endpoint-oriented `supplier_contacts` table with channel/phone-kind/subject shapes and optional same-Supplier physical location | One Core Phase 1 concept; normalized endpoint uniqueness; supports company and named-person channels without a separate people identity; smallest RLS/lifecycle surface | Repeats a person's name if several endpoints are later needed; deliberately cannot model person-only records or shared/multi-channel people | **Recommended conditional future slice** |
| B | `supplier_contact_people` plus `supplier_contact_channels` | Clean reusable person identity and several channels per person | Two sensitive tables, person lifecycle/linkage/duplicate rules, broader RLS/retention surface, and no proven current need for a people directory | Defer until product evidence requires it |
| C | Separate phone, email, website, and person tables | Homogeneous channel columns | Four or more tables, duplicated governance, inconsistent ranking/scope, and wider security surface | Reject |
| D | One contact header plus JSON/arrays of endpoints | Close to current Firebase and flexible | Weak type/FK/duplicate enforcement, coarse privacy/retention, and difficult field-minimized projection | Reject |
| E | Contact columns/arrays on `supplier_profiles` or `supplier_locations` | Few joins | Broadens root exposure, cannot safely version/remove personal values, and reintroduces branch/contact circularity | Reject |
| F | Person-only contact rows mixed with endpoint rows in one table | Preserves `contactPerson` even without a channel | Stores unnecessary PII, creates unclear utility/verification/uniqueness, and blocks a clean endpoint contract | Reject |

Option A is not an organization address book and does not preclude the later two-table people model. A later approved migration can introduce people and relink named-person endpoints without changing generic-company endpoint meaning.

## 16. Smallest safe future SQL slice and dependency conclusion

An empty local-only Supplier contacts foundation **can be dependency-safe before RLS and migration, conditionally**. It is not selected or authorized by this documentation task.

A later owner-approved exact SQL/pgTAP task may include only:

- one empty `public.supplier_contacts` table implementing the field groups and invariants in sections 3-10;
- one narrow non-partial supporting unique key/index on `supplier_locations (supplier_profile_id, id, record_class)` for the composite child FK;
- restrictive Supplier/location/reviewer/actor relationships, including same-Supplier and physical-location declarative enforcement;
- type/subject/privacy/provenance/lifecycle shape checks and active endpoint/scope/rank uniqueness;
- structural indexes, comments, and complete API-role privilege revocation; and
- focused disposable synthetic pgTAP for accepted/rejected shapes, cross-Supplier and service-coverage rejection, normalization-boundary storage, duplicates, restrictive deletes, zero rows/access objects, and continued exclusion of all out-of-scope concepts.

It must include no contact row, raw evidence, parser/mapping execution, trigger/trusted mutation routine, RLS/policy/view/RPC, Auth bridge, search/RFQ behavior, client integration, payment-options dependency, Firebase access, hosted operation, or Production/TEST data.

The supporting location uniqueness object is additive and redundant with the location UUID identity, but it is required to make Supplier/class agreement declarative. Without that object and composite FK, the empty contact table is not dependency-safe because a later row could link across Suppliers or to service coverage.

The empty boundary is safe without RLS because it is explicitly revoked and contains no data. It is safe without migration because no source transformation runs. It is **not** safe for non-synthetic activation until owner approval, trusted lifecycle/reviewer authority, personal-data basis/retention, and appropriate RLS/projection work exist.

If the payment-options ninth slice were separately merged first, its count change belongs only to that branch/merge. If this later contact boundary were then separately authorized and merged, contacts would add one Core Phase 1 concept and one physical table; this documentation does not project a canonical ordinal/count across the unmerged ninth-slice work. The verified state remains 14 physical / 12 implemented / 24 deferred.

## 17. Recommended owner decisions still required

SUP-005 remains unresolved until the designated owners explicitly approve or amend:

1. the endpoint-oriented Option A boundary and rejection of person-only canonical rows;
2. channel, phone-kind, subject, company/location scope, purpose, and preference-rank semantics;
3. the composite same-Supplier physical-location enforcement and the supporting location uniqueness object;
4. exact verification methods, what fact each verifies, verifier/system authority, failure behavior, and freshness/re-verification policy;
5. applicable privacy jurisdictions, personal-data classification, acceptable legal-basis codes/evidence, notices, consent scope/withdrawal, retention, erasure, legal holds, and quarantine handling;
6. whether any public or authenticated projection will ever be allowed and, if so, the exact audience/field/purpose gates—named-person exposure must remain separately explicit;
7. source/mapping/normalizer versions, collision/exception treatment, and the pre-migration evidence package;
8. trusted reviewer/activation/deactivation/erasure authority without deriving authority from recorded actor IDs; and
9. whether to select the conditional empty table plus supporting location object as a later SQL slice after the active ninth-slice work is resolved.

Technical-owner choices remain later: exact SQL names/types/lengths, E.164/IDNA libraries and versions, URL/email validation details, constraint/index expressions, evidence-reference format, tombstone mechanics, and focused pgTAP assertions. Those choices cannot weaken the approved product/privacy boundary.

## 18. Risks, validation, and exact stop point

Key risks are false person-channel attachment, treating mobile format as company ownership, publishing named-person details without a valid basis, copying branch phones onto the wrong Supplier/location, over-normalizing email/URL aliases, exposing protected exact-match keys, retaining PII indefinitely, and using contact presence as RFQ eligibility or search ranking. The contract fails closed on each risk.

Required validation is documentation-only: latest refreshed `origin/main` after merged PR #77 and PR #76/#75 lineage, 14 physical tables, 12 implemented / 24 deferred Core Phase 1 concepts, 12 unchanged Open gates, links, terminology, sensitive-content patterns, documentation-only diff, and `git diff --check`.

Do not start Supabase, replay migrations, run pgTAP, access Firebase, run the application build, run repository/runtime/database suites, implement SQL, create data, or modify the active Supplier payment-options implementation branch.

Exact stop point: one Draft PR containing the decision-ready Supplier contacts contract and synchronized planning documents. Stop before owner approval, SUP-005 resolution, SQL/pgTAP selection or implementation, RLS/Auth, mapping execution, data movement, Firebase/hosted access, Ready-for-review state, merge, or deployment.

## 19. References

- [`24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md`](24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md)
- [`25_SIXTH_SQL_SLICE_SUPPLIER_LOCATIONS_SELECTION.md`](25_SIXTH_SQL_SLICE_SUPPLIER_LOCATIONS_SELECTION.md)
- [`29_SUPPLIER_PAYMENT_OPTIONS_PRODUCT_AND_DATA_CONTRACT.md`](29_SUPPLIER_PAYMENT_OPTIONS_PRODUCT_AND_DATA_CONTRACT.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
