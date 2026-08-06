# Supplier category assignment product and data contract

Status: **Approved Option B; proposed seventh SQL slice selected for later separately authorized implementation**
Contract date: 6 August 2026
Verified start: `origin/main` `a28229a6171c5ab7f13dd2c06fbbef769726b82b`
Primary task profile: Documentation

## 1. Decision boundary

This document supplies the approved product/data contract requested by the seventh SQL-slice hard stop for the future `public.supplier_category_assignments` relation. It refines the already Resolved SUP-003 taxonomy direction without reopening it and records the Product/Data Owner's selection of the smallest dependency-safe boundary:

- one assignment is one reviewed classification of one Supplier profile to one canonical Supplier-offering category;
- assignment roles are `primary` and `secondary`, with at most one current primary per Supplier;
- only a reviewed trusted mutation may activate an assignment, and activation validates the then-current category as an active assignable leaf;
- `public.category_aliases` is not a structural prerequisite for an empty assignment table, but an implemented, populated, reviewed alias boundary is mandatory before any transformation uses alias matching;
- ambiguous, broad-only, global `other`, rejected, or unmapped source evidence creates no canonical assignment row;
- historical assignments are closed, never silently rewritten or normally hard-deleted; and
- base rows remain non-public, with no RLS, browser/API privileges, Auth behavior, mapping execution, data movement, or Production behavior in the contemplated empty local slice.

This approval selects the future one-table SQL/test planning boundary described in section 13. It does not authorize implementation, close an Open gate, authorize a taxonomy or alias row, authorize a transformation artifact, or authorize data access.

## 2. Verified starting state

- PR #70 is merged at `c19362b114c5ff79430e1c73b59552f41de2a02c`; PR #71 is merged at `a28229a6171c5ab7f13dd2c06fbbef769726b82b`, the verified `origin/main` starting SHA, and synchronizes the post-PR-70 baseline.
- The local SQL foundation contains 12 physical tables representing 10 implemented Core Phase 1 concepts; 26 of 36 Core Phase 1 concepts remain deferred.
- `public.supplier_profiles`, `public.categories`, `public.user_profiles`, and the internal migration-control foundation exist locally.
- `public.supplier_category_assignments` and `public.category_aliases` do not exist.
- `public.categories` is an empty structural foundation. No canonical vocabulary, alias, or mapping execution is approved or populated.
- Firebase remains the live Production backend. Supabase remains local-only.
- The 12 Open approval gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## 3. Smallest viable options

| Option | Boundary | Dependency and risk finding | Disposition |
|---|---|---|---|
| A | Wait for `category_aliases`, canonical vocabulary, and mapping artifacts before even defining empty assignment DDL | Safest for transformation, but incorrectly couples a canonical FK join table to one optional source-resolution mechanism; delays a reversible empty structural boundary | Not preferred |
| B | Define one empty `supplier_category_assignments` foundation; keep aliases, vocabulary rows, mapping artifacts, trusted commands, RLS, and data separate | Parent identities already exist; aliases resolve source values but are not part of canonical assignment identity; table remains empty, revoked, local-only, and independently removable | **Approved and selected** |
| C | Define assignments and `category_aliases` together | Provides the complete lookup shape, but adds a separately governed physical child, normalization/collision lifecycle, and additional test surface before any approved alias data exists | Reject for the smallest slice |
| D | Define assignments and populate or transform Supplier categories | Requires approved vocabulary, mapping manifest, exception/collision evidence, reviewer authority, reconciliation, and data authorization; not reversible as empty DDL | Reject |

The Product/Data Owner approved Option B on 6 August 2026. This document also selects its exact one-table SQL/test planning boundary; it authorizes no implementation.

## 4. Canonical assignment semantics

### 4.1 Meaning and cardinality

A category assignment states that a reviewed current classification links one canonical `public.supplier_profiles` row to one canonical `public.categories` row. It describes the Supplier's offering classification; it is not:

