# Supplier location product and data contract

Status: **Review-ready recommendation; no SQL slice or approval gate is authorized by this document**
Contract date: 6 August 2026
Verified start: `origin/main` `f5153356430524ac927ef0bb2d4c2908669b91ca`
Primary task profile: Documentation

## 1. Purpose and decision boundary

This document completes the product and data contract needed before a future `supplier_locations` SQL selection. It refines the already resolved SUP-004 direction without reopening or expanding it:

- physical presence and service coverage are different assertions;
- both use one typed future `public.supplier_locations` relation;
- `all_iraq` is a bounded non-area coverage code;
- `imports_outside_iraq` is Supplier-capability evidence, never a location or coverage row;
- ambiguous source values are preserved for review and are never guessed; and
- administrative-area reference population, Supplier transformation, RLS, API access, hosted Supabase, and Production work remain outside this contract.

This is a design artifact only. It does not select or authorize a sixth SQL migration, populate a table, transform Firebase data, resolve an Open gate, or approve client-visible behavior.

## 2. Verified starting state

- The local SQL foundation has 11 physical tables representing 9 implemented Core Phase 1 concepts; 27 of 36 remain deferred.
- `public.supplier_profiles`, `public.administrative_areas`, and the provider-neutral actor root are merged local-only foundations.
- `public.administrative_areas` is empty and accepts governorate shape only. Reference population and lower hierarchy remain deferred.
- `public.supplier_locations`, `public.supplier_contacts`, `public.rfqs`, and `public.rfq_recipients` do not exist.
- Firebase remains the Production backend. Supabase remains local-only.
- The 12 Open approval gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

## 3. Product meanings

### 3.1 Physical location

A Supplier physical location is a bounded assertion that the Supplier operates from, maintains, or is represented at a real-world place. It may be supported by an administrative-area reference and optional locality/address evidence, but those details do not change its class.

The initial physical kinds are:

| Kind | Meaning | Product rule |
|---|---|---|
| `headquarters` | The source-designated principal operating place for this Supplier profile | At most one current active headquarters per Supplier; the label does not by itself prove legal registration, ownership, or independent verification |
| `branch` | An additional source-designated operating place | Multiple current branches are supported, including multiple branches in the same governorate |
| `unspecified_presence` | Source evidence places the Supplier in an area but does not safely establish headquarters or branch semantics | Must not be displayed or counted as a confirmed branch or headquarters |

A physical location does **not** by itself mean that the Supplier:

- serves Buyers in that area;
- can receive or satisfy an RFQ for that area;
- owns or leases the premises;
- is legally registered there;
- has a warehouse, delivery point, or inventory there;
- has a public contact channel there; or
- has been independently verified.

A map link, phone number, free-text market name, online-only presence, import origin, or delivery destination is not independently sufficient to create a physical-location assertion.

### 3.2 Service coverage

Service coverage is a separate commercial assertion that the Supplier reports willingness or ability to serve a bounded geography. It is not physical-presence evidence and is not a contractual guarantee of price, stock, delivery time, eligibility, or response.

The initial mapped coverage targets are:

| Target form | Meaning | Stored target |
|---|---|---|
| Administrative-area coverage | The Supplier reports coverage of one explicitly reviewed Iraqi administrative area | Exactly one `administrative_area_id` |
| National coverage | The Supplier reports coverage across Iraq | `coverage_code=all_iraq`, with no administrative-area FK |

`local_only` and `governorate_level` remain `pending_review` unless an approved source rule names an exact supported target. `imports_outside_iraq` remains capability evidence and produces no `supplier_locations` row.

One Supplier may have zero, one, or many coverage rows. A physical row never creates coverage, and a coverage row never creates a headquarters, branch, address, contact location, or import capability.

### 3.3 Multiple branches

Multiple branches are supported from the first product contract. Each branch is its own stable physical row with its own order, area mapping, locality/address evidence, lifecycle, and source lineage.

Branches must not be collapsed merely because they share a governorate, city, label, address fragment, map link, or phone. Deduplication requires a reviewed deterministic rule. A branch may exist without a mapped administrative area, but it then remains non-mapped and cannot be presented as a mapped geographic fact.

## 4. Aggregate ownership and relationships

### 4.1 Supplier profiles

`public.supplier_profiles` is the required parent and aggregate root.

- One Supplier profile has zero to many Supplier-location rows.
- Every Supplier-location row belongs to exactly one Supplier profile.
- A Supplier profile may remain valid with no location or coverage rows.
- Deleting a Supplier profile must not cascade-delete location history; archive/state transition and restrictive references are required.
- Location evidence never establishes Supplier ownership, membership, account identity, listing approval, or RFQ eligibility.

