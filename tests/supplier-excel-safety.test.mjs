import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("the XLSX reader is local-only and rejects active or embedded workbook content", () => {
  const reader = read("src/utils/supplierWorkbookReader.ts");
  assert.match(reader, /file\.arrayBuffer\(\)/);
  assert.match(reader, /vbaProject\\\.bin/);
  assert.match(reader, /drawings\|media/);
  assert.match(reader, /activeX\|embeddings\|oleObjects/);
  assert.match(reader, /maximumExpandedArchiveBytes\s*=\s*4\s*\*\s*1024\s*\*\s*1024/);
  assert.match(reader, /entry\.data\.fill\(0\)/);
  assert.match(reader, /new Uint8Array\(buffer\)\.fill\(0\)/);
  assert.doesNotMatch(reader, /firebase|localStorage|sessionStorage|indexedDB|fetch\(/i);
});

test("the import service persists metadata and supplier submissions, never workbook bytes", () => {
  const service = read("src/services/supplierExcelImport.ts");
  assert.match(service, /supplierImportBatches/);
  assert.match(service, /supplierSubmissionDuplicateIndex/);
  assert.match(service, /idempotencyKey:\s*submissionId/);
  assert.match(service, /source:\s*["']excel_import["']/);
  assert.doesNotMatch(service, /arrayBuffer|Blob|base64|fileContents|fileBytes|storagePath|downloadURL/i);
  assert.doesNotMatch(service, /localStorage|sessionStorage|indexedDB/);
});

test("Firestore rules scope the Excel exception to buyer/admin/owner and metadata-only documents", () => {
  const rules = read("firestore.rbac.rules");
  assert.match(rules, /function canImportSupplierExcel/);
  assert.match(rules, /accountType == ["']buyer["']/);
  assert.match(rules, /function validExcelImportSubmission/);
  assert.match(rules, /data\.source == ["']excel_import["']/);
  assert.match(rules, /data\.idempotencyKey == submissionId/);
  assert.match(rules, /match \/supplierImportBatches\/\{batchId\}/);
  assert.match(rules, /match \/supplierSubmissionDuplicateIndex\/\{indexId\}/);
  assert.match(rules, /noStoredFileFields\(request\.resource\.data\)/);
});
