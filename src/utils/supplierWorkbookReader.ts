import { mapSupplierImportHeaders, validateSupplierImportFileMetadata } from "./supplierExcelCore.js";

export interface WorkbookImportResult {
  rows: string[][];
  rowNumbers: number[];
  formulaColumnsByRow: Record<number, number[]>;
  sheetName: string;
}

interface ZipEntry {
  data: Uint8Array;
  method: number;
  name: string;
  uncompressedSize: number;
}

interface WorkbookSheet {
  name: string;
  path: string;
  state: string;
}

const textDecoder = new TextDecoder("utf-8");
const maximumArchiveEntries = 200;
const maximumExpandedArchiveBytes = 4 * 1024 * 1024;
const maximumExpandedEntryBytes = 2 * 1024 * 1024;
const rejectedEntryPattern = /(^|\/)(?:vbaProject\.bin|macrosheets|activeX|embeddings|oleObjects|ctrlProps|customUI|externalLinks|printerSettings|drawings|media)(\/|$)/i;

export async function readSupplierWorkbook(file: File): Promise<WorkbookImportResult> {
  validateSupplierImportFileMetadata(file);
  let buffer: ArrayBuffer | null = await file.arrayBuffer();
  let entries: Map<string, ZipEntry> | null = null;
  try {
    entries = readZipEntries(buffer);
    validateWorkbookArchive(entries);
    const sharedStrings = parseSharedStrings(await readZipText(entries, "xl/sharedStrings.xml", false));
    const sheets = await readWorkbookSheets(entries);
    const selected = await selectSupplierSheet(entries, sheets, sharedStrings);
    const parsed = parseWorksheetRows(await readZipText(entries, selected.path, true), sharedStrings);
    if (!parsed.rows.length) throw new Error("supplierImportNoRows");
    return { ...parsed, sheetName: selected.name };
  } finally {
    entries?.forEach((entry) => entry.data.fill(0));
    entries?.clear();
    if (buffer) new Uint8Array(buffer).fill(0);
    buffer = null;
    entries = null;
  }
}

function readZipEntries(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) throw new Error("invalidSupplierImportFile");
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const directorySize = view.getUint32(eocdOffset + 12, true);
  const directoryOffset = view.getUint32(eocdOffset + 16, true);
  if (!entryCount || entryCount > maximumArchiveEntries || directoryOffset + directorySize > view.byteLength) throw new Error("invalidSupplierImportFile");
  const entries = new Map<string, ZipEntry>();
  let expandedBytes = 0;
  let offset = directoryOffset;
  const end = directoryOffset + directorySize;
  while (offset < end && entries.size < entryCount) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error("invalidSupplierImportFile");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = normalizeArchivePath(textDecoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength)));
    if (!name || name.startsWith("/") || name.split("/").includes("..")) throw new Error("invalidSupplierImportFile");
    if (localHeaderOffset + 30 > view.byteLength || view.getUint32(localHeaderOffset, true) !== 0x04034b50) throw new Error("invalidSupplierImportFile");
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > view.byteLength || uncompressedSize > maximumExpandedEntryBytes) throw new Error("supplierImportArchiveTooLarge");
    expandedBytes += uncompressedSize;
    if (expandedBytes > maximumExpandedArchiveBytes) throw new Error("supplierImportArchiveTooLarge");
    entries.set(name, { data: bytes.slice(dataStart, dataStart + compressedSize), method, name, uncompressedSize });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (entries.size !== entryCount) throw new Error("invalidSupplierImportFile");
  return entries;
}

function validateWorkbookArchive(entries: Map<string, ZipEntry>) {
  for (const name of entries.keys()) {
    if (rejectedEntryPattern.test(name) || /\.(?:bin|exe|js|html?)$/i.test(name)) throw new Error("supplierImportUnsafeWorkbook");
  }
  for (const required of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"]) {
    if (!entries.has(required)) throw new Error("invalidSupplierImportFile");
  }
}

