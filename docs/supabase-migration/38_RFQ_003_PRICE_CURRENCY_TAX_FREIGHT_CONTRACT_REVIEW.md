# RFQ-003 price, currency, tax, and freight contract review

Status: **Owner-approved Option B Product/Finance/Data contract; RFQ-003 Resolved; no SQL, runtime, data transformation, or Production action is authorized**

Approval date: 2026-08-09

Verified approval/synchronization base: `origin/main` at `877317a7871e72925dcc5278f3d364d3e6994aa5`, after merged PR #93

## 1. Scope and decision boundary

This review determines what the current repository proves about RFQ quotation `price`, quantity, currency, tax, freight, discounts, revisions, and Buyer comparison. It records the Owner-approved Option B future PostgreSQL commercial-amount contract without assigning unproved meaning to legacy values.

The Product/Finance Owner approved all fourteen decisions in section 10 on 9 August 2026, resolving RFQ-003 for architecture/product/finance/data semantics only. This approval selects no RFQ or quotation SQL slice and authorizes no SQL, trusted command, RLS, runtime, frontend, amount transformation, Firebase read/write, Production/TEST access, hosted Supabase operation, data movement, award logic, FX, billing, or deployment. The authoritative baseline, schema design, and decision register are synchronized by the same documentation-only approval task.

Evidence labels used below are:

- **Proved fact**: directly established by current code, tests, or repository history.
- **Historical repository fact**: established by an earlier committed repository state; it does not prove which client created any particular stored document.
- **Inference**: a bounded conclusion from proved facts, explicitly not a stored-data guarantee.
- **Approved contract**: an Owner-approved future relational semantic boundary that still requires separately authorized implementation.
- **Unknown**: not safely resolvable from repository evidence alone.

## 2. Executive finding

The strongest current-product signal is the Supplier form label **“Total price”** / **“السعر الإجمالي”**. The current UI therefore asks a Supplier for one quotation-level total for the RFQ, not a unit price. The response has no line item, offered quantity, unit-price, tax-amount, freight-amount, discount, subtotal, or computed-total field, and no code multiplies RFQ quantity by `price`.

That current UI intent is not a safe legacy migration rule:

1. `price` was introduced in commit `f38c85c3f6ac27aa17d29537d6b44ac04340d97d` under the label **“Price (optional)”**, with no unit/line/total qualifier.
2. Commit `d31997b7f9e0bcd78ce7172d9011adf0855fd9c9` later changed the UI to **“Total price”** and expanded the structured commercial form.
3. Stored response and revision documents contain no commercial schema version, price-basis discriminator, originating UI version, tax treatment, or freight amount.
4. The original Firestore Rules allowed an owned Supplier response without validating the `price` or `currency` type or value. Current Rules are stricter, but cannot prove how an older document was created.

Accordingly:

- **Current UI meaning:** quotation-level total price for the current single-item RFQ experience.
- **Persisted field meaning:** one response-level numeric value named `price`, without an enforced unit/line/total semantic tag.
- **Legacy migration meaning:** ambiguous. Code alone cannot safely transform it into `unit_price`, `line_subtotal`, or `quotation_total`.

The Owner-approved approach is **Option B**: use an explicit normalized commercial contract for new relational quotations, while quarantining ambiguous legacy commercial values and preserving their source evidence. No legacy `price` is converted by current UI wording, timestamps, division by RFQ quantity, number magnitude, Iraq/locale/language, Supplier location, preferred currency, delivery terms, or assumed tax/freight treatment.

## 3. Evidence inspected

### 3.1 Authoritative design and migration context

- [Current baseline](../ai-context/01_CURRENT_BASELINE.md)
- [RFQ task profile](../ai-context/task-profiles/RFQ.md)
- [Product and business rules](../ai-context/03_PRODUCT_AND_BUSINESS_RULES.md)
- [Testing and definition of done](../ai-context/06_TESTING_AND_DEFINITION_OF_DONE.md)
- [Firestore-to-PostgreSQL mapping draft](./02_FIRESTORE_TO_POSTGRES_MAPPING_DRAFT.md)
- [Cutover and rollback principles](./06_CUTOVER_AND_ROLLBACK_PRINCIPLES.md)
- [Authoritative PostgreSQL schema design](./09_POSTGRESQL_SCHEMA_DESIGN.md)
- [Schema decision register](./10_SCHEMA_DECISION_REGISTER.md)

The current design recommends exact numerics, explicit ISO currency per revision, immutable revision items, scale-4 half-even canonicalization, and a canonical quotation no-op hash. Before this approval it explicitly left legacy `price` meaning, tax, freight, and currency transformation Open under RFQ-003; the approved contract below closes that semantic gate without implementing it.

