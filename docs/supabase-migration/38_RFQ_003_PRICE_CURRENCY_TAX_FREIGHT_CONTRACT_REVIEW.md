# RFQ-003 price, currency, tax, and freight contract review

Status: **Decision-ready proposal only; RFQ-003 remains Open; no SQL, runtime, data transformation, or Production action is authorized**

Date: 2026-08-08

Verified starting point: `origin/main` at `89b8903c140a997a3c65f653c76a7e2d31f8c537`, the merge of PR #90

## 1. Scope and decision boundary

This review determines what the current repository proves about RFQ quotation `price`, quantity, currency, tax, freight, discounts, revisions, and Buyer comparison. It then proposes a safe future PostgreSQL commercial-amount contract without assigning unproved meaning to legacy values.

This document does not resolve RFQ-003. A Product/Finance Owner decision is still required before authoritative response-price transformation, normalized quotation comparison, or amount-bearing RFQ SQL. This review creates no SQL, changes no RFQ code or Firestore behavior, reads no Production or TEST data, and does not modify the authoritative baseline, schema design, or decision register.

Evidence labels used below are:

- **Proved fact**: directly established by current code, tests, or repository history.
- **Historical repository fact**: established by an earlier committed repository state; it does not prove which client created any particular stored document.
- **Inference**: a bounded conclusion from proved facts, explicitly not a stored-data guarantee.
- **Proposal**: a future contract requiring approval and implementation.
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

The recommended approach is **Option B**: use an explicit normalized commercial contract for new relational quotations, while quarantining ambiguous legacy commercial values and preserving their source evidence. No legacy `price` is converted by division, magnitude, locale, location, currency guess, or assumed tax/freight treatment.

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

The current design recommends exact numerics, explicit ISO currency per revision, immutable revision items, scale-4 half-even canonicalization, and a canonical quotation no-op hash. It also explicitly leaves legacy `price` meaning, tax, freight, and currency transformation Open under RFQ-003.

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

The following principles are **Proposal**, not current behavior:

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

## 7. Recommended Option B contract

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
| `unit_price` | Net amount per offered unit, after any discount, before only separately added tax/freight | Yes | Removes the current unit/total ambiguity and permits deterministic line calculation. |
| `line_subtotal` | Trusted `offered_quantity × unit_price`, canonicalized to scale 4 | Derived | Enables validation, audit, comparison, and stable hashing; browser input is ignored. |
| `currency_code` | One uppercase quotation currency inherited by every line | Yes, revision level | Current product requires IQD/USD selection and future comparison needs explicit currency. |
| `tax_mode` | `not_applicable`, `included_in_prices`, or `added_separately` | Yes | Absence currently creates unsafe ambiguity. Three modes cover comparison without a tax engine. |
| `tax_amount` | Exact quote-level tax amount; required for `added_separately`, optional informational disclosure for `included_in_prices`, absent for `not_applicable` | Conditional | Supports correct payable total without adding rates, jurisdictions, or line allocations not evidenced by the product. |
| `freight_mode` | `included_in_prices`, `added_separately`, or `buyer_arranged` | Yes | Separates commercial inclusion from current mixed delivery/logistics terms. |
| `freight_amount` | Exact quote-level amount; required only for `added_separately`, absent otherwise | Conditional | Makes separate freight payable and comparable without inventing allocation. |
| `quotation_subtotal` | Sum of trusted line subtotals | Derived | Needed for reconciliation and comparison. |
| `quotation_total` | Subtotal plus only separately added tax and freight | Derived | Replaces ambiguous generic `price` for new quotations. |
| `normalizer_version` / `no_op_hash` | Versioned canonicalization contract and server-computed digest | Yes | Preserves current true-no-op behavior under exact decimal semantics. |

No explicit discount field is recommended for the first release. `unit_price` is the actual net offered unit price after any discount. A Supplier may describe a promotion in notes, but it does not create a structured discount, list price, savings claim, or comparison adjustment. A later discount field requires evidence for amount versus rate, line versus quotation scope, allocation, rounding, disclosure, and award-value treatment.

### 7.3 Arithmetic contract

For each line:

`line_subtotal = round_half_even(offered_quantity × unit_price, 4)`

For each revision:

`quotation_subtotal = sum(line_subtotal ordered by RFQ line)`

`tax_addition = tax_amount when tax_mode = added_separately; otherwise 0`

