import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const lifecycleSource = read("src/utils/rfqLifecycle.ts");
const compiled = ts.transpileModule(lifecycleSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const lifecycle = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const openRfq = { status: "published", closingAt: new Date("2030-01-01"), closingDate: "2030-01-01" };
const closedRfq = { status: "closed", closingAt: new Date("2030-01-01"), closingDate: "2030-01-01" };

test("RFQ lifecycle partitions open invitations, submitted quotations, and history", () => {
  const response = { status: "submitted", revisionNumber: 2 };
  const result = lifecycle.partitionSupplierRfqLifecycle([
    { rfq: { ...openRfq, id: "open" }, response: null },
    { rfq: { ...openRfq, id: "quoted" }, response },
    { rfq: { ...closedRfq, id: "closed" }, response },
  ], new Date("2027-01-01").getTime());
  assert.deepEqual(result.invitations.map((item) => item.rfq.id), ["open"]);
  assert.deepEqual(result.quotations.map((item) => item.rfq.id), ["quoted"]);
  assert.deepEqual(result.history.map((item) => item.rfq.id), ["closed"]);
});

test("RFQ statuses are localized and legacy revisions normalize to V1", () => {
  assert.equal(lifecycle.localizedRfqStatus(closedRfq, "ar"), "مغلق");
  assert.equal(lifecycle.localizedRfqStatus(closedRfq, "en"), "Closed");
  assert.equal(lifecycle.localizedRfqResponseStatus("submitted", "ar"), "مقدم");
  assert.equal(lifecycle.currentRfqRevision({}), 1);
  assert.equal(lifecycle.currentRfqRevision({ revisionNumber: 3 }), 3);
});

test("commercial normalization detects material changes and deterministic IDs", () => {
  const before = { message: " Quote ", price: 100, currency: "IQD", deliveryDays: 5, referenceLinks: ["https://a.test"] };
  const same = { ...before, message: "Quote", referenceLinks: ["https://a.test", "https://a.test"] };
  assert.equal(lifecycle.hasMaterialRfqResponseChange(before, same), false);
  assert.deepEqual(lifecycle.changedRfqResponseFields(before, { ...same, price: 120 }), ["price"]);
  assert.equal(lifecycle.rfqResponseRevisionId("response", 2), "response_v2");
  assert.equal(lifecycle.rfqResponseUpdatedEventId("response", 2), "response_v2");
  assert.equal(lifecycle.rfqResponseUpdatedNotificationId("response", 2), "rfq-response-updated_response_v2");
});

test("Supplier history is bounded, paginated, lazy, has no polling, and rejects stale results", () => {
  const service = read("src/services/workspace.ts");
  const supplierPage = read("src/pages/workspace/SupplierWorkspacePages.tsx");
  const revisions = read("src/components/RfqRevisionHistory.tsx");
  assert.match(service, /limit\(boundedPageSize \+ 1\)/);
  assert.match(service, /where\("supplierUserId", "==", supplierUserId\)/);
  assert.match(service, /where\("supplierProfileId", "==", supplierProfileId\)/);
  assert.match(service, /where\("closingAt", ">=", Timestamp\.now\(\)\)/);
  assert.match(service, /startAfter\(/);
  assert.match(supplierPage, /loadRequestRef\.current/);
  assert.match(supplierPage, /selectionRequestRef\.current/);
  assert.match(supplierPage, /return \(\) => \{/);
  assert.match(revisions, /if \(items\.length \|\| loading\) return/);
  assert.match(revisions, /requestRef\.current === requestId/);
  assert.doesNotMatch(`${service}\n${supplierPage}\n${revisions}`, /setInterval|setTimeout\([^)]*listSupplierRfq/);
});

test("RFQ user-facing components do not present raw lifecycle states as primary labels", () => {
  const supplierPage = read("src/pages/workspace/SupplierWorkspacePages.tsx");
  assert.match(supplierPage, /localizedRfqStatus/);
  assert.match(supplierPage, /localizedRfqResponseStatus/);
  assert.doesNotMatch(supplierPage, />\s*\{(?:selected\.)?rfq\.status\}\s*</);
  assert.doesNotMatch(supplierPage, />\s*\{response\.status\}\s*</);
});