### 3.2 Current implementation and tests

- [Workspace types](../../src/types/workspace.ts)
- [Domain types](../../src/types/domain.ts)
- [RFQ lifecycle normalization](../../src/utils/rfqLifecycle.ts)
- [RFQ option lists](../../src/data/rfqOptions.ts)
- [Workspace service](../../src/services/workspace.ts)
- [Buyer RFQ page](../../src/pages/workspace/BuyerWorkspacePages.tsx)
- [Supplier RFQ page](../../src/pages/workspace/SupplierWorkspacePages.tsx)
- [Quotation revision history](../../src/components/RfqRevisionHistory.tsx)
- [Firestore Rules](../../firestore.rbac.rules)
- [RFQ workflow tests](../../tests/rfq-workflow.test.mjs)
- [RFQ lifecycle tests](../../tests/rfq-lifecycle.test.mjs)
- [RFQ Firestore Emulator tests](../../tests/rfq-firestore-emulator.mjs)

`src/types/domain.ts` contains no RFQ price model. Its only price-related field is the unrelated optional Supplier-review score `priceClarity`. The operative RFQ types are in `src/types/workspace.ts`.

## 4. End-to-end field trace

| Concern | UI input | Type/domain shape | Service and Firestore write | Revision/history | Buyer read/comparison | What the path proves |
|---|---|---|---|---|---|---|
| Requested quantity | Buyer number input, minimum 1 | `RfqRecord.quantity: number` | Converted with `Number`, then service truncates to a positive integer; stored on `rfqs` | Not copied into response revisions | Displayed beside requested unit | One positive integer RFQ-header quantity exists. It is not an offered quantity and is not used to calculate `price`. |
| Requested unit | Buyer selects a controlled unit or `other` with text | `RfqRecord.unit` and optional `unitOther` | Trimmed/validated and stored on `rfqs` | Not copied into response revisions | Displayed beside quantity | Unit belongs to the RFQ request, not the response price field. |
| Preferred currency | Buyer selects `IQD`, `USD`, or `either` | `RfqRecord.preferredCurrency?` | Defaults to `either`; current service and Rules constrain the three values | Not a response-revision field | Displayed as a Buyer preference to Supplier | It is an RFQ preference, not proof of the submitted quotation currency and not an exchange-rate instruction. |
| Response `price` | Current Supplier form requires a number labeled “Total price,” minimum 0, step 0.01 | Optional `number` on `RfqResponse` and `RfqResponseRevision` | Converted through JavaScript `Number`; current service rejects non-finite/negative values; stored at response level in `rfqResponses` | Copied into every V1/V2 revision snapshot | Rendered as raw `price` plus response currency | Current UI intent is a quotation total. Storage only proves a response-level number and does not encode total/unit/line basis. |
| Response currency | Current Supplier selector offers IQD or USD | Optional `"IQD" | "USD"` on response and revision | Stored on canonical response; current Rules require IQD or USD for a valid new/updated response | Copied into each revision | Rendered beside raw price | Current new-response path supports IQD and USD only. Legacy absence or provenance remains possible. |
| Tax/VAT | No RFQ or quotation input | No RFQ response/revision field | No write or validation | Not present | Not shown or normalized | Tax applicability, inclusion, exclusion, rate, and amount are all Unknown. Absence does not mean zero or not applicable. |
| Freight/delivery charge | Delivery-term selector includes `freight_included` and `freight_excluded` among logistical choices | `deliveryTerms` and optional free-text `deliveryTermsOther` | Stored as a bounded string, not an amount; current Rules do not constrain it to the UI option set | Copied into each revision | Displayed as offered delivery terms | An exact selected term may state included/excluded, but no freight amount or allocation exists. Other delivery values say nothing about price inclusion. |
| Discount | No structured input | No RFQ response/revision field | No write or validation | Not present | Not shown or calculated | No structured discount exists. Free text cannot be transformed into a discount amount or rate. |
| No-op behavior | Resubmission of the form | Nine fields in `RFQ_COMMERCIAL_FIELDS` | Text is trimmed, price becomes a JS `Number`, delivery days are truncated, links are trimmed/deduplicated, then normalized values are compared field by field | Equal submission creates no V2/event/notification; material change creates the next revision | History labels changed fields | Current behavior is direct normalized equality, not canonical hashing and not decimal scale-4 comparison. |

## 5. Exact answers required by RFQ-003

### 5.1 What does current `price` mean?

**Proved fact:** The current Supplier UI labels it “Total price,” it is stored once on the response, and the Buyer UI displays it once per quotation.

**Proved fact:** No current code treats it as unit price, multiplies it by quantity, allocates it to a line, or recomputes a total.

