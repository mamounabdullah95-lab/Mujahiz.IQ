# SEARCH-001 PostgreSQL search technology contract review

Status: **Proposal for Product/Technical/Data Owner decision — SEARCH-001 remains Open**
Verified repository start: `origin/main` `89b8903c140a997a3c65f653c76a7e2d31f8c537`
Evidence date: 8 August 2026
Primary task profile: Search
Decision owners: Product owner, technical owner, and data owner

## 1. Decision posture and evidence labels

This document is a decision-ready search contract, not an approval record or implementation authorization.

- **Verified current fact** means confirmed from the repository at the verified start above.
- **Approved dependency** means an already approved contract that SEARCH-001 must preserve.
- **Recommendation** means the proposed SEARCH-001 outcome and still requires an explicit owner decision.
- **Measurement gate** means a decision that must be based on a representative test corpus or runtime evidence rather than assumption.
- **Future seam** means compatibility deliberately retained without implementing the future feature now.

**Gate result:** SEARCH-001 remains **Open**. The current recommendation in the decision register is not silently approved or amended by this proposal.

This task creates no SQL, extension, index, generated column, search projection, RLS policy, API, frontend behavior, Firebase change, hosted Supabase resource, data movement, or Production/TEST access.

## 2. Verified current behavior

### 2.1 Repository and platform state

- **Verified current fact:** Firebase remains the live Production backend. Supabase remains local-only, empty/synthetic-data-only, and is not a Production authority.
- **Verified current fact:** Current `main` has empty, fully revoked local foundations for Supplier profiles, categories, administrative areas, Supplier locations, Supplier-category assignments, capabilities, payment options, and contacts. They have no RLS, API/browser grants, client integration, search projection, or real rows.
- **Verified current fact:** `public.supplier_profiles` stores original/display names, optional Arabic and English names, public-business fields, lifecycle fields, and private provenance fields. It has B-tree browse indexes but no FTS or trigram index.
- **Verified current fact:** Category, administrative-area, location, category-assignment, and capability foundations have relational lookup indexes suitable for later exact filters. They contain no approved vocabulary/reference population and no search runtime.
- **Approved dependency:** Category classification, physical location, service coverage, capability, contact, and Supplier eligibility are different meanings. Search must not collapse them.
- **Approved dependency:** Current `searchKeywords[]` values are derived compatibility data, not future authoritative state.

### 2.2 Buyer directory browse and keyword search

- **Verified current fact:** `DirectoryPage.tsx` initially loads at most 100 approved Suppliers through `listSuppliersPage(100)` and loads later pages only when the user selects “Load more.”
- **Verified current fact:** Keyword search and all visible directory filters run in the browser over only the Suppliers already loaded. A result absent from the loaded pages cannot be found by keyword, governorate, category, rating, capability, business type, confidence, or coverage filters.
- **Verified current fact:** Keyword search expands recognized material terms, then uses Fuse.js over one concatenated `supplierSearchText` value. The haystack combines both languages, names, category/location labels, descriptions, free text, `searchKeywords[]`, branch details, branch phone, source summary, source note, credit data, and other fields.
- **Verified current fact:** Search therefore mixes retrieval concerns, public presentation, private/restricted evidence, and compatibility fields in one client-visible record shape.
- **Verified current fact:** Pagination is a Firestore document cursor without a search rank. Search rank is recomputed client-side whenever another page is loaded, so the visible result set and order depend on how many pages the user has loaded.

### 2.3 Smart Supplier recommendations

- **Verified current fact:** Smart search first parses the request locally using taxonomy labels, a static procurement ontology, and the material dictionary. If Firebase AI is strictly enabled, Gemini may add structured intent.
- **Verified current fact:** AI category and governorate values are allowlisted against the supplied taxonomy, numbers are bounded, AI failure falls back to local intent, and the result is merged with the deterministic local intent.
- **Verified current fact:** Candidate retrieval is limited to at most 100 Suppliers matching up to 10 inferred category values, then unioned with the Suppliers already loaded in the directory. Recommendation ranking is performed in the browser and returns at most five results.
- **Verified current fact:** Current scoring considers text/category matches, governorate/coverage, payment and credit assertions, rating, confidence level, and update freshness. Equal raw scores fall back to average rating; there is no immutable final tie-breaker.
- **Verified current fact:** AI does not currently invent a Supplier row, but it can broaden intent and therefore influence the client-ranked candidate set. The database does not own the final ranking or all eligibility checks.

### 2.4 RFQ recipient candidate lookup