- Supplier ownership, membership, verification, listing approval, RFQ eligibility, service coverage, capability, product, material phrase, keyword, or search synonym;
- evidence that the Supplier currently stocks every item under the category;
- an authorization relationship; or
- proof that a source label was a canonical category.

One Supplier may have zero or many historical assignment rows and zero or many current active rows. A Supplier with at least one current active assignment must have exactly one current primary assignment after a trusted mutation commits. Unclassified, pending-review, or wholly unmapped Suppliers may have zero active assignments. No fallback category is invented.

### 4.2 Role and order

- `assignment_role` is exactly `primary` or `secondary`; do not store a second primary boolean that can disagree with the role.
- At most one active primary assignment exists per Supplier.
- The same Supplier/category pair cannot be active twice, regardless of role, source, or reviewer.
- `position` is non-negative and unique within the Supplier's active assignment set. It is presentation order, not classification confidence or category identity.
- The primary assignment is normally first in a projection, but role remains authoritative; position alone never creates or changes primary status.
- The initial product guidance of 10 active assignments is configurable operational guidance only. It is not a database `CHECK`, migration rejection rule, or reason to discard valid evidence.

Current Firebase arrays do not prove a primary category. Array order, language, frequency, UI order, and the first recognized value must not be used to infer primary status. When no explicit reviewed rule identifies a primary assignment, the Supplier remains pending review and receives no active canonical assignment set.

### 4.3 Effective current classification

An assignment is effective for future directory or matching use only when all of the following are true at query time:

- the assignment is `active`;
- its Supplier profile is permitted by the separately approved audience projection; and
- its category is still `active` and `is_assignable=true`.

Category deprecation or archive does not rewrite or delete assignment history. The later trusted category-lifecycle command must close each affected active assignment in the same reviewed operation. If the affected row is primary and no reviewed successor is activated, the command closes the Supplier's remaining active set so the Supplier returns to zero active assignments rather than leaving active secondaries without a primary. No secondary assignment is auto-promoted.

## 5. Relationships

### 5.1 Supplier profiles

- Every assignment belongs to exactly one `public.supplier_profiles` row through an `ON DELETE RESTRICT` relationship.
- A Supplier profile may exist with no assignments.
- Profile archive does not delete assignment history and does not authorize a new activation.
- Assignment rows contain no organization, owner, member, Auth-provider subject, contact, location, or RFQ relationship.

### 5.2 Categories

- Every assignment references exactly one canonical `public.categories.id` through an `ON DELETE RESTRICT` relationship.
- The FK preserves identity only; it must not encode category `status` or `is_assignable` in a way that prevents later category deprecation or historical resolution.
- Activation checks the locked category row is an active assignable leaf in the `supplier_offering` taxonomy. Root, intermediate, draft, deprecated, and archived categories cannot receive a new active assignment.
- Category replacement is advisory review evidence. It never automatically rewrites an assignment to `replacement_category_id`.

## 6. Alias and legacy-category mapping rules

### 6.1 Structural dependency decision

`public.category_aliases` is **not** a structural prerequisite for an empty `public.supplier_category_assignments` table. Canonical assignment identity uses the category UUID, while aliases are one governed mechanism for resolving source evidence to that identity.

The boundary is strict:

- exact reviewed source-value-to-canonical-code rules may exist in a versioned repository mapping manifest without an alias row;
- if a transformation uses the SUP-003 alias matching stage, `public.category_aliases` must first be separately authorized, implemented, populated with reviewed rows, collision-checked, and included in the transformation evidence;
- an alias table, mapping manifest, or fuzzy candidate never creates an assignment by itself; a reviewed assignment decision remains required; and
- the empty assignment slice must not create `category_aliases`, aliases, mappings, or category rows.

### 6.2 Matching and precedence

Use the approved SUP-003 order and stop only at a deterministic result:

1. exact canonical code or exact source-specific mapping;
2. approved versioned normalization and exact normalized mapping;
3. one active, collision-free alias in the declared source namespace and locale/script;
4. manual review.