**Historical repository fact:** The original input called it only “Price (optional).” No stored semantic-version field distinguishes documents created before and after the later “Total price” wording.

**Finding:** The current product asks for a quotation-level total, but legacy stored values remain ambiguous between unit, line, quotation total, or another Supplier-entered interpretation. The value cannot be authoritatively migrated from code evidence alone.

### 5.2 Where is quantity represented?

Quantity is a positive integer on the single RFQ header, paired with `unit` and optional `unitOther`. It is not repeated or confirmed by a Supplier response, there is no offered quantity, and it does not participate in price validation or comparison.

### 5.3 Where is currency represented?

- RFQ level: optional Buyer `preferredCurrency` of IQD, USD, or `either`.
- Canonical response level: optional legacy-compatible `currency` typed as IQD or USD.
- Revision level: currency is copied into each immutable revision snapshot.
- Line level: no response line exists, so no line currency exists.

The current response command does not enforce the Buyer preference. A specific Buyer preference and a different Supplier currency can therefore coexist unless the UI/user prevents it.

### 5.4 Which currencies does the current product support?

The current UI and current valid-response Rules support IQD and USD. `either` is a Buyer preference only and cannot be a quotation currency. Arbitrary currency is not a supported current UI behavior.

Legacy safety is weaker: the initial response Rules did not validate commercial field shape, and current TypeScript keeps currency optional for compatibility. Without record-specific trusted provenance, code alone cannot prove that every stored legacy value is present, IQD/USD, or UI-created.

### 5.5 What are the tax/VAT semantics?

Unknown. Tax/VAT is absent from the RFQ, response, revision, options, comparison, and focused tests. No evidence proves included, excluded, not applicable, zero, or embedded.

### 5.6 What are the freight/delivery-cost semantics?

There is no freight amount. The delivery-term vocabulary contains exact `freight_included` and `freight_excluded` labels, but the same single field also carries delivery methods such as Supplier delivery, Buyer pickup, site delivery, and EXW. Therefore:

- an exact included/excluded value is an observed term assertion;
- `freight_included` may indicate that the displayed price includes freight, but the freight component cannot be separated;
- `freight_excluded` supplies no payable freight amount; and
- every other delivery term leaves price inclusion Unknown.

No migration may turn these terms into a numeric freight charge without an approved rule and evidence.

### 5.7 Are discounts represented?

No. There is no discount amount, rate, basis, pre-discount price, or structured option. A message may contain arbitrary commercial prose, but parsing it would invent meaning.

### 5.8 What does the existing comparison UI compare?

It loads up to 100 responses for an RFQ, orders them by latest update/creation time, enriches each with a Supplier name, and renders side-by-side cards. Each card shows raw price plus currency, lead time, payment terms, delivery terms, message, links, and revision history.

It does not:

- sort or rank by price;
- multiply quantity by price;
- calculate subtotal, tax, freight, discount, or total;
- convert or group currencies;
- reject mixed-currency cards;
- normalize units; or
- highlight a lowest comparable offer.

The word “comparison” currently describes co-display, not a financially normalized comparison.

### 5.9 What do V1/V2 and no-op behavior preserve today?

First submission writes the canonical response, V1 revision, response event, and Buyer notification in one batch. A material update writes the changed canonical response, the next immutable revision, a deterministic response event, and a Buyer notification in one transaction. On first update of a legacy response without a revision number, the service also creates a V1 baseline from the existing response before creating V2.

The preserved commercial field set is message, price, currency, delivery days, payment terms and other text, delivery terms and other text, and reference links. Current no-op comparison trims text, converts price with JavaScript `Number`, truncates delivery days, and trims/deduplicates links. It performs direct equality and JSON string comparison. There is no SHA-256 no-op hash, decimal scale contract, half-even rounding, Unicode NFC rule, currency normalization, or source-fingerprint separation in the current runtime.

Consequently, V1/V2 proves workflow history and field snapshots, not the business meaning of the amount.

### 5.10 Which legacy values can be transformed deterministically?

