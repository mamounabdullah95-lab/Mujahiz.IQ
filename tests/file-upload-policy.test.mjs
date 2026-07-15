import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

test("file uploads default to disabled and require an explicit true flag", () => {
  assert.match(read("src/config/features.ts"), /VITE_FILE_UPLOADS_ENABLED === "true"/);
  assert.match(read("src/config/features.ts"), /VITE_SUPPLIER_EXCEL_IMPORT_ENABLED === "true"/);
  assert.match(read(".env.example"), /VITE_FILE_UPLOADS_ENABLED=false/);
  assert.match(read(".env.example"), /VITE_SUPPLIER_EXCEL_IMPORT_ENABLED=true/);
  assert.match(read("src/services/uploadService.ts"), /throw new FileUploadsDisabledError/);
  assert.match(read("src/services/uploadService.ts"), /No Storage adapter is bundled/);
});

test("application source has no Firebase Storage adapter and only the local XLSX input exception", () => {
  const files = sourceFiles(path.join(root, "src"));
  const combined = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(combined, /firebase\/storage|uploadBytes|uploadString|getDownloadURL/);
  const liveInputs = files.filter((file) => /type\s*=\s*["']file["']/i.test(fs.readFileSync(file, "utf8")));
  assert.deepEqual(liveInputs.map((file) => path.relative(path.join(root, "src"), file).replaceAll("\\", "/")), ["pages/SupplierExcelImportPage.tsx"]);
  const importer = read("src/pages/SupplierExcelImportPage.tsx");
  assert.match(importer, /accept=["']\.xlsx,application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet["']/);
  assert.match(importer, /never uploaded to Firebase Storage or retained by the browser/);
});

test("Firestore rejects file payloads in Excel import metadata and supplier records", () => {
  const rules = read("firestore.rbac.rules");
  assert.match(rules, /function noStoredFileFields/);
  assert.match(rules, /function validExcelImportSubmission/);
  assert.match(rules, /noStoredFileFields\(data\)/);
  assert.match(rules, /noStoredFileFields\(data\.supplierData\)/);
  assert.match(rules, /function validSupplierImportBatch/);
  assert.match(rules, /request\.resource\.data\.storageStatus in \["metadata_only", "upload_pending_launch"\]/);
  assert.match(rules, /!\("workbook" in data\)/);
  assert.match(rules, /!\("blob" in data\)/);
  assert.match(rules, /!\("rawData" in data\)/);
});

test("Excel import is gated in navigation, routing, UI, and service layers", () => {
  assert.match(read("src/AppV2.tsx"), /features\.supplierExcelImport \? \(/);
  assert.match(read("src/config/portalNavigation.ts"), /features\.supplierExcelImport \? \[/);
  assert.match(read("src/pages/AddSupplierPage.tsx"), /features\.supplierExcelImport &&/);
  assert.match(read("src/services/supplierExcelImport.ts"), /if \(!features\.supplierExcelImport\) throw new Error\("SUPPLIER_EXCEL_IMPORT_DISABLED"\)/);
});

test("Excel import does not persist or transmit workbook contents", () => {
  const importerFiles = [
    "src/pages/SupplierExcelImportPage.tsx",
    "src/services/supplierExcelImport.ts",
    "src/utils/supplierWorkbookReader.ts",
  ];
  const importer = importerFiles.map(read).join("\n");
  assert.doesNotMatch(importer, /localStorage|sessionStorage|indexedDB|sendBeacon|logEvent|firebase\/analytics/i);
  assert.doesNotMatch(importer, /console\.(?:log|info|warn|error)|fetch\s*\(/);
  assert.match(importer, /arrayBuffer\s*\(/);
  assert.match(read("src/services/supplierExcelImport.ts"), /originalFileName: preview\.fileName/);
  assert.doesNotMatch(read("src/services/supplierExcelImport.ts"), /workbook\s*:|blob\s*:|base64\s*:|arrayBuffer\s*:/i);
});


test("RFQ supporting links are text-only HTTPS references and never file uploads", () => {
  const linksUi = read("src/components/RfqReferenceLinks.tsx");
  const service = read("src/services/workspace.ts");
  const rules = read("firestore.rbac.rules");
  const buyer = read("src/pages/workspace/BuyerWorkspacePages.tsx");
  const supplier = read("src/pages/workspace/SupplierWorkspacePages.tsx");

  assert.doesNotMatch(linksUi, /type=["']file["']|FileReader|arrayBuffer|base64|firebase[/]storage/i);
  assert.match(linksUi, /type="url"/);
  assert.match(service, /MAX_RFQ_REFERENCE_LINKS = 5/);
  assert.match(service, /parsed.protocol !== "https:"/);
  assert.match(rules, /function validReferenceLinks/);
  assert.ok(rules.includes("links.size() <= 5"));
  assert.match(buyer, /<DisabledFileUpload/);
  assert.match(supplier, /<DisabledFileUpload/);
});