Canonical code wins over alias. An alias cannot shadow another category's canonical code. Translation, transliteration, token splitting, stemming, fuzzy score, category popularity, Supplier prominence, and array position never produce an automatic assignment.

Many legacy values may map to one category when every mapping rule is explicit. One source value may map to several categories only through a reviewed split rule with an ordered target set, rationale, mapping version, and reconciliation evidence. Multiple source values that resolve to the same Supplier/category target produce one active assignment and preserve contributing source evidence through the migration-control merge/reconciliation contract, not duplicate assignment rows.

### 6.3 Legacy-value outcomes

Use the SUP-003 outcome vocabulary: `unknown`, `pending_review`, `mapped`, `unmapped`, and `rejected`.

- Only `mapped` evidence with an explicit canonical target and completed review may support activation.
- A broad parent-only match is `pending_review`; it never guesses a leaf.
- Global legacy `other` creates no assignment. Preserve it and any bounded explanatory phrase for review.
- Free-text `subcategories[]` and `relatedMaterialService` remain evidence unless an approved mapping establishes category equivalence.
- Capabilities, brands, part numbers, products, standards, phrases, and search terms never become category assignments merely because text overlaps.
- Every non-mapped outcome retains bounded original evidence, source coordinates, versions, reason, and reconciliation result outside the public assignment row.

## 7. Source and provenance contract

### 7.1 Canonical row provenance

Each assignment row needs bounded, trusted provenance sufficient to explain the decision without copying a complete source record:

| Field group | Contract |
|---|---|
| Source class | Required bounded `source_type`, initially distinguishing reviewed legacy migration, reviewed import/submission, and trusted manual curation; a generic untraceable `system` source is prohibited |
| Source namespace | Required bounded namespace identifying the source contract, not a user or secret |
| Evidence reference | Nullable bounded internal/repository reference to the reviewed mapping or curation evidence; no URL token, raw workbook, full Supplier payload, or personal data |
| Transformation versions | Mapping and normalizer versions required when source resolution or transformation produced the candidate |
| Confidence | Optional trusted bounded evidence only; never a substitute for review, never public, and never used to bypass ambiguity |
| Review | Required reviewer `user_profiles` FK and review time before activation |
| Actors/times | Created/updated times and nullable provider-neutral actor FKs; browser-supplied identity is never authoritative |

Original source values, normalized comparison values, alias-match details, source collection/document/field/child identity, mapping outcome/reason, and reconciliation evidence belong in the restricted reviewed mapping artifacts and existing internal migration-control relations. They must not be duplicated wholesale into a directory-facing assignment row.

### 7.2 Deterministic migration child identity

For a migrated Supplier source record, the active logical child key is the approved canonical category code plus assignment role, as already required by SUP-003. The transformation version also records deterministic ordering inputs. A mutable array index alone is insufficient.

Changing the primary decision changes the semantic child key and requires a reviewed correction that closes the prior row and creates the successor. Replay of the same source snapshot and transformation version must return the same active mapping and target, never a duplicate row.

## 8. Lifecycle and correction

| From | Allowed next status | Rule |
|---|---|---|
| `draft` | `active`, `archived` | Draft has an explicit canonical target but is non-public and unusable; activation requires completed review and current invariant checks |
| `active` | `superseded`, `archived` | Supersede when a reviewed correction/reclassification replaces it; archive when withdrawn or invalidated without a current replacement |
| `superseded` | none | Terminal historical state; correction creates a new row |
| `archived` | none | Terminal historical state; correction creates a new row |

- `valid_from` is set on activation. A terminal transition sets `valid_until`, and `valid_until` must be later than `valid_from`.
- Draft rows do not participate in active uniqueness, directory projection, search, RFQ evidence, or migration success counts.
- Rejected, ambiguous, or no-target source proposals normally remain mapping/review outcomes and do not require an assignment row.
- A material role, target category, source decision, or activated position correction closes the old row and creates a new row; it does not update historical meaning in place.
- No normal hard delete is allowed after activation, migration mapping, or downstream historical use. A never-active unreferenced synthetic draft may be removed only within a separately authorized disposable test/development correction.
- Exact correction lineage, audit events, and trusted commands remain later implementation work; absence of those objects does not permit in-place historical rewrites.

