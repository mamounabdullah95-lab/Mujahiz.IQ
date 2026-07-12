import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_SUPPLIER_EXCEL_SIZE,
  MAX_SUPPLIER_IMPORT_ROWS,
  SUPPLIER_EXCEL_FIELDS,
  calculateSupplierProfileCompleteness,
  canUseSupplierExcelImport,
  isSupplierImportRowAccepted,
  mapSupplierImportHeaders,
  parseSupplierImportRows,
  validateSupplierImportFileMetadata,
  validateSupplierImportValues,
} from "../src/utils/supplierExcelCore.js";

function validValues(overrides = {}) {
  return {
    nameOriginal: "Mujahiz Test Company",
    displayName: "Mujahiz Test",
    nameLanguage: "mixed",
    nameAr: "شركة مجهز الاختبارية",
    nameEn: "Mujahiz Test Company",
    businessType: "company",
    shortDescription: "Industrial measurement supplier",
    governorates: "baghdad",
    city: "Baghdad",
    marketArea: "Karrada",
    primaryPhone: "07701234567",
    whatsappAvailable: "yes",
    categories: "instrumentation",
    capabilityTags: "local_stock,technical_support",
    sourceType: "market_visit",
    confidenceLevel: "medium",
    hasDirectExperience: "no",
    ...overrides,
  };
}

function valuesAsRow(values) {
  return SUPPLIER_EXCEL_FIELDS.map((field) => String(values[field.key] ?? ""));
}

test("the official schema has 35 bilingual fields and 13 required fields", () => {
  assert.equal(SUPPLIER_EXCEL_FIELDS.length, 35);
  assert.equal(SUPPLIER_EXCEL_FIELDS.filter((field) => field.required).length, 13);
  for (const field of SUPPLIER_EXCEL_FIELDS) {
    assert.match(field.headerAr, /[\u0600-\u06ff]/, `${field.key} must retain real Arabic text`);
    assert.ok(field.header.includes(field.headerEn));
  }
  const mapping = mapSupplierImportHeaders(SUPPLIER_EXCEL_FIELDS.map((field) => field.header));
  assert.equal(Object.keys(mapping.columns).length, 35);
  assert.deepEqual(mapping.missingRequiredColumns, []);
  assert.deepEqual(mapping.duplicateColumns, []);
});

test("only a non-empty XLSX up to 200 KB passes metadata validation", () => {
  assert.doesNotThrow(() => validateSupplierImportFileMetadata({ name: "suppliers.xlsx", size: 1024, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  assert.throws(() => validateSupplierImportFileMetadata({ name: "suppliers.xls", size: 1024, type: "application/vnd.ms-excel" }), /unsupportedSupplierImportFile/);
  assert.throws(() => validateSupplierImportFileMetadata({ name: "suppliers.xlsx", size: MAX_SUPPLIER_EXCEL_SIZE + 1, type: "" }), /supplierImportTooLarge/);
  assert.throws(() => validateSupplierImportFileMetadata({ name: "suppliers.xlsx", size: 0, type: "" }), /invalidSupplierImportFile/);
});

test("valid rows are normalized and receive a deterministic completeness score", () => {
  const result = validateSupplierImportValues(validValues());
  assert.equal(result.validationStatus, "valid");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.draft.normalizedPhones[0], "+9647701234567");
  assert.equal(result.draft.normalizedName, "mujahiz test company");
  assert.ok(result.completion.percentage > 40 && result.completion.percentage <= 100);
  assert.equal(result.draft.completionScore, result.completion.percentage);
  assert.deepEqual(calculateSupplierProfileCompleteness(result.values), result.completion);
});

test("unsafe content, formulas, unknown codes, and incomplete conditional data are rejected", () => {
  const unsafe = validateSupplierImportValues(validValues({ shortDescription: '<script>alert(1)</script>' }));
  assert.equal(unsafe.validationStatus, "invalid");
  assert.ok(unsafe.errors.includes("shortDescription:unsafe_content"));

  const formula = validateSupplierImportValues(validValues(), { formulaFields: ["primaryPhone"] });
  assert.equal(formula.validationStatus, "invalid");
  assert.ok(formula.errors.includes("primaryPhone:formula_not_allowed"));

  const unknown = validateSupplierImportValues(validValues({ categories: "not_a_real_category" }));
  assert.equal(unknown.validationStatus, "invalid");
  assert.ok(unknown.errors.some((error) => error.startsWith("unknown_code:categories:")));

  const missingCredit = validateSupplierImportValues(validValues({ acceptsCredit: "yes" }));
  assert.equal(missingCredit.validationStatus, "missing_required_data");
  assert.ok(missingCredit.missingFields.includes("creditDays"));
  assert.ok(missingCredit.missingFields.includes("creditStart"));
});

test("same-file duplicates are detected and more than 50 actual rows are rejected", () => {
  const headers = SUPPLIER_EXCEL_FIELDS.map((field) => field.header);
  const row = valuesAsRow(validValues());
  const parsed = parseSupplierImportRows({ headers, rows: [row, row], rowNumbers: [2, 3] });
  assert.equal(parsed.rows[0].validationStatus, "valid");
  assert.equal(parsed.rows[1].validationStatus, "exact_duplicate");
  assert.equal(parsed.rows[1].excluded, true);
  assert.equal(parsed.summary.exactDuplicateRows, 1);
  assert.throws(() => parseSupplierImportRows({ headers, rows: Array.from({ length: MAX_SUPPLIER_IMPORT_ROWS + 1 }, (_, index) => valuesAsRow(validValues({ nameOriginal: `Supplier ${index}` }))) }), /supplierImportTooManyRows/);
});

test("buyer and platform admins can import; supplier accounts and suspended users cannot", () => {
  assert.equal(canUseSupplierExcelImport({ uid: "buyer", accountType: "buyer", role: "contributor", status: "active" }), true);
  assert.equal(canUseSupplierExcelImport({ uid: "admin", accountType: "buyer", role: "admin", status: "active" }), true);
  assert.equal(canUseSupplierExcelImport({ uid: "owner", role: "owner", status: "active" }), true);
  assert.equal(canUseSupplierExcelImport({ uid: "supplier", accountType: "supplier", role: "contributor", status: "active" }), false);
  assert.equal(canUseSupplierExcelImport({ uid: "blocked", accountType: "buyer", role: "admin", status: "suspended" }), false);

  const possibleDuplicate = { excluded: false, validationStatus: "possible_duplicate", overrideReason: "" };
  assert.equal(isSupplierImportRowAccepted(possibleDuplicate, { role: "admin" }), false);
  assert.equal(isSupplierImportRowAccepted({ ...possibleDuplicate, overrideReason: "Reviewed and approved" }, { role: "admin" }), true);
  assert.equal(isSupplierImportRowAccepted({ ...possibleDuplicate, overrideReason: "Reviewed and approved" }, { role: "contributor" }), false);
});