`freight_addition = freight_amount when freight_mode = added_separately; otherwise 0`

`quotation_total = quotation_subtotal + tax_addition + freight_addition`

The trusted command recomputes all derived values and rejects any conflicting browser-supplied total. Included tax or freight is already inside line prices and is not added again. An optional disclosed included-tax amount is informational and must never be double-counted.

Negative quantities or amounts, NaN/infinity, exponent text, binary floating-point persistence, and implicit negative “discount” lines are prohibited. Zero unit price is allowed only if Product/Finance explicitly approves free lines; otherwise it must be positive. That zero-price policy is an owner decision listed below.

### 7.4 Precision, scale, and rounding

The recommended storage and canonical hash representation is exact `numeric(20,4)` for quantities, unit prices, component amounts, subtotals, and totals. Every canonical number is serialized with exactly four fractional digits and rounded half-even only at the defined boundary.

Scale 4 is justified by the existing authoritative design and future fractional units such as meter, liter, kilogram, ton, and work time. It is not permission to display four decimals to every user. Finance must approve accepted input precision and display/settlement rounding for IQD and USD. No legacy float is rounded into this contract until RFQ-003 and the transformation rule are approved.

### 7.5 Currency and mixed-currency behavior

The recommended first-release command allowlist is exactly IQD and USD because those are the currencies evidenced by the current product. The stored field remains an explicit uppercase ISO-style code so a later approved currency can be added without changing amount semantics.

- An RFQ requesting IQD accepts only an IQD quotation.
- An RFQ requesting USD accepts only a USD quotation.
- An RFQ requesting `either` accepts one chosen IQD or USD currency per revision.
- One revision and all its lines use one currency.
- A currency change creates a new revision.
- Quotations in different currencies are grouped and labeled **not directly comparable**.
- No exchange rate, automatic conversion, price ranking, or “lowest” badge is permitted across currencies.
- Missing, `either`, unsupported, malformed, or conflicting legacy currencies quarantine the commercial source unit.

If the Owner prefers allowing a Supplier to override a specific RFQ currency, that must be an explicit exception state and still cannot participate in direct comparison without an approved conversion contract.

### 7.6 Tax and freight behavior

Tax and freight modes are mandatory for new relational quotations so absence never silently means zero.

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

Direct numeric comparison or lowest-price highlighting requires:

1. the same RFQ and comparable line scope;
2. identical currency;
3. complete tax and freight modes;
4. valid derived totals;
5. supported quantity/unit equality in first release; and
6. no unresolved migration or commercial exception.

Mixed currency, missing tax/freight treatment, alternate quantity/unit, incomplete lines, or legacy-unresolved semantics must display a clear non-comparable state. They may be reviewed manually but never ranked by the system. Future award/value measurement references the immutable accepted revision and its normalized `quotation_total`; it never derives award value from the mutable quotation pointer or raw legacy `price`.

### 7.9 Immutable revision semantics

One recipient has at most one quotation. Every first submission creates V1 plus its item snapshots and sets the current pointer in the same trusted transaction. Any later change to quantity, unit, unit price, currency, tax, freight, total-affecting terms, message, or approved attachment creates the next immutable revision. Prior rows never update or delete.

The current pointer is only a convenience reference to the latest accepted revision. Comparison reads it; historical review loads prior revisions on demand. Withdrawal, correction, or later award decisions are separate immutable state/history and do not rewrite commercial revisions.

## 8. Legacy migration, provenance, and quarantine

### 8.1 Default disposition

Every legacy `rfqResponses` source document and each `rfqResponseRevisions` source document is evaluated as one bounded commercial source unit. If price basis, currency, tax, freight, numeric representation, or revision integrity is not proven under an approved transformation version, the unit receives a `quarantined` or `pending` source disposition with no fabricated amount-bearing target graph.

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

No exception is cleared from number magnitude, Iraq/locale/language, Supplier location, Buyer preferred currency, free-text parsing, or current UI wording alone. A reviewed correction appends a successor disposition/mapping and retains the original evidence.

### 8.3 Manual review boundary

Manual review may approve a specific source unit only with explicit evidence of price basis, currency, tax treatment, freight treatment, quantity/unit basis, numeric value, and revision relationship. The review records who decided, when, under which policy/transformation version, and the resulting normalized values. A reviewer must not merely relabel the same ambiguous number.

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

### Recommendation

Choose **Option B**.

