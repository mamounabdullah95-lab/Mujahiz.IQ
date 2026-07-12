import type { AppUser, DuplicateMatch, SupplierDraft } from "../types/domain";

export const MAX_SUPPLIER_EXCEL_SIZE: number;
export const MAX_SUPPLIER_IMPORT_ROWS: number;
export const MAX_SUPPLIER_IMPORT_COLUMNS: number;
export const SUPPLIER_EXCEL_FIELDS: ReadonlyArray<{ key: string; headerAr: string; headerEn: string; header: string; required: boolean; kind: string }>;
export const DEFAULT_SUPPLIER_IMPORT_OPTIONS: Readonly<Record<string, string[]>>;

export type SupplierImportValidationStatus = "valid" | "exact_duplicate" | "possible_duplicate" | "invalid" | "missing_required_data" | "needs_review";
export interface SupplierImportValueResult {
  values: Record<string, unknown>;
  draft: SupplierDraft;
  errors: string[];
  warnings: string[];
  missingFields: string[];
  completion: { percentage: number; completedFields: number; applicableFields: number; missingFields: string[]; notApplicableFields: string[]; statuses: Record<string, string> };
  validationStatus: SupplierImportValidationStatus;
  duplicateMatches: Array<DuplicateMatch & { source?: string }>;
}
export interface SupplierImportRow extends SupplierImportValueResult {
  originalRowNumber: number;
  excluded: boolean;
  overrideReason: string;
}
export function toLatinDigits(value: unknown): string;
export function cleanSupplierImportText(value: unknown, maximumLength?: number): { value: string; error: string };
export function normalizeSupplierImportHeader(value: unknown): string;
export function mapSupplierImportHeaders(headers: string[]): { columns: Record<string, number>; unknownColumns: Array<{ index: number; header: string }>; duplicateColumns: string[]; missingRequiredColumns: string[]; missingOptionalColumns: string[] };
export function validateSupplierImportFileMetadata(file: Pick<File, "name" | "size" | "type">): void;
export function calculateSupplierProfileCompleteness(profile: Partial<SupplierDraft> & Record<string, unknown>): { percentage: number; completedFields: number; applicableFields: number; missingFields: string[]; notApplicableFields: string[]; statuses: Record<string, string> };
export function valuesFromSupplierImportRow(cells: string[], columns: Record<string, number>): Record<string, string>;
export function validateSupplierImportValues(values: Record<string, unknown>, context?: { options?: Record<string, string[]>; duplicateIndexes?: unknown[]; formulaFields?: string[] }): SupplierImportValueResult;
export function parseSupplierImportRows(input: { headers: string[]; rows: string[][]; rowNumbers?: number[]; formulaColumnsByRow?: Record<number, number[]>; options?: Record<string, string[]>; duplicateIndexes?: unknown[] }): { headerMap: ReturnType<typeof mapSupplierImportHeaders>; rows: SupplierImportRow[]; summary: ReturnType<typeof summarizeSupplierImportRows> };
export function summarizeSupplierImportRows(rows: SupplierImportRow[]): { totalRowsDetected: number; validRows: number; incompleteRows: number; invalidRows: number; exactDuplicateRows: number; possibleDuplicateRows: number; completeRows: number; averageCompleteness: number };
export function canUseSupplierExcelImport(user: AppUser | null | undefined): boolean;
export function isSupplierImportRowAccepted(row: SupplierImportRow, user: AppUser | null | undefined): boolean;
export function supplierImportFieldLabel(key: string, locale?: "ar" | "en"): string;
