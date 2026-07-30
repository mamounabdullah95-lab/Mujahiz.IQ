import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import { features } from "../config/features";
import type { AppUser, DuplicateCheck, SupplierDraft } from "../types/domain";
import {
  canUseSupplierExcelImport,
  isSupplierImportRowAccepted,
  parseSupplierImportRows,
  summarizeSupplierImportRows,
  validateSupplierImportValues,
  type SupplierImportRow,
} from "../utils/supplierExcelCore.js";
import { readSupplierWorkbook } from "../utils/supplierWorkbookReader";
import { submitSupplierDraft } from "./firestore";
import { checkSupplierDuplicatesTrusted } from "./supplierOwnership";

export interface SupplierExcelImportPreview {
  batchId: string;
  fileName: string;
  fileSizeBytes: number;
  sheetName: string;
  rows: SupplierImportRow[];
  summary: ReturnType<typeof summarizeSupplierImportRows>;
  unknownColumns: Array<{ index: number; header: string }>;
  missingOptionalColumns: string[];
}

export interface SupplierExcelImportOptions extends Record<string, string[]> {
  governorates: string[];
  categories: string[];
  capabilityTags: string[];
  coverageAreas: string[];
  paymentOptions: string[];
  creditStart: string[];
  sourceType: string[];
  confidenceLevel: string[];
  businessType: string[];
}

const activeImportUsers = new Set<string>();

type TrustedDuplicateCheck = DuplicateCheck & { hasExactDuplicate: boolean };

function mergeTrustedDuplicateCheck(row: SupplierImportRow, check: TrustedDuplicateCheck): SupplierImportRow {
  const duplicateMatches = [...row.duplicateMatches, ...check.matches]
    .filter((item, index, items) => items.findIndex((candidate) =>
      candidate.supplierId === item.supplierId && candidate.reason === item.reason) === index);
  let validationStatus = row.validationStatus;
  if (!row.errors.length && !row.missingFields.length) {
    if (check.hasExactDuplicate) validationStatus = "exact_duplicate";
    else if (check.hasPossibleDuplicate && validationStatus !== "exact_duplicate") validationStatus = "possible_duplicate";
  }
  return {
    ...row,
    duplicateMatches,
    validationStatus,
    excluded: !["valid", "needs_review"].includes(validationStatus),
  };
}

async function applyTrustedDuplicateChecks(rows: SupplierImportRow[]) {
  const eligible = rows.map((row, index) => ({ row, index }))
    .filter(({ row }) => row.draft.nameOriginal.trim().length >= 2);
  if (!eligible.length) return rows;
  const checks = await checkSupplierDuplicatesTrusted(
    eligible.map(({ row }) => ({ supplierData: row.draft })),
  );
  const byIndex = new Map(eligible.map((item, index) => [item.index, checks[index]]));
  return rows.map((row, index) => {
    const check = byIndex.get(index);
    return check ? mergeTrustedDuplicateCheck(row, check) : row;
  });
}

export async function createSupplierExcelImportPreview(file: File, options: SupplierExcelImportOptions): Promise<SupplierExcelImportPreview> {
  assertFeatureEnabled();
  const workbook = await readSupplierWorkbook(file);
  if (workbook.rows.length < 2) throw new Error("supplierImportNoRows");
  const parsed = parseSupplierImportRows({
    headers: workbook.rows[0],
    rows: workbook.rows.slice(1),
    rowNumbers: workbook.rowNumbers.slice(1),
    formulaColumnsByRow: workbook.formulaColumnsByRow,
    duplicateIndexes: [],
    options,
  });
  const rows = await applyTrustedDuplicateChecks(parsed.rows);
  return {
    batchId: createBatchId(),
    fileName: sanitizeFileName(file.name),
    fileSizeBytes: file.size,
    sheetName: workbook.sheetName,
    rows,
    summary: summarizeSupplierImportRows(rows),
    unknownColumns: parsed.headerMap.unknownColumns,
    missingOptionalColumns: parsed.headerMap.missingOptionalColumns,
  };
}

export function revalidateSupplierImportRows(rows: SupplierImportRow[]) {
  return { rows, summary: summarizeSupplierImportRows(rows) };
}

export async function revalidateSupplierImportRow(values: Record<string, unknown>, options: SupplierExcelImportOptions, originalRowNumber: number): Promise<SupplierImportRow> {
  assertFeatureEnabled();
  const result = validateSupplierImportValues(values, { options, duplicateIndexes: [] });
  const [checked] = await applyTrustedDuplicateChecks([{
    ...result,
    originalRowNumber,
    excluded: !["valid", "needs_review"].includes(result.validationStatus),
    overrideReason: "",
  }]);
  return checked;
}