Option A is the smallest current-UI continuation but does not satisfy the stated need for deterministic unit/line/total, tax, and freight semantics. Option C is viable when legacy in-product display after cutover is a hard requirement, but the repository provides no evidence that a permanent second commercial model is necessary; it creates a durable risk that an “unknown” legacy amount is accidentally compared or awarded.

Option B adds only fields required for current quotation comparability or an explicit, bounded future-compatibility reason. It deliberately excludes tax rates/jurisdictions, line tax allocation, freight allocation, discount rates, list prices, alternates, partial bids, FX conversion, arbitrary currencies, incoterm automation, and award implementation.

## 10. Exact owner decisions required to resolve RFQ-003 later

RFQ-003 must remain Open until the Product/Finance Owner records all of the following:

1. **Legacy price basis:** approve either no automatic legacy amount transformation (recommended), or name an auditable source class that proves quotation-total meaning. Current wording or timestamps alone are insufficient.
2. **New amount basis:** approve `unit_price` as net per offered unit and approve the line/quotation equations above.
3. **Quantity/unit:** approve that first-release offered quantity/unit must equal the published RFQ item and that partial/alternate offers are unsupported.
4. **Currency allowlist:** approve IQD/USD only for first release, the behavior of `preferredCurrency`, and whether a specific requested currency is mandatory (recommended) or overridable.
5. **Mixed currency:** approve one currency per revision, no line mixing, no automatic FX, and no cross-currency ranking.
6. **Precision/rounding:** approve exact `numeric(20,4)`, scale-4 canonical serialization, half-even rounding, accepted input precision, and IQD/USD display/settlement rules.
7. **Tax:** approve the three tax modes, when `tax_amount` is required or optional, and confirm that no rate/jurisdiction/line allocation is in first release.
8. **Freight:** approve the three freight modes, separate-charge amount rule, and separation of freight charge from delivery logistics.
9. **Discounts:** approve omission of a structured first-release discount and the rule that unit price is net after any discount.
10. **Zero-price policy:** decide whether a zero unit price/free line is valid or must fail.
11. **Comparison:** approve the completeness gates, same-currency requirement, non-comparable states, and whether any automatic lowest-price indication is allowed.
12. **Legacy exceptions:** approve quarantine codes, manual-review evidence, reviewer authority, and the rule that unresolved units create no amount-bearing canonical target graph.
13. **Revision/no-op:** approve the proposed commercial field set and `quotation-normalizer-v1` hash boundary, including currency/tax/freight changes as new revisions.
14. **Future award seam:** approve that a later award/value record references an immutable normalized revision/total and that raw legacy `price` cannot be used for award or savings measurement.

After approval, a separate documentation synchronization task must update RFQ-003 in the decision register and every dependent schema section. Separate later tasks are still required for SQL, trusted commands, RLS, migration tooling, tests, hosted environment work, data movement, and cutover. Approval of this proposal alone authorizes none of them.

## 11. Risks and unresolved items

- The current “Total price” UI label is strong product intent but is not record-level provenance.
- Historic permissive Rules mean TypeScript/UI constraints cannot be assumed for every stored legacy document.
- Current `step="0.01"` browser input does not establish an approved IQD/USD precision or rounding policy.
- The current `deliveryTerms` field mixes logistical and freight-inclusion concepts; exact terms can be preserved but not converted into amounts.
- Current no-op equality is not the future canonical decimal hash and may treat some representations differently.
- A manually reviewed legacy amount remains unsafe unless tax, freight, currency, quantity/unit, and revision context are decided together.
- No Production sampling was performed, so this review makes no claim about actual field presence, value distributions, or exception counts.

## 12. Validation and exact stop point

Validation for this document is limited to repository evidence and documentation safety:

- exactly one new Markdown proposal file;
- no executable, SQL, schema, baseline, decision-register, Firebase, or Production-data change;
- all repository references resolve;
- proved facts, historical facts, inference, proposal, and Unknown states remain distinguishable;
- no locale, location, language, magnitude, tax, freight, or currency inference is used;
- no secrets, credentials, personal data, or complete Production records are included;
- Markdown/diff whitespace checks pass; and
- RFQ-003 remains Open.

**Exact stop point:** Draft PR containing this standalone proposal only. Do not mark Ready, merge, resolve RFQ-003, edit shared authoritative design/register files, implement SQL/runtime/RLS, access Firebase Production, start Docker/Supabase, or migrate any data.
