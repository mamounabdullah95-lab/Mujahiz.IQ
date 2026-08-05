# SUP-004 administrative areas and Supplier assignment contract

Status: **Decision-ready recommendation; SUP-004 remains Open pending explicit Product/Data owner approval**
Verified repository start: `origin/main` `f37d46bd875987a6c2d177b21df31a8ecb8e0b71`
Decision owners: Product owner and data owner under the founder-led dual-role governance recorded by PR #57
Primary task profile: Documentation

## 1. Exact decision question and posture

> Should Mujahiz IQ approve a hierarchy-ready Iraqi administrative-area reference contract, initially used at governorate granularity, and a typed Supplier assignment contract that keeps physical locations separate from service coverage, maps only explicit administrative evidence, represents `all_iraq` and `imports_outside_iraq` as bounded non-administrative exceptions, and preserves every ambiguous Firebase value for review rather than inferring a branch, locality, or coverage target?

**Recommendation:** approve that contract as Option B in section 6, subject to the ten explicit owner decisions in section 8.

**Approval state:** SUP-004 remains **Open**. This document records a recommendation and the exact owner decision required; it does not record approval. A pull-request approval, merge, or lack of objection must not silently change the gate. A later explicit owner outcome must update this document and `10_SCHEMA_DECISION_REGISTER.md` before any SUP-004-dependent SQL is authorized.

The other twelve approval gates also remain Open and unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

This task is planning and documentation only. It authorizes no SQL, reference rows, mappings, seed, migration, backfill, data read/write, application change, hosted work, or deployment.

## 2. Verified findings

### 2.1 Repository and migration state

- **Fact:** The verified start is merged PR #59 at `f37d46bd875987a6c2d177b21df31a8ecb8e0b71`.
- **Fact:** The local SQL foundation contains 10 physical tables representing 8 implemented Core Phase 1 concepts; 28 of 36 remain deferred.
- **Fact:** PR #54 implemented `public.supplier_profiles`, and PR #59 implemented `public.categories`. Both are local-only, synthetic-data-only foundations with no browser/API authority, hosted Supabase operation, Firebase change, or Production data movement.
- **Fact:** `administrative_areas` is the smallest remaining structurally independent Core Phase 1 reference concept, but SUP-004 blocks its authoritative contract. `supplier_locations` also remains deferred and depends on both `supplier_profiles` and this contract.
- **Fact:** Firebase remains the live Production backend. Supabase remains local-only.

### 2.2 Current Firebase-compatible Supplier shape

- **Fact:** `SupplierDraft` stores top-level `governorate`, optional `governorates[]`, structured `branches[]`, `city`, `marketArea`, optional `address`, optional `googleMapsLink`, and `coverageAreas[]`.
- **Fact:** A branch stores `governorate`, `city`, optional `marketArea`, optional `address`, and optional `phone`.
- **Fact:** The Add Supplier UI describes the governorate selection as the head-office governorate but permits multiple selections. Its draft builder also unions branch governorates into `governorates[]` and stores the first array value in scalar `governorate`.
- **Fact:** Directory/search paths treat `governorate`/`governorates[]` as location evidence. Recommendation matching also treats `all_iraq` as a coverage override. The implementation does not establish that every `governorates[]` value is service coverage.
- **Fact:** The Excel contract requires configured governorate codes, uses the first as scalar `governorate`, and stores the full set in `governorates[]`. Unknown configured codes are rejected.
- **Fact:** Current coverage codes are `local_only`, `governorate_level`, `all_iraq`, and `imports_outside_iraq`. The first two name no target area.
- **Finding:** Current data can prove a headquarters/branch, an area association, or a coarse coverage assertion depending on the source field. It cannot prove that an unqualified governorate array is service coverage or that `local_only`/`governorate_level` targets the first stored governorate.

### 2.3 Administrative-reference volatility