export async function submitSupplierExcelImportBatch(user: AppUser, preview: SupplierExcelImportPreview) {
  assertFeatureEnabled();
  if (!canUseSupplierExcelImport(user)) throw new Error("SUPPLIER_EXCEL_IMPORT_FORBIDDEN");
  if (activeImportUsers.has(user.uid)) throw new Error("SUPPLIER_EXCEL_IMPORT_IN_PROGRESS");
  const acceptedRows = preview.rows.filter((row) => isSupplierImportRowAccepted(row, user));
  if (!acceptedRows.length) throw new Error("supplierImportNoAcceptedRows");
  if (acceptedRows.length > 50) throw new Error("supplierImportTooManyRows");
  activeImportUsers.add(user.uid);
  try {
    if (!isFirebaseConfigured || !db) {
      for (const row of acceptedRows) {
        await submitSupplierDraft(user.uid, row.draft, duplicateCheckForRow(row));
      }
      return { batchId: preview.batchId, acceptedRows: acceptedRows.length };
    }

    const importedByRole = resolveImporterRole(user);
    const batch = writeBatch(db);
    const batchRef = doc(db, "supplierImportBatches", preview.batchId);
    const summary = summarizeSupplierImportRows(preview.rows);
    batch.set(batchRef, stripUndefined({
      source: "excel_import",
      importedBy: user.uid,
      importedByRole,
      originalFileName: preview.fileName,
      fileSizeBytes: preview.fileSizeBytes,
      totalRowsDetected: summary.totalRowsDetected,
      acceptedRows: acceptedRows.length,
      incompleteRows: summary.incompleteRows,
      invalidRows: summary.invalidRows,
      exactDuplicateRows: summary.exactDuplicateRows,
      possibleDuplicateRows: summary.possibleDuplicateRows,
      averageCompleteness: summary.averageCompleteness,
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      status: "completed",
    }));

    for (const row of acceptedRows) {
      const submissionId = `${preview.batchId}_${row.originalRowNumber}`;
      const submissionRef = doc(db, "supplierSubmissions", submissionId);
      const pendingIndexRef = doc(db, "supplierSubmissionDuplicateIndex", submissionId);
      const duplicateCheck = duplicateCheckForRow(row);
      batch.set(submissionRef, stripUndefined({
        submittedBy: user.uid,
        submissionStatus: row.validationStatus === "possible_duplicate" ? "possible_duplicate" : "pending_review",
        supplierData: row.draft,
        duplicateCheck: { ...duplicateCheck, checkedAt: serverTimestamp() },
        countsForAccess: false,
        creditConsumed: false,
        source: "excel_import",
        importBatchId: preview.batchId,
        originalRowNumber: row.originalRowNumber,
        importedBy: user.uid,
        importedByRole,
        importedAt: serverTimestamp(),
        profileCompleteness: row.completion.percentage,
        validationStatus: row.validationStatus,
        idempotencyKey: submissionId,
        duplicateOverrideReason: row.overrideReason || undefined,
        createdAt: serverTimestamp(),
      }));
      batch.set(pendingIndexRef, stripUndefined({
        submissionId,
        submittedBy: user.uid,
        supplierName: row.draft.nameOriginal,
        normalizedName: row.draft.normalizedName,
        normalizedPhones: row.draft.normalizedPhones,
        normalizedEmail: row.draft.normalizedEmail,
        website: row.draft.website,
        googleMapsLink: row.draft.googleMapsLink,
        governorate: row.draft.governorate,
        categories: row.draft.categories,
        source: "pending_submission",
        createdAt: serverTimestamp(),
      }));
    }

    const auditRef = doc(collection(db, "auditLogs"));
    batch.set(auditRef, {
      actorId: user.uid,
      action: "supplier_import.completed",
      targetType: "supplierImportBatch",
      targetId: preview.batchId,
      details: { acceptedRows: acceptedRows.length, totalRowsDetected: preview.summary.totalRowsDetected, importedByRole },
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return { batchId: preview.batchId, acceptedRows: acceptedRows.length };
  } finally {
    activeImportUsers.delete(user.uid);
  }
}

function duplicateCheckForRow(row: SupplierImportRow): DuplicateCheck {
  return { hasPossibleDuplicate: row.duplicateMatches.length > 0, matches: row.duplicateMatches };
}

function resolveImporterRole(user: AppUser): "buyer" | "admin" | "owner" {
  if (user.role === "owner") return "owner";
  if (user.role === "admin") return "admin";
  return "buyer";
}

function assertFeatureEnabled() {
  if (!features.supplierExcelImport) throw new Error("SUPPLIER_EXCEL_IMPORT_DISABLED");
}

function createBatchId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replaceAll("-", "");
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function sanitizeFileName(name: string) {
  return name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").slice(0, 140);
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).map(([key, item]) => [key, stripUndefined(item)])) as T;
    }
  }
  return value;
}

export type { SupplierImportRow };
