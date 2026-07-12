import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Pencil, RotateCcw, Upload, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Section, TextAreaField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { businessTypes, capabilityTags, confidenceLevels, coverageAreas, creditStarts, paymentOptions, sourceTypes } from "../data/constants";
import {
  createSupplierExcelImportPreview,
  revalidateSupplierImportRow,
  revalidateSupplierImportRows,
  submitSupplierExcelImportBatch,
  type SupplierExcelImportPreview,
} from "../services/supplierExcelImport";
import {
  isSupplierImportRowAccepted,
  SUPPLIER_EXCEL_FIELDS,
  supplierImportFieldLabel,
  type SupplierImportRow,
} from "../utils/supplierExcelCore.js";

const statusStyles: Record<string, string> = {
  valid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  needs_review: "border-sky-200 bg-sky-50 text-sky-800",
  missing_required_data: "border-amber/30 bg-amber/10 text-amber-800",
  invalid: "border-red-200 bg-red-50 text-red-700",
  exact_duplicate: "border-slate-300 bg-slate-100 text-slate-700",
  possible_duplicate: "border-violet-200 bg-violet-50 text-violet-800",
};

const filterValues = ["all", "valid", "missing_required_data", "invalid", "exact_duplicate", "possible_duplicate", "needs_review", "complete"] as const;