### 4.2 Administrative areas

`public.administrative_areas` is an optional target reference, not the owner of the assertion.

- One administrative area may be referenced by many Suppliers and by both physical and coverage rows.
- Each mapped row references at most one administrative area.
- The current governorate-only constraint means a first location slice can structurally reference governorates only.
- New mappings may use only an area allowed by the then-approved area lifecycle and hierarchy contract.
- Deprecating or replacing an area must not rewrite historical Supplier or RFQ evidence. Replacement is handled by reviewed lineage and new current rows.
- `all_iraq` never creates or references a synthetic administrative-area row.

### 4.3 Contacts

Contacts belong to the Supplier first and may later be scoped to one physical location.

- The future `public.supplier_contacts` row owns the optional `location_id`; `supplier_locations` must not contain a `contact_id`.
- A contact linked to a location must have the same `supplier_profile_id` as that location. A future composite FK or equivalent trusted enforcement must prevent cross-Supplier links.
- Service-coverage rows cannot receive location-scoped contacts.
- A physical location can have zero or many contacts; a Supplier-wide contact has no location ID.
- Current `branches[].phone` evidence belongs to the later contact transformation. A location-only slice must neither copy it into an address field nor discard it.
- Visibility, consent, verification, retention, contact-person treatment, and audience projections remain under the unresolved SUP-005 recommendation and later security review.

This direction removes the current logical circularity: the location slice has no contact dependency, while the later contact slice may depend on the already-created location table.

### 4.4 Organizations

Supplier locations belong to Supplier profiles, not directly to organizations.

- `supplier_locations` has no `organization_id` and does not depend on organization bootstrap.
- A future organization association is reached only through the Supplier profile after ORG-001 and ORG-002 are approved and implemented.
- Location rows are never copied, merged, or shared across Supplier profiles merely because they later reference the same organization.
- Free-text organization evidence cannot create an organization or change location ownership.
- Any future requirement for an organization-wide address book or a location shared by several Supplier profiles requires a separate product contract; it must not overload `supplier_locations` silently.

This keeps the location relation dependency-safe while ORG-001 and ORG-002 remain Open.

## 5. `supplier_locations` row contract

### 5.1 Required conceptual fields

The future table requires the following field groups. Names are the recommended SQL-facing names; SQL types, bounded lengths, and constraint syntax belong to the later implementation review.

| Group | Required contract |
|---|---|
| Identity | `id` as database-generated UUIDv4; immutable after creation |
| Parent | `supplier_profile_id` required, restrictive FK to `public.supplier_profiles` |
| Classification | `record_class` in `physical_location`, `service_coverage`; `record_kind` conditionally valid for that class |
| Order | Non-negative `position`, stable within Supplier/class/kind after activation or historical use |
| Mapped target | Nullable `administrative_area_id`; nullable bounded `coverage_code` whose initial only value is `all_iraq` |
| Physical evidence | Nullable bounded `city`, `market_area`, `address_text`, and allowlisted `map_url`; valid only for physical rows |
| Mapping state | `mapping_status` in `unknown`, `pending_review`, `mapped`, `unmapped`, `rejected`; nullable bounded `mapping_rule_version` and `mapping_reason` |
| Source evidence | Bounded `source_origin`, `source_field`, nullable `source_ordinal`, and nullable `original_source_text`; never a complete Firebase payload |
| Review provenance | Nullable `reviewed_by_user_profile_id` and `reviewed_at`; both trusted-only and either both present or both absent |
| Lifecycle | `record_status` in `draft`, `active`, `archived`; optional `valid_from` and `valid_until` with ordered interval |
| Audit metadata | `created_at`, `updated_at`, nullable provider-neutral created/updated actor FKs; updated time cannot precede created time |

Initial class/kind compatibility is exact:

| `record_class` | Allowed `record_kind` values |
|---|---|
| `physical_location` | `headquarters`, `branch`, `unspecified_presence` |
| `service_coverage` | `administrative_area`, `national` |

Warehouse, factory-site, showroom, registered-office, delivery-point, international-location, radius, polygon, coordinate, and online-only kinds are not silently added. They require later evidence and contract expansion.

### 5.2 Target and mapping invariants

The later SQL design must enforce these shape rules:

