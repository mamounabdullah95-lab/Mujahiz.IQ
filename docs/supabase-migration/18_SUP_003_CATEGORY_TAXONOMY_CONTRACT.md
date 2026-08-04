# SUP-003 Supplier category and taxonomy contract

Status: **Open - approval requested; no SQL or implementation is authorized**
Verified repository start: `origin/main` `82fe945bcd1e4472fdc13b6dddb363e384ac75b6`
Decision owners: Product owner and data owner
Primary task profile: Documentation

## 1. Decision posture and evidence labels

This document makes SUP-003 approval-ready without approving it. It uses these labels throughout:

- **Fact**: verified from the current repository or the authoritative migration documents.
- **Recommendation**: the proposed contract that takes effect only if SUP-003 is explicitly approved.
- **Assumption**: a bounded premise that must be confirmed or replaced at approval.
- **Approval required**: a material choice that the Product owner and data owner must accept or change.

SUP-003 remains **Open**. The other thirteen Open gates remain unchanged: `ID-001`, `ORG-001`, `ORG-002`, `SUP-004`, `RFQ-003`, `MSG-002`, `MSG-003`, `SEARCH-001`, `FILE-001`, `BILL-001`, `AUD-001`, `RES-001`, and `MIG-002`.

Approval of this document would approve only the taxonomy contract and the planning boundary in section 12. It would not authorize SQL, taxonomy rows, aliases, Supplier assignments, source mappings, data movement, application work, hosted work, or Production access.

## 2. Current-state findings

### 2.1 Verified facts

- **Fact:** The authoritative schema design proposes one hierarchical `categories` relation with stable codes, paired Arabic/English labels, an optional parent, and Supplier assignments that record whether an assignment is primary.
- **Fact:** The design merges `category_translations` into `categories` for the bounded Arabic/English launch languages. `category_translations` remains a Remove/Merge concept and must not be created.
- **Fact:** The schema decision register keeps SUP-003 Open because hierarchy, mapping, and the exception path are not approved.
- **Fact:** The fourth-slice review concluded that `categories` and `supplier_category_assignments` cannot be implemented safely until SUP-003 is approved. It selected no fourth SQL slice.
- **Fact:** Core Phase 1 remains 7 implemented and 29 deferred concepts. `categories` and `supplier_category_assignments` are among the deferred concepts.
- **Fact:** The current Firebase `categories` collection has zero verified Production documents. Repository code can seed category documents shaped as `group`, `value`, `labelEn`, `labelAr`, `active`, and `updatedAt`, but repository capability is not evidence that those documents exist in Production.
- **Fact:** The application and official import templates currently expose a flat list of 23 Supplier category codes, including the global code `other`. Each default code has an English and Arabic label.
- **Fact:** Platform settings can replace the default Supplier category list with flat `{ value, labelEn, labelAr }` items. Current normalization deduplicates by `value` and may use a code or the other language when a label is missing. That fallback is current application behavior, not the proposed relational contract.
- **Fact:** Supplier documents and submissions store `categories[]` as strings. Supplier drafts also store free-text `subcategories[]`, controlled `capabilityTags[]`, and an optional free-text `relatedMaterialService`.
- **Fact:** The current Excel importer accepts only configured codes for `categories[]`, rejects unknown category codes, and accepts `subcategories[]` as free-text values. The raw workbook is not stored.
- **Fact:** Current search and duplicate-candidate logic uses category strings as supporting evidence, but `SEARCH-001` remains Open and current `searchKeywords[]` are not authoritative taxonomy state.
- **Fact:** Existing migration-control relations can retain record-level source dispositions, target mappings, validation results, and import errors. They do not themselves define the canonical taxonomy or approve a vocabulary mapping.
- **Fact:** Firebase remains the live Production backend and Auth authority. Supabase remains local-only and synthetic-data-only.

### 2.2 Problem statement