export function SupplierExcelImportPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<SupplierExcelImportPreview | null>(null);
  const [filter, setFilter] = useState<(typeof filterValues)[number]>("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [partialConfirmed, setPartialConfirmed] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const importOptions = useMemo(() => ({
    governorates: taxonomy.governorates.map((item) => item.value),
    categories: taxonomy.supplierCategories.map((item) => item.value),
    capabilityTags: capabilityTags.map((item) => item.value),
    coverageAreas: coverageAreas.map((item) => item.value),
    paymentOptions: paymentOptions.map((item) => item.value),
    creditStart: creditStarts.map((item) => item.value),
    sourceType: sourceTypes.map((item) => item.value),
    confidenceLevel: confidenceLevels.map((item) => item.value),
    businessType: businessTypes.map((item) => item.value),
  }), [taxonomy]);

  const visibleRows = useMemo(() => {
    if (!preview) return [];
    if (filter === "all") return preview.rows;
    if (filter === "complete") return preview.rows.filter((row) => row.completion.percentage === 100);
    return preview.rows.filter((row) => row.validationStatus === filter);
  }, [filter, preview]);

  const acceptedCount = useMemo(() => preview && appUser ? preview.rows.filter((row) => isSupplierImportRowAccepted(row, appUser)).length : 0, [appUser, preview]);
  const requiresPartialConfirmation = Boolean(preview && acceptedCount < preview.rows.length);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    setPreview(null);
    setPartialConfirmed(false);
    try {
      const result = await createSupplierExcelImportPreview(file, importOptions);
      setPreview(result);
    } catch (reason) {
      setMessage(errorMessage(reason instanceof Error ? reason : new Error("supplierImportFailed"), locale));
    } finally {
      setBusy(false);
    }
  }

  function clearSession() {
    setPreview(null);
    setEditingIndex(null);
    setEditValues({});
    setPartialConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage(copy(locale, "تم مسح الملف وبيانات المعاينة من ذاكرة الجلسة.", "The file and preview data were cleared from session memory."));
  }

  function toggleRow(index: number) {
    if (!preview || !appUser) return;
    const row = preview.rows[index];
    const canOverride = row.validationStatus === "possible_duplicate" && ["owner", "admin"].includes(appUser.role);
    if (!["valid", "needs_review"].includes(row.validationStatus) && !canOverride) return;
    const rows = preview.rows.map((item, itemIndex) => itemIndex === index ? { ...item, excluded: !item.excluded } : item);
    const next = revalidateSupplierImportRows(rows);
    setPreview({ ...preview, ...next });
  }

  function updateOverrideReason(index: number, value: string) {
    if (!preview) return;
    const rows = preview.rows.map((item, itemIndex) => itemIndex === index ? { ...item, overrideReason: value } : item);
    setPreview({ ...preview, ...revalidateSupplierImportRows(rows) });
  }

  function openEditor(index: number) {
    if (!preview) return;
    const row = preview.rows[index];
    const values = Object.fromEntries(SUPPLIER_EXCEL_FIELDS.map((field) => {
      const value = row.values[field.key];
      if (Array.isArray(value)) return [field.key, value.join(",")];
      if (typeof value === "boolean") return [field.key, value ? "yes" : "no"];
      return [field.key, value == null ? "" : String(value)];
    }));
    setEditingIndex(index);
    setEditValues(values);
  }

  async function saveEditor() {
    if (!preview || editingIndex == null) return;
    setBusy(true);
    try {
      const current = preview.rows[editingIndex];
      const updated = await revalidateSupplierImportRow(editValues, importOptions, current.originalRowNumber);
      const rows = preview.rows.map((item, index) => index === editingIndex ? updated : item);
      setPreview({ ...preview, ...revalidateSupplierImportRows(rows) });
      setEditingIndex(null);
      setEditValues({});
      setMessage(copy(locale, "تم تحديث الصف وإعادة التحقق منه.", "The row was updated and revalidated."));
    } catch (reason) {
      setMessage(errorMessage(reason instanceof Error ? reason : new Error("supplierImportFailed"), locale));
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview || !appUser || !acceptedCount) return;
    if (requiresPartialConfirmation && !partialConfirmed) {
      setMessage(copy(locale, "وافق أولاً على استيراد السجلات المقبولة فقط.", "Confirm the partial import before continuing."));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await submitSupplierExcelImportBatch(appUser, preview);
      setPreview(null);
      setEditingIndex(null);
      setEditValues({});
      setPartialConfirmed(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(copy(locale, `تم استيراد بيانات المجهزين بنجاح وإرسال ${result.acceptedRows} سجلاً إلى المراجعة. انتهت معالجة الملف ولم يتم الاحتفاظ بنسخة منه.`, `Supplier data was imported successfully and ${result.acceptedRows} records were sent for review. Processing is complete and no copy of the file was retained.`));
    } catch (reason) {
      setMessage(errorMessage(reason instanceof Error ? reason : new Error("supplierImportFailed"), locale));
    } finally {
      setBusy(false);
    }
  }

  function downloadErrorCsv() {
    if (!preview) return;
    const rows = preview.rows.filter((row) => !["valid", "needs_review"].includes(row.validationStatus));
    const csv = [
      ["row", "supplier", "status", "errors", "missing_fields"],
      ...rows.map((row) => [row.originalRowNumber, row.draft.nameOriginal, row.validationStatus, row.errors.join("; "), row.missingFields.join("; ")]),
    ].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `supplier-import-errors-${preview.batchId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section
      title={copy(locale, "استيراد المجهزين من Excel", "Import suppliers from Excel")}
      description={copy(locale, "تُقرأ ملفات XLSX محلياً في المتصفح، ثم تُعرض للمراجعة قبل إرسال السجلات المقبولة إلى الإدارة.", "XLSX files are read locally in your browser and reviewed before accepted records are sent to administration.")}
      actions={<a className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber bg-white px-4 py-2 text-sm font-black text-amber hover:bg-amber hover:text-white" href="/templates/supplier-import-template.xlsx" download><Download className="h-4 w-4" />{copy(locale, "تحميل نموذج Excel للمجهزين", "Download Supplier Excel Template")}</a>}
    >
      <div className="grid gap-5">
        <div className="rounded-xl border border-borderSoft bg-white p-5 shadow-card">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h3 className="text-lg font-black text-ink">{copy(locale, "اختر ملف القالب الرسمي", "Choose the official template")}</h3>
              <p className="mt-2 text-sm leading-7 text-muted">{copy(locale, "ملف XLSX واحد فقط، بحد أقصى 200 KB و50 شركة. لن يُرفع الملف إلى Firebase Storage ولن يُحفظ في المتصفح.", "One XLSX file only, up to 200 KB and 50 suppliers. The file is never uploaded to Firebase Storage or retained by the browser.")}</p>
            </div>
            <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-black text-white hover:bg-river">
              <Upload className="h-4 w-4" />
              {busy ? copy(locale, "جارٍ الفحص...", "Checking...") : copy(locale, "اختيار ملف XLSX", "Choose XLSX file")}
              <input ref={fileInputRef} className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={handleFile} />
            </label>
          </div>
          {message ? <div className="mt-4 rounded-lg border border-amber/30 bg-amber/10 p-3 text-sm font-bold text-ink" role="status">{message}</div> : null}
        </div>

        {preview ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <Summary label={copy(locale, "المكتشف", "Detected")} value={preview.summary.totalRowsDetected} />
              <Summary label={copy(locale, "صالح", "Valid")} value={preview.summary.validRows} tone="success" />
              <Summary label={copy(locale, "ناقص", "Incomplete")} value={preview.summary.incompleteRows} tone="warning" />
              <Summary label={copy(locale, "غير صالح", "Invalid")} value={preview.summary.invalidRows} tone="danger" />
              <Summary label={copy(locale, "مكرر مؤكد", "Exact duplicates")} value={preview.summary.exactDuplicateRows} />
              <Summary label={copy(locale, "مكرر محتمل", "Possible duplicates")} value={preview.summary.possibleDuplicateRows} />
              <Summary label={copy(locale, "مكتمل 100%", "100% complete")} value={preview.summary.completeRows} />
              <Summary label={copy(locale, "متوسط الاكتمال", "Average complete")} value={`${preview.summary.averageCompleteness}%`} />
            </div>

            <div className="rounded-xl border border-borderSoft bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted"><strong className="text-ink">{preview.fileName}</strong> · {(preview.fileSizeBytes / 1024).toFixed(1)} KB · {preview.sheetName}</div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={downloadErrorCsv}><Download className="h-4 w-4" />{copy(locale, "تنزيل تقرير الأخطاء", "Download error report")}</Button>
                  <Button type="button" variant="ghost" onClick={clearSession}><RotateCcw className="h-4 w-4" />{copy(locale, "إلغاء ومسح الملف", "Cancel and clear")}</Button>
                </div>
              </div>
              {preview.unknownColumns.length ? <p className="mt-3 text-xs font-bold text-amber-800">{copy(locale, "أعمدة غير مستخدمة: ", "Unused columns: ")}{preview.unknownColumns.map((item) => item.header).join(", ")}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {filterValues.map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg border px-3 py-1.5 text-xs font-black ${filter === value ? "border-navy bg-navy text-white" : "border-borderSoft bg-white text-muted hover:border-amber"}`}>{filterLabel(value, locale)}</button>)}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-borderSoft bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full text-sm">
                  <thead className="bg-cream text-ink"><tr>{["", "#", copy(locale, "المجهز", "Supplier"), copy(locale, "المحافظة / المدينة", "Governorate / city"), copy(locale, "الهاتف / البريد", "Phone / email"), copy(locale, "التصنيف", "Category"), copy(locale, "الاكتمال", "Completeness"), copy(locale, "الحالة", "Status"), copy(locale, "الملاحظات", "Issues"), copy(locale, "الإجراءات", "Actions")].map((label) => <th key={label} className="px-3 py-3 text-start font-black">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-borderSoft">
                    {visibleRows.map((row) => {
                      const index = preview.rows.indexOf(row);
                      const canToggle = ["valid", "needs_review"].includes(row.validationStatus) || (row.validationStatus === "possible_duplicate" && ["owner", "admin"].includes(appUser?.role || ""));
                      return <tr key={row.originalRowNumber} className={row.excluded ? "bg-slate-50/70 opacity-75" : "bg-white"}>
                        <td className="px-3 py-3"><input type="checkbox" checked={!row.excluded} disabled={!canToggle} onChange={() => toggleRow(index)} aria-label={copy(locale, "تضمين الصف", "Include row")} /></td>
                        <td className="px-3 py-3 font-black">{row.originalRowNumber}</td>
                        <td className="px-3 py-3"><strong className="block text-ink">{row.draft.nameOriginal || "-"}</strong><span className="text-xs text-muted">{row.draft.nameAr || row.draft.nameEn || "-"}</span></td>
                        <td className="px-3 py-3">{row.draft.governorate || "-"}<span className="block text-xs text-muted">{row.draft.city || "-"}</span></td>
                        <td className="px-3 py-3" dir="ltr">{row.draft.phones[0] || "-"}<span className="block text-xs text-muted">{row.draft.email || "-"}</span></td>
                        <td className="px-3 py-3">{row.draft.categories[0] || "-"}</td>
                        <td className="px-3 py-3"><span className="font-black text-ink">{row.completion.percentage}%</span><div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-amber" style={{ width: `${row.completion.percentage}%` }} /></div></td>
                        <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${statusStyles[row.validationStatus] || statusStyles.invalid}`}>{statusLabel(row.validationStatus, locale)}</span></td>
                        <td className="max-w-72 px-3 py-3 text-xs text-muted">{[...row.errors, ...row.missingFields.map((item) => `missing:${item}`)].slice(0, 3).join(" · ") || "-"}{row.duplicateMatches[0] ? <span className="mt-1 block font-bold text-violet-700">{row.duplicateMatches[0].supplierName}</span> : null}</td>
                        <td className="px-3 py-3"><Button type="button" variant="ghost" onClick={() => openEditor(index)}><Pencil className="h-4 w-4" />{copy(locale, "تعديل", "Edit")}</Button></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {preview.rows.some((row) => row.validationStatus === "possible_duplicate" && !row.excluded) ? <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><h3 className="font-black text-violet-900">{copy(locale, "أسباب تجاوز التكرار المحتمل", "Possible duplicate override reasons")}</h3><div className="mt-3 grid gap-3">{preview.rows.map((row, index) => row.validationStatus === "possible_duplicate" && !row.excluded ? <TextAreaField key={row.originalRowNumber} label={`${row.originalRowNumber} - ${row.draft.nameOriginal}`} value={row.overrideReason} onChange={(event) => updateOverrideReason(index, event.target.value)} placeholder={copy(locale, "اكتب سبباً واضحاً من 10 أحرف على الأقل", "Enter a clear reason of at least 10 characters")} /> : null)}</div></div> : null}

            <div className="rounded-xl border border-borderSoft bg-white p-5 shadow-card">
              {requiresPartialConfirmation ? <label className="mb-4 flex items-start gap-3 text-sm font-bold text-ink"><input className="mt-1" type="checkbox" checked={partialConfirmed} onChange={(event) => setPartialConfirmed(event.target.checked)} /><span>{copy(locale, "أوافق صراحة على استيراد السجلات المقبولة فقط واستبعاد الصفوف غير الصالحة أو المكررة.", "I explicitly approve importing accepted records only and excluding invalid or duplicate rows.")}</span></label> : null}
              <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{copy(locale, `سيتم إرسال ${acceptedCount} سجل مستقل إلى المراجعة.`, `${acceptedCount} independent records will be sent for review.`)}</p><Button type="button" disabled={busy || !acceptedCount || (requiresPartialConfirmation && !partialConfirmed)} onClick={() => void confirmImport()}><CheckCircle2 className="h-4 w-4" />{copy(locale, "تأكيد استيراد السجلات المقبولة", "Confirm accepted records")}</Button></div>
            </div>
          </>
        ) : null}

        {editingIndex != null && preview ? <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/45 p-4"><div className="mx-auto my-6 max-w-5xl rounded-xl bg-creamLight p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-ink">{copy(locale, `تعديل الصف ${preview.rows[editingIndex].originalRowNumber}`, `Edit row ${preview.rows[editingIndex].originalRowNumber}`)}</h3><p className="mt-1 text-sm text-muted">{copy(locale, "استخدم الأكواد الرسمية للقيم متعددة الاختيار وافصلها بفاصلة إنجليزية.", "Use official codes for multi-select fields and separate them with English commas.")}</p></div><button type="button" onClick={() => setEditingIndex(null)} aria-label={copy(locale, "إغلاق", "Close")}><XCircle className="h-6 w-6 text-muted" /></button></div><div className="mt-5 grid gap-4 md:grid-cols-2">{SUPPLIER_EXCEL_FIELDS.map((field) => ["shortDescription", "address", "branchDetails", "creditTermsNote"].includes(field.key) ? <TextAreaField key={field.key} label={`${field.required ? "* " : ""}${locale === "ar" ? field.headerAr : field.headerEn}`} value={editValues[field.key] || ""} onChange={(event) => setEditValues((current) => ({ ...current, [field.key]: event.target.value }))} /> : <TextField key={field.key} label={`${field.required ? "* " : ""}${locale === "ar" ? field.headerAr : field.headerEn}`} value={editValues[field.key] || ""} onChange={(event) => setEditValues((current) => ({ ...current, [field.key]: event.target.value }))} />)}</div><div className="mt-5 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setEditingIndex(null)}>{copy(locale, "إلغاء", "Cancel")}</Button><Button type="button" disabled={busy} onClick={() => void saveEditor()}>{copy(locale, "حفظ وإعادة التحقق", "Save and revalidate")}</Button></div></div></div> : null}
      </div>
    </Section>
  );
}

function Summary({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-ink";
  return <div className="rounded-xl border border-borderSoft bg-white p-3 shadow-card"><div className={`text-xl font-black ${color}`}>{value}</div><div className="mt-1 text-xs font-bold text-muted">{label}</div></div>;
}

function copy(locale: "ar" | "en", ar: string, en: string) { return locale === "ar" ? ar : en; }

function statusLabel(status: string, locale: "ar" | "en") {
  const labels: Record<string, [string, string]> = { valid: ["صالح", "Valid"], needs_review: ["يحتاج مراجعة", "Needs review"], missing_required_data: ["بيانات إلزامية ناقصة", "Missing required data"], invalid: ["غير صالح", "Invalid"], exact_duplicate: ["مكرر مؤكد", "Exact duplicate"], possible_duplicate: ["مكرر محتمل", "Possible duplicate"] };
  const label = labels[status] || [status, status];
  return locale === "ar" ? label[0] : label[1];
}

function filterLabel(value: (typeof filterValues)[number], locale: "ar" | "en") {
  if (value === "all") return copy(locale, "الكل", "All");
  if (value === "complete") return copy(locale, "مكتمل 100%", "100% complete");
  return statusLabel(value, locale);
}

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

function errorMessage(error: Error & { missingColumns?: string[] }, locale: "ar" | "en") {
  const messages: Record<string, [string, string]> = {
    supplierImportTooLarge: ["حجم ملف Excel أكبر من الحد المسموح. يجب ألا يتجاوز الملف 200 كيلوبايت.", "The Excel file exceeds the allowed size. The maximum permitted size is 200 KB."],
    supplierImportTooManyRows: ["يحتوي الملف على أكثر من 50 شركة. قسّم البيانات إلى أكثر من ملف ثم حاول مجدداً.", "The file contains more than 50 suppliers. Split the data into multiple files and try again."],
    unsupportedSupplierImportFile: ["يسمح بملفات XLSX فقط.", "Only XLSX files are allowed."],
    unsupportedSupplierImportMime: ["نوع الملف لا يطابق ملف Excel معتمداً.", "The file type does not match an approved Excel workbook."],
    supplierImportMissingSheet: ["لم يتم العثور على ورقة بيانات المجهزين المطلوبة Supplier Form. يرجى استخدام النموذج الرسمي.", "The required Supplier Form worksheet was not found. Please use the official template."],
    supplierImportMissingRequiredColumns: ["توجد أعمدة إلزامية مفقودة في القالب.", "Required template columns are missing."],
    supplierImportUnsafeWorkbook: ["يحتوي الملف على عناصر أو محتوى غير مسموح.", "The workbook contains disallowed objects or content."],
    supplierImportNoRows: ["لم يتم العثور على سجلات صالحة للاستيراد.", "No supplier records were found for import."],
    SUPPLIER_EXCEL_IMPORT_FORBIDDEN: ["هذه الخاصية متاحة للمشتري والمدير والحساب الرئيسي فقط.", "This feature is available to buyer, admin, and owner accounts only."],
    SUPPLIER_EXCEL_IMPORT_IN_PROGRESS: ["توجد عملية استيراد قيد التنفيذ لهذا الحساب.", "An import is already in progress for this account."],
  };
  const base = messages[error.message] || ["تعذر قراءة الملف أو أن بنيته لا تطابق النموذج المعتمد.", "The file could not be read or does not match the approved template."];
  const suffix = error.missingColumns?.length ? ` ${error.missingColumns.map((key) => supplierImportFieldLabel(key, locale)).join(", ")}` : "";
  return `${locale === "ar" ? base[0] : base[1]}${suffix}`;
}
