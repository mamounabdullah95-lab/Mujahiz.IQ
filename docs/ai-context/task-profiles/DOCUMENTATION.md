# Task Profile — Documentation and Project Memory

Use for `AGENTS.md`, `CODEX.md`, `docs/ai-context/`, decision logs, task profiles, handoffs, and durable repository documentation.

## Load

- Current root instructions.
- The specific context file being updated.
- Repository or merged-PR evidence needed to verify changed facts.

## Preserve

- Separation between stable rules and volatile baseline values.
- Verified facts versus recommendations or `Needs verification` items.
- One source of truth for each changing value.
- Short navigational instruction files; detailed context stays under `docs/ai-context/`.
- No secrets, personal identifiers, complete Production records, or long logs.

## Avoid by default

- Application code, dependency, Firebase, DNS, test, or generated-file changes.
- Updating the baseline for speculative, unmerged, or temporary work.
- Copying full PR descriptions or chat histories into Project Memory.

## Verification

Check links and paths, compare factual claims with current repository/merged PR evidence, and confirm the diff is documentation-only.

Suggested reasoning: Medium.