- **Verified current fact:** The Buyer RFQ workspace calls `listSupplierCandidates([categoryId])` after a category is chosen and access is active.
- **Verified current fact:** Firestore returns at most 100 rows using `array-contains-any`; the client then keeps only approved Suppliers with `canReceiveRfqs === true`.
- **Verified current fact:** This is a deterministic category-and-eligibility lookup, not a general keyword search. It has no stable rank or complete-dataset pagination.

### 2.5 Claim Supplier search

- **Verified current fact:** The GitHub-only, undeployed Claim flow uses a trusted callable function, requires a current verified Supplier account, rate-limits searches, supports exact or prefix name modes, caps reads at 25, and returns at most 10 results.
- **Verified current fact:** It searches normalized Supplier-name variants only and excludes non-approved, watchlisted, or already owned profiles.
- **Verified current fact:** Its result projection is intentionally small: Supplier ID, bilingual names, governorate, city, up to three categories, and a sanitized website domain. It does not read the duplicate/contact index.
- **Verified current fact:** Claim Supplier is not deployed or enabled in Production. Its privacy and bounded-query pattern is evidence for the future Supabase contract, not evidence of live behavior.

### 2.6 Admin/Owner Supplier lookup

- **Verified current fact:** The approved-Suppliers admin page loads the complete approved Supplier collection and filters it in the browser.
- **Verified current fact:** Its local haystack supports substring matching across IDs, bilingual names, emails, phones, WhatsApp, contact people, addresses/branches, categories, capabilities, `searchKeywords[]`, source notes, UAT identifiers, and registration/reference-like fields.
- **Verified current fact:** Focused tests cover whitespace/case normalization, Arabic and English names, identifier/contact/location/category/reference matching, empty results, and URL query routing. They do not prove server-side pagination, authorization-safe projections, stable ranking, or bilingual recall.

### 2.7 Material dictionary, ontology, and normalization

- **Verified current fact:** The repository contains a curated bilingual material list with canonical Arabic/English terms, synonyms, subcategories, brands, and standards. Tests prove phrase matching for “Differential Pressure Gauge,” Arabic/English equivalence, `DP Gauge`, and longest-useful unknown phrase capture.
- **Verified current fact:** The static procurement ontology maps a small set of recognized products to possible categories, search terms, and locale-specific Supplier-type descriptions.
- **Verified current fact:** Current normalizers use Unicode NFKC or bounded character folding in some paths, remove Arabic diacritics, normalize selected Arabic letters, lowercase English, normalize digit scripts in the Claim path, and sometimes remove common company words.
- **Verified current fact:** These normalizers are inconsistent across directory, admin, material, duplicate, and Claim paths. Several transformations are lossy and none is a single approved versioned PostgreSQL search contract.
- **Verified current fact:** Unknown-term capture can currently retain a bounded raw query excerpt and user ID in suggestion examples. The schema design instead requires minimized, restricted evidence and prohibits complete query/record dumps.

## 3. Problems in the current Firebase/client-search approach

1. **Incomplete recall:** directory and smart search can miss eligible Suppliers outside the first loaded page or the 100-row category candidate query.
2. **Client-authoritative ranking:** ranking changes with loaded-page state and is not reproducible from one database query.
3. **Mixed security domains:** public/buyer search text currently includes branch phone values, source summaries/notes, and other data that must not enter a general searchable projection.
4. **Compatibility data leakage:** `searchKeywords[]`, denormalized arrays, and free-text source fields influence matching even though they are not authoritative relational facts.
5. **Semantic conflation:** text presence can blur category eligibility, physical presence, service coverage, capability, payment, confidence, and freshness.
6. **Inconsistent normalization:** Arabic letter folding, digit conversion, company-word removal, punctuation handling, and phrase treatment vary by code path and are not versioned as one contract.
7. **Weak pagination semantics:** Firestore browse pagination has no search rank; client filtering after pagination cannot provide a stable global order.
8. **Unmeasured fuzzy behavior:** Fuse.js and existing Dice scoring use hard-coded thresholds without a reviewed Arabic/English relevance corpus.
9. **AI influence without a database search contract:** optional AI can broaden intent before a complete eligible candidate set and deterministic rank exist.
10. **Privacy-heavy admin scan:** support lookup requires sensitive identifiers, but the current solution retrieves whole Supplier records and performs broad substring matching in the browser.

## 4. Requirements for the first Supabase operational release

### 4.1 Required search experiences

The first operational release must support exactly these bounded experiences:

1. **Buyer directory browse/search:** complete-dataset keyword search, explicit facets, locale-correct result presentation, stable keyset pagination, and truthful empty states over the audience-eligible Supplier projection.
2. **RFQ recipient candidates:** complete-dataset exact category filtering plus database-authoritative RFQ eligibility; optional approved delivery/service-area filters; no AI eligibility decision.
3. **Claim Supplier lookup:** exact and prefix Supplier-name search over the eligible unowned subset, bounded results, rate limiting, and the existing minimized result shape. Activation still depends on the separately approved Claim delivery gates.
4. **Admin/Owner support lookup:** a separate restricted endpoint for exact identifiers and exact normalized contact/reference lookup, plus safe name search. It must not reuse the Buyer projection or return a match explanation that reveals the protected value.
5. **Optional smart-query interpretation:** local dictionary/ontology parsing, with optional AI assistance, may translate a natural-language request into proposed search terms and filter IDs. The same deterministic database search must execute the resulting query.

Saved searches, global message search, advanced Catalog search, paid placement, semantic/vector search, and anonymous public Supplier search are not required for this release.

### 4.2 Searchable, exact-only, filter-only, and excluded fields

| Data class | Buyer directory | RFQ candidates | Claim lookup | Admin/Owner support |
|---|---|---|---|---|
| Approved Supplier display/original/Arabic/English names | FTS plus exact/prefix boosts | Display only; optional name refinement | Exact/prefix only | Safe name FTS plus exact/prefix |
| Approved public short description and reviewed material/service text | FTS | Not an eligibility fact | Excluded | FTS only if authorized for support audience |
| Reviewed category labels and approved search synonyms | Query expansion and rank boost; assignment remains authoritative | Exact active category-assignment filter | Display only, bounded | Exact filter plus safe label search |
| Active mapped administrative area | Filter-only; physical location and service coverage are separate filters | Filter-only if the RFQ contract requires it | Bounded display only | Exact filter |
| `all_iraq` service coverage | Filter-only | Filter-only if required | Excluded | Exact filter |
| Approved public capability code/label | Filter-only; optional rank boost only after owner approval | Filter-only only when RFQ eligibility explicitly requires it | Excluded | Exact filter |
| Business type and approved rating summary | Filter-only; rating must not override text relevance | Not authoritative unless the RFQ contract says so | Excluded | Exact filter |
| Public immutable Supplier reference | Exact-only | Exact-only if present in the workflow | Exact-only if approved for disclosure | Exact-only |
| PostgreSQL UUID and legacy Firestore ID | Not general free-text; UUID may be an exact deep-link lookup | Exact internal lookup only | Result identity only | Exact-only, restricted by role |
| Phone, email, WhatsApp, contact person, registration/tax/source reference | Excluded | Excluded | Excluded | Exact normalized restricted lookup only; never general FTS |
| Address text, branch phone, map URL, source note/summary, review note | Excluded from text projection | Excluded | Excluded except already approved bounded location/domain fields | Excluded from FTS; separately authorized exact support fields only |
| Confidence/security/duplicate signals, ownership/member identity, migration metadata | Excluded from search and rank | Eligibility may consume trusted state without exposing it | Eligibility may consume trusted state without exposing it | Excluded from ordinary results; dedicated investigation paths only |
| Current `searchKeywords[]` | Never authoritative and not migrated as search state | Never authoritative | Never authoritative | Never authoritative |

Payment and credit assertions have no approved client projection in the current PostgreSQL contracts. They must remain unavailable to Buyer search until a later access/projection decision explicitly authorizes their fields and meaning.

### 4.3 Deterministic authority boundary

- The database owns audience eligibility, Supplier lifecycle, active category assignments, active mapped locations/coverage, approved capabilities, exact filters, pagination, and final result membership.
- Category and administrative-area filters use canonical UUIDs/codes and active relational assignments. A text match never creates or substitutes for an assignment.
- RFQ candidate eligibility uses the trusted `can_receive_rfqs` contract or its transactionally equivalent predicate. AI, material terms, popularity, and fuzzy similarity cannot override it.
- Claim eligibility excludes owned, non-approved, watchlisted, or otherwise ineligible Suppliers before ranking.
- Exact protected identifiers use separate constant-shape lookups against protected normalized values/digests. Their match fields never enter the Buyer/Claim projection.
- Ranking is neutral. No paid placement or undisclosed commercial boost is permitted.

### 4.4 Normalization contract

Every searchable value retains the original authored value. Derived values record `normalizer_version`; a version change rebuilds the projection and produces a collision/recall comparison before activation.

The recommended first version performs only reviewed, deterministic transformations:

- Unicode NFKC; remove control characters; trim and collapse whitespace.
- English: locale-independent lowercase for matching; preserve letters, numbers, meaningful `+`, `#`, `/`, hyphen, dot, and model/part-number separators in the code channel.
- Arabic: remove tatweel and optional diacritics; normalize Arabic-Indic and Persian digits to Latin digits for matching; use only explicitly approved letter equivalences. Original spelling remains untouched.
- Do not translate, transliterate, stem, reorder, or split an approved multi-word phrase during canonical normalization.
- Do not remove company/legal-form words from the only search representation. A secondary name-comparison form may omit reviewed legal forms for a lower-ranked boost, but exact authored-name matching stays available.
- Store or derive separate normalized phrase, token, and code/model representations. `DP-100`, `DP100`, `SF/UTP`, `CAT6`, `H2SO4`, `ASME B16.5`, and Arabic/Latin digit variants must not be destroyed by punctuation stripping.
- Transliteration is a curated alias relationship, not an automatic normalization rule.

### 4.5 Bilingual retrieval and presentation

- Arabic-script query segments rank Arabic names/terms first; Latin-script query segments rank English names/terms first. Mixed queries evaluate each segment in its matching channel.
- Reviewed dictionary/alias relationships may expand an Arabic term to an English retrieval term, or vice versa. Raw machine translation is not a database fact.
- Same-script exact phrase, exact name, exact approved alias, and exact code/model matches outrank cross-language expansion.
- Results render only the active UI locale’s approved label/name fields under their existing presentation rules. Matching an English alias in Arabic mode must not inject English category text into the Arabic view, and the reverse also applies.
- Category and administrative-area labels remain paired and never use silent cross-language fallback. Original Supplier-authored text may be shown only where that audience and existing presentation contract permit it.

### 4.6 Brands, models, part numbers, phrases, and misspellings

- **Brands:** use reviewed material-term aliases or later Catalog Lite brand fields. A brand is retrieval evidence, never a category assignment.
- **Models and part numbers:** use exact normalized code matching, controlled prefix matching where ambiguity is bounded, and a separate code/model rank tier. FTS stemming must not alter them.
- **Standards and abbreviations:** use typed reviewed aliases. Ambiguous abbreviations require category/context evidence or remain broad results.
- **Multi-word terms:** preserve the complete phrase, apply phrase matching/boosting, and only then use token-level fallback. “Differential pressure gauge” must not become three independent authoritative matches.
- **Transliteration:** support only reviewed aliases with locale/script and source provenance.
- **Misspellings:** Phase 1 returns deterministic FTS/prefix results and may offer reviewed suggestions. It must not silently broaden to fuzzy Supplier eligibility. Trigram similarity is introduced only after the measurement gate in section 8.

### 4.7 Material dictionary, procurement ontology, and AI

- The material dictionary is versioned, reviewed retrieval configuration for canonical material concepts, phrases, synonyms, brands, standards, and category suggestions. It does not assert that a Supplier sells a material.
- The procurement ontology is a bounded query-intent aid. Its product-to-category relationships must be reviewed/versioned before server use and must not become hidden taxonomy state.
- Until `material_terms` and `material_term_aliases` are separately implemented, a versioned server-side artifact may provide the same query-expansion interface. This is a compatibility seam, not authority to create those deferred tables in the search implementation PR.
- Optional Gemini/AI may propose only bounded query terms and canonical filter IDs. Every ID is allowlisted and every filter is revalidated by the database search service.
- AI may not create Supplier facts, infer ownership, verification, approval, category assignment, service coverage, capability activation, RFQ eligibility, or contact disclosure.
- AI output must never directly add a Supplier to results or override deterministic exclusion. Optional AI reranking, if retained later, may reorder only an already eligible bounded candidate set and must be labeled, measurable, disableable, and secondary to exact-match tiers.
- AI failure, timeout, disablement, or invalid output falls back to the deterministic local parser and database search without loss of core functionality.

## 5. Technology options

### Option A — PostgreSQL relational filters and FTS first; evidence-gated `pg_trgm`

Use canonical relational filters, a field-minimized derived Supplier search projection, separate Arabic/English/code channels, PostgreSQL FTS with phrase/exact tiers, and stable keyset pagination. Do not enable `pg_trgm` initially. Measure the corpus and add trigram candidate generation only if approved misspelling/name recall remains below the agreed gate after normalization and dictionary work.

### Option B — PostgreSQL FTS plus `pg_trgm` from day one

Use the same database contract as Option A but install and index trigram similarity immediately for Supplier names, reviewed aliases, and selected code fields.

### Option C — external search service for Phase 1

Publish an audience-safe search document to a dedicated search provider and use PostgreSQL as the source of truth for filters/eligibility, with synchronization, replay, deletion, monitoring, and fallback infrastructure.

### 5.1 Tradeoff matrix