Current values mix controlled main-category codes, free-text subcategories, capabilities, material/service phrases, and search evidence. Treating every string as a canonical category would create false hierarchy, language, and migration certainty. A relational FK cannot be required until category identity, hierarchy, labels, aliases, lifecycle, assignment rules, and exception handling are deterministic.

## 3. Evaluated options

| Choice | Benefits | Risks | Disposition proposed for approval |
|---|---|---|---|
| Keep a flat label/code list | Closest to the current UI and importer | Cannot represent reviewed parent/child meaning; repeats broad and narrow concepts; weak historical path semantics | Reject |
| Use fixed level tables such as category/subcategory | Simple level-specific queries | Hard-codes depth; makes moves and future growth disruptive; duplicates lifecycle rules | Reject |
| Use one adjacency hierarchy | One stable identity model; bounded depth; supports broad navigation and specific assignment | Requires cycle/depth enforcement and governed reparenting | Recommend |
| Use one untyped taxonomy for every domain immediately | Maximum apparent reuse | Silently decides product, RFQ, and search semantics; broadens SUP-003 | Reject |
| Define one Supplier-offering taxonomy now and permit later domain references only after separate approval | Keeps meaning coherent while bounding present use | Future product/RFQ work must prove the same nodes fit | Recommend |
| Store aliases on the category row or in JSON | Fewer physical tables | Poor collision, provenance, lifecycle, and lookup constraints | Reject |
| Store category aliases as physical child rows | Deterministic lookup and typed provenance; independent lifecycle | Adds one physical relation when alias work is authorized | Recommend |
| Auto-create categories from every unknown source string | Low manual effort | Creates duplicates, wrong translations, phrase fragmentation, and irreversible false classification | Reject |
| Preserve unknown values and review them | No silent loss; auditable mapping | Requires a queue and manual decisions | Recommend |

## 4. Purpose, meaning, and boundaries

### 4.1 Canonical meanings

| Term | Recommended meaning | Not equivalent to |
|---|---|---|
| Category / `التصنيف` | A governed, stable procurement-domain grouping that describes what a Supplier offers at a reusable level | A Supplier type, individual item, ad-hoc phrase, or search token |
| Capability / `القدرة` | An operational ability or service attribute of a Supplier, such as local stock, installation, or technical support | A category merely because it helps filtering |
| Product or service / `المنتج أو الخدمة` | A specific named catalog offering or service record, potentially with its own reference or description | Its broader category |
| Material/service phrase / `عبارة المادة أو الخدمة` | Preserved source text describing a requested or supplied material/service; it may be narrower, broader, or more contextual than a category | A canonical category until reviewed |
| Keyword / `كلمة مفتاحية` | Derived retrieval evidence used by a search implementation | Identity, an FK, or authoritative classification |
| Search synonym / `مرادف بحث` | A reviewed retrieval equivalence used to expand or rank queries | A category alias that is automatically safe for classification |

- **Recommendation:** The initial taxonomy type is `supplier_offering`. Its nodes classify the broad procurement offerings of Suppliers.
- **Recommendation:** The proposed approval scope covers the category catalog contract only. A later, separately authorized assignment phase may classify Suppliers.
- **Recommendation:** Products/services and RFQ items may reference the same taxonomy only after their own domain review proves the meaning and granularity are valid. No product or RFQ use is approved here.
- **Recommendation:** Capabilities, brands, part numbers, standards, material terms, phrases, and search keywords remain outside category identity.
- **Approval required:** Confirm one bounded `supplier_offering` taxonomy rather than immediate multi-domain taxonomy types.

## 5. Hierarchy contract

