import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("supplier form uses red asterisks and concise hints without optional prose", () => {
  const ui = read("src/components/ui.tsx");
  const page = read("src/pages/AddSupplierPage.tsx");

  assert.match(ui, /required \? <span[^>]*>\*<\/span>/);
  assert.match(ui, /hint\?: string/);
  assert.match(ui, /\{hint \? <span[^>]*>\{hint\}<\/span> : null\}/);
  assert.doesNotMatch(ui, /requirement\?: string/);
  assert.doesNotMatch(page, /requirement=/);
  assert.doesNotMatch(page, /t\("optionalFieldLegend"\)/);
  assert.doesNotMatch(page, /t\("conditionalFieldLegend"\)/);
  assert.doesNotMatch(page, /t\("oneContactRequired"\)/);

  for (const field of [
    "supplierName",
    "businessType",
    "arabicCompanyName",
    "englishCompanyName",
    "shortDescription",
    "address",
    "primaryPhone",
    "email",
  ]) {
    const fieldLine = page.split("\n").find((line) => line.includes(`label={t("${field}")}`));
    assert.ok(fieldLine?.includes(" required"), `${field} must show a required asterisk`);
  }

  for (const hint of [
    "supplierNameHint",
    "businessTypeHint",
    "arabicCompanyNameHint",
    "englishCompanyNameHint",
    "shortDescriptionHint",
    "marketAreaHint",
    "addressHint",
    "primaryPhoneHint",
    "emailHint",
    "sourceNoteHint",
  ]) {
    assert.match(page, new RegExp(`hint=\\{t\\("${hint}"\\)\\}`), `${hint} must be rendered`);
  }
});

test("only an explicit click on the final review button can submit a supplier", () => {
  const page = read("src/pages/AddSupplierPage.tsx");
  assert.match(page, /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*\}\}/);
  assert.doesNotMatch(page, /onSubmit=\{\(event\)[\s\S]{0,160}handleSubmit/);
  assert.doesNotMatch(page, /type="submit"/);
  assert.match(page, /disabled=\{busy \|\| missing\.length > 0\} type="button" onClick=\{\(\) => void handleSubmit\(\)\}/);
  assert.match(page, /aria-current=\{index === step \? "step" : undefined\}[\s\S]{0,100}onClick=\{\(\) => setStep\(index\)\}/);
});

test("manual and bulk validation require the primary phone and core company fields", () => {
  const page = read("src/pages/AddSupplierPage.tsx");
  const scoring = read("src/utils/scoring.ts");

  assert.match(page, /function missingRequiredFormFieldKeys\(form: FormState/);
  assert.match(page, /!form\.primaryPhone\.trim\(\)/);
  assert.match(page, /missingRequiredFormFieldKeys\(input, itemDraft\)/);
  assert.match(page, /missingRequiredFormFieldKeys\(itemForm, itemDraft\)/);
  assert.match(page, /missingRequiredFormFieldKeys\(item\.form, item\.draft\)/);

  for (const key of [
    "businessType",
    "arabicCompanyName",
    "englishCompanyName",
    "shortDescription",
    "address",
    "primaryPhone",
    "email",
  ]) {
    assert.match(scoring, new RegExp(`missing\\.push\\("${key}"\\)`), `${key} must be enforced`);
  }
  assert.match(scoring, /requiredChecks: Array<\[boolean, number\]>/);
  assert.match(scoring, /Boolean\(draft\.city \|\| draft\.marketArea\)/);
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

test("supplier field guidance is bilingual", () => {
  const i18n = read("src/i18n.ts");

  for (const key of [
    "supplierNameHint",
    "displayNameHint",
    "companyNameLanguageHint",
    "businessTypeHint",
    "arabicCompanyNameHint",
    "englishCompanyNameHint",
    "shortDescriptionHint",
    "governorateHint",
    "cityHint",
    "marketAreaHint",
    "googleMapsLinkHint",
    "addressHint",
    "coverageAreasHint",
    "primaryPhoneHint",
    "secondaryPhoneHint",
    "whatsappHint",
    "emailHint",
    "websiteHint",
    "facebookHint",
    "instagramLinkedinHint",
    "contactPersonHint",
    "contactPersonRoleHint",
    "mainCategoryHint",
    "subcategoriesHint",
    "capabilityTagsHint",
    "paymentOptionsHint",
    "acceptsCreditHint",
    "creditDaysHint",
    "creditStartHint",
    "creditTermsNoteHint",
    "sourceTypeHint",
    "confidenceLevelHint",
    "directExperienceHint",
    "lastInteractionYearHint",
    "relatedMaterialServiceHint",
    "sourceNoteHint",
  ]) {
    assert.equal(i18n.split(`${key}:`).length - 1, 2, `${key} must exist in English and Arabic`);
  }
});