| Dimension | Option A | Option B | Option C |
|---|---|---|---|
| Arabic/English | Explicit PostgreSQL channels and corpus-driven tuning; no unproved fuzzy benefit | Potential typo/transliteration recall, but thresholds may create Arabic collisions and noisy short-token matches | Provider-dependent analyzers; still requires Mujahiz-specific bilingual corpus and aliases |
| Performance | One database, bounded projection, GIN plus relational B-tree indexes; simplest to profile | Extra GIN/GiST index and similarity CPU/write cost before need is known | Fast specialized retrieval is possible, but network and synchronization latency are added |
| Maintenance | Lowest operational surface; versioned rebuild remains required | Additional extension, thresholds, operator classes, index maintenance, and tuning | Highest: provider, credentials, sync/outbox, replay, deletion, monitoring, incident recovery |
| Security/privacy | Search projection stays beside relational eligibility and can be audience-minimized | Same boundary, but fuzzy indexes must still exclude protected fields | Copies searchable data to another system and adds deletion/residency/access review |
| Cost | Existing PostgreSQL capacity plus measured index/storage cost | Existing platform plus higher database index/CPU cost | New recurring service and operational cost before scale evidence |
| Migration | Derived rebuild from reviewed relational rows; no `searchKeywords[]` import | Same plus extension/index rollout and rollback | Requires dual-write/backfill/reconciliation before cutover |
| Failure mode | Disable FTS path and retain database browse/filters | Disable trigram branch while retaining FTS | Must fall back to PostgreSQL and reconcile stale/partial external documents |

## 6. Recommended option

**Recommendation: approve Option A.**

Start the first operational release with PostgreSQL relational filters plus bilingual FTS/exact/phrase/code ranking over a rebuildable, audience-safe search projection. Keep `pg_trgm` out of the initial implementation and introduce it only after measured recall failure under section 8. Reject an external search service for Phase 1; reconsider it only after the database approach fails agreed recall, latency, or operational requirements at representative scale.

This recommendation matches the existing decision-register direction but does not resolve SEARCH-001. Owner approval or amendment is still required.

## 7. Proposed SQL/index/projection boundary for a future separate implementation PR

The future implementation PR may design and implement only the minimum objects needed for the approved option. This section is conceptual and contains no executable SQL.

### 7.1 Audience-safe search projection

Use one rebuildable logical Supplier search projection for Buyer/RFQ-safe fields, with a stable `supplier_profile_id`, projection version, normalizer version, locale-specific source text, code/model text, and derived locale-specific search vectors. It may be implemented as a maintained relation/materialized projection or another reviewed PostgreSQL-native mechanism; the implementation review must prove refresh, rebuild, reconciliation, and failure behavior.

Cross-table category/location/capability aggregation must not be hidden in an unmaintainable generated expression. The projection is derived from active reviewed rows and can be rebuilt without treating itself as authoritative.

The projection may contain only:

- audience-approved Supplier names and description/material-service text;
- approved active category labels and reviewed search synonyms for retrieval expansion;
- approved public capability labels if their separate projection is authorized;
- public administrative-area names needed for display/query interpretation;
- reviewed material aliases, brands, standards, and code/model variants used as retrieval evidence; and
- lifecycle/version fields required to invalidate or rebuild the document.

It must exclude contacts, ownership/member identity, duplicate fingerprints/candidates, private addresses/evidence, provenance/source notes, internal confidence/security/quality signals, review notes, raw term-suggestion examples, migration IDs/metadata, and protected audit fields.

Admin/Owner exact support lookup uses a separate restricted function/projection and protected B-tree/digest lookups. It must not add private fields to the Buyer projection.

### 7.2 Candidate index concepts

- Partial B-tree indexes for eligible Supplier lifecycle and stable browse ordering.
- Existing/join-oriented B-tree indexes for active Supplier-category, active mapped area/coverage, and separately approved capability filters.
- GIN indexes for explicit Arabic and English FTS vectors in the safe projection.
- B-tree indexes for exact normalized name, public reference, and code/model lookup.
- No trigram index in the initial Option A implementation.
- Every candidate index requires representative synthetic/approved TEST data, query plans, size/write-cost evidence, and proof that it serves a named query path.

### 7.3 Ranking contract

Ranking tiers are deterministic and applied in this order:

1. exact allowed identifier or exact normalized model/part code;
2. exact normalized Supplier name;
3. same-script exact reviewed phrase/alias;
4. same-script FTS rank;
5. reviewed cross-language dictionary/alias expansion;
6. token fallback.

Relational filters are mandatory predicates, not score boosts. Internal confidence, source, contact presence, ownership identity, paid status, update timestamp, and hidden review/security signals do not influence public rank. Approved rating or capability boosts require an explicit later owner decision and must remain subordinate to text relevance.