- **Recommendation:** Use a single-parent adjacency hierarchy. Each category has zero or one parent.
- **Recommendation:** The maximum hierarchy depth is three nodes: root (level 1), group (level 2), and assignable category (level 3). A branch may end at level 2.
- **Recommendation:** Root nodes have no parent, are navigation/grouping nodes, and are never assignable.
- **Recommendation:** Only an active leaf marked assignable may receive a new Supplier assignment. A node with children is not assignable. A branch-ending level-2 leaf may be assignable; level 3 is not mandatory.
- **Recommendation:** A child must have the same taxonomy type as its parent. Self-parenting, cycles, and descendant depth greater than three are prohibited.
- **Recommendation:** Cycle and depth validation must be database-enforced in a future SQL slice and also checked by the future trusted mutation path. Application-only validation is insufficient.
- **Recommendation:** A draft node may be moved while cycle, depth, label-collision, and child-depth checks pass.
- **Recommendation:** The parent of an active, deprecated, source-mapped, or assigned category is immutable. A semantic move creates a new category and deprecates the old category with an approved replacement; it does not rewrite historical paths.
- **Recommendation:** A parent cannot be archived while it has active or deprecated descendants. Descendants must first be replaced/reparented while still draft, deprecated with replacements, or archived in a reviewed bottom-up operation.
- **Recommendation:** Archiving a parent never cascades, deletes, or silently changes a child or Supplier assignment.
- **Approval required:** Confirm maximum depth three, assignable leaves only, and immutable parentage after activation.

## 6. Identity and canonical codes

- **Recommendation:** Every category uses a database-generated UUIDv4 primary key under the already resolved local DB-001 convention. Clients never choose the authoritative UUID.
- **Recommendation:** Every category also has one globally unique, stable, human-readable canonical code.
- **Recommendation:** Codes use lowercase ASCII snake case, 2-64 characters, and the pattern `[a-z][a-z0-9]*(?:_[a-z0-9]+)*`. A code communicates stable identity, not a translatable display label or hierarchy path.
- **Recommendation:** A category code is immutable from row creation. Renaming labels, deprecating a node, or replacing a node never changes its code.
- **Recommendation:** Existing controlled Firebase/import values are candidate legacy codes, not automatically approved canonical codes. Each must pass the mapping stages in section 11.
- **Recommendation:** A Firebase category document ID, if a future approved snapshot contains one, is retained as a nullable unique legacy identifier; it is never the PostgreSQL primary key.
- **Recommendation:** External codes retain a bounded source namespace and original value. They never replace the canonical code and are not globally trusted outside their namespace.
- **Approval required:** Confirm human-readable immutable snake-case codes and UUIDv4 identity.

## 7. Arabic and English labels

- **Recommendation:** Every persisted category has an approved canonical Arabic label and canonical English label. Transliteration is not a substitute for translation.
- **Recommendation:** Each label is 2-120 Unicode code points after trimming. It must contain no control characters, markup, leading/trailing whitespace, repeated internal whitespace, or line breaks.
- **Recommendation:** Approved display labels are preserved as authored. A versioned normalized form is stored or derived for collision checks; normalization does not overwrite the display label.
- **Recommendation:** Active and deprecated sibling categories within the same taxonomy type and parent cannot share the same normalized Arabic label or the same normalized English label. Root siblings use the same rule. The same normalized label in different branches is permitted only after review and requires path-qualified presentation where ambiguity matters.
- **Recommendation:** Arabic UI renders only approved Arabic category labels; English UI renders only approved English category labels. It must not copy, transliterate, or silently display the other language as fallback.
- **Recommendation:** A missing or disputed translation stays in the review workflow and blocks category creation/activation. An already active category keeps its last approved label until a replacement translation is approved.
- **Assumption:** Arabic and English remain the only launch taxonomy languages. More locales or an independently governed translation lifecycle would require a later decision before reconsidering a translation table.
- **Approval required:** Confirm paired required labels, sibling-level uniqueness, and no cross-language fallback.

## 8. Aliases and search-term boundary

### 8.1 Alias meanings

