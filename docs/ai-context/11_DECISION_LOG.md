# Decision Log

Record durable decisions only. Do not use this file as a chronological chat transcript.

## 2026-07-16 — Primary domain

Decision:

- `mujahiz.com` is the purchased primary domain.
- Purchase of an additional defensive domain is deferred due to budget.
- Firebase Hosting remains the hosting platform unless a future approved decision changes it.

## 2026-07-19 — Production baseline discipline

Decision:

- Production supplier counts and fingerprints are protected verification anchors.
- High-risk work must compare relevant baseline values before and after.
- Ordinary local UI work should not repeatedly query or restate the full Production baseline.

## 2026-07-20 — Token-efficient development workflow

Decision:

- Project context will be stored in repository documents.
- Prompts will reference those documents rather than repeat the project history.
- One coherent concern per task/branch/PR.
- Reviews default to the current diff and direct dependencies.
- Maximum reasoning is not the default.
- Session/Fork handoffs use a short task-state file.
- Baseline details are updated in one place only.

## Product decisions retained

- Buyer initial access period: 3 days.
- Ten new and approved supplier submissions grant 30 days of access.
- Bulk supplier Excel import is limited to authorized Buyer/Admin/Owner roles.
- Supplier accounts cannot use that bulk import.
- Import limit: 50 suppliers and 200 KB per workbook.
- Arabic and English must never be mixed accidentally in one interface mode.
- Normal users cannot self-promote, alter protected role/account identity, or modify trusted supplier-profile linkage.
