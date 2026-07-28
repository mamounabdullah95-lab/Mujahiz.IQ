# Password Reset and Account Recovery — Controlled Production UAT

Status: prepared only. Do not execute without separate approval.

## Deployment and configuration prerequisites

1. Merge and deploy the approved application change through the normal Hosting workflow under separate approval.
2. In Firebase Console, open **Authentication → Templates → Password reset → Customize action URL** and set the action URL to:

   `https://mujahiz.com/reset-password`

   This Console change requires separate approval. Do not change the message body, sender, Authorized Domains, DNS, or another Auth template as part of that action.
3. Confirm read-only that `mujahiz.com` remains an Authorized Domain and that the existing Firebase Hosting domains remain available. Stop and report if either assumption is false; do not add or remove a domain during UAT.
4. Confirm the deployed route loads on the canonical domain and that legacy `web.app` and `firebaseapp.com` action URLs preserve `mode`, `oobCode`, and `continueUrl` while redirecting to `https://mujahiz.com`.
5. Obtain explicit approval to change the passwords of the existing dedicated Buyer TEST account and Supplier TEST account. Keep account identifiers and credentials only in the approved secure operator channel; do not copy them into tickets, source, logs, screenshots, commits, PR text, or this document.

## Bounded test matrix

Run once for the dedicated Buyer TEST account, then once for the dedicated Supplier TEST account:

1. In an operator-only checklist, record the account's current role, account type, approval/access state, and protected profile linkage. Do not paste identifiers or credentials into general UAT evidence.
2. Open `https://mujahiz.com/login`, select **Forgot password**, enter the TEST account email, and submit once.
3. Confirm the UI disables duplicate submission while loading and shows the neutral response that does not confirm account existence. Confirm it tells the operator to check Inbox and Spam/Junk.
4. Confirm exactly one password-reset email arrives. Record only pass/fail and delivery time; do not retain or copy the full action URL or action code.
5. Open the email link. Confirm the browser reaches `https://mujahiz.com/reset-password` and shows the new-password form only after validating the action code.
6. Confirm a deliberate mismatch is rejected locally and that a password shorter than eight characters is rejected without changing the account.
7. Enter the separately approved replacement password and complete the reset once.
8. Confirm the application returns to login, does not automatically authenticate, rejects the old password, and accepts the approved replacement password.
9. Open the same email link again and confirm the recoverable already-used/invalid-link state offers a new reset request.
10. Sign in and verify the recorded role, account type, approval/access/Trial state, and protected profile linkage are unchanged. For the Supplier TEST account, also verify the owned supplier profile still points to the same account.

## Language checks

Repeat the request page, reset page, errors, and login success message in both interface languages:

- Arabic contains Arabic interface copy only and remains RTL.
- English contains English interface copy only and remains LTR.
- Neither language exposes a raw Firebase error.

## Evidence and stop conditions

Record only bounded pass/fail results, timestamps, browser/domain, and non-sensitive screenshots with addresses and query strings redacted.

Stop immediately without further reset attempts if:

- the link does not reach the canonical reset route;
- the Console action URL or Authorized Domains differ from the prerequisites;
- any user-facing response reveals whether an account exists;
- a role, account type, access/Trial field, supplier linkage, or profile ownership changes;
- the wrong account receives the email;
- an action code, password, token, or full reset URL appears in logs, analytics, screenshots, or stored application data.

Do not merge, deploy, change Firebase Console settings, change either Production TEST password, or execute this UAT without the approvals named above.