- **Recommendation:** A category alias is a category-specific alternate label or legacy value that resolves to exactly one canonical category in a declared locale and source namespace.
- **Recommendation:** An abbreviation may be stored as alias type `abbreviation` only when it unambiguously names the category in that namespace.
- **Recommendation:** A search synonym expresses retrieval equivalence and remains governed by SEARCH-001. It is not automatically a classification alias.
- **Recommendation:** A brand identifies a maker or commercial family; a part number identifies a product/reference; neither is a category alias.
- **Recommendation:** A material/service phrase remains phrase evidence unless reviewers determine that the entire phrase is an alternate name for one category. Semantically required multi-word phrases remain atomic; normalization must not split, reorder, stem, or map their individual words independently.

### 8.2 Alias storage and collisions

- **Recommendation:** Aliases require separate physical child rows under the existing logical `categories` concept. They must not be arrays, JSON, or copied label columns on `categories`.
- **Recommendation:** Alias rows are category-specific, while automatic-classification uniqueness is enforced across the taxonomy for the same source namespace, locale/script, normalizer version, and normalized value.
- **Recommendation:** Two categories cannot both have an active auto-mapping alias with the same lookup identity. A collision is `pending_review`; it is never resolved by row order, popularity, or fuzzy score.
- **Recommendation:** Exact canonical-code matching has precedence over alias matching. An alias may not shadow another category's canonical code in the same source namespace.
- **Recommendation:** Alias normalization is limited to versioned Unicode normalization, trimming/collapsing whitespace, case handling where applicable, removal of Arabic tatweel/optional diacritics where explicitly reviewed, and explicitly approved Arabic character equivalences. It excludes translation, transliteration, tokenization, stemming, fuzzy scoring, and phrase splitting.
- **Recommendation:** Alias changes are versioned and source-attributed. An archived alias cannot be used for new automatic mappings but remains available for historical reconciliation.
- **Approval required:** Confirm separate category-specific aliases, global collision prevention for automatic mapping, and the stated search boundary.

## 9. Lifecycle and historical stability

### 9.1 Statuses and transitions

| From | Allowed next status | Rule |
|---|---|---|
| `draft` | `active`, `archived` | Activation requires valid labels, code, hierarchy, and collision checks; an unused rejected draft may be archived |
| `active` | `deprecated`, `archived` | Deprecation is preferred when a replacement exists; archive blocks new use |
| `deprecated` | `active`, `archived` | Reactivation requires explicit review and no active conflicting replacement |
| `archived` | none | Terminal; create or reactivate the proper predecessor only through a separately reviewed correction |

- **Recommendation:** Active categories may receive new assignments. Deprecated categories remain readable for history but receive no new assignments and should identify an active replacement when one exists. Archived categories receive no new assignments or mappings.
- **Recommendation:** A replacement must be a different active category in the same taxonomy type. Replacement links cannot form a loop.
- **Recommendation:** Categories are never hard-deleted after activation, source mapping, or assignment. A never-active, unreferenced local draft may be removed only in a separately authorized development correction; Production deletion is not authorized here.
- **Recommendation:** Existing Supplier assignments to a deprecated or archived category remain historically resolvable. They are not silently rewritten to the replacement. A later reviewed reassignment records a new decision and preserves the old mapping evidence.
- **Approval required:** Confirm the four statuses, terminal archive, and no automatic reassignment.

## 10. Supplier assignment boundary

- **Recommendation:** Supplier assignment implementation remains a later SQL slice. This document defines its contract only.
- **Recommendation:** Only active, assignable leaves may receive a new assignment. Root and intermediate nodes are navigation-only.
- **Recommendation:** Assignment roles are `primary` and `secondary`. A Supplier has at most one active primary category and cannot hold duplicate active assignments to the same category.
- **Recommendation:** A future trusted command should normally cap active assignments at 10 per Supplier. This is a product-validation limit, not a `categories` table constraint; a different limit requires product evidence and explicit approval.
- **Recommendation:** A Supplier with any approved category assignments should have exactly one primary assignment. Unclassified, pending-review, or unmapped Suppliers may have zero assignments without inventing a category.
- **Recommendation:** Future contributors, imports, and source transformations may propose assignments. A designated taxonomy/data review workflow approves or changes them, and only the later trusted mutation boundary applies canonical assignments.
- **Recommendation:** The proposer/reviewer terms describe workflow responsibility only. This contract does not select users, roles, Auth, RLS, grants, or application permissions.
- **Approval required:** Confirm leaf-only assignment, one primary, secondary assignments, and the suggested limit of 10.

