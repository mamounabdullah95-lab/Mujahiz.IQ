import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { MAX_SUPPLIER_EXCEL_SIZE, SUPPLIER_EXCEL_FIELDS } from "../src/utils/supplierExcelCore.js";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const templatePath = path.join(root, "public", "templates", "supplier-import-template.xlsx");

function unzip(buffer) {
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 0xffff - 22); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  assert.notEqual(eocd, -1, "valid ZIP end record");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

test("the downloadable template is a small, safe, empty four-sheet workbook", () => {
  const bytes = fs.readFileSync(templatePath);
  assert.ok(bytes.length > 0 && bytes.length <= MAX_SUPPLIER_EXCEL_SIZE);
  const entries = unzip(bytes);
  assert.equal(entries.has("xl/workbook.xml"), true);
  assert.equal(entries.has("xl/worksheets/sheet1.xml"), true);
  assert.equal([...entries.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length, 4);
  assert.equal([...entries.keys()].some((name) => /vbaProject|macrosheets|activeX|embeddings|oleObjects|drawings|media/i.test(name)), false);

  const workbook = entries.get("xl/workbook.xml").toString("utf8");
  assert.match(workbook, /Supplier Form/);
  assert.match(workbook, /[\u0600-\u06ff]/, "sheet names must retain real Arabic text");

  const supplierSheet = entries.get("xl/worksheets/sheet1.xml").toString("utf8");
  const headerRow = supplierSheet.match(/<row r="1"[\s\S]*?<\/row>/)?.[0] || "";
  assert.equal((headerRow.match(/<c /g) || []).length, SUPPLIER_EXCEL_FIELDS.length);
  for (const field of SUPPLIER_EXCEL_FIELDS) assert.ok(headerRow.includes(field.headerEn));
  assert.match(supplierSheet, /<pane ySplit="1"/);
  assert.match(supplierSheet, /<autoFilter ref="A1:AI51"\/>/);
  assert.match(supplierSheet, /<dataValidations count="8">/);
  for (let row = 2; row <= 51; row += 1) {
    assert.match(supplierSheet, new RegExp(`<row r="${row}" spans="1:35"\\/>`));
  }
  const dataRows = supplierSheet.match(/<row r="(?:[2-9]|[1-4]\d|5[01])"[^>]*>([\s\S]*?)<\/row>/g) || [];
  assert.equal(dataRows.length, 0, "all 50 supplier rows must remain empty self-closing rows");

  const allXml = [...entries.values()].map((entry) => entry.toString("utf8")).join("\n");
  const cellText = [...allXml.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join("\n");
  assert.doesNotMatch(cellText, /@[a-z0-9.-]+\.[a-z]{2,}|\+964\d{8,}|https?:\/\//i, "template must not contain supplier contact records");
});
