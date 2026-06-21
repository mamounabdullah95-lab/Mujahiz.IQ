export interface WorkbookImportResult {
  rows: string[][];
  sheetName?: string;
}

interface ZipEntry {
  data: Uint8Array;
  method: number;
  name: string;
}

const textDecoder = new TextDecoder("utf-8");

export async function readWorkbookRows(file: File): Promise<WorkbookImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    return { rows: parseCsv(await file.text()), sheetName: file.name };
  }
  if (!name.endsWith(".xlsx")) {
    throw new Error("unsupportedSupplierImportFile");
  }

  const entries = await readZipEntries(await file.arrayBuffer());
  const sharedStrings = parseSharedStrings(await readZipText(entries, "xl/sharedStrings.xml", false));
  const worksheetPath = findFirstWorksheetPath(entries);
  const worksheetXml = await readZipText(entries, worksheetPath, true);

  return {
    rows: parseWorksheetRows(worksheetXml, sharedStrings),
    sheetName: worksheetPath.split("/").pop(),
  };
}

async function readZipEntries(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) {
    throw new Error("invalidSupplierImportFile");
  }

  const directorySize = view.getUint32(eocdOffset + 12, true);
  const directoryOffset = view.getUint32(eocdOffset + 16, true);
  const entries = new Map<string, ZipEntry>();
  let offset = directoryOffset;
  const end = directoryOffset + directorySize;

  while (offset < end) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      break;
    }

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength)).replaceAll("\\", "/");

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, {
      data: bytes.slice(dataStart, dataStart + compressedSize),
      method,
      name,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView) {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

async function readZipText(entries: Map<string, ZipEntry>, path: string, required: boolean) {
  const entry = entries.get(path);
  if (!entry) {
    if (required) {
      throw new Error("invalidSupplierImportFile");
    }
    return "";
  }
  return textDecoder.decode(await inflateZipEntry(entry));
}

async function inflateZipEntry(entry: ZipEntry) {
  if (entry.method === 0) {
    return entry.data;
  }
  if (entry.method !== 8) {
    throw new Error("unsupportedSupplierImportFile");
  }
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("unsupportedSupplierImportBrowser");
  }

  const payload = new Uint8Array(entry.data.byteLength);
  payload.set(entry.data);
  const stream = new Blob([payload.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseSharedStrings(xml: string) {
  if (!xml) {
    return [];
  }
  const document = parseXml(xml);
  return getElementsByLocalName(document, "si").map((item) =>
    getElementsByLocalName(item, "t")
      .map((node) => node.textContent || "")
      .join(""),
  );
}

function findFirstWorksheetPath(entries: Map<string, ZipEntry>) {
  if (entries.has("xl/worksheets/sheet1.xml")) {
    return "xl/worksheets/sheet1.xml";
  }
  const firstWorksheet = Array.from(entries.keys())
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort()[0];
  if (!firstWorksheet) {
    throw new Error("invalidSupplierImportFile");
  }
  return firstWorksheet;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const document = parseXml(xml);
  return getElementsByLocalName(document, "row")
    .map((row) => {
      const values: string[] = [];
      getElementsByLocalName(row, "c").forEach((cell) => {
        const reference = cell.getAttribute("r") || "";
        const columnIndex = reference ? columnNameToIndex(reference.replace(/\d+/g, "")) : values.length;
        values[columnIndex] = readCellText(cell, sharedStrings).trim();
      });
      return values.map((value) => value || "");
    })
    .filter((row) => row.some(Boolean));
}

function readCellText(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") {
    return decodeExcelEscapedText(getElementsByLocalName(cell, "t")
      .map((node) => node.textContent || "")
      .join(""));
  }
  const value = getElementsByLocalName(cell, "v")[0]?.textContent || "";
  if (type === "s") {
    return decodeExcelEscapedText(sharedStrings[Number(value)] || "");
  }
  return decodeExcelEscapedText(value);
}

function decodeExcelEscapedText(value: string) {
  return value
    .replace(/_x000D_/gi, "\n")
    .replace(/_x000A_/gi, "\n")
    .replace(/_x0009_/gi, "\t");
}

function columnNameToIndex(name: string) {
  return name
    .toUpperCase()
    .split("")
    .reduce((index, char) => index * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function parseXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (getElementsByLocalName(document, "parsererror").length) {
    throw new Error("invalidSupplierImportFile");
  }
  return document;
}

function getElementsByLocalName(parent: Document | Element, localName: string) {
  return Array.from(parent.getElementsByTagNameNS("*", localName));
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }
  return rows;
}