| Source evidence | Safe deterministic treatment | Unsafe treatment |
|---|---|---|
| Valid RFQ quantity and unit | Create/preserve the requested RFQ item quantity and unit with source mapping and validation | Treat quantity as the quantity actually offered, delivered, or priced by the Supplier |
| RFQ preferred currency | Preserve as a Buyer preference when it is exactly IQD, USD, or `either` | Use it as the quotation currency or overwrite a response currency |
| Response identity, RFQ/Supplier/user linkage, timestamps, status, and revision sequence | Transform only after the existing party, lifecycle, and revision-integrity checks pass | Let a commercial interpretation repair identity/revision gaps |
| Message, delivery days/terms, payment terms, and safe links | Preserve as immutable source history subject to current validation and migration safety rules | Parse free text into tax, freight, discount, price basis, or award value |
| Exact legacy currency token | Preserve as observed source evidence; an exact IQD/USD value may become canonical only under an approved source-shape/provenance rule | Infer a missing code from locale, Iraq, language, Supplier location, RFQ preference, or number magnitude |
| Legacy `price` numeric value | Preserve the source value and source fingerprint in restricted migration evidence; quarantine its commercial interpretation | Divide by quantity, label it unit/line/total, round it to scale 4, or use it in comparison/award totals without approval |
| Exact `freight_included`/`freight_excluded` term | Preserve the observed term | Invent freight amount, allocation, or tax treatment |
| V1/V2 commercial snapshots | Preserve source ordering, identities, and raw commercial history | Treat revision existence as proof that amount semantics were correct |

### 5.11 Do tests prove commercial semantics?

No. The focused tests prove access scope, atomic V1/event/notification creation, immutable revisions, deterministic IDs, material-change behavior, legacy V1 preservation on first update, and duplicate-revision prevention under identical concurrent updates. Their fixtures use `quantity: 2`, `price: 1000`, and `currency: USD`, but assert no equation or semantic relationship between them. No test proves unit price, line total, quotation total, tax, freight amount, discount, currency-preference enforcement, scale, rounding, or cross-currency comparison.

## 6. Contract principles for a future relational quotation

The following principles are the **Owner-approved future relational contract**, not current Firebase behavior or implemented PostgreSQL behavior:

1. Every amount has one named business meaning. Generic `price` is not a relational column name.
2. New quotation commands use exact decimals only. Browser or JavaScript floating point is never authoritative for persisted money, totals, or hashes.
3. One revision has exactly one authoritative quotation currency. `either` is never stored as that currency, and mixed-currency lines are prohibited in the first release.
4. Quantity and unit are explicit immutable line snapshots. The first release does not support partial quantity, alternate units, or multi-currency lines.
5. Unit price is net after any Supplier discount and excludes only charges explicitly marked as separately added. This avoids inventing a first-release discount model.
6. Line subtotal, quotation subtotal, and quotation total are trusted derived snapshots validated from the authoritative inputs.
7. Tax treatment and freight charge treatment are separate from delivery logistics and separate from each other.
8. Tax and freight are quotation-level in the first release. Current evidence does not justify line allocation, multiple tax types, rates, jurisdictions, incoterm engines, or charge catalogs.
9. Every change to a commercial input creates a new immutable revision unless the canonical payload hash is identical.
10. Ambiguous legacy commercial values remain source evidence, not authoritative relational money.

## 7. Owner-approved Option B contract

### 7.1 Aggregate placement

| Aggregate | First-release responsibility | Reason |
|---|---|---|
| `rfq_items` | Requested quantity, unit code, optional bounded `other` unit text, stable line order | Quantity/unit originate with the Buyer request and are immutable after publication. |
| `quotations` | Recipient-anchored identity, lifecycle, and current-revision pointer only | Mutable current money must not compete with immutable revision history. |
| `quotation_revisions` | Currency, commercial modes, quotation-level tax/freight amounts, derived subtotal/total, terms, message, attachments, hash, normalizer version | These values apply to the whole submitted quotation and must change only by new revision. |
| `quotation_revision_items` | RFQ-item reference, line order, offered quantity/unit snapshot, unit price, derived line subtotal, compliance/notes where approved | This is the immutable comparable line snapshot. No separate mutable `quotation_items` table is needed. |

### 7.2 First-release commercial fields

| Field | Meaning and rule | Required? | Why justified now |
|---|---|---:|---|
| `offered_quantity` | Exact positive decimal quantity priced by this line; initially must equal the published RFQ item quantity | Yes | Required to distinguish amount basis and calculate the line subtotal. Equality preserves current no-partial-bid behavior. |
| `offered_unit_code` / bounded `offered_unit_other` | Immutable unit snapshot; initially must equal the RFQ item unit | Yes | Prevents a unit-price amount from becoming detached from its unit while keeping alternate units out of first release. |
| `unit_price` | Strictly positive net amount per offered unit, after any discount, before only separately added tax/freight | Yes | Removes the current unit/total ambiguity and permits deterministic line calculation; zero-price lines require a separate future contract. |
| `line_subtotal` | Trusted `offered_quantity × unit_price`, canonicalized to scale 4 | Derived | Enables validation, audit, comparison, and stable hashing; browser input is ignored. |
| `currency_code` | One uppercase quotation currency inherited by every line | Yes, revision level | Current product requires IQD/USD selection and future comparison needs explicit currency. |
| `tax_mode` | `not_applicable`, `included_in_prices`, or `added_separately` | Yes | Absence currently creates unsafe ambiguity. Three modes cover comparison without a tax engine. |
| `tax_amount` | Exact quotation-level amount; required for `added_separately`, absent for `not_applicable`, and retained for `included_in_prices` only when explicitly supported as informational disclosure | Conditional | Supports correct payable total without adding rates, jurisdictions, multiple tax types, a tax engine, or line allocations; an included disclosure is never added again. |
| `freight_mode` | `included_in_prices`, `added_separately`, or `buyer_arranged` | Yes | Separates commercial inclusion from current mixed delivery/logistics terms. |
| `freight_amount` | Exact quote-level amount; required only for `added_separately`, absent otherwise | Conditional | Makes separate freight payable and comparable without inventing allocation. |
| `quotation_subtotal` | Sum of trusted line subtotals | Derived | Needed for reconciliation and comparison. |
| `quotation_total` | Subtotal plus only separately added tax and freight | Derived | Replaces ambiguous generic `price` for new quotations. |
| `normalizer_version` / `no_op_hash` | Versioned canonicalization contract and server-computed digest | Yes | Preserves current true-no-op behavior under exact decimal semantics. |