Search ordering is `match_tier DESC`, deterministic rank value `DESC`, locale-appropriate normalized display name `ASC`, then Supplier UUID `ASC`. Browse ordering is locale-appropriate normalized display name plus Supplier UUID.

### 7.4 Pagination contract

- Use keyset pagination; never use offset pagination for ranked Supplier search.
- Use an opaque cursor bound to the normalized query hash, filter hash, locale, normalizer/projection version, page size, and final ordering tuple.
- Reject a cursor when any bound input differs.
- Return an explicit bounded page size and `has_more`; do not load the whole eligible dataset into the browser.
- Rank values used in the cursor must use a deterministic precision/representation so a repeated unchanged query produces the same order.
- Projection changes during navigation may move records; the endpoint must prevent duplicate/skip behavior within its supported consistency boundary and document whether it uses a transaction timestamp or version watermark.

## 8. Deterministic test corpus and acceptance matrix

No current measurement proves that PostgreSQL FTS, trigram, or an external engine meets Mujahiz IQ recall. The future implementation must create a synthetic/reviewed corpus before enabling search.

### 8.1 Corpus composition

The corpus should include, at minimum:

- Arabic-only, English-only, and mixed-script Supplier names;
- Arabic diacritics/tatweel and reviewed letter variants;
- Latin, Arabic-Indic, and Persian digits;
- legal-form words retained and secondary comparison forms;
- exact Supplier references and UUID-like values;
- category label/code/alias cases and ambiguous cross-branch aliases;
- governorate physical-location versus service-coverage cases, including `all_iraq`;
- brands, standards, abbreviations, transliterations, models, and part numbers;
- multi-word phrases including “differential pressure gauge” and Arabic equivalents;
- one-word and multi-word misspellings at realistic edit distances;
- private contacts/source notes containing tempting match text, to prove non-disclosure;
- ineligible, watchlisted, archived, owned-for-Claim, and RFQ-ineligible Suppliers;
- enough tied relevance scores to prove UUID tie-breaking and multi-page stability; and
- Catalog Lite-shaped product/service terms without requiring Catalog Lite tables.

Every query has a locale, audience, filters, expected eligible set, expected excluded set, and relevance grades for top results. Production Supplier rows or complete Production-derived records are prohibited as fixtures.

### 8.2 Acceptance matrix

| Case | Required deterministic result |
|---|---|
| Exact public/admin identifier | Authorized exact result at rank 1; unauthorized audiences receive no identifier oracle |
| Exact Arabic/English Supplier name | Expected eligible Supplier at rank 1 |
| Prefix Claim name search | Only eligible unowned Suppliers; maximum approved result/read limits; stable order |
| Category filter | 100% of results have an active approved assignment; text alone cannot qualify |
| Area filter | Physical and service-coverage semantics remain distinct; ambiguous/unmapped rows do not qualify |
| RFQ candidate lookup | 100% satisfy category and trusted eligibility; AI cannot add a row |
| Known bilingual material/alias | Expected relevant Supplier set appears within the owner-approved top-K target in each locale |
| Multi-word phrase | Phrase matches outrank independent-word matches; no word-by-word classification |
| Brand/model/part/standard | Exact normalized code/alias is preserved and ranked above loose text |
| UI locale | Search may use reviewed cross-language evidence, but rendered taxonomy/interface content remains in the active locale |
| Private-field canary | Zero Buyer/RFQ/Claim matches and zero result leakage from contact, provenance, ownership, review, security, or migration fields |
| Pagination | No duplicates or omissions across unchanged multi-page queries; cursor/input mismatch fails closed |
| AI unavailable/invalid | Same eligible database boundary and usable deterministic fallback |

### 8.3 Proposed quality and performance gates

The following are recommendations for owner approval, not measured facts:

- 100% pass rate for eligibility, authorization, exact identifier, private-canary, locale-display, and pagination invariants.
- Exact normalized Supplier name/reference success at rank 1.
- Recall@10 of at least 0.90 overall and at least 0.85 separately for Arabic and English judged queries after deterministic dictionary expansion.
- NDCG@10 of at least 0.80 overall, with Arabic and English reported separately rather than averaged away.
- Warm-query p95 at or below 300 ms and p99 at or below 750 ms at the application boundary on a representative dataset at least 10 times the current historical Supplier-count order of magnitude, while recording cold-cache results separately.
- No query plan may depend on a full eligible-Supplier sequential scan at the representative scale unless evidence proves that PostgreSQL correctly chooses it for a bounded tiny relation.

