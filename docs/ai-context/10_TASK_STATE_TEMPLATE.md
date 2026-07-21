# Task State / Session Handoff Template

Create one short state file when a task moves to a new session, Fork, or reviewer.

```markdown
# Task state: [name]

Updated: [YYYY-MM-DD HH:MM timezone]
Status: [investigating / implementing / PR open / awaiting approval / blocked / complete]

## Objective
[One sentence.]

## Repository state
- Base branch:
- Base commit:
- Working branch:
- PR:
- Latest commit:

## Completed
- [...]
- [...]

## Changed files
- `path`: [why]

## Verification
- `[command]`: [result]
- [manual check]: [result]

## Baseline delta
- Production writes: none / [explicitly approved details]
- Supplier count: unchanged / [value]
- Supplier fingerprints: unchanged / [verified reference]
- Other relevant counts: [...]

## Remaining
1. [...]
2. [...]

## Blocker or decision
[Only the exact unresolved point.]

## Safety
- Do not repeat completed steps.
- Do not merge/deploy/write to Production without explicit approval.
- Continue from the listed commit and inspect only relevant files first.
```

Keep this handoff under approximately 300–500 words. Do not paste long logs or the full original prompt.