No explicit discount field is included in the approved first-release contract. `unit_price` is the actual net offered unit price after any discount. A Supplier may describe a promotion in notes, but it does not create a structured discount, list price, savings claim, or comparison adjustment. A later discount field requires evidence for amount versus rate, line versus quotation scope, allocation, rounding, disclosure, and award-value treatment.

### 7.3 Arithmetic contract

For each line:

`line_subtotal = round_half_even(offered_quantity × unit_price, 4)`

For each revision:

`quotation_subtotal = sum(line_subtotal ordered by RFQ line)`

`tax_addition = tax_amount when tax_mode = added_separately; otherwise 0`

`freight_addition = freight_amount when freight_mode = added_separately; otherwise 0`

`quotation_total = quotation_subtotal + tax_addition + freight_addition`

The trusted command recomputes all derived values and rejects any conflicting browser-supplied total. Included tax or freight is already inside line prices and is not added again. An optional disclosed included-tax amount is informational and must never be double-counted.

Negative quantities or amounts, NaN/infinity, exponent text, binary floating-point persistence, and implicit negative discount lines are prohibited. `unit_price` must be greater than zero. Free, sample, or no-charge lines require a separately approved Product/Finance contract rather than overloading ordinary quotation pricing.

### 7.4 Precision, scale, and rounding

The approved storage and canonical hash representation is exact `numeric(20,4)` for quantities, unit prices, component amounts, subtotals, and totals. Every canonical number is serialized with exactly four fractional digits and rounded half-even only at the approved canonical arithmetic boundary.

Scale 4 is justified by the existing authoritative design and future fractional units such as meter, liter, kilogram, ton, and work time. Display formatting may later show fewer decimals according to approved currency/UI conventions, but stored and canonical values remain exact at scale 4. No legacy float is rounded into this contract without a separately approved record-specific transformation rule.

### 7.5 Currency and mixed-currency behavior

The approved first-release command allowlist is exactly IQD and USD because those are the currencies evidenced by the current product. The stored field remains an explicit uppercase ISO-style code so a later approved currency can be added without changing amount semantics.

- An RFQ requesting IQD accepts only an IQD quotation.
- An RFQ requesting USD accepts only a USD quotation.
- An RFQ requesting `either` accepts one chosen IQD or USD currency per revision.
- One revision and all its lines use one currency.
- A currency change creates a new revision.
- Quotations in different currencies are grouped and labeled **not directly comparable**.
- No exchange rate, automatic conversion, price ranking, or “lowest” badge is permitted across currencies.
- Missing, `either`, unsupported, malformed, or conflicting legacy currencies quarantine the commercial source unit.

A Supplier cannot override a specific IQD or USD RFQ currency in the first release. Any future override or FX behavior requires a separate explicit contract.

### 7.6 Tax and freight behavior

The approved tax and freight modes are mandatory for new relational quotations so absence never silently means zero.

| Mode | Amount rule | Total behavior | Comparison display |
|---|---|---|---|
| Tax `not_applicable` | No tax amount | Adds 0 | Explicitly “not applicable,” not “unknown” |
| Tax `included_in_prices` | Optional disclosed amount; no amount may also mean not separately disclosed | Adds 0 | Show included; show disclosed component only when present |
| Tax `added_separately` | Exact non-negative amount required | Adds amount | Show as separate addition |
| Freight `included_in_prices` | No separate freight amount | Adds 0 | Show included in prices |
| Freight `added_separately` | Exact non-negative amount required | Adds amount | Show separate charge |
| Freight `buyer_arranged` | No Supplier freight amount | Adds 0 | Show Buyer-arranged, not free freight |