Owners may amend these numbers before approval. The implementation report must publish corpus size/composition, dataset scale, hardware/environment, query plans, index sizes, build/rebuild time, and per-locale results.

### 8.4 `pg_trgm` decision gate

Introduce `pg_trgm` in a later separate PR only when all of these are true:

1. the deterministic normalizer, exact/prefix/code paths, FTS configuration, and reviewed dictionary aliases are implemented and measured;
2. a reviewed misspelling/name-query subset fails its approved Recall@10 or zero-result target;
3. trigram evaluation on the same corpus produces a material improvement without violating private-field, short-token, Arabic-collision, latency, and index-cost limits; and
4. Technical/Data Owners approve exact indexed fields, similarity thresholds, operator/index choice, query caps, and rollback.

If those conditions are not met, `pg_trgm` remains absent. A typo result alone is not authority to use fuzzy similarity for category mapping, Supplier eligibility, ownership, or duplicate resolution.

## 9. Measurements required before an external search engine

An external engine is not justified until PostgreSQL Option A, and Option B if its gate is met, have measured evidence for:

- Recall@K, precision@K, MRR/NDCG, and zero-result rate by Arabic, English, mixed script, phrase, brand/model/code, and misspelling cohort;
- p50/p95/p99 latency at representative concurrency, cold/warm cache, and high-selectivity versus broad filters;
- query-plan stability, rows examined, database CPU/memory, index size, projection rebuild time, write amplification, and operational recovery time;
- pagination stability and maximum safe query/page limits;
- privacy/authorization negative tests and deletion/rebuild correctness;
- dictionary/alias maintenance effort and unresolved-term volume; and
- actual product requirements that PostgreSQL cannot meet, such as proven scale, advanced faceting, multilingual analyzer needs, or relevance iteration frequency.

Reconsider Option C only when the approved PostgreSQL approach misses an agreed quality or performance threshold after bounded tuning, or a separately approved feature requires capabilities PostgreSQL cannot supply safely. Any external design must include source-of-truth, outbox/sync, replay, deletion, residency, credential, monitoring, staleness, and PostgreSQL fallback contracts.

## 10. Migration implications

- Preserve every original Arabic, English, mixed, brand, model, standard, category, and material/service value under its approved domain contract.
- Recompute all search normalization with a named version. Do not copy current `searchKeywords[]` into future authoritative columns or projection rows.
- Do not promote current free-text subcategories, related-material text, ontology relationships, or material aliases into category assignments without the SUP-003 mapping/review process.
- Populate the search projection only from reconciled active relational rows and separately approved public fields. Ambiguous/unmapped category/location/capability values create no filter eligibility.
- Search projection counts and hashes must reconcile to the eligible source set; rebuilds must be idempotent and versioned.
- Current term-suggestion examples may contain user identity or full query text. Migration must minimize/quarantine them under a separately approved retention/privacy rule; they never enter search documents.
- Firebase and Supabase coexistence requires one explicit query authority per experience. Do not merge or compare partial rankings from both systems in one user-visible page.
- Cutover evidence must prove equivalent or intentionally changed eligibility, result disclosure, locale behavior, and pagination before routing traffic to Supabase.

## 11. Rollback and fallback behavior

- Before Supabase search cutover, Firebase remains authoritative and unchanged.
- After an approved Supabase cutover, a search-specific feature flag may disable optional AI, dictionary expansion, or ranked FTS independently.
- If optional AI fails, use deterministic parsing and the same PostgreSQL eligibility/filter query.
- If the search projection or FTS path is unhealthy, fall back to server-side eligible browse plus exact relational filters and stable keyset pagination. Do not fall back to loading the full collection or trusting `searchKeywords[]` in the client.
- A projection rebuild occurs beside the active version; activation switches only after count/hash/privacy/query-plan checks pass. Rollback selects the prior compatible projection/normalizer version.
- If a future trigram branch harms relevance or performance, disable that branch and retain FTS/exact/filter behavior; dropping extension/index objects is a separately reviewed implementation action.
- External-service failure, if that future option is ever approved, falls back to PostgreSQL and never broadens eligibility or exposes stale protected rows.

## 12. Future seams for Catalog Lite

Preserve these seams without implementing Catalog Lite now:

- stable Supplier and category foreign-key identities;
- a typed search-document source kind such as Supplier profile versus future catalog item;
- reusable material-term and alias identities for brands, standards, models, and part numbers;
- per-source eligibility and audience predicates;
- query/rank versioning that can combine Supplier-level and item-level candidates without changing Supplier authority; and
- result grouping by Supplier so many catalog items do not crowd out other eligible Suppliers.

