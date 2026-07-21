# UI, UX, Brand, and Localization Rules

## Brand preservation

Mujahiz IQ has an established visual identity. Functional changes must not trigger an unrelated redesign.

- Reuse existing design tokens, components, spacing rules, icon style, radii, and typography.
- Do not introduce a second visual system.
- Do not replace brand assets with generic substitutes.
- Preserve responsive behavior and existing approved compositions unless the task explicitly changes them.

## Arabic and English

Arabic:

- Full RTL direction at page, component, form, table, navigation, dialog, and breadcrumb levels.
- Correct alignment of labels, values, icons, numbers, punctuation, and mixed technical strings.
- Arabic copy should sound professional and natural for Iraqi business users.

English:

- Full LTR direction.
- Professional procurement and supplier terminology.
- No residual Arabic interface strings unless they are user-entered data or an untranslated proper name.

Both:

- Never render accidental mixed-language labels.
- Avoid literal or word-by-word translation.
- Keep product names, brands, model numbers, part numbers, email addresses, and URLs intact.
- Test language switching without a hard refresh where supported.
- Use one canonical translation key per concept.

## Forms

- Validate required fields clearly.
- Preserve user-entered data after a recoverable error.
- Use field-level messages plus a concise form-level summary where useful.
- Iraqi mobile validation must account for accepted local and international forms according to the approved product rule.
- Email errors should distinguish invalid format, already registered, verification required, rate-limited, and permission failure.
- Dropdowns should be used for known sectors/categories, with an `Other` option and conditional text field when required.

## Tables and dashboards

- Provide useful empty states, not blank pages.
- Administrative activity labels must be human-readable.
- Explain status, date, actor, and action where appropriate.
- Pagination, sorting, and filtering must operate on correct data, not only the currently rendered subset.
- Destructive actions require confirmation and clear consequences.
- Loading, empty, error, unauthorized, and disabled states must be visually distinct.

## Accessibility and responsiveness

- Keyboard-accessible controls.
- Visible focus state.
- Semantic labels.
- Sufficient text and control contrast.
- Touch targets suitable for mobile.
- No content clipping at common mobile widths.
- Dialogs and menus must work in RTL and LTR.
- Respect reduced-motion preferences for nonessential animation.

## UI task scope rule

For a small UI fix:

- Inspect the target component and its direct styling dependencies.
- Do not request or scan the full codebase.
- Do not change business logic unless required.
- Test Arabic, English, desktop, and mobile states relevant to the component.