Delivery method/terms remain separate text or controlled logistics fields. A delivery method such as Supplier delivery or EXW does not by itself determine `freight_mode`.

### 7.7 Canonical no-op contract

Use the existing design name `quotation-normalizer-v1`. The server computes SHA-256 over canonical UTF-8 JSON after validating the revision:

- header: response status, uppercase currency, validity, delivery/payment terms, message, tax mode/amount, freight mode/amount, subtotal, and total;
- items: stable RFQ item identity, line order, offered quantity/unit, unit price, line subtotal, compliance/alternate description, lead time, and notes where approved;
- attachments: stable content hash or approved normalized HTTPS reference and label;
- exact numerics: scale 4, fixed four-digit serialization, half-even rounding, never binary floating point;
- text: Unicode NFC, LF line endings, trimmed surrounding Unicode whitespace, and one explicit null sentinel for absent/empty optional text;
- ordering: RFQ line then stable item identity; attachment position then stable reference/digest; lexical object keys; and
- exclusions: actor, submission time, request/idempotency key, generated IDs, audit/event/notification IDs, and any derived value outside the approved field set.

The hash is separate from the raw-source fingerprint. Equal hash returns the current quotation/revision with `no_op=true` and creates no revision, item, event, audit, notification, or pointer change. A normalizer-version change never silently reinterprets an old hash.

### 7.8 Comparison rules

A Buyer comparison may use only current, complete, normalized revisions. It displays requested and offered quantity/unit, unit price, line subtotal, tax mode/amount, freight mode/amount, quotation total, currency, lead time, payment/delivery terms, and revision number.

Automatic price comparison or ranking requires:

1. the same RFQ scope;
2. the same first-release quantity/unit contract;
3. a complete normalized quotation with valid derived totals;
4. the same currency; and
5. valid tax and freight treatment.

The UI may identify the lowest normalized `quotation_total` among fully comparable quotations in the same currency. That indication is informational only: it is not an award recommendation, does not select a winner, and does not hide non-price factors.

A quotation that fails any gate displays a clear non-comparable state and is never automatically price-ranked. There is no automatic cross-currency comparison, FX conversion, or lowest-price indication across currencies.

Any future award or value record references only the immutable accepted normalized revision and its trusted calculated amount. It never uses the mutable quotation pointer or raw ambiguous legacy `price` for award amount, savings, lowest-price determination, or procurement value measurement.

### 7.9 Immutable revision semantics

One recipient has at most one quotation. Every first submission creates V1 plus its item snapshots and sets the current pointer in the same trusted transaction. Any later change to quantity, unit, unit price, currency, tax, freight, total-affecting terms, message, or approved attachment creates the next immutable revision. Prior rows never update or delete.

The current pointer is only a convenience reference to the latest accepted revision. Comparison reads it; historical review loads prior revisions on demand. Withdrawal, correction, or later award decisions are separate immutable state/history and do not rewrite commercial revisions.

## 8. Legacy migration, provenance, and quarantine

### 8.1 Default disposition

Every legacy `rfqResponses` source document and each `rfqResponseRevisions` source document is evaluated as one bounded commercial source unit. It must not produce authoritative normalized monetary rows when:

- price basis is unknown;
- currency is missing, invalid, or unsupported;
- quantity/unit mapping is unresolved;
- tax or freight interpretation would require inference; or
- revision integrity is unresolved.

Such a unit receives a `quarantined` or `pending` source disposition with no fabricated amount-bearing target graph until bounded evidence and an approved transformation version prove every required semantic.

The migration preserves, in restricted evidence:

- source system, collection, document ID, and source-version/checkpoint;
- migration batch and transformation version;
- raw commercial field presence and safe typed representation;
- a non-secret source-content fingerprint separate from the no-op hash;
- response/revision identity and sequence evidence;
- observed currency and terms without promotion to inferred meaning;
- exception code, rationale, review state, reviewer/approval provenance, and any successor disposition; and
- forward/reverse mapping evidence after a reviewed resolution.

It does not create fake zeros, fake currencies, fake unit prices, fake totals, or partial canonical graphs. Firebase remains authoritative until a separately approved feature cutover; retained source evidence is not deleted by this review.

### 8.2 Minimum exception classes

- `LEGACY_PRICE_BASIS_UNKNOWN`
- `LEGACY_CURRENCY_MISSING_OR_UNSUPPORTED`
- `LEGACY_TAX_TREATMENT_UNKNOWN`
- `LEGACY_FREIGHT_TREATMENT_OR_AMOUNT_UNKNOWN`
- `LEGACY_NUMERIC_SCALE_OR_FLOAT_UNSAFE`
- `LEGACY_QUANTITY_OR_UNIT_UNCONFIRMED`
- `LEGACY_REVISION_GAP_OR_CONTENT_MISMATCH`
- `LEGACY_SOURCE_PROVENANCE_INSUFFICIENT`

