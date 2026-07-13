import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { DEFAULT_SUPPLIER_IMPORT_OPTIONS, SUPPLIER_EXCEL_FIELDS } from "../src/utils/supplierExcelCore.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "public", "templates", "supplier-import-template.xlsx");
const constantsSource = await readFile(path.join(root, "src", "data", "constants.ts"), "utf8");
const labels = readPlatformLabels(constantsSource);

const optionGroups = [
  ["company_name_language", "nameLanguage"], ["business_type", "businessType"], ["governorate", "governorates"],
  ["coverage_area", "coverageAreas"], ["yes_no_unknown", "yesNoUnknown"], ["supplier_category", "categories"],
  ["capability_tag", "capabilityTags"], ["payment_option", "paymentOptions"], ["credit_start", "creditStart"],
  ["source_type", "sourceType"], ["confidence_level", "confidenceLevel"], ["direct_experience", "directExperience"],
];

const optionRows = [];
const optionRanges = {};
for (const [group, key] of optionGroups) {
  const start = optionRows.length + 4;
  for (const code of DEFAULT_SUPPLIER_IMPORT_OPTIONS[key]) {
    const label = labels.get(code) || fallbackLabel(code);
    optionRows.push([group, code, label.en, label.ar]);
  }
  optionRanges[key] = { start, end: optionRows.length + 3 };
}

const validations = [
  ["C2:C51", "nameLanguage"], ["F2:F51", "businessType"], ["Q2:Q51", "yesNoUnknown"],
  ["AB2:AB51", "yesNoUnknown"], ["AD2:AD51", "creditStart"], ["AF2:AF51", "sourceType"],
  ["AG2:AG51", "confidenceLevel"], ["AH2:AH51", "directExperience"],
].map(([range, key]) => ({ range, formula: `'الخيارات'!$B$${optionRanges[key].start}:$B$${optionRanges[key].end}` }));

const guideRows = [
  ["دليل استخدام نموذج استيراد المجهزين", "Supplier import template guide"],
  ["الحد الأقصى للشركات", "Maximum suppliers", "50"],
  ["الحد الأقصى لحجم الملف", "Maximum file size", "200 KB"],
  ["استخدم الأكواد الموجودة في ورقة الخيارات.", "Use the codes listed in the Options sheet."],
  ["افصل القيم المتعددة بفاصلة إنجليزية (,).", "Separate multiple values with an English comma (,)."],
  ["الحقول التي تبدأ بعلامة * إلزامية.", "Fields beginning with * are required."],
  ["لا تضف أعمدة ولا تغيّر أسماء الأعمدة.", "Do not add columns or rename headers."],
  ["لا تستخدم Formulas أو Macros أو صوراً أو Objects.", "Do not use formulas, macros, images, or embedded objects."],
  ["يُقرأ الملف محلياً ولا تحتفظ المنصة بنسخة منه.", "The file is read locally and the platform does not retain a copy."],
];

const verificationRows = [
  ["مصادر التحقق - إرشادية فقط", "Verification sources - guidance only"],
  ["اسم المجهز", "المصدر الرسمي", "ملاحظة التحقق", "مستوى الثقة"],
  ["لا تُقرأ هذه الورقة تلقائياً كبيانات شركات.", "This sheet is never read automatically as supplier data."],
];

const files = new Map([
  ["[Content_Types].xml", contentTypesXml()],
  ["_rels/.rels", rootRelationshipsXml()],
  ["docProps/app.xml", appPropertiesXml()],
  ["docProps/core.xml", corePropertiesXml()],
  ["xl/workbook.xml", workbookXml()],
  ["xl/_rels/workbook.xml.rels", workbookRelationshipsXml()],
  ["xl/styles.xml", stylesXml()],
  ["xl/worksheets/sheet1.xml", supplierSheetXml()],
  ["xl/worksheets/sheet2.xml", simpleSheetXml(guideRows, true)],
  ["xl/worksheets/sheet3.xml", simpleSheetXml([["قائمة الأكواد المعتمدة", "Approved code list"], ["Group", "Code", "English Label", "Arabic Label"], ...optionRows], true, "A2:D2")],
  ["xl/worksheets/sheet4.xml", simpleSheetXml(verificationRows, true)],
]);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, createZip(files));
const bytes = (await readFile(outputPath)).byteLength;
if (bytes > 200 * 1024) throw new Error(`Template exceeds 200 KB: ${bytes}`);
console.log(JSON.stringify({ outputPath, bytes, fields: SUPPLIER_EXCEL_FIELDS.length, emptyRows: 50, optionRows: optionRows.length }));

