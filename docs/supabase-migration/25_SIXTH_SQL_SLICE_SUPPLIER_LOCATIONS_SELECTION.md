# Core Phase 1 sixth SQL slice: Supplier locations selection

Status: **Selected planning boundary; implementation not authorized or started**
Decision date: 6 August 2026
Verified start: `origin/main` `11f78fa23a7254a7a3f48e21830ba13fee9bbcfb`
Merged contract evidence: PR #66 merge `11f78fa23a7254a7a3f48e21830ba13fee9bbcfb`; reviewed head `b69988fcbd0e899eeb57c75b4372811c81f2f4d2`
Primary task profile: Documentation

## 1. Decision

Recommend and select **Option A: an empty `public.supplier_locations` foundation only** for a later separately authorized local SQL implementation.

This decision supersedes the pre-contract no-go in [`23_SIXTH_SQL_SLICE_SELECTION.md`](23_SIXTH_SQL_SLICE_SELECTION.md) only for future planning. That historical no-go remains correct at its recorded starting point. This document authorizes no SQL, pgTAP, data, RLS, hosted operation, merge, or deployment.

## 2. Verified current state

- PR #66 is merged into `origin/main` at `11f78fa23a7254a7a3f48e21830ba13fee9bbcfb` and contains the Supplier Location Product and Data Contract.
- The current local SQL foundation has 11 physical tables representing 9 implemented Core Phase 1 concepts; 27 of 36 remain deferred.
- `public.supplier_profiles`, `public.administrative_areas`, `public.user_profiles`, and the internal migration-control foundation already exist locally.
- `public.supplier_locations`, `public.supplier_contacts`, service-coverage assignments, RLS, Auth integration, and application access do not exist.
- Firebase remains the live Production backend. Supabase remains local-only.
- The 12 Open gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## 3. Candidate comparison

| Option | Boundary | Dependency and reversibility finding | Decision |
|---|---|---|---|
| A | Empty `supplier_locations` foundation only | Parent/reference/actor roots are merged; contacts point to locations later; no rows, mapping execution, RLS, Auth, hosted, Firebase, or Production dependency; independently removable before later dependents exist | **Selected** |
| B | `supplier_locations` plus service-coverage assignments | Requires approved administrative-area population, mapping manifest, source precedence/deduplication, exception handling, reconciliation, and data authorization | Rejected for this slice |
| C | `supplier_locations` plus contacts | Requires the later contact model, consent/verification/retention rules, audience projections, same-Supplier enforcement, and protected data transformation | Rejected for this slice |
| D | No-go until another contract is resolved | PR #66 resolves the earlier boundary, contact-direction, mapping-artifact, and exposure uncertainties for empty DDL without resolving an Open gate | Not selected |

Option A is independently reversible because it is empty, local-only, has no child table in the selected boundary, exposes no API authority, and requires only restrictive references to already merged roots. Normal rollback of a future implementation can remove its own table and test objects before any later dependent slice or data use; rollback after dependents or historical use would require a separately reviewed plan.

## 4. Minimum future DDL boundary

The later implementation may create exactly one empty `public.supplier_locations` table with the decision-level field groups below. Exact SQL types, lengths, constraint names, and index names belong to that implementation review.

| Boundary | Required decision |
|---|---|
| Stable identity | Database-generated UUIDv4 `id`, immutable after creation |
| Supplier relationship | Required `supplier_profile_id` with `ON DELETE RESTRICT`; a Supplier may have zero or many rows and no cascade may erase location history |
| Administrative-area relationship | Nullable `administrative_area_id` with `ON DELETE RESTRICT`; present only for a mapped physical row or mapped administrative-area coverage row; the current reference target is governorate-only |
| Physical/coverage classification | `record_class` is `physical_location` or `service_coverage`; allowed kinds are physical `headquarters`, `branch`, `unspecified_presence`, or coverage `administrative_area`, `national` |
| Branch/head-office semantics | At most one active headquarters per Supplier; multiple branches, including same-area branches, remain distinct; uncertain area evidence uses `unspecified_presence` and is never presented as a confirmed branch/headquarters |
| Ordering | Non-negative `position`, unique while active within Supplier/class/kind and stable after activation or historical use |
| Address and map treatment | Nullable bounded `city`, `market_area`, `address_text`, and allowlisted `map_url` are physical-only evidence; they do not prove ownership, legal registration, service coverage, or verification |
| Coordinate treatment | No latitude, longitude, geometry, radius, polygon, boundary, geocoding, or spatial index; a mapping "source coordinate" means source document/field/child identity, not geospatial coordinates |
| Coverage target | Nullable `coverage_code` whose initial only value is `all_iraq`; a mapped national row has this code and no area FK; no synthetic national administrative-area row |
| Mapping and source state | Bounded mapping status, rule version/reason, source origin/field/ordinal, and bounded original source text; never a complete Firebase payload |
| Review provenance | Nullable provider-neutral reviewer plus review time, both present or both absent and trusted-only |
| Lifecycle and actors | `draft`, `active`, `archived`; optional ordered validity interval; created/updated times and nullable provider-neutral actors; updated time cannot precede created time |