## 11. `other`, unmapped values, and deterministic migration mapping

### 11.1 `other` and free text

- **Recommendation:** Do not create or auto-map to one global canonical `other` category. The current `other` code is preserved as a legacy source value and routed to review.
- **Recommendation:** A parent-scoped terminal category such as a reviewed “other within X” may exist only when Product/data owners approve a stable business meaning, code, labels, and parent. It is not a substitute for unknown data.
- **Recommendation:** Free-text subcategories and `relatedMaterialService` remain bounded source evidence. They do not become codes or labels automatically.
- **Recommendation:** When a submission selects legacy `other`, the later mapping workflow should require or reuse bounded explanatory phrase evidence where available; absence of evidence remains unknown rather than forcing a classification.

### 11.2 Mapping outcome vocabulary

| Outcome | Meaning | Target allowed |
|---|---|---|
| `unknown` | A source value has not been recognized or evaluated | No |
| `pending_review` | Evidence exists but translation, meaning, collision, or granularity needs a decision; ambiguity is a reason under this status | No |
| `mapped` | A reviewed deterministic rule identifies one or more explicit canonical targets | Yes |
| `unmapped` | The value is understood but no approved canonical target exists at this migration version | No |
| `rejected` | The value is invalid, unsafe, non-category content, or explicitly unsuitable for taxonomy mapping | No |

No outcome discards the bounded original value, source coordinates, normalizer/mapping version, decision reason, or reconciliation result.

### 11.3 Matching stages

Apply stages in order and stop at the first deterministic single result:

1. **Exact:** match the preserved source token to an approved canonical code or an exact source-specific mapping.
2. **Normalized:** apply only the approved, versioned normalization boundary in section 8 and match an approved source-specific normalized value.
3. **Alias:** match one active alias for the declared source namespace and locale/script.
4. **Manual review:** route no-match, collision, ambiguous, composite, disputed-language, global `other`, and free-text values to the review queue.

- **Recommendation:** Fuzzy similarity may rank review candidates only after SEARCH-001 or a separately approved migration-only scorer. It never automatically maps a category under SUP-003.
- **Recommendation:** Many legacy values may map to one canonical category when each source rule is explicit and reviewed.
- **Recommendation:** One source value never expands automatically through exact, normalized, or alias matching. A one-to-many result requires an explicit reviewed split rule, ordered target set, mapping version, rationale, and reconciliation evidence. Otherwise it stays `pending_review` or `unmapped`.
- **Recommendation:** One source record may produce zero, one, or many Supplier assignment targets, but each target uses canonical category code plus assignment role as its deterministic child key in the existing migration-control contract.
- **Recommendation:** Mapping evidence records source system/artifact, source field, original bounded value, normalized value, locale/script when known, normalizer version, match stage, mapping version, outcome, targets, reason, reviewer/time, and reconciliation result. It must not include a raw workbook, complete Supplier record, secrets, or unnecessary personal data.
- **Recommendation:** Counts alone do not prove a correct mapping. Reconciliation must cover source-value outcomes, ambiguity/unmapped/rejected counts, target assignment counts, primary-assignment invariants, and deterministic replay.
- **Recommendation:** No Production export, import, seed, migration, backfill, or read is authorized by this contract.
- **Approval required:** Confirm no global `other`, the five outcome states, ordered matching stages, and reviewed-only one-to-many mapping.

## 12. Exact future SQL boundary if SUP-003 is approved

### 12.1 Minimum physical relations

The complete taxonomy structure needs two physical relations while remaining one logical Core Phase 1 `categories` concept:

1. `public.categories` for identity, hierarchy, bilingual labels, lifecycle, assignability, order, and replacement.
2. `public.category_aliases` for category-specific aliases, source namespace, normalization version, lifecycle, and deterministic lookup.

`category_translations` must not be created. Existing internal migration-control tables and versioned reviewed mapping artifacts hold record-level dispositions, mappings, validation, and exceptions; no new source-mapping table is required in the first taxonomy slice.

### 12.2 Can `categories` be implemented alone first?

- **Recommendation:** Yes. After explicit SUP-003 approval and a separate SQL-slice authorization, the smallest first local slice may create exactly `public.categories` and its required enforcement/index objects.
- That slice must remain empty except for synthetic test rows created and rolled back or isolated by the test harness. It must include no canonical taxonomy seed, Firebase constants copy, aliases, source mappings, Supplier assignments, migration, or application access.
- `public.category_aliases` may follow only in a separately authorized taxonomy-alias slice or be included in the same later authorization if reviewers prefer one complete structural change.
- `public.supplier_category_assignments` remains a later slice after categories, aliases/mapping rules, assignment workflow, and transformation evidence are separately approved. It is not part of the first taxonomy slice.

### 12.3 Contract-level `categories` requirements

- UUIDv4 PK; immutable globally unique `code`; bounded `category_type` initially allowing only `supplier_offering`.
- Nullable self-FK `parent_category_id` using restrictive delete behavior; nullable self-FK `replacement_category_id` using restrictive delete behavior.
- Required `label_ar`, `label_en`, their versioned normalized comparison values or an equivalently deterministic mechanism, `status`, `is_assignable`, non-negative `sort_order`, and created/updated timestamps and trusted actor references where the existing actor boundary permits.
- Optional unique `legacy_firestore_id` and bounded descriptions; external codes do not occupy the canonical code column.
- Checks for code format/length, label length/cleanliness, status values, taxonomy type, non-negative order, no self-parent/replacement, replacement/status compatibility, and assignability/status compatibility.
- Database enforcement for maximum depth, no cycles, immutable code, immutable parent after activation/use, leaf-only assignability, replacement-loop prevention, and parent-archive rules.
- Unique normalized Arabic and English labels among non-archived siblings, including the root scope.
- Indexes supporting parent/status/order traversal, type/status/code lookup, normalized Arabic/English sibling checks, replacement lookup, and optional legacy-ID reconciliation.
- Table and column comments stating taxonomy meaning, source-versus-canonical boundaries, status behavior, zero API authority, and prohibition on silent language fallback.

### 12.4 Contract-level `category_aliases` requirements

- UUIDv4 PK and restrictive FK to `categories`.
- Required alias type, locale/script, display value, normalized value, normalizer version, source namespace, status, source class, and timestamps; bounded optional provenance reference without personal data.
- Checks for allowed alias/status/locale values, display and normalized lengths, no control/markup content, and active-target compatibility.
- Uniqueness per category/type/locale/normalized value/version and an active automatic-mapping uniqueness boundary across taxonomy/source namespace/locale/normalized value/version.
- Indexes for deterministic alias lookup, category history, source namespace, and archived-value reconciliation.
- No brand, part-number, arbitrary keyword, or generic search-synonym rows.

### 12.5 Security and access boundary

- The first local-only taxonomy slice has zero privileges for `anon`, `authenticated`, or any browser/API role.
- It adds no RLS, policy, grant, view, RPC, Auth bridge, application integration, hosted linkage, remote SQL, or public read projection.
- RLS and API/read projections require a later separately approved task. The absence of RLS is acceptable only while all API-role privileges remain absent.
- **Approval required:** Confirm the two-relation complete model, the permissible one-table first slice, and later assignment separation.

## 13. Material decisions requiring explicit approval

No row below is approved by publication of this Draft PR.

