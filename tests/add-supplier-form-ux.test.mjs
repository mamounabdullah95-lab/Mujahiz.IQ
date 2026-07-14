import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("supplier form visibly distinguishes required, optional, and conditional fields", () => {
  const ui = read("src/components/ui.tsx");
  const page = read("src/pages/AddSupplierPage.tsx");

  assert.match(ui, /required \? <span[^>]*>\*<\/span>/);
  assert.match(ui, /requirement\?: string/);
  assert.match(page, /t\("requiredField"\)/);
  assert.match(page, /t\("optionalFieldLegend"\)/);
  assert.match(page, /t\("conditionalFieldLegend"\)/);
  assert.match(page, /requirement=\{t\("oneOfLocationRequired"\)\}/);
  assert.match(page, /requirement=\{t\("oneContactField"\)\}/);
  assert.match(page, /required\s+label=\{t\("governorate"\)\}/);
  assert.match(page, /required\s+label=\{t\("mainCategory"\)\}/);
});

test("supplier duplicate checking is single-flight and does not silently lock submission", () => {
  const page = read("src/pages/AddSupplierPage.tsx");

  assert.match(page, /const duplicateCheckTimeoutMs = 15_000/);
  assert.match(page, /duplicateCheckRequestRef/);
  assert.match(page, /existingRequest\?\.key === duplicateLookupKey/);
  assert.match(page, /setDuplicateChecking\(true\)/);
  assert.match(page, /supplierDuplicateCheckInProgress/);
  assert.match(page, /supplierDuplicateCheckTimeout/);
  assert.match(page, /supplierDuplicateCheckFailed/);
  assert.match(page, /supplierSubmitInProgress/);
  assert.match(page, /disabled=\{busy \|\| missing\.length > 0\}/);
  assert.match(page, /busy \? t\("supplierSubmitInProgress"\)/);
});

test("supplier form requirement and progress messages are bilingual", () => {
  const i18n = read("src/i18n.ts");

  for (const key of [
    "requiredField",
    "optionalFieldLegend",
    "conditionalFieldLegend",
    "oneOfLocationRequired",
    "oneContactRequired",
    "oneContactField",
    "supplierDuplicateCheckInProgress",
    "supplierDuplicateCheckFailed",
    "supplierDuplicateCheckTimeout",
    "supplierSubmitInProgress",
  ]) {
    assert.equal(i18n.split(`${key}:`).length - 1, 2, `${key} must exist in English and Arabic`);
  }
});
