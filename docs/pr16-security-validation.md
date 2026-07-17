# PR #16 Security Validation

This document records the authorization model and validation evidence for Draft PR #16. It is not a deployment approval.

## Current authorization model

### Buyer writes

An ordinary Buyer may write RFQs, conversations, and messages only when all of the following are true:

- the Firebase Auth token has `email_verified: true`;
- `users/{uid}.role` is `contributor`;
- `accountType` is `buyer`, or the legacy Buyer record has no `accountType`;
- Firestore `status` is `approved`;
- Firestore `emailVerified` is `true`;
- `accessStatus` is `active` or `temporary`;
- `accessExpiresAt` is a future timestamp.

Admin and Owner roles are not ordinary Buyer identities, even if their stored `accountType` is `buyer`.

### Supplier writes

A Supplier may perform Supplier-sensitive RFQ, response, conversation, and message writes only when:

- the Firebase Auth token has `email_verified: true`;
- the user is an approved `contributor` with `accountType: supplier`;
- Firestore `emailVerified` is `true`;
- the user is not suspended;
- `users/{uid}.supplierProfileId` matches the requested profile;
- the linked Supplier is `approved` and has `canReceiveRfqs: true`;
- `suppliers/{supplierProfileId}.accountOwnerId == uid`.

Historical conversation reads remain available to signed-in participants. Current account eligibility is required for every new message, preview update, and read receipt.

## Legitimate notification creation paths

1. A Buyer creates a published RFQ, or publishes a draft, in an atomic batch with `rfqPublishEvents/{rfqId}`.
2. After that trusted immutable event commits, the client creates at most one deterministic notification per linked target account using `rfq-published_{rfqId}_{userId}`.
3. A Supplier creates its first response in an atomic batch with `rfqResponseEvents/{rfqId_uid}`.
4. After that trusted immutable event commits, the client creates one deterministic Buyer notification using `rfq-response_{responseId}`.
5. Administrative notifications use a separate constrained type set and cannot impersonate RFQ notifications.

The notification write is intentionally best-effort and separate from the business write. Rules require the immutable event, a currently authorized actor, canonical Supplier ownership, the exact recipient relationship, exact RFQ/response identifiers, deterministic document ID, fixed link, fixed localized copy, and `read: false`. A notification cannot create its own trusted event, and a deterministic ID cannot be created twice.

## Production schema audit

Read-only audit:

- Project ID: `mujahiziq`
- Exported at: `2026-07-17T12:17:35.054Z`
- Suppliers: 479
- Users: 4
- RFQs: 0
- RFQ responses: 0
- Conversations: 0
- Messages: 0
- Notifications: 0
- Supplier profiles missing `status`: 0
- Supplier profiles with a non-approved `status`: 0
- Supplier profiles missing `accountOwnerId`: 479
- Supplier profiles missing `canReceiveRfqs`: 469
- Supplier profiles where `canReceiveRfqs` is not `true`: 479
- Linked Supplier accounts: 0
- Writes attempted: false

The 479 directory records remain readable under their existing directory rules. None is currently authorized for Supplier RFQ writes because no Supplier account is linked and no profile has both canonical ownership and active RFQ reception. Enabling a Supplier account later requires an explicit, separately approved linking workflow; this PR does not migrate or modify Supplier data.

No Production RFQ, response, conversation, or message exists, so there is no Production document whose historical read path is broken by these changes. Emulator fixtures cover representative legacy documents.

## Query compatibility

Emulator tests execute the frontend query shapes for:

- Buyer RFQs filtered by `buyerId`;
- Supplier RFQs filtered with `array-contains` on `recipientIds`;
- Supplier response fetched by its deterministic `rfqId_supplierUserId` document ID;
- Buyer responses filtered by RFQ IDs;
- conversations filtered by `participantIds`;
- messages filtered by `conversationId`;
- notifications filtered by `userId`.

The legitimate query shapes pass. Broader unscoped or cross-account queries fail.

## Firestore Rules limits

The table reports the static upper bound of unique dependent-document accesses for one Rules evaluation. Firestore may cache repeated access to the same path. `getAfter()` counts are shown separately. The Emulator log is the authoritative result for expression and depth limits.

| Operation | Expression result | get() | exists() | getAfter() | Max helper depth | Repeated access |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Buyer creates RFQ draft | Allowed below limit | 1 | 0 | 0 | 4 | User path cached |
| Buyer publishes RFQ document | Allowed below limit | 1 | 0 | 1 | 4 | User and event paths cached |
| Publish event in same batch | Allowed below limit | 0 | 0 | 1 | 3 | RFQ-after path cached |
| Supplier reads targeted RFQ | Allowed below limit | 2 | 0 | 0 | 4 | User and Supplier paths cached |
| Supplier creates response document | Allowed below limit | 3 | 0 | 1 | 4 | User, Supplier, RFQ, and event paths cached |
| Response event in same batch | Allowed below limit | 1 | 0 | 1 | 3 | RFQ and response-after paths cached |
| Supplier updates own response | Allowed below limit | 3 | 0 | 0 | 4 | User, Supplier, and RFQ paths cached |
| Direct conversation create | Allowed below limit | 3 | 0 | 0 | 4 | Buyer, owner-user, and Supplier paths cached |
| RFQ conversation create | Allowed below limit | 4 | 0 | 0 | 4 | Buyer, Supplier-user, Supplier, and RFQ paths cached |
| Message create | Allowed below limit | 2-3 | 0 | 0 | 4 | Conversation and participant paths cached |
| Conversation preview update | Allowed below limit | 1-2 | 0 | 0 | 4 | Participant paths cached |
| Message read receipt | Allowed below limit | 2-3 | 0 | 0 | 4 | Conversation and participant paths cached |
| Published RFQ notification | Allowed below limit | 4 | 0 | 0 | 4 | Actor-user, event, target-user, and Supplier paths cached |
| Response notification | Allowed below limit | 3 | 0 | 0 | 4 | Actor-user, Supplier, and immutable response-event paths cached |

The final Emulator run completed 43/43 tests and `assert-firestore-emulator-log.mjs` found no expression-limit, document-access-call-limit, or function-call-depth diagnostics.

## Built Production bundle matrix

`scripts/validate-firebase-production-bundles.mjs` builds and runs three real Vite Production bundles in Chrome Headless:

- missing Firebase variables: configuration error, no form/input, no Demo activation, no bootstrap request;
- malformed Firebase variables: configuration error, no form/input, no Demo activation, no bootstrap request;
- valid synthetic variables: normal application bootstrap requested and rendered.

The validation uses synthetic values only and confirms that Firebase configuration values are not rendered into the DOM.

## Protection confirmation

- No merge.
- No Firebase deployment.
- No Production write.
- No Authentication, Supplier, RFQ, conversation, or message modification.
- No migration, seed, backfill, or bulk operation.
- No dependency update.