1. A `mapped` physical row has exactly one `administrative_area_id`, no `coverage_code`, and a physical kind.
2. A non-mapped physical row has no administrative-area FK and no coverage code, but retains bounded source evidence and a reason appropriate to its mapping status.
3. A `mapped` administrative-area coverage row has exactly one `administrative_area_id` and no coverage code.
4. A `mapped` national coverage row has `coverage_code=all_iraq` and no administrative-area FK.
5. A non-mapped coverage row has neither target form and cannot participate in geographic matching.
6. Coverage rows cannot store city, market, street-address, map-link, or contact-location data.
7. `rejected` rows are retained as restricted evidence and never projected as current location or coverage.
8. `imports_outside_iraq` is rejected as a location/coverage target and routed only by a later Supplier-capability contract.

### 5.3 Cardinality and uniqueness invariants

- At most one active `headquarters` row exists per Supplier.
- Any number of active `branch` and `unspecified_presence` rows may exist, subject to later operational bounds.
- A Supplier cannot have duplicate active mapped coverage rows for the same administrative-area target.
- A Supplier cannot have more than one active `all_iraq` coverage row.
- Physical rows are not unique by administrative area because distinct branches may share one area.
- Active position is unique within Supplier, record class, and record kind.
- Address, name, phone, URL, and normalized free text are never standalone identity or uniqueness keys.
- Stable source-child identity and replay use the existing `internal.migration_record_mappings` contract, not a mutable array index or a new public mapping table.

### 5.4 Lifecycle and correction

- Draft rows are restricted working state and do not participate in search or recipient evidence.
- Active rows may participate only through an approved trusted query/projection.
- Archived rows remain resolvable for history and cannot receive new contact links or new selection use.
- Class, kind, mapped target, source identity, and activated semantic identity are immutable after a row is referenced by a published RFQ snapshot. A substantive correction closes/archives the old assertion and creates a replacement with explicit lineage in the approved audit/event mechanism when available.
- Display-order or bounded descriptive corrections before historical use must not change source-child identity.
- No normal hard delete is allowed after activation, mapping, migration trace, or RFQ use.

The exact mutation command, replacement-lineage storage, and audit event are deferred because AUD-001, RFQ-003, and the trusted command layer are not approved by this contract.

## 6. Firebase/source compatibility

The approved future transformation remains deterministic and zero-to-many:

| Source evidence | Future row result | Evidence that must remain outside or alongside the row |
|---|---|---|
| Top-level `governorate`, `city`, `marketArea`, `address`, `googleMapsLink` | One ordered physical `headquarters` row when the reviewed source rule accepts it | Original document/field identity and bounded original values |
| Each `branches[]` child | One ordered physical `branch` row | Source child ordinal/key and any phone reserved for later contact transformation |
| Additional recognized `governorates[]` value | Physical `unspecified_presence` unless stronger reviewed evidence exists | Exact source field/value and precedence result |
| Exact target-bearing coverage value | One service-coverage row | Mapping rule/version and source coordinate |
| `all_iraq` | One mapped national-coverage row | Original code and deterministic child mapping |
| `local_only`, `governorate_level` without target | Non-mapped/pending review; no geographic target | Original value and review reason |
| `imports_outside_iraq` | No location/coverage row | Preserve for later capability mapping |
| Unknown, contradictory, or unsafe value | Zero mapped rows; retain disposition/exception | Original value, rule version, outcome, and reason |

“Source coordinate” means collection/document/field/child position or stable child key. It does not mean latitude/longitude.

Before any transformation, a separate reviewed task must provide:

- a versioned exact/alias value-mapping manifest tied to approved administrative-area codes;
- source precedence and deduplication rules for scalar, array, branch, and coverage evidence;
- a collision and exception report;
- deterministic child keys/ordinals and mapping-rule version;
- reconciliation expectations for zero, one, and many normalized rows; and
- rollback/supersession behavior using the existing internal migration-control relations.

These are required repository artifacts, not additional tables in the location slice. The existing `internal.migration_batches`, `internal.migration_source_dispositions`, `internal.migration_record_mappings`, `internal.migration_merge_group_members`, `internal.migration_validation_results`, and `internal.import_errors` remain the future traceability foundation. This contract does not authorize their runtime use or any Firebase read.

## 7. Future RFQ recipient-selection compatibility

The location model must support future recipient selection without deciding RFQ-003.