## 9. Reviewer and owner responsibilities

### Product/Data Owner

Under the current founder-led dual-role governance recorded by SUP-003, the Product Owner and Data Owner are the same decision authority until later delegation. That authority approved this complete contract and Option B on 6 August 2026 and must:

- approve canonical vocabulary and mapping-manifest versions before transformation;
- approve reviewer delegation, primary-selection rules, split/merge rules, and material exception classes;
- accept reconciliation and rollback evidence before any data migration authorization; and
- never treat approval of this document as approval of SQL, RLS, hosted work, or data movement.

### Proposer and reviewer

- A Supplier owner, contributor, import, migration process, or staff member may later propose evidence only through an approved workflow; no proposal has canonical authority.
- The designated taxonomy/data reviewer verifies the Supplier, category meaning, source evidence, mapping version, collisions, primary decision, duplicate set, and lifecycle transition before activation.
- A fuzzy candidate, source array order, client role, email, Auth UID, or popularity signal cannot act as reviewer.
- The reviewer identity is provider-neutral `public.user_profiles.id`. This contract selects no Auth provider, platform role, RLS policy, or application permission and therefore does not resolve ID-001 or SEC-001.
- Technical and security reviewers later own declarative constraint coverage, trusted-command atomicity, API privilege revocation, RLS/projection design, and positive/negative tests. They do not redefine taxonomy meaning silently.

The reviewer and proposer need not be distinct people in the founder-led phase unless the Product/Data Owner later requires separation. The proposal source and review decision must still be independently recorded fields/evidence; a direct client write can never stand in for review.

## 10. Duplicate prevention and enforcement boundary

### 10.1 Declarative expectations

A later SQL selection must require:

- database-generated UUIDv4 identity;
- restrictive FKs to Supplier, category, reviewer, and actor profiles;
- bounded checks for role, status, source/provenance, position, timestamps, and lifecycle shape;
- one active row per `(supplier_profile_id, category_id)`, regardless of role or source;
- at most one active primary row per Supplier;
- one active row per `(supplier_profile_id, position)`; and
- structural indexes for Supplier/status/role/position and category/status/Supplier lookup.

Historical `superseded` and `archived` rows are intentionally outside active uniqueness and may repeat prior Supplier/category or position values.

### 10.2 Trusted-command expectations

Declarative FKs and partial uniqueness cannot safely enforce every cross-row rule. The later trusted activation/correction command must lock the Supplier's current assignment set and target categories in a deterministic order, then atomically:

- verify the Supplier is not archived and the target category is an active assignable `supplier_offering` leaf;
- recheck active duplicate, primary, and position conflicts;
- require one primary when the post-commit active set is non-empty;
- require completed review/provenance and the authorized actor under the later security design;
- close replaced rows and insert successors without an interval overlap;
- write the later-approved audit/event/idempotency evidence when those foundations exist; and
- fail with no partial change on stale versions, collisions, ambiguity, or invalid lifecycle.

The category lifecycle command may deprecate or archive a category without deleting assignment history only by locking affected Supplier sets and closing their active references atomically. Affected secondary rows close individually. An affected primary must be replaced by an explicitly reviewed new primary in the same operation or the Supplier's whole active set closes pending review. It must not auto-reassign, auto-promote, or revive closed assignments if the category is later reactivated.

An empty local table can precede these trusted commands only while it has zero API-role privileges, no application integration, and no non-synthetic rows.

## 11. Evidence required before any transformation

No Supplier assignment transformation may begin until a separate reviewed package contains all of the following:

1. an authorized bounded source snapshot identity and source-field inventory for `categories[]`, `subcategories[]`, and relevant phrase evidence;
2. an approved populated canonical taxonomy with stable codes, active assignable leaves, bilingual labels, lifecycle state, and content fingerprint;
3. a versioned exact/normalized mapping manifest covering every distinct bounded source value and namespace;
4. the implemented/populated alias version and a collision/shadowing report if alias matching is used;
5. explicit treatment of broad parents, global `other`, free text, composite values, translations, collisions, and zero/one/many outcomes;
6. a reviewed primary-selection decision for every Supplier with one or more proposed targets, never inferred from array order;
7. deterministic child keys, ordering inputs, mapping/normalizer versions, source dispositions, reverse-target rules, and reviewed merge groups;
8. an exception report with safe counts and bounded sample keys only, containing no full Production records, raw workbooks, secrets, or unnecessary personal data;
9. dry-run reconciliation covering source-value outcomes, source Suppliers, proposed targets, duplicate collapses, active row totals, Suppliers with zero assignments, exactly-one-primary results, and deterministic replay;
10. rollback/supersession steps proving dependency order, mapping trace, target fingerprints, and preservation of historical evidence; and
11. explicit Product/Data Owner approval of the mapping version and a separately authorized environment/data-migration plan.

Counts alone are insufficient. Any unexplained value, target, duplicate, primary, reverse trace, or replay difference blocks transformation.

## 12. Future RLS and projection constraints

- The base table is non-public and the empty local implementation must revoke all table privileges from `public`, `anon`, `authenticated`, and `service_role`, consistent with existing foundations.
- No direct browser insert, update, delete, approval, role change, or lifecycle transition is allowed. Future proposals and reviews use separately approved trusted commands.
- RLS is not column security. Directory/Buyer/Supplier projections must be field-minimized security-invoker views or RPCs and must not expose source namespace/reference, mapping or normalizer versions, confidence, reviewer/actor IDs, review times, closure reasons, draft rows, or exception evidence.
- A current directory projection may expose only the permitted Supplier identity plus effective category identity/code, approved localized label/path, assignment role, and order. Anonymous exposure requires separate product/security approval.
- Deprecated/archived categories and superseded/archived/draft assignments remain restricted historical/review data and never appear as current classifications.
- Supplier owners may later see or propose their own classification evidence only after ownership, Auth, RLS, and application-permission review. This document creates no such authority.
- Cross-Supplier reads and writes, reviewer-only evidence, and trusted-source fields require explicit negative tests in the later Extra High Security RLS task.
- SEARCH-001 continues to own hierarchy expansion, synonyms, fuzzy behavior, ranking, FTS/trigram/external search, query plans, and performance indexes. Assignment DDL authorizes none of them.
- RFQ recipient eligibility and publication snapshots remain independent future contracts. An assignment row never directly authorizes an RFQ.

## 13. Selected future structural boundary

If separately authorized in a later implementation task, the selected seventh SQL slice may contain only:

- one migration creating an empty `public.supplier_category_assignments` table with the decision-level field groups in this contract;
- its UUIDv4 PK, restrictive FKs, checks, active uniqueness/indexes, comments, and API-role privilege revocations; and
- one focused disposable synthetic pgTAP contract plus minimum documentation evidence.

It must not contain:

- `public.category_aliases` or any other new table;
- category, alias, assignment, Supplier, mapping, seed, or reference rows;
- changes to `supplier_profiles`, `categories`, migration-control tables, Auth, organizations, locations, contacts, RFQs, or search;
- triggers, trusted mutation routines, RLS, policies, views, RPCs, grants, browser/API access, or application integration;
- mapping-manifest execution, Firebase access, import, export, migration, seed, backfill, reconciliation run, or Production/TEST data access or change; or
- hosted Supabase linking, remote SQL, merge, or deployment in this contract task.

If that exact one-table implementation is later authorized and merged, it would project 13 physical tables, 11 implemented Core Phase 1 concepts, and 25 deferred concepts. Until then, the verified current state remains 12 / 10 / 26.