function findEndOfCentralDirectory(view: DataView) {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function readZipText(entries: Map<string, ZipEntry>, path: string, required: boolean) {
  const entry = entries.get(normalizeArchivePath(path));
  if (!entry) {
    if (required) throw new Error("invalidSupplierImportFile");
    return "";
  }
  const inflated = await inflateZipEntry(entry);
  if (inflated.byteLength > maximumExpandedEntryBytes) throw new Error("supplierImportArchiveTooLarge");
  return textDecoder.decode(inflated);
}

async function inflateZipEntry(entry: ZipEntry) {
  if (entry.method === 0) return entry.data;
  if (entry.method !== 8) throw new Error("unsupportedSupplierImportFile");
  if (!("DecompressionStream" in globalThis)) throw new Error("unsupportedSupplierImportBrowser");
  const payload = new Uint8Array(entry.data.byteLength);
  payload.set(entry.data);
  const stream = new Blob([payload.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const result = new Uint8Array(await new Response(stream).arrayBuffer());
  if (entry.uncompressedSize && result.byteLength !== entry.uncompressedSize) throw new Error("invalidSupplierImportFile");
  return result;
}

async function readWorkbookSheets(entries: Map<string, ZipEntry>): Promise<WorkbookSheet[]> {
  const workbook = parseXml(await readZipText(entries, "xl/workbook.xml", true));
  const relationships = parseXml(await readZipText(entries, "xl/_rels/workbook.xml.rels", true));
  const targetById = new Map(getElementsByLocalName(relationships, "Relationship").map((item) => [item.getAttribute("Id") || "", item.getAttribute("Target") || ""]));
  return getElementsByLocalName(workbook, "sheet").map((sheet) => {
    const relationshipId = sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || sheet.getAttribute("r:id") || "";
    const target = targetById.get(relationshipId) || "";
    return { name: sheet.getAttribute("name") || "", state: sheet.getAttribute("state") || "visible", path: resolveWorkbookTarget(target) };
  }).filter((sheet) => sheet.path);
}

async function selectSupplierSheet(entries: Map<string, ZipEntry>, sheets: WorkbookSheet[], sharedStrings: string[]) {
  const visible = sheets.filter((sheet) => sheet.state === "visible");
  const exact = visible.find((sheet) => sheet.name.trim().toLocaleLowerCase("en") === "supplier form");
  if (exact) return exact;
  for (const sheet of visible) {
    const firstRow = parseWorksheetRows(await readZipText(entries, sheet.path, true), sharedStrings, 1).rows[0] || [];
    try {
      if (!mapSupplierImportHeaders(firstRow).missingRequiredColumns.length) return sheet;
    } catch {
      // Continue checking visible sheets only.
    }
  }
  throw new Error("supplierImportMissingSheet");
}

function parseSharedStrings(xml: string) {
  if (!xml) return [];
  const document = parseXml(xml);
  return getElementsByLocalName(document, "si").map((item) => getElementsByLocalName(item, "t").map((node) => node.textContent || "").join(""));
}

function parseWorksheetRows(xml: string, sharedStrings: string[], maximumRows = Number.POSITIVE_INFINITY) {
  const document = parseXml(xml);
  const rows: string[][] = [];
  const rowNumbers: number[] = [];
  const formulaColumnsByRow: Record<number, number[]> = {};
  for (const row of getElementsByLocalName(document, "row")) {
    if (rows.length >= maximumRows) break;
    const rowNumber = Number(row.getAttribute("r")) || rows.length + 1;
    const values: string[] = [];
    const formulaColumns: number[] = [];
    getElementsByLocalName(row, "c").forEach((cell) => {
      const reference = cell.getAttribute("r") || "";
      const columnIndex = reference ? columnNameToIndex(reference.replace(/\d+/g, "")) : values.length;
      if (columnIndex >= 100) throw new Error("supplierImportTooManyColumns");
      values[columnIndex] = readCellText(cell, sharedStrings).trim();
      if (getElementsByLocalName(cell, "f").length) formulaColumns.push(columnIndex);
    });
    if (values.some(Boolean) || formulaColumns.length) {
      rows.push(values.map((value) => value || ""));
      rowNumbers.push(rowNumber);
      if (formulaColumns.length) formulaColumnsByRow[rowNumber] = formulaColumns;
    }
  }
  return { rows, rowNumbers, formulaColumnsByRow };
}

function readCellText(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") return decodeExcelEscapedText(getElementsByLocalName(cell, "t").map((node) => node.textContent || "").join(""));
  const value = getElementsByLocalName(cell, "v")[0]?.textContent || "";
  if (type === "s") return decodeExcelEscapedText(sharedStrings[Number(value)] || "");
  if (type === "b") return value === "1" ? "true" : "false";
  return decodeExcelEscapedText(value);
}

function decodeExcelEscapedText(value: string) {
  return value.replace(/_x000D_/gi, "\n").replace(/_x000A_/gi, "\n").replace(/_x0009_/gi, "\t");
}

function columnNameToIndex(name: string) {
  return name.toUpperCase().split("").reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function resolveWorkbookTarget(target: string) {
  const normalized = target.replaceAll("\\", "/").replace(/^\//, "");
  return normalizeArchivePath(normalized.startsWith("xl/") ? normalized : `xl/${normalized}`);
}

function normalizeArchivePath(path: string) {
  return path.replaceAll("\\", "/").replace(/\/\.\//g, "/").replace(/^\.\//, "");
}

function parseXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (getElementsByLocalName(document, "parsererror").length) throw new Error("invalidSupplierImportFile");
  return document;
}

function getElementsByLocalName(parent: Document | Element, localName: string) {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}