No exception is cleared from current UI wording, timestamps, number magnitude, RFQ quantity, Iraq/locale/language, Supplier location, Buyer preferred currency, delivery terms, free-text parsing, or any other inference alone. A reviewed correction appends a successor disposition/mapping and retains the original evidence.

### 8.3 Manual review boundary

Manual review may approve a specific source unit only with bounded explicit evidence of price basis, currency, tax treatment, freight treatment, quantity/unit basis, numeric value, and revision relationship, under reviewer authority defined by the migration/reconciliation contract. The review records who decided, when, under which policy/transformation version, and the resulting normalized values. No reviewer may merely relabel the same ambiguous number or infer semantics solely to make migration counts reconcile.

Historical events and notifications remain already materialized/fan-out suppressed. Migration review never emits a new quotation event or Buyer notification.

## 9. Option analysis

| Criterion | Option A — minimal response-total contract | Option B — normalized new contract, ambiguous legacy quarantined | Option C — normalized new contract plus permanent legacy compatibility envelope |
|---|---|---|---|
| Shape | New revisions store one `quoted_total_amount`, IQD/USD currency, and current terms; no unit price or derived lines | New revisions use explicit line quantity/unit/unit price, derived subtotals/totals, tax mode, freight mode, and one currency; legacy commercial values require reviewed transformation or quarantine | Option B for new data; ambiguous legacy values are also imported into a restricted immutable display-only envelope with `semantics=unknown` |
| Migration safety | Medium if all legacy `price` is declared a total; High only if legacy still quarantines | **High**: no automatic semantic rewrite and no partial target graph | Medium-High: raw fidelity is good, but a second permanent representation increases misuse risk |
| User experience | Simple, closest to current form, but offers remain weakly comparable | More structured entry; clearer payable total and comparison; modest additional Supplier input | Preserves legacy display in PostgreSQL, but users must understand two incompatible quotation representations |
| Comparison correctness | Low-Medium: total/currency visible, but tax/freight basis remains unclear and unit economics unavailable | **High for complete same-currency new revisions**; non-comparable states are explicit | High for new revisions; legacy envelope must remain excluded from ranking and totals |
| Auditability | Medium: one total is easy to preserve but its composition is unknown | **High**: explicit inputs, trusted derivations, immutable revisions, and versioned hash | Medium-High: source fidelity is strong, but dual models complicate investigation |
| Complexity | **Low** | Medium and bounded; no tax engine, FX, line allocations, or discount subsystem | High: compatibility projection, access rules, labels, lifecycle, and eventual retirement are additional work |
| Future award/value measurement | Weak: payable amount may not be comparable and unit basis is unavailable | **Strongest**: immutable normalized total can be referenced without mutating quotation history | Strong for new data; legacy remains unsuitable without later adjudication |
| Immutable revision compatibility | Good | **Good and explicit** | Good, but two revision payload classes must never be confused |

### Owner decision

The Product/Finance Owner approved **Option B** on 9 August 2026.

Option A is the smallest current-UI continuation but does not satisfy the stated need for deterministic unit/line/total, tax, and freight semantics. Option C is viable when legacy in-product display after cutover is a hard requirement, but the repository provides no evidence that a permanent second commercial model is necessary; it creates a durable risk that an “unknown” legacy amount is accidentally compared or awarded.

Option B adds only fields required for current quotation comparability or an explicit, bounded future-compatibility reason. It deliberately excludes tax rates/jurisdictions, line tax allocation, freight allocation, discount rates, list prices, alternates, partial bids, FX conversion, arbitrary currencies, incoterm automation, and award implementation.

## 10. Owner approval record resolving RFQ-003

On 9 August 2026, the Product/Finance Owner approved Option B and all of the following decisions. RFQ-003 is Resolved for this architecture/product/finance/data contract.

