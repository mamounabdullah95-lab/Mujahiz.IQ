# Security and Production Guardrails

These rules are mandatory unless the user gives an explicit, task-specific approval that overrides one of them.

## Default permissions

Default mode is:

- Repository reads allowed.
- Local code edits allowed on a dedicated branch.
- Local tests allowed.
- Emulator tests allowed.
- Read-only Production verification allowed only when necessary and safe.
- Production writes are not allowed.
- Merge and deployment are not allowed.

## Actions requiring explicit approval

Do not perform any of the following without explicit approval in the current task:

- Write, update, or delete Production data.
- Create Production test records.
- Delete Production TEST records.
- Run migration, seed, backfill, repair, or bulk update.
- Change user roles or privileged account state.
- Deploy Hosting, Rules, Indexes, Functions, Storage, or Extensions.
- Change DNS records or domain redirects.
- Merge a PR or push directly to `main`.
- Rotate credentials or change billing.
- Enable file uploads, AI services, or another currently disabled service.

## Protected Production assets

- Supplier records and their identifiers.
- Supplier submission/request records.
- Users and roles.
- RFQs and responses.
- Messages and notifications.
- Audit logs.
- Authentication and email-action configuration.
- Domain/DNS and Firebase authorized-domain settings.

## Data-integrity procedure

For a task capable of affecting supplier data:

1. Record the current `main` SHA.
2. Record supplier count and relevant request count.
3. Retrieve current supplier-ID and content fingerprints through the approved read-only method.
4. Confirm backup availability when the operation is destructive or difficult to reverse.
5. Run the smallest safe change.
6. Re-run counts and fingerprints.
7. Stop on any unexplained difference.

Do not paste full Production datasets into chat, prompts, logs, or PR descriptions.

## Secrets and privacy

- Never commit `.env` files containing live values.
- Never print tokens, private keys, credentials, session cookies, or complete Firebase configuration secrets.
- Use redaction in logs and screenshots.
- Do not copy Production user data into fixtures.
- Use synthetic data for tests.
- Do not expose account email, UID, phone number, or private profile data unnecessarily.

## Change isolation

- One coherent concern per branch/PR.
- No unrelated refactor.
- No dependency upgrade unless required by the task.
- No formatting sweep across untouched files.
- No automated rewrite of supplier content.
- No destructive cleanup while implementing a feature.
- Keep rollback simple.

## Stop-on-risk conditions

Stop and report before continuing when:

- `main` differs unexpectedly from the stated baseline.
- Production counts or fingerprints differ unexpectedly.
- A command would write to Production.
- A required secret is missing.
- Tests reveal a pre-existing failure relevant to the task.
- Rules approach platform limits without a verified test.
- The requested change would broaden privileges.
- A deployment target is ambiguous.