- **Fact:** Repository constants contain 18 governorate codes and omit Halabja.
- **Fact:** Iraq's Ministry of Justice records Law No. 7 of 2025 and the official-gazette decree establishing Halabja as Iraq's nineteenth governorate. The repository list cannot be copied as a current authoritative seed. Source: [Iraqi Ministry of Justice, Gazette issue 4825](https://moj.gov.iq/view.9248/).
- **Fact:** Lower administrative units and codes continue to change. The Ministry of Planning recorded new or reclassified districts in 2025 and 2026, including [Qara Tapa](https://mop.gov.iq/archives/31879), [Jalawla](https://mop.gov.iq/archives/36762), and [Al-Khairat](https://mop.gov.iq/archives/37453).
- **Finding:** Canonical identity must be independent of a display label, hierarchy path, or one external-code version. Any future population requires a dated, reviewed official administrative-unit snapshot; application constants are mapping candidates only.

## 3. Exact unresolved questions in SUP-004

| # | Unresolved question | Evidence gap |
|---:|---|---|
| 1 | Governorates only, or full governorate/district/subdistrict hierarchy? | Current Supplier data reliably controls governorates but stores lower locality as free text. |
| 2 | Which authority/version supplies areas, bilingual labels, hierarchy, and external codes? | Configurable application constants omit the current nineteenth governorate; official lower units change. |
| 3 | Internal stable codes or copied external statistical codes? | External codes aid interoperability but may be introduced or re-coded. |
| 4 | What does each current location field mean? | `governorates[]` combines UI selection and branch-derived values; scalar `governorate` is the first value. |
| 5 | How are physical locations distinguished from service coverage? | Firestore stores both on one Supplier document and search uses both kinds of evidence. |
| 6 | What do `local_only` and `governorate_level` target? | Neither code names its locality or governorate. |
| 7 | Is `imports_outside_iraq` coverage or sourcing capability? | Current UI calls it coverage, but its wording describes import capability. |
| 8 | Which outcomes, exception evidence, ordering, and replay keys are mandatory? | The design requires originals/exceptions but does not approve exact field-level rules. |
| 9 | How are official changes represented without rewriting history? | Current data has no area lineage or versioned mapping. |
| 10 | Which future Firebase writes are accepted during coexistence? | Firebase remains live; no relational cutover or dual-write behavior is approved. |

## 4. Minimum administrative-area contract

### 4.1 Identity and hierarchy

- Use one `administrative_areas` adjacency hierarchy for Iraqi civil administrative units.
- Use a database-generated UUIDv4 identity under DB-001 plus an immutable, globally unique Mujahiz code. The code is not a label, hierarchy path, or external statistical code.
- Define `governorate`, `district`, and `subdistrict` with maximum depth three. A governorate has no parent; a district has one governorate parent; a subdistrict has one district parent. Prohibit self-parenting and cycles.
- Use governorate granularity for the initial operational/population boundary. Hierarchy fields preserve later compatibility, but this task authorizes no district or subdistrict rows.
- Keep city, market/industrial area, street address, municipality, neighborhood, village, coordinates, boundaries, and geometry outside canonical area identity until separately approved.

### 4.2 Names, external identifiers, and lifecycle

- Require reviewed Arabic and English names for an active area; one language never fills the other silently.
- Preserve bounded source namespace, external code, source version/date, and source reference when official evidence exists. External identifiers are interoperability evidence, not canonical identity.
- Use `draft`, `active`, `deprecated`, and `archived`. Active rows receive new assignments; deprecated rows remain resolvable and may identify an active replacement; archived rows receive no new assignment.
- Canonical code is immutable. Parent and area type become immutable after activation or assignment. Material reclassification uses reviewed replacement/version lineage instead of rewriting history.
- Never hard-delete an area after activation, mapping, or assignment. Parent archive never cascades.

### 4.3 First reference-data boundary

- Do not copy the repository's 18 constants as authoritative PostgreSQL rows.
- Before population, obtain one dated official snapshot, reconcile all governorates including Halabja, define bilingual labels and stable Mujahiz codes, and produce an exception/collision report.
- After explicit SUP-004 approval, a future empty `administrative_areas` SQL slice may be selected separately. Population remains a separate data-governance task.

## 5. Minimum Supplier location and coverage contract

### 5.1 One typed relation, two meanings

Retain logical `supplier_locations`, with `record_class` distinguishing:

1. `physical_location` — headquarters, structured branch, or uncertain physical presence; and
2. `service_coverage` — explicit service in one area or one approved bounded non-area scope.

A physical row never implies coverage. A coverage row never proves an office, branch, address, or contact location.

Initial physical kinds are `headquarters`, `branch`, and `unspecified_presence`. Coverage uses either one mapped `administrative_area_id` or one bounded code: `all_iraq` or `imports_outside_iraq`. A mapped coverage row has exactly one of area or code. A non-mapped row may have neither target but must retain source evidence.

`imports_outside_iraq` preserves its current import/sourcing meaning. It does not assert an Iraqi area or international delivery. A future capability design may supersede its placement without discarding history.

### 5.2 Required transformed-row evidence

Retain Supplier, record class/kind, deterministic position/child key, source artifact/field and bounded original value, mapping status/version/stage/reason/coordinates, mapped target if any, reviewer/time, physical details, active dates, and existing migration disposition/target/reconciliation evidence.

Mapping/verification/source fields are trusted-only. Row order and identity remain stable after publication or historical use. Archive/close rows instead of rewriting historical evidence.

### 5.3 Mapping outcomes

| Outcome | Meaning | Target allowed |
|---|---|---|
| `unknown` | Not recognized or evaluated | No |
| `pending_review` | Meaning, target, collision, granularity, or field semantics needs a decision | No |
| `mapped` | A reviewed deterministic rule identifies the recorded target | Yes |
| `unmapped` | Understood but no approved target exists in this version | No |
| `rejected` | Invalid, unsafe, contradictory, or not an area/coverage assertion | No |

No outcome discards source value, coordinates, version, reason, or reconciliation. Fuzzy matching may rank review candidates only; it never auto-maps.

### 5.4 Deterministic Firebase transformation

| Source evidence | Recommended transformation | Prohibited inference |
|---|---|---|
| Top-level governorate/address fields | One ordered physical/headquarters row; map only through an approved value rule | No service coverage |
| Each `branches[]` item | One ordered physical/branch row with its details and independently mapped governorate | No coverage; no text-based branch merge |
| Additional recognized `governorates[]` values not already represented | Ordered physical/`unspecified_presence` rows with source evidence | No invented address, branch, priority, or coverage |
| Duplicate scalar/array/branch evidence | Use explicit source precedence and lineage; deduplicate targets only under a reviewed rule | No collapse by label or array order alone |
| `all_iraq` | Mapped service row with that code and no area FK | Do not create 19 governorate rows |
| `imports_outside_iraq` | Mapped exceptional service row with that code and no area FK | No country row or international-delivery claim |
| `governorate_level` | `pending_review` unless the same source explicitly names the covered governorate under an approved rule | Never choose first governorate by convenience |
| `local_only` | `pending_review` unless a future lower-area contract and explicit target exist | Never auto-map city/market/address text |
| Unknown/historical/translated/admin-added value | Exact source rule, bounded normalized/alias rule, then manual review | No fuzzy auto-map, drop, or invention |

One source record may produce zero, one, or many rows. Each target uses a deterministic child key from source field, ordinal, class, and target kind/code so replay cannot fork or reorder history.

## 6. Smallest viable options

| Option | Description | Benefits | Risks / disposition |
|---|---|---|---|
| A. Flat governorates only | Flat area list; assignments use governorate IDs or exceptions | Smallest immediate vocabulary | No lower-level path; likely future identity/FK redesign. Viable, not preferred. |
| **B. Hierarchy-ready, governorate-first, typed Supplier rows** | Three-level adjacency; first population governorates only; one relation distinguishes physical and coverage | Aligns with approved design, preserves Firebase without invented precision, enables an empty independent slice, avoids later FK redesign | Requires disciplined mappings and owner approval. **Recommend.** |
| C. Full hierarchy now | Populate/map all three levels | Rich filtering | Current source lacks deterministic lower IDs; official units change; high rework. Reject now. |
| D. Free text / JSON only | Retain Firestore-shaped blobs | Lowest initial work | No stable FKs, hierarchy, deterministic mappings, or reliable filters. Reject. |

Separate physical and coverage tables were considered. They simplify row shapes but duplicate mapping/lifecycle/provenance rules, add a physical relation, and diverge from approved `supplier_locations`. One typed relation is the smaller coherent option when class invariants are explicit.

## 7. Recommendation and dependency safety

Approve Option B. It is dependency-safe because `administrative_areas` is independent of Supplier/Auth/organization/RLS/hosted/Production data; governorate-first use fits explicit controlled evidence; later hierarchy rows do not change existing FKs; physical and coverage meanings cannot imply each other; exception codes prevent fake areas; ambiguous Firebase values remain reviewable; and no population, transformation, or client access accompanies the structural decision.

After later explicit approval, the smallest next implementation candidate is a separately authorized empty local-only `public.administrative_areas` slice with synthetic tests and zero API-role access. `supplier_locations`, official rows, mappings, transformation, and application access remain later tasks.

## 8. Exact owner decisions required

The Product/Data owner must explicitly approve Option B and each choice below, or return numbered changes. Every row is **Pending**.

| # | Material choice | Recommended decision | Owner decision |
|---:|---|---|---|
| 1 | Scope | Iraqi civil areas for Supplier references; exclude postal, electoral, municipal, geometry, and international models | **Pending** |
| 2 | Hierarchy | Governorate/district/subdistrict, depth three; governorate-first population | **Pending** |
| 3 | Identity | UUIDv4 plus immutable Mujahiz code; official identifiers/version separate | **Pending** |
| 4 | Authority | Dated Ministry of Planning / Statistics and GIS Authority snapshot before population; no seed from constants | **Pending** |
| 5 | Supplier model | One typed relation with distinct physical and service classes | **Pending** |
| 6 | Physical mapping | Section 5.4 headquarters/branch/unspecified rules; no coverage inference | **Pending** |
| 7 | Coverage | Area FK only for explicit target; only `all_iraq` and `imports_outside_iraq` as initial non-area codes | **Pending** |
| 8 | Ambiguous scopes | `local_only`/`governorate_level` remain review outcomes without explicit target; never infer first governorate | **Pending** |
| 9 | History | Preserve originals, coordinates, outcomes/version, reviewer/reason, order, lineage, deterministic mappings | **Pending** |
| 10 | First SQL boundary | After gate approval, propose empty `administrative_areas` separately; population/Supplier rows remain later | **Pending** |

Required later approval statement:

> Product/Data owner approves SUP-004 Option B and decisions 1-10 exactly as recorded in `21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`, with any numbered exceptions stated explicitly.

Until that statement is recorded and synchronized, SUP-004 remains Open.

## 9. Assumptions, deferred work, and risks

Assumptions requiring confirmation: governorate granularity is enough initially; the official administrative-unit guide is the preferred external authority; `governorates[]` is physical evidence rather than coverage absent a source-specific rule; and `imports_outside_iraq` remains for compatibility pending a capability redesign.

Deferred: exact vocabulary/codes/labels/aliases/seed; lower-level population; municipality/locality/postal/spatial models; address parsing and fuzzy matching; contact/visibility/RLS; coverage verification and UI behavior; Firebase coexistence/cutover; migration, reconciliation, and hosted environment work.

Principal risks are stale 18-value seeds, physical-to-coverage inference, wrong targets for coarse codes, overstatement of international service, false lower-area parsing, official recoding, weak class invariants, and collapsed ordered evidence. The contract mitigates them through official snapshot review, typed rows, explicit targets, versioned external identifiers, review outcomes, and deterministic child mappings.

## 10. Validation and stop point

Focused checks must confirm SUP-004 remains Open; the other twelve gates are unchanged; the verified PR #59 starting state is 10 physical tables and 8 implemented / 28 deferred / 36 total concepts; the recommendation matches the authoritative design/register and merged Supplier/category foundations; external links are official; Markdown paths, sensitive-value scan, `git diff --check`, and documentation-only diff checks pass.

No Firebase, pgTAP, local Supabase, build, Emulator, or full repository suite runs for this documentation-only task.

Exact stop point: Draft PR containing this recommendation and the still-Open register entry. Stop before owner approval, gate closure, SQL selection/implementation, reference population, data movement, merge, or deployment.

## 11. References

- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`15_THIRD_SQL_SLICE_SELECTION.md`](15_THIRD_SQL_SLICE_SELECTION.md)
- [`16_THIRD_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md`](16_THIRD_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md)
- [`18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md`](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md)
- [`19_FOURTH_SQL_SLICE_CATEGORIES_SELECTION.md`](19_FOURTH_SQL_SLICE_CATEGORIES_SELECTION.md)
- [`20_FOURTH_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md`](20_FOURTH_SQL_SLICE_IMPLEMENTATION_EVIDENCE.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`00_CURRENT_STATE_AND_INVENTORY.md`](00_CURRENT_STATE_AND_INVENTORY.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
