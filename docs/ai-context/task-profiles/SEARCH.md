# Task Profile — Search

Use for supplier search, ranking, query normalization, filtering, pagination, and bilingual technical matching.

## Load

- `docs/ai-context/03_PRODUCT_AND_BUSINESS_RULES.md`
- Relevant search UI, services, utilities, indexes, and search tests only.

## Preserve

- Search across the full eligible dataset, not only the first rendered page.
- Multi-word technical phrases, brands, models, part numbers, abbreviations, and Arabic/English variants.
- Precise meaning; avoid naive word-by-word translation or destructive tokenization.
- Server-bounded queries, correct cursor behavior, and explicit limits.
- Neutral ranking unless paid placement is explicitly approved and labeled.
- Role-correct search destinations and truthful empty states.

## Avoid by default

- Loading complete collections for client-side filtering.
- Broad architecture review when one search path is affected.
- Redesigning supplier data or taxonomy without product approval.

## Verification

Use targeted normalization/ranking tests, pagination tests, relevant index review, and production build. Run Emulator only when query authorization changes.

Suggested reasoning: High.