Do not create product variants, inventory, transactional price search, vector embeddings, Catalog tables, or item-level indexes in the SEARCH-001 implementation merely to satisfy these seams.

## 13. Explicit owner decisions still required

| # | Decision | Recommended owner outcome |
|---:|---|---|
| 1 | SEARCH-001 technology | Approve Option A: PostgreSQL filters + bilingual FTS first; evidence-gated `pg_trgm` |
| 2 | First-release experiences | Approve Buyer directory, RFQ candidates, bounded Claim lookup when its delivery gates permit, restricted Admin/Owner lookup, and optional smart intent only |
| 3 | Searchable/filter/excluded fields | Approve section 4.2 and the separate public versus support projections |
| 4 | Normalizer | Approve the versioned, original-preserving boundary in section 4.4 and require collision/replay evidence for changes |
| 5 | Bilingual rank/display | Approve same-script-first ranking, reviewed cross-language expansion, and active-locale-only UI content |
| 6 | AI role | Approve optional intent assistance only; prohibit AI authority over facts, eligibility, filters, and result membership |
| 7 | Ranking | Approve exact/phrase/FTS tiers and prohibit paid/internal-confidence/freshness boosts for Phase 1 |
| 8 | Pagination | Approve opaque query-bound keyset cursors and the consistency/version boundary |
| 9 | Quality/performance gates | Approve or amend the proposed Recall/NDCG/latency and scale thresholds |
| 10 | `pg_trgm` gate | Approve later introduction only under all four evidence conditions in section 8.4 |
| 11 | External engine gate | Approve PostgreSQL measurement first and reject an external service for Phase 1 |
| 12 | Payment/credit search | Keep excluded until a separate client projection/access decision approves it |
| 13 | Admin exact support lookup | Approve protected exact normalized identifiers with no private-field match disclosure |
| 14 | Claim search inclusion | Confirm whether the first Supabase operational release includes Claim lookup or only preserves its ready seam until Claim runtime gates are implemented |

Until these decisions are explicitly approved or amended, SEARCH-001 remains Open and no implementation slice is selected.

## 14. Out-of-scope future enhancements

- SQL migrations, extension installation, FTS/trigram indexes, generated columns, projections, views, RPCs, RLS, or grants;
- frontend, Firebase, Gemini/API, hosted Supabase, Production/TEST, data migration, or deployment changes;
- semantic/vector search, embeddings, LLM-generated Supplier profiles, or general AI search;
- external search service selection or procurement;
- anonymous/public directory exposure;
- paid placement, personalization, behavioral ranking, saved searches, alerts, or search analytics beyond minimized measurement;
- automatic transliteration/translation, automatic taxonomy mapping, fuzzy Supplier merge, or fuzzy ownership/eligibility decisions;
- Catalog Lite tables, variants, inventory, pricing, CPQ, or product-media search; and
- edits to the authoritative baseline, decision register, or schema design, or resolution of SEARCH-001.

## 15. Validation and exact stop point

Validation for this proposal is documentation-only:

- exactly one new Markdown proposal file;
- SEARCH-001 remains Open and recommendations are labeled;
- relative repository links resolve;
- current Firebase versus local-only Supabase terminology is preserved;
- private Supplier/contact/ownership/provenance/security/migration data is excluded from public search projections;
- sensitive-value scan and `git diff --check` pass; and
- no executable, SQL, extension, index, application, data, hosted, Production, TEST, merge, or deployment change occurs.

Exact stop point: Draft PR containing this proposal only. Stop before owner approval, decision-register synchronization, SQL/index/projection implementation, `pg_trgm`, external search, data access/movement, Ready-for-review transition, merge, or deployment.

## 16. References

- [`09_POSTGRESQL_SCHEMA_DESIGN.md`](09_POSTGRESQL_SCHEMA_DESIGN.md)
- [`10_SCHEMA_DECISION_REGISTER.md`](10_SCHEMA_DECISION_REGISTER.md)
- [`02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md`](02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [`18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md`](18_SUP_003_CATEGORY_TAXONOMY_CONTRACT.md)
- [`21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md`](21_SUP_004_ADMINISTRATIVE_AREAS_AND_SUPPLIER_ASSIGNMENT_CONTRACT.md)
- [`../ai-context/01_CURRENT_BASELINE.md`](../ai-context/01_CURRENT_BASELINE.md)
- [`../ai-context/03_PRODUCT_AND_BUSINESS_RULES.md`](../ai-context/03_PRODUCT_AND_BUSINESS_RULES.md)
- [`../ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md`](../ai-context/04_SECURITY_AND_PRODUCTION_GUARDRAILS.md)