1. **Legacy price basis:** no automatic authoritative transformation of legacy Firebase `price`; it remains source evidence unless a separately approved, auditable record-specific provenance class proves its meaning. Current UI wording, timestamps, magnitude, RFQ quantity, Iraq/locale/language, Supplier location, preferred currency, and delivery terms cannot supply that meaning; ambiguous values remain quarantined and non-comparable.
2. **New amount basis:** `unit_price` is the authoritative net amount per offered unit; line subtotal, quotation subtotal, and quotation total use the approved equations above; separately added tax/freight are added once; browser totals and generic persisted `price` are never authoritative.
3. **Quantity/unit:** first-release offered quantity and unit equal the published RFQ item; partial quantities, alternate units, and substitute quantity/unit logic are unsupported pending a separate future contract.
4. **Currency allowlist:** first release supports IQD/USD only; a specific Buyer currency is mandatory, while `either` permits the Supplier to choose IQD or USD for the revision.
5. **Mixed currency:** one currency applies to the revision and every line; no mixed lines, automatic FX, cross-currency comparison, or cross-currency ranking is permitted.
6. **Precision/rounding:** quantity and monetary canonical values use exact PostgreSQL `numeric(20,4)`, exactly four fractional digits in canonical serialization, half-even rounding at the approved boundary, and no authoritative binary floating-point persistence.
7. **Tax:** modes are `not_applicable`, `included_in_prices`, and `added_separately`; no amount exists for not-applicable, a separately added quotation-level amount is required and added once, and included tax is never added again. An explicitly supported included-tax disclosure remains informational. No rates, jurisdictions, tax engine, line allocation, or multiple tax types are included.
8. **Freight:** modes are `included_in_prices`, `added_separately`, and `buyer_arranged`; only separately added freight requires and adds a quotation-level amount. Buyer-arranged freight has no Supplier amount. Freight treatment remains separate from delivery/logistics, with no allocation engine or Incoterm automation.
9. **Discounts:** no structured first-release discount model; `unit_price` is net after any Supplier discount, and notes create no discount amount/rate, list price, savings claim, or comparison adjustment.
10. **Zero price:** `unit_price` must be greater than zero; free/sample/no-charge lines require a separate Product/Finance contract.
11. **Comparison:** automatic price comparison requires the same RFQ scope, first-release quantity/unit contract, complete valid normalized data, same currency, and valid tax/freight treatment. The UI may identify the lowest same-currency normalized total only as information, never as an award recommendation, winner selection, or substitute for non-price factors.
12. **Legacy exceptions:** unknown price basis, missing/invalid/unsupported currency, unresolved quantity/unit mapping, inferred tax/freight, or unresolved revision integrity prevents authoritative monetary rows. Manual review uses bounded evidence and contract-defined authority; no reviewer invents semantics to reconcile migration counts.
13. **Revision/no-op:** every material commercial change creates an immutable revision. A versioned canonical hash covers the approved quantity, unit, unit price, currency, tax, freight, commercial terms, and other approved fields after server recomputation of totals; an identical payload is a no-op. Current JavaScript floating-point equality is not copied.
14. **Future award seam:** a future award/value record references only an immutable normalized revision and trusted calculated amount; raw ambiguous legacy `price` cannot determine awards, savings, lowest price, or procurement value. Award implementation remains out of scope.

This approval selects no RFQ/quotation or amount-bearing SQL slice. Separate later authorization remains required for SQL, trusted commands, RLS, migration tooling or transformation, tests, hosted environment work, data movement, cutover, frontend behavior, awards, FX, and deployment.

## 11. Risks and remaining implementation items

- The current “Total price” UI label is strong product intent but is not record-level provenance.
- Historic permissive Rules mean TypeScript/UI constraints cannot be assumed for every stored legacy document.
- Current `step="0.01"` browser input is not the approved canonical decimal boundary; exact input parsing, validation, and display formatting remain future implementation work.
- The current `deliveryTerms` field mixes logistical and freight-inclusion concepts; exact terms can be preserved but not converted into amounts.
- Current no-op equality is not the future canonical decimal hash and may treat some representations differently.
- A manually reviewed legacy amount remains unsafe unless bounded record-specific evidence proves price basis, tax, freight, currency, quantity/unit, and revision context together.
- No Production sampling was performed, so this review makes no claim about actual field presence, value distributions, or exception counts.

## 12. Validation and exact stop point

Validation for this document is limited to repository evidence and documentation safety:

- exactly the four requested Markdown documents change relative to the synchronized `origin/main` base;
- no executable, SQL migration, application, Firebase, RLS, hosted, or Production-data file changes;
- all repository references resolve;
- proved facts, historical facts, inference, approved contract, and Unknown states remain distinguishable;
- no locale, location, language, magnitude, tax, freight, currency, or migration-count inference is used;
- RFQ-003 and SEARCH-001 are Resolved, with exactly eight other Open gates;
- structural state remains 13 migrations, 19 physical tables, and 17 implemented / 19 deferred Core Phase 1 concepts; and
- relative-link, sensitive-value, scope, stale-wording, and Markdown/diff whitespace checks pass.

**Exact stop point:** Commit and push the four documentation updates to existing Draft PR #92 and update its description. Keep it Draft; do not mark Ready, merge, deploy, start Docker/Supabase, implement RFQ/quotation SQL or runtime/RLS/frontend/award/FX work, access Firebase Production/TEST, or migrate any data.