function supplierSheetXml() {
  const headerCells = SUPPLIER_EXCEL_FIELDS.map((item, index) => inlineCell(`${columnName(index + 1)}1`, item.header, item.required ? 2 : 1)).join("");
  const emptyRows = Array.from({ length: 50 }, (_, index) => `<row r="${index + 2}" spans="1:35"/>`).join("");
  const validationXml = validations.map((item) => `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" sqref="${item.range}"><formula1>${xml(item.formula)}</formula1></dataValidation>`).join("");
  const columns = Array.from({ length: 35 }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index === 0 ? 28 : index === 6 || index === 10 || index === 13 || index === 30 ? 30 : 20}" customWidth="1"/>`).join("");
  return worksheetXml(`<cols>${columns}</cols><sheetData><row r="1" ht="36" customHeight="1">${headerCells}</row>${emptyRows}</sheetData><autoFilter ref="A1:AI51"/><dataValidations count="${validations.length}">${validationXml}</dataValidations>`, "A1:AI51", true);
}

function simpleSheetXml(rows, rtl = false, autoFilter = "") {
  const body = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="28" customHeight="1"' : ""}>${row.map((value, columnIndex) => inlineCell(`${columnName(columnIndex + 1)}${rowIndex + 1}`, value, rowIndex === 0 ? 1 : 0)).join("")}</row>`).join("");
  const width = Math.max(1, ...rows.map((row) => row.length));
  const filter = autoFilter ? `<autoFilter ref="${autoFilter}"/>` : "";
  return worksheetXml(`<cols>${Array.from({ length: width }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${index < 2 ? 34 : 28}" customWidth="1"/>`).join("")}</cols><sheetData>${body}</sheetData>${filter}`, `A1:${columnName(width)}${rows.length}`, rtl);
}

function worksheetXml(content, dimension, rtl) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ""}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${content}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function inlineCell(reference, value, style = 0) {
  return `<c r="${reference}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${[1,2,3,4].map((id) => `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function rootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function workbookXml() {
  const names = ["Supplier Form", "دليل الاستخدام", "الخيارات", "مصادر التحقق"];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${names.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets><calcPr calcMode="manual"/></workbook>`;
}

function workbookRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[1,2,3,4].map((id) => `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`).join("")}<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF06365F"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF36A21"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD9C8B8"/></left><right style="thin"><color rgb="FFD9C8B8"/></right><top style="thin"><color rgb="FFD9C8B8"/></top><bottom style="thin"><color rgb="FFD9C8B8"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function corePropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Mujahiz IQ Supplier Import Template</dc:title><dc:creator>Mujahiz IQ</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-07-12T00:00:00Z</dcterms:created></cp:coreProperties>`;
}

function appPropertiesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Mujahiz IQ</Application><AppVersion>1.0</AppVersion></Properties>`;
}

function readPlatformLabels(source) {
  const map = new Map();
  const regex = /\{\s*value:\s*"([^"]+)"\s*,\s*labelEn:\s*"([^"]*)"\s*,\s*labelAr:\s*"([^"]*)"\s*\}/g;
  for (const match of source.matchAll(regex)) map.set(match[1], { en: match[2], ar: match[3] });
  const fixed = { arabic: ["Arabic", "عربي"], english: ["English", "إنكليزي"], mixed: ["Mixed", "مختلط"], yes: ["Yes", "نعم"], no: ["No", "لا"], unknown: ["Unknown", "غير معروف"], not_sure: ["Not sure", "غير متأكد"] };
  Object.entries(fixed).forEach(([code, [en, ar]]) => map.set(code, { en, ar }));
  return map;
}

function fallbackLabel(code) {
  const en = code.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  return { en, ar: code };
}

function columnName(index) {
  let value = "";
  while (index > 0) { index -= 1; value = String.fromCharCode(65 + (index % 26)) + value; index = Math.floor(index / 26); }
  return value;
}

function xml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.size, 8); eocd.writeUInt16LE(entries.size, 10); eocd.writeUInt32LE(centralDirectory.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
