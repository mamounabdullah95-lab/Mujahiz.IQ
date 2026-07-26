import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("RFQ service preserves draft recipients and uses scoped deterministic supplier response reads", () => {
  const service = read("src/services/workspace.ts");
  assert.match(service, /const recipientIds = \[\.\.\.new Set/);
  assert.match(service, /status === "published" && recipientIds\.length === 0/);
  assert.match(service, /export async function getSupplierRfqResponse/);
  assert.match(service, /where\("rfqId", "==", scope\.rfqId\)/);
  assert.match(service, /where\("supplierUserId", "==", scope\.supplierUserId\)/);
  assert.match(service, /where\("supplierProfileId", "==", scope\.supplierProfileId\)/);
  assert.match(service, /limit\(2\)/);
  assert.match(service, /item\.id !== scope\.responseId/);
  assert.match(service, /matches\.length !== 1/);
  assert.match(service, /existing\?\.firstSubmittedAt \|\| existing\?\.createdAt \|\| timestamp/);
  assert.match(service, /runTransaction\(db/);
  assert.match(service, /hasMaterialRfqResponseChange/);
  assert.match(service, /rfqResponseUpdatedNotificationId/);
});

test("first Supplier submission uses the authorized scoped query before the atomic create batch", () => {
  const service = read("src/services/workspace.ts");
  const start = service.indexOf("export async function submitRfqResponse");
  const end = service.indexOf("export interface NotificationCursor", start);
  assert.ok(start >= 0 && end > start);
  const submit = service.slice(start, end);
  assert.match(submit, /const preexisting = await findScopedSupplierRfqResponse/);
  assert.match(submit, /if \(!preexisting\) \{[\s\S]*?const batch = writeBatch\(db\);/);
  assert.match(submit, /batch\.set\(responseRef, created\)/);
  assert.match(submit, /batch\.set\(doc\(rfqResponseRevisionsRef, created\.revisionId\)/);
  assert.match(submit, /batch\.set\(doc\(rfqResponseEventsRef, id\)/);
  assert.match(submit, /doc\(notificationsRef, responseNotificationId\(id\)\)/);
  assert.match(submit, /await batch\.commit\(\);[\s\S]*?return id;[\s\S]*?await runTransaction\(db/);
  assert.doesNotMatch(submit, /settledSnapshot = await getDoc\(responseRef\)/);
});

test("RFQ response window uses a Firestore timestamp and blocks closed requests in service", () => {
  const service = read("src/services/workspace.ts");
  const types = read("src/types/workspace.ts");
  assert.match(service, /Timestamp\.fromDate\(closingAtDate\)/);
  assert.match(service, /isRfqAcceptingResponses\(rfq\)/);
  assert.match(service, /throw new Error\("rfq_closed"\)/);
  assert.match(types, /closingAt: TimestampLike/);
});

test("buyer and supplier RFQ pages expose comparison and own-response workflows", () => {
  const buyer = read("src/pages/workspace/BuyerWorkspacePages.tsx");
  const supplier = read("src/pages/workspace/SupplierWorkspacePages.tsx");
  assert.match(buyer, /listRfqResponses/);
  assert.match(buyer, /Received quotations/);
  assert.match(buyer, /window\.confirm\(text\.confirmPublish\)/);
  assert.match(supplier, /getSupplierRfqResponse/);
  assert.match(supplier, /firebaseUser\.uid, appUser\.supplierProfileId/);
  assert.match(supplier, /responseLoadError/);
  assert.match(supplier, /isRfqAcceptingResponses/);
  assert.match(supplier, /partitionSupplierRfqLifecycle/);
  assert.match(supplier, /RfqLifecycleTimeline/);
  assert.match(supplier, /RfqRevisionHistory/);
  assert.doesNotMatch(supplier, /listRfqResponses/);
});

test("RFQ security rules enforce access, immutable identity, time window, and safe notifications", () => {
  const rules = read("firestore.rbac.rules");
  assert.match(rules, /data\.closingAt is timestamp/);
  assert.match(rules, /function publishable\(data\) \{ return data\.recipientIds\.size\(\) > 0 && data\.closingAt >= request\.time; \}/);
  assert.match(rules, /allow create: if currentBuyerCanWrite\(\)/);
  assert.match(rules, /function buyerCanUpdateRfq/);
  assert.match(rules, /function rfqIdentityUnchanged/);
  assert.match(rules, /responseId == request\.resource\.data\.rfqId \+ "_" \+ request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.createdAt == resource\.data\.createdAt/);
  assert.match(rules, /function rfqCanReceiveResponse/);
  assert.match(rules, /match \/rfqResponseRevisions\/\{revisionId\}/);
  assert.match(rules, /validUpdatedResponseNotification/);
  assert.match(rules, /supplierIsTargeted\(data\)/);
  assert.match(rules, /allow delete: if false/);
  assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly\(\["userId", "actorId", "type"/);
  assert.match(rules, /noStoredFileFields\(request\.resource\.data\)/);
});

test("RFQ attachment controls remain disabled and do not introduce Storage calls", () => {
  const pages = [
    read("src/pages/workspace/BuyerWorkspacePages.tsx"),
    read("src/pages/workspace/SupplierWorkspacePages.tsx"),
  ].join("\n");
  const service = read("src/services/workspace.ts");
  assert.match(pages, /DisabledFileUpload/);
  assert.match(service, /attachmentStatus: "upload_pending_launch"/);
  assert.doesNotMatch(`${pages}\n${service}`, /firebase\/storage|uploadBytes|uploadString|getDownloadURL/);
});
