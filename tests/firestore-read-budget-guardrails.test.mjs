import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const script = fs.readFileSync(path.join(root, "scripts/audit-production-read-only.mjs"), "utf8");

test("standard Production audit uses aggregation counts and bounded reads", () => {
  assert.match(script, /:runAggregationQuery/);
  assert.match(script, /aggregations: \[\{ alias: "count", count: \{\} \}\]/);
  assert.match(script, /limit: safeLimit/);
  assert.match(script, /Math\.min\(10/);
});

test("full scans and Supplier hashes are explicit opt-in only", () => {
  const guard = script.indexOf("if (!allowFullScan)");
  const fullQuery = script.indexOf('collectionId: "suppliers"', guard);
  const hash = script.indexOf("supplierContentHash", guard);
  assert.ok(guard > 0 && fullQuery > guard && hash > guard);
  assert.match(script, /FULL_SCAN_BLOCKED/);
  assert.match(script, /FULL_SCAN_WARNING/);
  assert.match(script, /--allow-full-scan/);
});

test("Production audit source contains no Firestore write APIs", () => {
  assert.doesNotMatch(script, /commit|batchWrite|setDoc|addDoc|updateDoc|deleteDoc|PATCH|DELETE/);
  assert.match(script, /writesAttempted: false/);
});

test("standard audit output summarizes exact documents without exposing raw fields", () => {
  assert.match(script, /function summarizeDocument/);
  assert.match(script, /const rawExactChecks =/);
  assert.match(script, /supplier: summarizeDocument/);
  assert.doesNotMatch(script, /const report = \{[^\n]*rawExactChecks/);
});
