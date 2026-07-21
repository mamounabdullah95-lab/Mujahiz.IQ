# Task Profile — UI and Localization

Use for copy, layout, responsive behavior, RTL/LTR, accessibility, component states, and isolated presentation defects.

## Load

- `docs/ai-context/05_UI_UX_AND_LOCALIZATION.md`
- The target component/page, direct styles, translations, and focused tests only.

## Preserve

- Existing brand and component system.
- Arabic RTL and English LTR behavior.
- No accidental mixed-language labels.
- Responsive behavior, keyboard access, visible focus, and useful loading/empty/error states.
- Existing business logic and routes unless the defect proves they must change.

## Avoid by default

- Backend, Firestore, Rules, indexes, Production audits, or full repository scans.
- Unrelated redesign, formatting sweep, or dependency changes.
- Maximum reasoning for routine presentation work.

## Verification

Check the affected Arabic/English, desktop/mobile, loading/empty/error states. Run targeted tests plus type/build checks proportionate to the change.

Suggested reasoning: Medium; High only when behavior spans multiple components or routes.