- Physical presence and service coverage must be independently queryable.
- Only active, mapped service-coverage rows are eligible geographic evidence. Physical rows cannot silently qualify a Supplier.
- `all_iraq` remains one national code and must not be expanded into 19 duplicate governorate rows.
- Candidate generation must return Supplier identities without duplicates when several rows match.
- Recipient authorization remains anchored in the future immutable `public.rfq_recipients` row, not in a live location join.
- At publication, the future recipient evidence must freeze the delivery-area identity, matching coverage row identity or identities, match rule/version, evaluation time, and any approved manual-override reason. The exact snapshot columns or payload shape remain part of RFQ-003.
- Later location edits, area deprecation, ownership changes, or search-ranking changes must not rewrite a published recipient snapshot.
- Coverage is evidence only. Listing, ownership, eligibility, category, commercial, and authorization checks remain separate inputs.

Whether coverage is mandatory, advisory, or overrideable for a given RFQ; how delivery-area hierarchy matches; and who may override a mismatch all remain deferred to RFQ-003.

## 8. Future geographic-search compatibility

The product must expose two distinct geographic questions:

1. **Physical presence:** “Which Suppliers report a headquarters or branch in this area?”
2. **Service coverage:** “Which Suppliers report that they serve this area?”

Results and filters must label these meanings separately. The search layer may combine them only through an explicitly approved rule and must never relabel presence as coverage.

The first relational indexes should support bounded structural lookup only:

- Supplier + class + status + kind + position;
- administrative area + class + status + Supplier; and
- coverage code + class + status + Supplier.

Future hierarchy-aware search may use reviewed ancestor/descendant rules after lower administrative levels are approved. Coordinates, distance, radius, polygons, PostGIS, geocoding, full-text search, trigram matching, fuzzy ranking, synonyms, and score weighting are excluded. SEARCH-001 remains Open and owns search technology, ranking, query-plan evidence, and index-cost decisions.

Base rows remain non-public. Any Buyer, Supplier, or anonymous directory projection requires later field-minimized security design under SUP-005 and the first client-accessible SQL/RLS approval.

## 9. Required future tables, compatibility tables, and explicit non-tables

### 9.1 Complete table inventory for this contract

`public.supplier_locations` is the only new table required by the location contract itself. The other future tables below are conditional compatibility boundaries owned by their existing unresolved decisions or later feature phases; this document does not approve or require their implementation.

| Future table | Status relative to this contract | Compatibility relationship | Included in the recommended first location slice? |
|---|---|---|---|
| `public.supplier_locations` | **Required by this contract** to store typed physical-presence and service-coverage assertions | Direct subject of this contract | **Yes, table only** |
| `public.supplier_contacts` | Conditional later Supplier-contact table; SUP-005/security review remains required | Later `location_id` points to a physical row owned by the same Supplier | No |
| `public.organizations` | Conditional on future ORG-001 approval | Reached through `supplier_profiles`, never directly from locations | No |
| `public.organization_memberships` | Conditional on future ORG-002 approval | No location FK; organization authorization remains separate from location facts | No |
| `public.rfqs` | Existing future RFQ-chain concept; its geographic behavior remains conditional on RFQ-003 | Supplies the delivery-area evidence that may later be matched | No |
| `public.rfq_recipients` | Existing future RFQ-chain concept; its selection/snapshot contract remains conditional on RFQ-003 | May snapshot matching location/coverage row IDs without treating them as live authorization | No |

`public.supplier_profiles`, `public.administrative_areas`, `public.user_profiles`, and the six `internal` migration-control tables already exist locally and are dependencies or future traceability infrastructure, not future tables introduced by this contract.

### 9.2 Tables not required by this contract

Do not create the following as part of the location model:

- `supplier_branches` — branches are typed physical rows in `supplier_locations`;
- `supplier_service_areas` or `supplier_coverage_areas` — coverage is a typed row in the same relation under resolved SUP-004;
- `supplier_location_contacts` — the initial cardinality is handled by nullable `supplier_contacts.location_id`;
- `organization_locations` — no approved shared organization-location product exists;
- `supplier_location_coordinates`, geometry, geocode, radius, or boundary tables — spatial behavior is deferred;
- a public legacy-value mapping table — reviewed mapping artifacts and existing internal migration-control relations provide the future trace;
- RFQ recipient/location join tables — the need and exact snapshot shape remain with RFQ-003; this contract requires compatibility, not a new relation.

If later evidence proves a many-to-many contact/location relation, shared organization premises, spatial search, or normalized multi-match RFQ evidence is necessary, each requires its own reviewed contract and table decision.

## 10. Safest future SQL boundary

The safest separately authorized location slice is exactly:

- one empty `public.supplier_locations` table implementing the field groups and invariants in section 5;
- its PK, restrictive FKs to merged `supplier_profiles`, `administrative_areas`, and provider-neutral actor rows;
- check/unique constraints and structural indexes required by sections 5.2, 5.3, and 8;
- comments that state the physical/coverage separation and exclusions;
- explicit revocation from `public`, `anon`, `authenticated`, and `service_role`, consistent with the existing local-only foundations; and
- disposable synthetic pgTAP coverage in the implementation PR.

That future slice must not include:

- `supplier_contacts` or any other table;
- changes to `supplier_profiles`, `administrative_areas`, Auth, organizations, RFQs, or migration-control tables;
- administrative-area rows, aliases, reference population, or lower hierarchy;
- Firebase reads, transformation, mapping execution, migration, seed, backfill, or Production/TEST data;
- RLS, policies, views, RPCs, grants, API/browser access, application integration, or an Auth bridge;
- hosted Supabase linking, remote SQL, deployment, or readiness claims;
- triggers, trusted mutation routines, domain events, audit resolution, geographic ranking, or RFQ recipient logic; or
- latitude/longitude, geometry, geocoding, radius, polygon, international-area, warehouse, or delivery-point expansion.

This recommendation keeps organization, RFQ, search, identity-provider authority, audit, and client access outside the empty structural boundary. A later SQL-slice selection must confirm the gate analysis and approve this exact boundary; this contract alone is not that approval.

## 11. Decisions that remain deferred

The following decisions are intentionally not made here:

- the exact SQL DDL, bounded text lengths, names of check constraints, and whether values use text checks or separately reviewed enums;
- the authorized administrative-area population, canonical governorate codes/labels, external source version, and lower hierarchy;
- Firebase mapping manifest content, exception set, transformation execution, reconciliation, and cutover;
- maximum active branch/location counts and product editing workflow;
- legal/registered-address, warehouse, factory-site, showroom, delivery-point, online-only, international, coordinate, and spatial meanings;
- address verification levels, who may verify, evidence standard, and dispute workflow;
- map-link allowlist, normalization, retention, projection, and external-provider policy;
- contact visibility, consent, contact-person model, verification, retention, and audience projections under SUP-005;
- organization bootstrap, organization memberships, shared organization premises, and organization-scoped authorization under ORG-001/ORG-002;
- whether RFQ coverage is required or advisory, hierarchy match rules, override authority, recipient snapshot storage, and publication semantics under RFQ-003;
- search engine, hierarchy expansion, Arabic/English matching, fuzzy behavior, ranking, distance, geocoding, and spatial indexes under SEARCH-001;
- audit/event lineage, mutation commands, actor authority, and history projections under AUD-001 and the trusted-operation design;
- RLS, client/API privileges, anonymous directory exposure, and field-minimized projections;
- hosted Supabase, Auth migration, Firebase coexistence/cutover, and Production migration; and
- every other Open approval gate not directly named above.

These deferrals are compatibility boundaries, not omissions to be filled silently during SQL implementation.

## 12. Review and validation checklist

- [x] Physical location has a bounded product meaning and does not imply service coverage.
- [x] Service coverage has a bounded product meaning and does not imply physical presence.
- [x] Multiple branches are supported without collapsing same-area locations.
- [x] Contacts link later from contact to physical location, removing a circular first-slice dependency.
- [x] Organizations remain indirect through Supplier profiles while ORG-001/ORG-002 stay Open.
- [x] RFQ recipient selection and geographic search have compatible identities and query semantics without resolving RFQ-003 or SEARCH-001.
- [x] Every required adjacent future table is named, and unnecessary split/join/spatial tables are explicitly excluded.
- [x] Existing internal mapping tables and required future mapping artifacts are distinguished from new public tables.
- [x] The recommended future SQL slice is empty, revoked, local-only, and limited to `public.supplier_locations` plus its own enforcement/index/test objects.
- [x] All 12 approval gates remain Open and unchanged.
- [x] No SQL, migration, data, Firebase, hosted Supabase, Production, RLS, client, or deployment action is authorized.

## 13. Exact stop point

Stop at the Draft PR containing this documentation-only contract. Do not create a migration, select or implement the sixth SQL slice, resolve an approval gate, populate administrative areas, transform Supplier data, merge, or deploy.

The next permissible task is a separate review/approval of this contract and, only afterward, a separate sixth-slice selection that either authorizes the exact empty boundary in section 10 or records a no-go.

## 14. References

- [`21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`](21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md)
- [`23_SIXTH_SQL_SLICE_SELECTION.md`](23_SIXTH_SQL_SLICE_SELECTION.md)
- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