| # | Material choice | Recommended option | Rationale | Owner decision |
|---:|---|---|---|---|
| 1 | Taxonomy purpose | One `supplier_offering` taxonomy; Supplier use first | Bounded meaning without deciding product/RFQ behavior | Approve / change |
| 2 | Hierarchy | Single parent, maximum depth 3 | Supports navigation and specificity without unlimited graph complexity | Approve / change |
| 3 | Assignability | Active leaves only; roots/intermediate nodes not assignable | Prevents broad and narrow assignments from having unclear equivalence | Approve / change |
| 4 | Reparenting | Parent immutable after activation, mapping, or assignment | Preserves historical paths and deterministic replay | Approve / change |
| 5 | Identity | UUIDv4 PK plus immutable global human-readable snake-case code | Separates stable identity from labels and hierarchy | Approve / change |
| 6 | Labels | Arabic and English required, sibling-unique by locale, no cross-language fallback | Prevents mixed-language UI and silent translation invention | Approve / change |
| 7 | Alias model | Separate category-specific physical child rows with global auto-map collision prevention | Makes mapping deterministic and auditable | Approve / change |
| 8 | Lifecycle | `draft` -> `active` -> `deprecated`/`archived`; archived terminal; no automatic rewrites | Preserves history and controlled replacement | Approve / change |
| 9 | Supplier assignments | One primary, secondary allowed, suggested active maximum 10 | Supports breadth while bounding noise | Approve / change |
| 10 | Global `other` | Do not create/map a global category; preserve and review legacy values | Avoids false classification and an unhelpful catch-all | Approve / change |
| 11 | Mapping | Exact -> normalized -> alias -> manual; fuzzy never auto; one-to-many reviewed only | Deterministic, explainable, and lossless | Approve / change |
| 12 | First SQL boundary | `categories` alone may be the first empty local slice; aliases and assignments later | Smallest reversible implementation after contract approval | Approve / change |
| 13 | Initial access | Zero API-role privileges and no RLS until a later access task | Preserves the proven local-only boundary | Approve / change |

### Assumptions to confirm

- Arabic and English are the only launch taxonomy languages.
- Three hierarchy levels are sufficient for the first reviewed Supplier-offering vocabulary.
- A limit of 10 active Supplier assignments is adequate for the initial directory use case.
- The current 23 controlled values are mapping candidates, not a pre-approved taxonomy seed.
- Existing migration-control relations plus reviewed versioned mapping artifacts are sufficient for the first taxonomy slice; a dedicated reusable source-vocabulary mapping relation is deferred until implementation evidence requires it.

## 14. Explicit approval checklist

SUP-003 may change from Open only when Product owner and data owner explicitly confirm all items below in a reviewed commit:

- [ ] The purpose and `supplier_offering` boundary are approved.
- [ ] Category, capability, product/service, phrase, keyword, synonym, brand, and part-number distinctions are approved.
- [ ] Single-parent hierarchy, maximum depth, root behavior, leaf assignment, cycle prevention, and parent archive rules are approved.
- [ ] UUIDv4 identity, canonical code format, global uniqueness, immutability, legacy IDs, and external-code namespacing are approved.
- [ ] Required Arabic/English labels, bounds, normalization, sibling uniqueness, disputed-translation handling, and no mixed-language fallback are approved.
- [ ] Alias types, physical child relation, source scope, collision behavior, phrase preservation, and SEARCH-001 boundary are approved.
- [ ] Lifecycle states/transitions, replacement links, no-delete rule, and historical assignment stability are approved.
- [ ] Supplier primary/secondary rules, leaf-only rule, zero-assignment exception, and suggested maximum are approved as a later implementation contract.
- [ ] Global `other`, free-text evidence, outcome states, and review behavior are approved.
- [ ] Matching order, ambiguity, many-to-one, reviewed one-to-many, source evidence, and reconciliation are approved.
- [ ] Two-relation complete taxonomy model, permissible `categories`-only first slice, and later assignment slice are approved.
- [ ] Zero API-role access, no RLS in the local-only first slice, and all exclusions are approved.
- [ ] The Product owner records approve/changes requested, name/date, and exact exceptions.
- [ ] The data owner records approve/changes requested, name/date, and exact exceptions.
- [ ] A follow-up commit updates the schema decision register from Open only after both approvals; until then SUP-003 remains Open.