## 14. Recorded owner decision

On 6 August 2026, the founder-led Product/Data Owner explicitly approved Option B and the complete contract as written, including:

- a future empty, local-only `public.supplier_category_assignments` foundation;
- no alias-infrastructure prerequisite for empty DDL and a hard block on alias-based transformation until separately approved infrastructure and mappings exist;
- exactly one reviewed primary category for every non-empty active assignment set, with no inference from legacy array order;
- preservation for review, rather than guessing, for ambiguous or unmapped legacy values; and
- the provenance, lifecycle, reviewer/owner, duplicate/enforcement, transformation-evidence, relationship, and future projection constraints in this contract.

All required assignment successor-contract decisions under SUP-003 are now satisfied. SUP-003 was already Resolved and remains closed; this approval does not silently close or weaken any of the 12 Open gates. The approved Option B boundary is selected as the proposed seventh SQL slice, but SQL and pgTAP implementation remain outside this PR and require a separate authorized task.

Transformation remains blocked until every artifact in section 11 and a separately authorized environment/data-migration plan exist. Approval of this contract and slice selection does not authorize data migration, seed, backfill, Firebase mapping execution, RLS, Auth, hosted Supabase, Production, or TEST work.

## 15. Risks

- Current source arrays do not encode primary status. Manual review volume may be significant; inferring primary would be a more serious integrity error.
- The current 23 controlled values are candidates, not an approved canonical vocabulary. Assignment DDL can remain empty until vocabulary approval, but no data use can.
- A missing alias table does not block empty DDL, yet it blocks any transformation that claims to use alias matching. Reviewers must not blur repository manifest mappings and active alias rows.
- Category deprecation can close a Supplier's whole active set when the primary is affected and no reviewed successor exists. Zero active assignments is safer than auto-promotion, an ineffective primary, or silent historical rewrite.
- Partial uniqueness enforces at most one primary, not exactly one for a non-empty set. That postcondition requires a future atomic trusted command.
- Provenance and reviewer fields are sensitive governance evidence. Exposing base rows would leak internal classification decisions.
- A future mapping change can produce one-to-many or many-to-one corrections. Existing migration-control merge, supersession, reverse-trace, and reconciliation rules must be used rather than weakening assignment uniqueness.

## 16. Validation and exact stop point

Required checks for this approval update are documentation-only: verify the start SHA and PR #70/PR #71 merges, 12 physical tables, 10 implemented / 26 deferred Core Phase 1 concepts, the 12 unchanged Open gates, absence of assignment/alias tables, relative links, terminology, Markdown structure, sensitive-content scan, documentation-only diff, and `git diff --check`.

Do not start local Supabase, replay migrations, run pgTAP, run Firebase suites, run the application build, or run full repository tests because no SQL or executable file is changed.

Exact stop point: PR #72 marked Ready with the approved contract, selected proposed seventh-slice planning boundary, and synchronized documentation. Stop before SQL or pgTAP implementation, merge, hosted work, data work, or deployment.

## 17. References

- [`18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md`](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md)
- [`19_FOURTH_SQL_SLICE_CATEGORIES_SELECTION.md`](19_FOURTH_SQL_SLICE_CATEGORIES_SELECTION.md)
- [`20_FOURTH_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md`](20_FOURTH_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md)
- [`24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md`](24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md)
- [`25_SIXTH_SQL_SLICE_SUPPLIER_LOCATIONS_SELECTION.md`](25_SIXTH_SQL_SLICE_SUPPLIER_LOCATIONS_SELECTION.md)
- [`26_SEVENTH_SQL_SLICE_SELECTION.md`](26_SEVENTH_SQL_SLICE_SELECTION.md)
- [`15_THIRD_SQL_SLICE_SELECTION.md`](15_THIRD_SQL_SLICE_SELECTION.md)
- [`16_THIRD_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md`](16_THIRD_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