### 4.1 Shape and duplicate-prevention expectations

- Mapped physical and mapped administrative-area coverage rows each have exactly one administrative-area FK and no coverage code.
- Mapped national coverage has only `coverage_code=all_iraq`; non-mapped rows have neither target form and cannot participate in geographic matching.
- Coverage rows cannot contain city, market, address, map, or contact-location evidence.
- At most one active headquarters exists per Supplier.
- Active mapped coverage is unique per Supplier/administrative-area target, and at most one active `all_iraq` row exists per Supplier.
- Physical rows are not unique by area, address fragment, map URL, phone, name, or normalized free text; distinct same-area branches are allowed.
- Stable source-child replay uses the existing internal migration-record mapping contract, not a mutable array index or a new public mapping table.

### 4.2 Lifecycle, correction, and deletion

- Draft rows are restricted working state and do not qualify search or recipient selection.
- Active rows may be consumed only through a later approved trusted query/projection.
- Archived and rejected evidence remains restricted and cannot receive new selection use or contact links.
- No normal hard delete is allowed after activation, mapping trace, migration use, or RFQ historical use.
- A material correction closes or archives the prior assertion and creates a replacement under later approved lineage/audit behavior; this slice adds no trigger, mutation command, audit event, or replacement relation.

## 5. Firebase mapping and ambiguity rules

The current repository model stores top-level `governorate`, optional `governorates[]`, `city`, `marketArea`, `address`, `googleMapsLink`, structured `branches[]`, free-text `branchDetails`, free-form validated `coverageAreas[]`, and branch `phone`. The backend bounds these values but does not enforce the UI coverage vocabulary, so unknown or historical coverage strings must be expected.

| Current Firebase evidence | Future disposition | Ambiguity or preservation rule |
|---|---|---|
| Top-level `governorate`, `city`, `marketArea`, `address`, `googleMapsLink` | One ordered physical headquarters candidate when an approved exact source rule accepts it | Preserve source document/field identity and bounded originals; never infer coverage, legal address, or verification |
| Each `branches[]` item | One ordered physical branch candidate | Preserve child key/ordinal and bounded location values; reserve `phone` for later contact transformation; never merge by similar text alone |
| Free-text `branchDetails` | No direct structured location row | Preserve for manual review; never parse it automatically into a branch, address, phone, target area, or coverage assertion |
| Additional recognized `governorates[]` values | Physical `unspecified_presence` candidates unless stronger source evidence applies | Preserve exact value and precedence outcome; do not invent branch, address, priority, or coverage |
| `all_iraq` | One mapped national service-coverage candidate | Preserve original code and deterministic child identity; never expand to 19 governorate rows |
| `local_only` or `governorate_level` without an explicit target | Non-mapped `pending_review` evidence | Preserve original value and reason; never select the first governorate, city, market, or address by convenience |
| `imports_outside_iraq` | No location or coverage row | Preserve for later Supplier-capability review; it is international/import capability, not an Iraqi administrative location |
| Unknown, translated, contradictory, or unsafe value | No mapped geographic target | Preserve bounded original value, source identity, mapping outcome, rule version, and reason for manual review |

Physical presence and service coverage remain separate row classes and separate product questions. A physical row never qualifies service coverage; a coverage row never proves premises, branch, address, contact, import capability, listing approval, or RFQ eligibility.

Before any future Firebase transformation, a separate reviewed task must provide these repository artifacts:

1. a versioned exact/alias mapping manifest tied to approved administrative-area codes;
2. scalar/array/branch/coverage precedence and deduplication rules;
3. a collision and exception report;
4. deterministic child keys/ordinals and mapping-rule version;
5. zero/one/many reconciliation expectations; and
6. rollback/supersession behavior using the existing internal migration-control relations.

Those artifacts are data-migration prerequisites. They are not tables and are not required to create an empty structural foundation.

## 6. Dependency and security findings

### 6.1 Contact and organization dependencies

- `supplier_locations` contains no `contact_id`. The later `supplier_contacts.location_id` may point only to a physical row owned by the same Supplier, using a composite FK or equivalent trusted enforcement.
- Branch phone, Supplier-wide phone/email, contact person, consent, verification, visibility, and retention remain entirely outside this slice.
- Locations belong directly to Supplier profiles and contain no `organization_id`. ORG-001 and ORG-002 remain Open; no organization or membership is inferred from free text.

### 6.2 Search and RFQ implications

