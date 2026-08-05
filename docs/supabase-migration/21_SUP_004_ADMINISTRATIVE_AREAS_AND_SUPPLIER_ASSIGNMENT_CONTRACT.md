# SUP-004 administrative areas and Supplier assignment contract

Status: **Approved — SUP-004 resolved through the explicit Product/Data owner decision recorded on 5 August 2026**
Verified repository start: `origin/main` `f37d46bd875987a6c2d177b21df31a8ecb8e0b71`
Decision owners: Product owner and data owner under the founder-led dual-role governance recorded by PR #57
Primary task profile: Documentation

## 1. Decision result

The owner explicitly approved **Option B** with the following modifications and boundaries:

- use a hierarchy-ready Iraqi administrative-area model;
- start with governorates only and require all 19 governorates, including Halabja, when reference population is separately authorized;
- defer district and subdistrict support to a later approved slice;
- keep Supplier physical locations distinct from Supplier service coverage through typed assignments;
- preserve ambiguous Firebase values for review without guessing or silent remapping;
- classify `imports_outside_iraq` as a Supplier capability, not an administrative area or service-coverage code;
- use stable internal identities and keep official/reference codes separately when available;
- select an empty `administrative_areas` foundation as the fifth SQL boundary; and
- exclude Supplier assignment tables, reference population, seed, Firebase transformation, hosted Supabase, and Production work.

**Gate result:** SUP-004 is **Resolved**. The contract decisions needed to select the empty governorate-only administrative-area foundation are complete. Exact reference-source acquisition, vocabulary population, and lower-level hierarchy implementation are later execution decisions and do not block empty structural DDL.

The twelve remaining Open gates are unchanged: `ID-001`, `ORG-001`, `ORG-002`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

This approval does not authorize SQL implementation. It authorizes only the planning selection recorded in `22_FIFTH_SQL_SLICE_ADMINISTRATIVE_AREAS_SELECTION.md`.

## 2. Evidence and findings retained

### 2.1 Repository and migration state

- **Fact:** The verified start is merged PR #59 at `f37d46bd875987a6c2d177b21df31a8ecb8e0b71`.
- **Fact:** The local SQL foundation contains 10 physical tables representing 8 implemented Core Phase 1 concepts; 28 of 36 remain deferred.
- **Fact:** PR #54 implemented `public.supplier_profiles`, and PR #59 implemented `public.categories`. Both remain local-only, synthetic-data-only foundations.
- **Fact:** Firebase remains the live Production backend. Supabase remains local-only.

### 2.2 Firebase compatibility finding

- `SupplierDraft` stores scalar `governorate`, optional `governorates[]`, structured `branches[]`, lower-address text, and `coverageAreas[]`.
- The current UI describes governorate selection as head-office evidence but permits multiple values; draft construction also unions branch governorates into `governorates[]` and stores the first array value as scalar `governorate`.
- Current coverage codes are `local_only`, `governorate_level`, `all_iraq`, and `imports_outside_iraq`. The first two name no target, while the last describes sourcing capability rather than an Iraqi service area.
- Therefore, physical area, service coverage, and import capability must remain distinct. Array order or nearby fields never supply missing semantics.

### 2.3 Administrative-reference finding