Approval result: **Pending**
Product owner:
Data owner:
Approval commit SHA:
Approved exceptions or changes:

## 15. Exact exclusions

This document and Draft PR exclude:

- SQL, migrations, pgTAP, seeds, taxonomy data, aliases, mapping manifests, and local-stack operations;
- resolution of SUP-004 or any other approval gate;
- Supplier assignment implementation or transformation;
- search-engine technology, ranking, stemming, fuzzy thresholds, FTS, trigram, or resolution of SEARCH-001;
- RLS, policies, grants, views, RPCs, Auth, ownership, roles, browser/API access, or application permissions;
- frontend/application changes, template changes, Firebase changes, hosted Supabase access, remote SQL, deployment, or DNS;
- Production or TEST reads/writes, export, import, seed, migration, backfill, cleanup, deletion, or data sampling;
- canonical vocabulary population or automatic adoption of the 23 current codes;
- products, RFQ items, materials dictionary redesign, capabilities vocabulary design, organizations, administrative areas, and address/coverage normalization.

## 16. Risks and migration implications

- A flat-to-hierarchical mapping can expose that current broad and narrow values are not equivalent. Those cases must remain pending rather than force leaf assignment.
- The legacy global `other` code may increase review volume. Preserving it as evidence is safer than creating a misleading canonical target.
- Arabic normalization can collapse genuinely distinct words if expanded casually. Every normalizer change needs a version, collision report, and replay comparison.
- English abbreviations and technical phrases can collide across branches. Source namespace and manual review are required for deterministic classification.
- Immutable active parentage increases replacement work but prevents historical path drift and non-reproducible migration results.
- Leaf-only assignments may leave some current Suppliers temporarily unmapped when evidence identifies only a broad parent. Zero assignments are preferable to invented precision.
- Adding `category_aliases` increases the eventual physical table count but remains a physical child of the existing logical `categories` concept; it does not reclassify the 79 logical concepts or change 7 implemented/29 deferred Core Phase 1 state in this Open document.
- No FK should be applied to transformed Supplier category data until every relevant source value has a deterministic outcome and reconciliation passes.

## 17. Validation, stop conditions, and next authorized action

### Validation required for this decision document

- SUP-003 remains Open and all other thirteen gates remain unchanged.
- The document remains consistent with the authoritative schema design, decision register, review checklist, fourth-slice no-go, phase counts, and current category/import contracts.
- Arabic/English terminology remains paired and no translation is silently invented.
- Markdown paths/references, stale-state markers, sensitive-value scan, and `git diff --check` pass.
- No tests or builds are run for this documentation-only task.

### Stop conditions

Stop without SQL or further gate work if either decision owner requests changes, any material row in section 13 is unanswered, a proposal would resolve another gate, the local-only zero-API boundary cannot be preserved, or a source mapping would discard/force ambiguous data.

### Next action after explicit approval

After both decision owners approve SUP-003 in a reviewed commit, create a new focused task to synchronize the decision register and select the exact first taxonomy SQL slice. For an isolated local implementation, use **Terra with High reasoning** as recommended by the fourth-slice selection. Keep the slice empty, synthetic-data-only, local-only, API-inaccessible, and separately reviewed. Do not begin that work from this Open contract.

## 18. References

- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`11_SCHEMA_REVIEW_CHECKLIST.md`](11_SCHEMA_REVIEW_CHECKLIST.md)
- [`17_FOURTH_SQL_SLICE_SELECTION.md`](17_FOURTH_SQL_SLICE_SELECTION.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`00_CURRENT_STATE_AND_INVENTORY.md`](00_CURRENT_STATE_AND_INVENTORY.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