- Only active mapped service-coverage rows may become geographic coverage evidence; physical rows cannot silently qualify a Supplier.
- Search must eventually expose physical presence and service coverage as separately labeled filters. SEARCH-001 still owns query technology, ranking, hierarchy expansion, fuzzy behavior, and performance evidence.
- RFQ recipient authorization remains the future immutable `rfq_recipients` row, not a live location join. Coverage requirement, hierarchy matching, overrides, and publication snapshots remain under RFQ-003.
- The selected slice includes structural lookup indexes only. It includes no FTS, trigram, geocoding, spatial index, ranking, recipient logic, or query-plan claim.

### 6.3 Exposure boundary

- The base table is non-public and must be explicitly revoked from `public`, `anon`, `authenticated`, and `service_role` in the later local implementation.
- Source origin/field/ordinal, original source text, mapping status/rule/reason, review identity/time, actor IDs, and draft/rejected/unmapped evidence must never enter a public projection.
- Branch phones and all other contact/person fields are not location columns and must never be exposed through a location projection.
- Full address and map URL are not publicly authorized by this selection. Any later Buyer, Supplier, or anonymous projection requires field minimization, audience approval, and RLS/trusted-query review; no projection may expose base rows wholesale.
- A future RLS review must prove default-deny base access, trusted-only mutation/review fields, lifecycle-aware reads, Supplier ownership or audience scoping, and negative cross-Supplier tests. This requirement does not select or design a policy here.

### 6.4 Open-gate analysis

No Open gate changes status. The empty table does not need an Auth authority (`ID-001`), organization model/membership (`ORG-001`, `ORG-002`), RFQ commercial/recipient behavior (`RFQ-003`), messaging decisions (`MSG-002`, `MSG-003`), search implementation (`SEARCH-001`), files (`FILE-001`), billing (`BILL-001`), audit/event retention (`AUD-001`), hosted region (`RES-001`), or hosted environment strategy (`MIG-002`).

Future client access remains separately gated by the SEC-001 RLS delivery review. Mapping execution remains separately gated by the migration-control runtime and authorized data-migration workflow. Neither is silently approved here.

## 7. Exact future implementation boundary

A later dedicated SQL PR may include only:

- one migration creating empty `public.supplier_locations`;
- its PK, restrictive FKs, checks, active uniqueness constraints/indexes, structural lookup indexes, comments, and API-role privilege revocations; and
- one focused disposable synthetic pgTAP contract plus bounded documentation evidence.

If that exact one-table implementation is later approved and merged, the projected local state becomes 12 physical tables, 10 implemented Core Phase 1 concepts, and 26 deferred concepts. Until then, the verified current state remains 11 / 9 / 27.

## 8. Explicit deferrals and exclusions

The sixth-slice implementation must not include:

- location, branch, coverage, administrative-area, alias, or reference rows;
- `supplier_contacts`, service-coverage assignment data, organization tables, RFQ tables, or any other new table;
- contact fields, organization IDs, latitude/longitude, geometry, geocoding, radius, polygon, international location, warehouse, factory-site, showroom, registered-office, delivery-point, or online-only fields;
- administrative-area population, lower hierarchy, mapping manifest execution, Firebase reads, transformation, reconciliation run, migration, seed, import, export, or backfill;
- RLS, policies, views, RPCs, grants, browser/API access, Auth bridge, application integration, triggers, trusted mutation routines, audit/domain events, search ranking, or RFQ recipient logic;
- hosted Supabase linking, remote SQL, deployment, Firebase change, or Production/TEST data access or change; or
- implementation, Ready status, merge, or deployment in this documentation task.

Deferred product decisions include maximum active branch/location counts, address verification/dispute workflow, map-provider policy, contact consent/visibility, organization-shared premises, RFQ coverage requirements/overrides/snapshots, search technology/hierarchy/ranking, audit lineage, RLS and audience projections, hosted environment, Auth migration, and Production cutover.

## 9. Validation and stop point

Required checks are documentation-only: verify PR #66 and commit references, relative links, 11 physical tables, 9 implemented / 27 deferred Core Phase 1 concepts, all 12 unchanged Open gates, Markdown structure, sensitive-content scan, documentation-only diff, and `git diff --check`.

Do not run Firebase suites, pgTAP, the application build, or full repository tests because no executable or SQL file is changed.

Exact stop point: Draft PR containing this decision package. Stop before SQL or pgTAP implementation, Ready status, merge, hosted work, data work, or deployment.

## 10. References

- [`24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md`](24_SUPPLIER_LOCATION_PRODUCT_AND_DATA_CONTRACT.md)
- [`21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`](21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md)
- [`23_SIXTH_SQL_SLICE_SELECTION.md`](23_SIXTH_SQL_SLICE_SELECTION.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
