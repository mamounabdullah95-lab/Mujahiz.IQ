# Context Update Checklist

Update documentation only when the underlying fact changed.

## Update `01_CURRENT_BASELINE.md` after

- Merge to `main` that changes application behavior, infrastructure, security boundaries, or Production assumptions.
- Production deployment.
- Firestore Rules or Index deployment.
- DNS/custom-domain change.
- Production data change.
- Verified test baseline change that affects future tasks.

## Update architecture after

- Framework or service change.
- New Firebase service.
- New repository structure.
- New canonical data-access layer.
- Material role/permission redesign.

## Update business rules after

- Product-owner approval of a changed rule.
- Trial/referral policy change.
- RFQ lifecycle change.
- New supplier state or verification workflow.
- Import-policy change.

## Update safety after

- New high-risk system.
- New deployment target.
- New data protection requirement.
- Approved backup/restore procedure.

## Do not update for

- Temporary debugging notes.
- A one-off command.
- A failed experiment.
- Long test logs.
- A branch that was not merged.
- A documentation-only Project Memory installation with no behavior change.
- Speculative future ideas.

## Before committing context changes

- Remove secrets and personal identifiers.
- Mark unknown items as unknown.
- Separate verified facts from recommendations.
- Keep the baseline date and source state clear.
- Avoid duplicating the same rule in multiple files unless the short duplication is necessary for safety.

---