- Repository constants contain 18 governorates and omit Halabja.
- Iraq's Ministry of Justice records Halabja as Iraq's nineteenth governorate. Source: [Iraqi Ministry of Justice, Gazette issue 4825](https://moj.gov.iq/view.9248/).
- Lower administrative units and reference codes continue to change. Examples include [Qara Tapa](https://mop.gov.iq/archives/31879), [Jalawla](https://mop.gov.iq/archives/36762), and [Al-Khairat](https://mop.gov.iq/archives/37453).
- Consequently, repository constants are mapping candidates, not an authoritative seed, and stable Mujahiz identity remains separate from versioned external identifiers.

## 3. Approved administrative-area contract

### 3.1 Identity and first-phase hierarchy

- Use one `administrative_areas` adjacency model for Iraqi civil administrative units.
- Use a database-generated UUIDv4 primary identity under DB-001 plus an immutable, globally unique Mujahiz canonical code.
- Keep official/reference source namespace, external code, and source version/date separate from canonical identity when available.
- The fifth SQL slice is governorate-only: accepted rows have `area_type=governorate`, depth 1, and no parent.
- Retain hierarchy-ready parent/depth semantics, but do not accept or populate district or subdistrict rows until a later approved slice expands the contract and enforcement.
- City, market/industrial area, street address, municipality, neighborhood, village, coordinates, boundaries, postal data, and geometry remain non-canonical/deferred.

### 3.2 Governorate population boundary

- A later separately authorized population must contain all 19 Iraqi governorates, including Halabja.
- Do not copy the current 18 application constants as authoritative rows.
- Before population, record a dated reviewed official source, reconcile bilingual labels and external codes, and produce an exception/collision report.
- No reference row, seed, mapping manifest, Firebase read, or data operation is authorized by this contract or the fifth-slice planning PR.

### 3.3 Names and lifecycle

- Active canonical areas require reviewed Arabic and English names; one language never silently fills the other.
- Canonical codes are immutable. Use `draft`, `active`, `deprecated`, and `archived` lifecycle semantics when later implementation is authorized.
- Active rows may receive future assignments; deprecated rows remain resolvable and may identify a replacement; archived rows receive no new assignment.
- Never hard-delete an area after activation, mapping, or assignment. Official changes use reviewed replacement/version lineage rather than historical rewrite.

## 4. Approved Supplier assignment contract

The future logical `supplier_locations` relation must distinguish:

1. `physical_location` — headquarters, structured branch, or explicitly uncertain physical presence; and
2. `service_coverage` — service in one explicitly mapped administrative area or the bounded national scope `all_iraq`.

A physical row never implies coverage. A coverage row never proves an office, branch, address, contact location, or import capability.

Initial physical kinds are `headquarters`, `branch`, and `unspecified_presence`. A mapped coverage row uses exactly one of `administrative_area_id` or `coverage_code=all_iraq`. Non-mapped rows retain source evidence without a fabricated target.

`imports_outside_iraq` belongs to the future Supplier capability mapping. It must not create an administrative-area row or a `supplier_locations` coverage row. Until the capability transformation is separately authorized, preserve the original Firebase value and source coordinates as reviewed migration evidence.

### 4.1 Mapping outcomes

| Outcome | Meaning | Target allowed |
|---|---|---|
| `unknown` | Not recognized or evaluated | No |
| `pending_review` | Meaning, target, collision, granularity, or field semantics needs a decision | No |
| `mapped` | A reviewed deterministic rule identifies the recorded target | Yes |
| `unmapped` | Understood but no approved target exists in this version | No |
| `rejected` | Invalid, unsafe, contradictory, or not an area/coverage assertion | No |

No outcome discards source value, coordinates, version, reason, ordering, or reconciliation. Fuzzy matching may rank review candidates only; it never auto-maps.

### 4.2 Deterministic Firebase transformation

| Source evidence | Approved future disposition | Prohibited inference |
|---|---|---|
| Top-level governorate/address fields | One ordered physical/headquarters row; map only through an approved value rule | No service coverage |
| Each `branches[]` item | One ordered physical/branch row with independently mapped governorate | No coverage; no text-based branch merge |
| Additional recognized `governorates[]` values | Ordered physical/`unspecified_presence` evidence unless a stronger source rule applies | No invented address, branch, priority, or coverage |
| Duplicate scalar/array/branch evidence | Use explicit precedence and lineage; deduplicate only under a reviewed rule | No collapse by label or array order alone |
| `all_iraq` | One mapped service-coverage row with no area FK | Do not create 19 governorate assignments |
| `imports_outside_iraq` | Preserve for future Supplier capability mapping | No area or service-coverage row |
| `governorate_level` | `pending_review` unless an approved source rule names the covered governorate | Never choose the first governorate by convenience |
| `local_only` | `pending_review` until an approved lower-area contract and explicit target exist | Never auto-map city/market/address text |
| Unknown/historical/translated/admin-added value | Exact source rule, bounded normalized/alias rule, then manual review | No fuzzy auto-map, drop, or invention |

One source record may produce zero, one, or many normalized rows. Deterministic child keys use source field, ordinal, record class, and target kind/code so replay cannot fork or reorder history.

## 5. Recorded owner decisions

| # | Material choice | Owner decision |
|---:|---|---|
| 1 | Scope | **Approved:** Iraqi civil areas for Supplier references; postal, electoral, municipal, spatial, and international-area models excluded |
| 2 | Hierarchy | **Approved with boundary:** hierarchy-ready model; governorates only now; district/subdistrict support deferred |
| 3 | Governorate set | **Approved:** later population must include all 19 governorates, including Halabja |
| 4 | Identity | **Approved:** UUIDv4 plus stable immutable Mujahiz code; official/reference codes stored separately when available |
| 5 | Reference authority | **Approved with deferral:** dated official-source validation is mandatory before population; exact acquisition/version is a later population task |
| 6 | Supplier model | **Approved:** one typed future relation with distinct physical-location and service-coverage classes |
| 7 | Physical/legacy mapping | **Approved:** preserve explicit evidence and ambiguity; never infer coverage, branch, locality, or target |
| 8 | Coverage/capability boundary | **Approved with modification:** `all_iraq` is a non-area coverage scope; `imports_outside_iraq` is a Supplier capability |
| 9 | History | **Approved:** preserve originals, coordinates, outcomes/version, reviewer/reason, order, lineage, and deterministic mappings |
| 10 | Fifth SQL boundary | **Approved:** empty `administrative_areas` foundation only; no Supplier assignment table or data population |

Approval result: **Approved — SUP-004 resolved on 5 August 2026**.

## 6. Fifth SQL slice and dependency safety

The proposed fifth SQL slice is exactly `public.administrative_areas`, empty except for disposable synthetic tests in a later implementation PR.

It is dependency-safe because it is structurally independent of Supplier rows, Auth, organizations, RLS, hosted Supabase, and Production data; it accepts only governorate shape in the first slice; stable identity is separate from future external identifiers; and all population, lower hierarchy, Supplier assignments, mappings, and client access remain separately gated.

## 7. Deferred decisions and risks

Deferred: exact canonical governorate codes/labels/external identifiers and dated source artifact; reference population; district/subdistrict enforcement and rows; locality/postal/spatial models; Supplier assignment implementation; capability implementation; RLS/projections; Firebase coexistence/cutover; migration and reconciliation; hosted environments.

Remaining risks are stale 18-value application constants, later official recoding, ambiguous legacy meanings, overstatement of coverage, and accidental implementation of deferred hierarchy or assignments. The approved boundaries require official-source review before population, typed meanings, explicit mapping outcomes, and an empty fifth slice.

## 8. Validation and stop point

Focused checks must confirm SUP-004 is Resolved in the contract/register/design/checklist; exactly twelve gates remain Open; the fifth slice selects only empty `administrative_areas`; every reference path resolves; sensitive-value and `git diff --check` scans pass; and the diff remains documentation-only.

No Firebase, pgTAP, local Supabase, build, Emulator, or full repository suite runs for this documentation-only task.

Exact stop point: Ready PR #61 containing the approved contract and fifth-slice planning boundary. Stop before SQL implementation, Supplier assignment work, data population, merge, or deployment.

## 9. References

- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`22_FIFTH_SQL_SLICE_ADMINISTRATIVE_AREAS_SELECTION.md`](22_FIFTH_SQL_SLICE_ADMINISTRATIVE_AREAS_SELECTION.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`00_CURRENT_STATE_AND_INVENTORY.md`](00_CURRENT_STATE_AND_INVENTORY.md)
