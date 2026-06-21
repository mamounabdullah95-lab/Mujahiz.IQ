import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Save, Send, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, ChipGroup, Section, SelectField, TextAreaField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import {
  businessTypes,
  capabilityTags,
  confidenceLevels,
  coverageAreas,
  creditStarts,
  labelFor,
  type OptionItem,
  paymentOptions,
  sourceTypes,
  supplierCapabilityGroups,
} from "../data/constants";
import {
  fetchDuplicateIndexes,
  getSupplier,
  getSupplierSubmission,
  resubmitSupplierSubmission,
  submitSupplierDraft,
  updateApprovedSupplier,
} from "../services/firestore";
import type { DuplicateCheck, SupplierDraft } from "../types/domain";
import { createSearchKeywords, findDuplicateMatches, normalizeEmail, normalizeName, normalizePhone } from "../utils/normalization";
import { calculateCompletionScore, missingRequiredSupplierFieldKeys } from "../utils/scoring";
import { readWorkbookRows } from "../utils/workbookImport";

const steps = ["supplierIdentity", "location", "contactInfo", "capabilities", "sourceConfidence", "submitForReview"];
const supplierImportMaxSize = 100 * 1024;
const addSupplierDraftStorageVersion = 1;

interface FormState {
  nameOriginal: string;
  displayName: string;
  nameLanguage: "arabic" | "english" | "mixed";
  nameAr: string;
  nameEn: string;
  shortDescription: string;
  businessType: string;
  governorates: string[];
  branches: Array<{
    governorate: string;
    city: string;
    marketArea: string;
    address: string;
    phone: string;
  }>;
  city: string;
  marketArea: string;
  address: string;
  googleMapsLink: string;
  coverageAreas: string[];
  primaryPhone: string;
  secondaryPhone: string;
  whatsappAvailable: "yes" | "no" | "unknown";
  email: string;
  website: string;
  facebook: string;
  instagramLinkedin: string;
  contactPerson: string;
  contactPersonRole: string;
  mainCategories: string[];
  subcategories: string;
  capabilityTags: string[];
  paymentOptions: string[];
  acceptsCredit: "yes" | "no" | "unknown";
  creditDays: string;
  creditStart: string;
  creditTermsNote: string;
  sourceType: string;
  confidenceLevel: string;
  hasDirectExperience: "yes" | "no" | "not_sure";
  lastInteractionYear: string;
  relatedMaterialService: string;
  sourceNote: string;
}

interface BulkImportItem {
  duplicateCheck: DuplicateCheck;
  form: FormState;
  missing: string[];
  rowNumber: number;
}

interface SavedAddSupplierDraft {
  bulkEditIndex: number | null;
  bulkItems: BulkImportItem[];
  form: FormState;
  importSummary: string;
  savedAt: string;
  step: number;
  version: number;
}

const initialForm: FormState = {
  nameOriginal: "",
  displayName: "",
  nameLanguage: "mixed",
  nameAr: "",
  nameEn: "",
  shortDescription: "",
  businessType: "company",
  governorates: [],
  branches: [],
  city: "",
  marketArea: "",
  address: "",
  googleMapsLink: "",
  coverageAreas: [],
  primaryPhone: "",
  secondaryPhone: "",
  whatsappAvailable: "unknown",
  email: "",
  website: "",
  facebook: "",
  instagramLinkedin: "",
  contactPerson: "",
  contactPersonRole: "",
  mainCategories: [],
  subcategories: "",
  capabilityTags: [],
  paymentOptions: [],
  acceptsCredit: "unknown",
  creditDays: "",
  creditStart: "",
  creditTermsNote: "",
  sourceType: "",
  confidenceLevel: "",
  hasDirectExperience: "not_sure",
  lastInteractionYear: "",
  relatedMaterialService: "",
  sourceNote: "",
};

function normalizeFormState(value?: Partial<FormState> | null): FormState {
  return {
    ...initialForm,
    ...(value || {}),
    branches: value?.branches || [],
  };
}

export function AddSupplierPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser, firebaseUser, isAdmin } = useAuth();
  const { taxonomy } = useTaxonomy();
  const navigate = useNavigate();
  const { submissionId, supplierId } = useParams();
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState(0);
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheck>({ hasPossibleDuplicate: false, matches: [] });
  const [checkedKey, setCheckedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState("");
  const [bulkItems, setBulkItems] = useState<BulkImportItem[]>([]);
  const [bulkEditIndex, setBulkEditIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [approvedSupplierOriginalForm, setApprovedSupplierOriginalForm] = useState<FormState | null>(null);
  const draftLoadedRef = useRef(false);
  const isApprovedEditMode = Boolean(supplierId);

  const draft = useMemo(() => buildDraft(form), [form]);
  const missing = missingRequiredSupplierFieldKeys(draft);
  const bulkEditItem = bulkEditIndex === null ? null : bulkItems[bulkEditIndex] || null;
  const isBulkEditing = Boolean(bulkEditItem);
  const draftStorageKey = firebaseUser ? `mujahiz-iq-add-supplier-draft-${firebaseUser.uid}` : "";
  const option = (item: { value: string; labelEn: string; labelAr: string }) => ({
    value: item.value,
    label: locale === "ar" ? item.labelAr : item.labelEn,
  });

  useEffect(() => {
    if (!draftStorageKey || submissionId || supplierId || draftLoadedRef.current) {
      return;
    }
    draftLoadedRef.current = true;
    const stored = localStorage.getItem(draftStorageKey);
    if (!stored) {
      return;
    }
    try {
      const saved = JSON.parse(stored) as SavedAddSupplierDraft;
      if (saved.version !== addSupplierDraftStorageVersion) {
        return;
      }
      const nextBulkItems = Array.isArray(saved.bulkItems)
        ? saved.bulkItems.map((item) => ({ ...item, form: normalizeFormState(item.form) }))
        : [];
      const nextBulkEditIndex =
        typeof saved.bulkEditIndex === "number" && saved.bulkEditIndex >= 0 && saved.bulkEditIndex < nextBulkItems.length
          ? saved.bulkEditIndex
          : null;
      setForm(normalizeFormState(saved.form));
      setStep(typeof saved.step === "number" ? Math.min(5, Math.max(0, saved.step)) : 0);
      setBulkItems(nextBulkItems);
      setBulkEditIndex(nextBulkEditIndex);
      setImportSummary(saved.importSummary || (nextBulkItems.length ? t("supplierBulkImportApplied", { count: nextBulkItems.length }) : ""));
      setMessage(t("addSupplierDraftRestored"));
    } catch {
      localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, submissionId, supplierId, t]);

  useEffect(() => {
    if (!draftStorageKey || submissionId || supplierId || !draftLoadedRef.current) {
      return;
    }
    const hasDraft = bulkItems.length > 0 || bulkEditIndex !== null || importSummary || !isBlankForm(form);
    if (!hasDraft) {
      localStorage.removeItem(draftStorageKey);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const payload: SavedAddSupplierDraft = {
        bulkEditIndex,
        bulkItems,
        form,
        importSummary,
        savedAt: new Date().toISOString(),
        step,
        version: addSupplierDraftStorageVersion,
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [bulkEditIndex, bulkItems, draftStorageKey, form, importSummary, step, submissionId, supplierId]);

  useEffect(() => {
    if (step !== 5) {
      return;
    }
    const key = `${draft.normalizedName}|${draft.normalizedPhones.join(",")}|${draft.normalizedEmail}|${draft.facebook}`;
    if (!draft.nameOriginal || key === checkedKey) {
      return;
    }
    setCheckedKey(key);
    void runDuplicateCheck();
  }, [step, draft, checkedKey]);

  useEffect(() => {
    if (!submissionId || !firebaseUser) {
      return;
    }
    setBusy(true);
    void getSupplierSubmission(submissionId)
      .then((submission) => {
        if (!submission || submission.submittedBy !== firebaseUser.uid || submission.submissionStatus !== "needs_correction") {
          setMessage(t("supplierSubmissionCannotEdit"));
          return;
        }
        setForm(formFromDraft(submission.supplierData));
        setDuplicateCheck(submission.duplicateCheck || { hasPossibleDuplicate: false, matches: [] });
        setStep(5);
        setImportSummary("");
        setBulkItems([]);
      })
      .finally(() => setBusy(false));
  }, [firebaseUser, submissionId, t]);

  useEffect(() => {
    if (!supplierId || !firebaseUser || !isAdmin) {
      return;
    }
    setBusy(true);
    void getSupplier(supplierId)
      .then((supplier) => {
        if (!supplier) {
          setMessage(t("supplierNotFound"));
          return;
        }
        const nextForm = formFromDraft(supplier);
        setForm(nextForm);
        setApprovedSupplierOriginalForm(nextForm);
        setDuplicateCheck({ hasPossibleDuplicate: false, matches: [] });
        setStep(0);
        setImportSummary("");
        setBulkItems([]);
      })
      .catch((reason) => setMessage(reason instanceof Error ? reason.message : t("supplierNotFound")))
      .finally(() => setBusy(false));
  }, [firebaseUser, isAdmin, supplierId, t]);

  if (appUser?.role === "viewer" || appUser?.status === "suspended") {
    return (
      <Section title={t("addSupplier")} description={t("noAccessBody")}>
        <div className="rounded-md border border-amber/40 bg-amber/10 p-4 text-sm font-semibold text-ink">
          {t("noAccessTitle")}
        </div>
      </Section>
    );
  }

  function setValue<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function clearSavedDraft() {
    if (draftStorageKey) {
      localStorage.removeItem(draftStorageKey);
    }
  }

  function resetAddSupplierPage() {
    if (!window.confirm(t(isApprovedEditMode ? "confirmResetSupplierChanges" : "confirmResetAddSupplierPage"))) {
      return;
    }
    clearSavedDraft();
    setForm(isApprovedEditMode && approvedSupplierOriginalForm ? approvedSupplierOriginalForm : initialForm);
    setStep(0);
    setDuplicateCheck({ hasPossibleDuplicate: false, matches: [] });
    setCheckedKey("");
    setImportSummary("");
    setBulkItems([]);
    setBulkEditIndex(null);
    setMessage(t(isApprovedEditMode ? "supplierChangesReset" : "addSupplierDraftReset"));
  }

  function firstMissingStep(keys: string[]) {
    if (keys.some((key) => ["supplierName"].includes(key))) return 0;
    if (keys.some((key) => ["governorate", "cityOrMarketArea"].includes(key))) return 1;
    if (keys.some((key) => ["contactMethod"].includes(key))) return 2;
    if (keys.some((key) => ["mainCategory", "capabilityTag"].includes(key))) return 3;
    if (keys.some((key) => ["sourceType", "confidenceLevel"].includes(key))) return 4;
    return 5;
  }

  function openBulkEdit(index: number) {
    const item = bulkItems[index];
    if (!item) {
      return;
    }
    setBulkEditIndex(index);
    setForm(normalizeFormState(item.form));
    setDuplicateCheck(item.duplicateCheck);
    setCheckedKey("");
    setStep(firstMissingStep(item.missing));
    setMessage("");
  }

  function closeBulkEdit() {
    setBulkEditIndex(null);
    setForm(initialForm);
    setDuplicateCheck({ hasPossibleDuplicate: false, matches: [] });
    setCheckedKey("");
    setStep(5);
  }

  async function evaluateBulkForm(input: FormState) {
    const itemDraft = buildDraft(input);
    const indexes = await fetchDuplicateIndexes();
    const matches = findDuplicateMatches(itemDraft, indexes);
    return {
      draft: itemDraft,
      missing: missingRequiredSupplierFieldKeys(itemDraft),
      duplicateCheck: { hasPossibleDuplicate: matches.length > 0, matches },
    };
  }

  async function saveBulkEdit() {
    if (bulkEditIndex === null) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const evaluated = await evaluateBulkForm(form);
      setBulkItems((current) =>
        current.map((item, index) =>
          index === bulkEditIndex
            ? { ...item, form, missing: evaluated.missing, duplicateCheck: evaluated.duplicateCheck }
            : item,
        ),
      );
      closeBulkEdit();
      setMessage(t("supplierBulkItemSaved"));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t("supplierSubmitFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitBulkItem(index: number, inputForm?: FormState) {
    if (!firebaseUser) {
      return;
    }
    const item = bulkItems[index];
    if (!item) {
      return;
    }
    const itemForm = inputForm || item.form;
    const itemDraft = buildDraft(itemForm);
    const itemMissing = missingRequiredSupplierFieldKeys(itemDraft);
    if (itemMissing.length) {
      setMessage(t("missingRequiredFields", { fields: itemMissing.map((field) => t(field)).join(", ") }));
      if (inputForm) {
        setStep(firstMissingStep(itemMissing));
      } else {
        openBulkEdit(index);
      }
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const evaluated = await evaluateBulkForm(itemForm);
      await submitSupplierDraft(firebaseUser.uid, evaluated.draft, evaluated.duplicateCheck);
      const nextItems = bulkItems.filter((_, itemIndex) => itemIndex !== index);
      setBulkItems(nextItems);
      closeBulkEdit();
      setMessage(t("supplierBulkItemSubmitted"));
      if (!nextItems.length) {
        clearSavedDraft();
        setTimeout(() => navigate("/my-submissions"), 900);
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t("supplierSubmitFailed"));
    } finally {
      setBusy(false);
    }
  }

  function submitCurrentBulkEdit() {
    if (bulkEditIndex === null) {
      setMessage(t("supplierBulkNoActiveItem"));
      return;
    }
    void submitBulkItem(bulkEditIndex, form);
  }

  async function runDuplicateCheck() {
    const indexes = await fetchDuplicateIndexes();
    const matches = findDuplicateMatches(
      draft,
      supplierId ? indexes.filter((item) => item.supplierId !== supplierId) : indexes,
    );
    const nextCheck = { hasPossibleDuplicate: matches.length > 0, matches };
    setDuplicateCheck(nextCheck);
    return nextCheck;
  }

  async function handleWorkbookUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setMessage("");
    setImportSummary("");
    setBulkItems([]);
    setBulkEditIndex(null);
    if (file.size > supplierImportMaxSize) {
      setMessage(t("supplierImportTooLarge"));
      return;
    }
    setImporting(true);
    try {
      const workbook = await readWorkbookRows(file);
      const importOptions = {
        governorates: taxonomy.governorates,
        supplierCategories: taxonomy.supplierCategories,
      };
      const forms = extractSupplierImportForms(workbook.rows, form, importOptions);
      if (forms.length > 1) {
        const indexes = await fetchDuplicateIndexes();
        const bulk = forms.slice(0, 50).map((item) => {
          const itemDraft = buildDraft(item.form);
          const matches = findDuplicateMatches(itemDraft, indexes);
          return {
            form: item.form,
            rowNumber: item.rowNumber,
            missing: missingRequiredSupplierFieldKeys(itemDraft),
            duplicateCheck: { hasPossibleDuplicate: matches.length > 0, matches },
          };
        });
        setBulkItems(bulk);
        setBulkEditIndex(null);
        setStep(5);
        setImportSummary(t("supplierBulkImportApplied", { count: bulk.length }));
        return;
      }
      const imported = forms[0] || mergeWorkbookRowsIntoForm(workbook.rows, form, importOptions);
      if (!imported.matchedFields) {
        setMessage(t("supplierImportNoFields"));
        return;
      }
      setForm(imported.form);
      setStep(5);
      setCheckedKey("");
      setDuplicateCheck({ hasPossibleDuplicate: false, matches: [] });
      setImportSummary(t("supplierImportApplied", { count: imported.matchedFields }));
    } catch (reason) {
      const key = reason instanceof Error ? reason.message : "supplierImportFailed";
      setMessage(t(key, { defaultValue: t("supplierImportFailed") }));
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit() {
    if (!firebaseUser) {
      return;
    }
    setMessage("");
    if (missing.length) {
      setMessage(t("missingRequiredFields", { fields: missing.map((field) => t(field)).join(", ") }));
      setStep(0);
      return;
    }
    setBusy(true);
    try {
      const latestDuplicateCheck = await runDuplicateCheck();
      if (supplierId) {
        await updateApprovedSupplier(supplierId, firebaseUser.uid, draft);
        setApprovedSupplierOriginalForm(formFromDraft(draft));
        setMessage(t("approvedSupplierUpdated"));
        setTimeout(() => navigate("/admin/suppliers"), 700);
        return;
      }
      if (submissionId) {
        await resubmitSupplierSubmission(submissionId, firebaseUser.uid, draft, latestDuplicateCheck);
        setMessage(t("correctionResubmitted"));
      } else {
        await submitSupplierDraft(firebaseUser.uid, draft, latestDuplicateCheck);
        setMessage(t("submissionThanks"));
      }
      setForm(initialForm);
      clearSavedDraft();
      setTimeout(() => navigate("/my-submissions"), 700);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t("supplierSubmitFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkSubmit() {
    if (!firebaseUser || !bulkItems.length || bulkItems.some((item) => item.missing.length)) {
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      for (const item of bulkItems) {
        await submitSupplierDraft(firebaseUser.uid, buildDraft(item.form), item.duplicateCheck);
      }
      setMessage(t("supplierBulkSubmitted", { count: bulkItems.length }));
      setBulkItems([]);
      clearSavedDraft();
      setTimeout(() => navigate("/my-submissions"), 900);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : t("supplierSubmitFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title={isApprovedEditMode ? t("editApprovedSupplier") : t("addSupplier")}
      description={isApprovedEditMode ? t("editApprovedSupplierDescription") : t(steps[step])}
      actions={
        <Button type="button" variant="secondary" onClick={resetAddSupplierPage}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {isApprovedEditMode ? t("resetChanges") : t("resetAddSupplierPage")}
        </Button>
      }
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (isBulkEditing) {
            void saveBulkEdit();
            return;
          }
          void handleSubmit();
        }}
      >
        {!isApprovedEditMode ? <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-ink">{t("supplierImportTitle")}</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{t("supplierImportBody")}</p>
            </div>
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-river hover:text-river">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {importing ? t("loading") : t("supplierImportButton")}
              <input
                className="sr-only"
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                disabled={busy || importing}
                onChange={(event) => void handleWorkbookUpload(event)}
              />
            </label>
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-500">{t("supplierImportLimit")}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            <a className="text-river hover:text-ink" href="/templates/supplier-single-template-ar.xlsx" download>{t("downloadSingleArabicTemplate")}</a>
            <a className="text-river hover:text-ink" href="/templates/supplier-single-template-en.xlsx" download>{t("downloadSingleEnglishTemplate")}</a>
            <a className="text-river hover:text-ink" href="/templates/supplier-bulk-template-ar.xlsx" download>{t("downloadBulkArabicTemplate")}</a>
            <a className="text-river hover:text-ink" href="/templates/supplier-bulk-template-en.xlsx" download>{t("downloadBulkEnglishTemplate")}</a>
          </div>
          {importSummary ? (
            <div className="mt-3 rounded-md border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">
              {importSummary}
            </div>
          ) : null}
        </div> : null}

        {bulkItems.length && !isBulkEditing ? (
          <BulkImportPreview
            items={bulkItems}
            locale={locale}
            taxonomy={taxonomy}
            busy={busy}
            onCancel={() => {
              setBulkItems([]);
              setBulkEditIndex(null);
              clearSavedDraft();
            }}
            onEdit={openBulkEdit}
            onSubmitItem={(index) => void submitBulkItem(index)}
            onSubmit={() => void handleBulkSubmit()}
          />
        ) : (
          <>
        {isBulkEditing && bulkEditItem ? (
          <div className="rounded-md border border-river/20 bg-river/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-ink">{t("supplierBulkEditTitle")}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {t("supplierBulkEditBody", { row: bulkEditItem.rowNumber })}
                </p>
              </div>
              <Button disabled={busy} type="button" onClick={submitCurrentBulkEdit}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {t("sendThisSupplier")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[720px] grid-cols-6 gap-2">
            {steps.map((item, index) => (
              <button
                className={`grid min-h-14 gap-1 rounded-md border px-2 py-2 text-center text-xs font-bold transition ${
                  index === step
                    ? "border-river bg-river text-white"
                    : index < step
                      ? "border-mint/30 bg-mint/10 text-mint"
                      : "border-slate-200 bg-white text-slate-500 hover:border-river hover:text-river"
                }`}
                key={item}
                type="button"
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                <span>{index + 1}</span>
                <span>{t(item)}</span>
              </button>
            ))}
          </div>
        </div>

        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label={t("supplierName")} value={form.nameOriginal} onChange={(event) => setValue("nameOriginal", event.target.value)} required />
            <TextField label={t("displayName")} value={form.displayName} onChange={(event) => setValue("displayName", event.target.value)} required />
            <SelectField label={t("companyNameLanguage")} value={form.nameLanguage} onChange={(event) => setValue("nameLanguage", event.target.value as FormState["nameLanguage"])}>
              <option value="arabic">{t("nameLanguageArabic")}</option>
              <option value="english">{t("nameLanguageEnglish")}</option>
              <option value="mixed">{t("nameLanguageMixed")}</option>
            </SelectField>
            <SelectField label={t("businessType")} value={form.businessType} onChange={(event) => setValue("businessType", event.target.value)}>
              {businessTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(businessTypes, item.value, locale)}
                </option>
              ))}
            </SelectField>
            <TextField label={t("arabicCompanyName")} value={form.nameAr} onChange={(event) => setValue("nameAr", event.target.value)} />
            <TextField label={t("englishCompanyName")} value={form.nameEn} onChange={(event) => setValue("nameEn", event.target.value)} />
            <TextAreaField className="md:col-span-2" label={t("shortDescription")} value={form.shortDescription} onChange={(event) => setValue("shortDescription", event.target.value)} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-bold text-slate-700">{t("governorate")}</div>
              <ChipGroup options={taxonomy.governorates.map(option)} values={form.governorates} onChange={(values) => setValue("governorates", values)} />
            </div>
            <TextField label={t("city")} value={form.city} onChange={(event) => setValue("city", event.target.value)} required />
            <TextField label={t("marketArea")} value={form.marketArea} onChange={(event) => setValue("marketArea", event.target.value)} required />
            <TextField label={t("googleMapsLink")} value={form.googleMapsLink} onChange={(event) => setValue("googleMapsLink", event.target.value)} type="url" />
            <TextAreaField className="md:col-span-2" label={t("address")} value={form.address} onChange={(event) => setValue("address", event.target.value)} />
            <div className="md:col-span-2">
              <div className="mb-2 text-sm font-bold text-slate-700">{t("coverageAreas")}</div>
              <ChipGroup options={coverageAreas.map(option)} values={form.coverageAreas} onChange={(values) => setValue("coverageAreas", values)} />
            </div>
            <div className="grid gap-3 border-t border-slate-200 pt-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-ink">{t("supplierBranches")}</div>
                  <p className="mt-1 text-sm text-slate-500">{t("supplierBranchesDescription")}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setValue("branches", [
                    ...form.branches,
                    { governorate: "", city: "", marketArea: "", address: "", phone: "" },
                  ])}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("addBranch")}
                </Button>
              </div>
              {form.branches.map((branch, index) => (
                <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2" key={index}>
                  <SelectField
                    label={t("governorate")}
                    value={branch.governorate}
                    onChange={(event) => setValue("branches", form.branches.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, governorate: event.target.value } : item
                    ))}
                  >
                    <option value=""></option>
                    {taxonomy.governorates.map((item) => (
                      <option key={item.value} value={item.value}>{labelFor(taxonomy.governorates, item.value, locale)}</option>
                    ))}
                  </SelectField>
                  <TextField
                    label={t("city")}
                    value={branch.city}
                    onChange={(event) => setValue("branches", form.branches.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, city: event.target.value } : item
                    ))}
                  />
                  <TextField
                    label={t("marketArea")}
                    value={branch.marketArea}
                    onChange={(event) => setValue("branches", form.branches.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, marketArea: event.target.value } : item
                    ))}
                  />
                  <TextField
                    label={t("phone")}
                    value={branch.phone}
                    onChange={(event) => setValue("branches", form.branches.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, phone: event.target.value } : item
                    ))}
                  />
                  <TextField
                    className="md:col-span-2"
                    label={t("address")}
                    value={branch.address}
                    onChange={(event) => setValue("branches", form.branches.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, address: event.target.value } : item
                    ))}
                  />
                  <div className="md:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setValue("branches", form.branches.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {t("removeBranch")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label={t("primaryPhone")} value={form.primaryPhone} onChange={(event) => setValue("primaryPhone", event.target.value)} />
            <TextField label={t("secondaryPhone")} value={form.secondaryPhone} onChange={(event) => setValue("secondaryPhone", event.target.value)} />
            <SelectField label={t("whatsapp")} value={form.whatsappAvailable} onChange={(event) => setValue("whatsappAvailable", event.target.value as FormState["whatsappAvailable"])}>
              <option value="yes">{t("yes")}</option>
              <option value="no">{t("no")}</option>
              <option value="unknown">{t("unknown")}</option>
            </SelectField>
            <TextField label={t("email")} value={form.email} onChange={(event) => setValue("email", event.target.value)} type="email" />
            <TextField label={t("website")} value={form.website} onChange={(event) => setValue("website", event.target.value)} type="url" />
            <TextField label={t("facebook")} value={form.facebook} onChange={(event) => setValue("facebook", event.target.value)} />
            <TextField label={t("instagramLinkedin")} value={form.instagramLinkedin} onChange={(event) => setValue("instagramLinkedin", event.target.value)} />
            <TextField label={t("contactPerson")} value={form.contactPerson} onChange={(event) => setValue("contactPerson", event.target.value)} />
            <TextField label={t("contactPersonRole")} value={form.contactPersonRole} onChange={(event) => setValue("contactPersonRole", event.target.value)} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4">
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700">{t("mainCategory")}</div>
              <ChipGroup options={taxonomy.supplierCategories.map(option)} values={form.mainCategories} onChange={(values) => setValue("mainCategories", values)} />
            </div>
            <TextField label={t("subcategories")} value={form.subcategories} onChange={(event) => setValue("subcategories", event.target.value)} placeholder={t("subcategoriesPlaceholder")} />
            <div className="grid gap-4">
              <div className="text-sm font-bold text-slate-700">{t("capabilityTags")}</div>
              {supplierCapabilityGroups.map((group) => {
                const groupValues = new Set<string>(group.values);
                const selected = form.capabilityTags.filter((value) => groupValues.has(value));
                const options = capabilityTags.filter((item) => groupValues.has(item.value)).map(option);
                return (
                  <div className="rounded-md border border-slate-200 p-3" key={group.labelKey}>
                    <div className="mb-2 text-xs font-bold text-slate-500">{t(group.labelKey)}</div>
                    <ChipGroup
                      options={options}
                      values={selected}
                      onChange={(values) => setValue("capabilityTags", [
                        ...form.capabilityTags.filter((value) => !groupValues.has(value)),
                        ...values,
                      ])}
                    />
                  </div>
                );
              })}
            </div>
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700">{t("paymentOptions")}</div>
              <ChipGroup options={paymentOptions.map(option)} values={form.paymentOptions} onChange={(values) => setValue("paymentOptions", values)} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label={t("acceptsCredit")} value={form.acceptsCredit} onChange={(event) => setValue("acceptsCredit", event.target.value as FormState["acceptsCredit"])}>
                <option value="unknown">{t("unknown")}</option>
                <option value="yes">{t("yes")}</option>
                <option value="no">{t("no")}</option>
              </SelectField>
              <TextField
                label={t("creditDays")}
                value={form.creditDays}
                onChange={(event) => setValue("creditDays", event.target.value)}
                placeholder={t("creditDaysPlaceholder")}
                disabled={form.acceptsCredit === "no"}
              />
              <SelectField label={t("creditStart")} value={form.creditStart} onChange={(event) => setValue("creditStart", event.target.value)} disabled={form.acceptsCredit === "no"}>
                <option value=""></option>
                {creditStarts.map((item) => (
                  <option key={item.value} value={item.value}>{labelFor(creditStarts, item.value, locale)}</option>
                ))}
              </SelectField>
              <TextAreaField
                className="md:col-span-3"
                label={t("creditTermsNote")}
                value={form.creditTermsNote}
                onChange={(event) => setValue("creditTermsNote", event.target.value)}
                disabled={form.acceptsCredit === "no"}
              />
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label={t("sourceType")} value={form.sourceType} onChange={(event) => setValue("sourceType", event.target.value)} required>
              <option value=""></option>
              {sourceTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(sourceTypes, item.value, locale)}
                </option>
              ))}
            </SelectField>
            <SelectField label={t("confidenceLevel")} value={form.confidenceLevel} onChange={(event) => setValue("confidenceLevel", event.target.value)} required>
              <option value=""></option>
              {confidenceLevels.map((item) => (
                <option key={item.value} value={item.value}>
                  {labelFor(confidenceLevels, item.value, locale)}
                </option>
              ))}
            </SelectField>
            <SelectField label={t("directExperience")} value={form.hasDirectExperience} onChange={(event) => setValue("hasDirectExperience", event.target.value as FormState["hasDirectExperience"])}>
              <option value="yes">{t("yes")}</option>
              <option value="no">{t("no")}</option>
              <option value="not_sure">{t("notSure")}</option>
            </SelectField>
            <TextField label={t("lastInteractionYear")} value={form.lastInteractionYear} onChange={(event) => setValue("lastInteractionYear", event.target.value)} inputMode="numeric" />
            <TextField label={t("relatedMaterialService")} value={form.relatedMaterialService} onChange={(event) => setValue("relatedMaterialService", event.target.value)} />
            <TextAreaField label={t("sourceNote")} value={form.sourceNote} onChange={(event) => setValue("sourceNote", event.target.value)} />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-md border border-slate-200 p-4">
                <div className="text-xs font-bold uppercase text-slate-500">{t("completionScore")}</div>
                <div className="mt-2 text-3xl font-black text-ink">{draft.completionScore}%</div>
              </div>
              <div className="rounded-md border border-slate-200 p-4">
                <div className="text-xs font-bold uppercase text-slate-500">{t("mainCategory")}</div>
                <div className="mt-2 font-bold text-ink">
                  {draft.categories.length ? draft.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ") : "-"}
                </div>
              </div>
              <div className="rounded-md border border-slate-200 p-4">
                <div className="text-xs font-bold uppercase text-slate-500">{t("confidence")}</div>
                <div className="mt-2 font-bold text-ink">{draft.confidenceLevel ? labelFor(confidenceLevels, draft.confidenceLevel, locale) : "-"}</div>
              </div>
            </div>

            {missing.length ? (
              <div className="rounded-md border border-clay/30 bg-clay/10 p-4 text-sm font-semibold text-clay">
                <AlertTriangle className="me-2 inline h-4 w-4" aria-hidden="true" />
                {t("missingRequiredFields", { fields: missing.map((field) => t(field)).join(", ") })}
              </div>
            ) : (
              <div className="rounded-md border border-mint/30 bg-mint/10 p-4 text-sm font-semibold text-mint">
                <CheckCircle2 className="me-2 inline h-4 w-4" aria-hidden="true" />
                {isApprovedEditMode ? t("readyToSave") : t("readyForAdminReview")}
              </div>
            )}

            {duplicateCheck.hasPossibleDuplicate ? (
              <div className="rounded-md border border-amber/40 bg-amber/10 p-4">
                <h3 className="font-bold text-ink">{t("duplicateWarning")}</h3>
                <div className="mt-3 grid gap-2">
                  {duplicateCheck.matches.map((match) => (
                    <div className="rounded border border-amber/30 bg-white p-3 text-sm" key={`${match.supplierId}-${match.reason}`}>
                      <div className="font-bold text-ink">{match.supplierName}</div>
                      <div className="text-slate-600">
                        {t("duplicateReason")}: {t(`duplicate_${match.reason}`)} · {t(match.confidence)} · {match.score}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {t("noDuplicateWarning")}
              </div>
            )}
          </div>
        ) : null}

        {message ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">{message}</div> : null}

        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
          <Button disabled={step === 0 || busy} type="button" variant="secondary" onClick={() => setStep((current) => Math.max(0, current - 1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t("back", { defaultValue: "Back" })}
          </Button>
          {step < 5 ? (
            <Button type="button" onClick={() => setStep((current) => Math.min(5, current + 1))}>
              {t("next")}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : isBulkEditing ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} type="button" variant="secondary" onClick={closeBulkEdit}>
                {t("backToBulkReview")}
              </Button>
              <Button disabled={busy} type="button" variant="secondary" onClick={() => void saveBulkEdit()}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {t("saveAndReturn")}
              </Button>
              <Button disabled={busy} type="button" onClick={submitCurrentBulkEdit}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {t("sendThisSupplier")}
              </Button>
            </div>
          ) : (
            <Button disabled={busy || missing.length > 0} type="submit">
              {isApprovedEditMode ? <Save className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {isApprovedEditMode ? t("saveChanges") : t("submitForReview")}
            </Button>
          )}
        </div>
          </>
        )}
      </form>
    </Section>
  );
}

function BulkImportPreview({
  items,
  locale,
  taxonomy,
  busy,
  onCancel,
  onEdit,
  onSubmitItem,
  onSubmit,
}: {
  items: BulkImportItem[];
  locale: "ar" | "en";
  taxonomy: SupplierImportOptions;
  busy: boolean;
  onCancel: () => void;
  onEdit: (index: number) => void;
  onSubmitItem: (index: number) => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const invalidCount = items.filter((item) => item.missing.length).length;
  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-bold text-ink">{t("supplierBulkReviewTitle")}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {t("supplierBulkReviewBody", { count: items.length, invalid: invalidCount })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button disabled={busy || invalidCount > 0} type="button" onClick={onSubmit}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("supplierBulkSubmit", { count: items.length })}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-start">{t("row")}</th>
              <th className="px-3 py-2 text-start">{t("supplierName")}</th>
              <th className="px-3 py-2 text-start">{t("governorate")}</th>
              <th className="px-3 py-2 text-start">{t("mainCategory")}</th>
              <th className="px-3 py-2 text-start">{t("status")}</th>
              <th className="px-3 py-2 text-start">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((item, index) => {
              const draft = buildDraft(item.form);
              return (
                <tr key={item.rowNumber}>
                  <td className="px-3 py-3 font-semibold text-slate-500">{item.rowNumber}</td>
                  <td className="px-3 py-3">
                    <button
                      className="text-start font-bold text-river hover:text-ink"
                      type="button"
                      onClick={() => onEdit(index)}
                    >
                      {draft.displayName || draft.nameOriginal || "-"}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {(draft.governorates?.length ? draft.governorates : draft.governorate ? [draft.governorate] : []).map((governorate) => labelFor(taxonomy.governorates, governorate, locale)).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {draft.categories.length ? draft.categories.map((category) => labelFor(taxonomy.supplierCategories, category, locale)).join(", ") : "-"}
                  </td>
                  <td className="px-3 py-3">
                    {item.missing.length ? (
                      <span className="font-semibold text-clay">
                        {t("missingRequiredFields", { fields: item.missing.map((field) => t(field)).join(", ") })}
                      </span>
                    ) : item.duplicateCheck.hasPossibleDuplicate ? (
                      <span className="font-semibold text-amber">{t("duplicateWarning")}</span>
                    ) : (
                      <span className="font-semibold text-mint">{t("readyForAdminReview")}</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button className="min-h-9 px-3" disabled={busy} type="button" variant="secondary" onClick={() => onEdit(index)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        {t("edit")}
                      </Button>
                      <Button className="min-h-9 px-3" disabled={busy} type="button" onClick={() => onSubmitItem(index)}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        {t("sendThisSupplier")}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildDraft(form: FormState): SupplierDraft {
  const phones = [form.primaryPhone, form.secondaryPhone].map((item) => item.trim()).filter(Boolean);
  const normalizedPhones = Array.from(new Set(phones.map(normalizePhone).filter(Boolean)));
  const branches = (form.branches || [])
    .map((branch) => ({
      governorate: branch.governorate.trim(),
      city: branch.city.trim(),
      marketArea: branch.marketArea.trim(),
      address: branch.address.trim(),
      phone: branch.phone.trim(),
    }))
    .filter((branch) => branch.governorate || branch.city || branch.marketArea || branch.address || branch.phone);
  const governorates = Array.from(new Set([
    ...form.governorates.filter(Boolean),
    ...branches.map((branch) => branch.governorate).filter(Boolean),
  ]));
  const categories = form.mainCategories.filter(Boolean);
  const creditDays = Array.from(
    new Set(
      form.creditDays
        .split(/[,\s]+/)
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isFinite(item) && item > 0 && item <= 365),
    ),
  ).sort((a, b) => a - b);
  const subcategories = form.subcategories
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const baseDraft = {
    nameOriginal: form.nameOriginal.trim(),
    displayName: form.displayName.trim() || form.nameOriginal.trim(),
    nameLanguage: form.nameLanguage,
    nameAr: form.nameAr.trim(),
    nameEn: form.nameEn.trim(),
    shortDescription: form.shortDescription.trim(),
    businessType: form.businessType as SupplierDraft["businessType"],
    governorate: governorates[0] || "",
    governorates,
    branches,
    city: form.city.trim(),
    marketArea: form.marketArea.trim(),
    address: form.address.trim(),
    googleMapsLink: form.googleMapsLink.trim(),
    coverageAreas: form.coverageAreas,
    phones,
    normalizedPhones,
    whatsappAvailable: form.whatsappAvailable,
    email: form.email.trim(),
    normalizedEmail: normalizeEmail(form.email),
    website: form.website.trim(),
    facebook: form.facebook.trim(),
    instagramLinkedin: form.instagramLinkedin.trim(),
    contactPerson: form.contactPerson.trim(),
    contactPersonRole: form.contactPersonRole.trim(),
    categories,
    subcategories,
    capabilityTags: form.capabilityTags,
    paymentOptions: form.paymentOptions,
    ...(form.acceptsCredit === "unknown" ? {} : { acceptsCredit: form.acceptsCredit === "yes" }),
    creditDays: form.acceptsCredit === "yes" ? creditDays : [],
    ...(form.acceptsCredit === "yes" && form.creditStart
      ? { creditStart: form.creditStart as SupplierDraft["creditStart"] }
      : {}),
    creditTermsNote: form.acceptsCredit === "yes" ? form.creditTermsNote.trim() : "",
    sourceType: form.sourceType as SupplierDraft["sourceType"],
    confidenceLevel: form.confidenceLevel as SupplierDraft["confidenceLevel"],
    hasDirectExperience: form.hasDirectExperience,
    lastInteractionYear: form.lastInteractionYear.trim(),
    relatedMaterialService: form.relatedMaterialService.trim(),
    sourceNote: form.sourceNote.trim(),
    normalizedName: normalizeName(`${form.nameOriginal} ${form.nameAr} ${form.nameEn}`),
    searchKeywords: [],
    completionScore: 0,
  };
  return {
    ...baseDraft,
    searchKeywords: createSearchKeywords(baseDraft),
    completionScore: calculateCompletionScore(baseDraft),
  };
}

function formFromDraft(draft: SupplierDraft): FormState {
  return {
    nameOriginal: draft.nameOriginal || "",
    displayName: draft.displayName || draft.nameOriginal || "",
    nameLanguage: draft.nameLanguage || "mixed",
    nameAr: draft.nameAr || "",
    nameEn: draft.nameEn || "",
    shortDescription: draft.shortDescription || "",
    businessType: draft.businessType || "company",
    governorates: draft.governorates?.length ? draft.governorates : draft.governorate ? [draft.governorate] : [],
    branches: (draft.branches || []).map((branch) => ({
      governorate: branch.governorate || "",
      city: branch.city || "",
      marketArea: branch.marketArea || "",
      address: branch.address || "",
      phone: branch.phone || "",
    })),
    city: draft.city || "",
    marketArea: draft.marketArea || "",
    address: draft.address || "",
    googleMapsLink: draft.googleMapsLink || "",
    coverageAreas: draft.coverageAreas || [],
    primaryPhone: draft.phones?.[0] || "",
    secondaryPhone: draft.phones?.[1] || "",
    whatsappAvailable: draft.whatsappAvailable || "unknown",
    email: draft.email || "",
    website: draft.website || "",
    facebook: draft.facebook || "",
    instagramLinkedin: draft.instagramLinkedin || "",
    contactPerson: draft.contactPerson || "",
    contactPersonRole: draft.contactPersonRole || "",
    mainCategories: draft.categories || [],
    subcategories: draft.subcategories?.join(", ") || "",
    capabilityTags: draft.capabilityTags || [],
    paymentOptions: draft.paymentOptions || [],
    acceptsCredit: draft.acceptsCredit === true ? "yes" : draft.acceptsCredit === false ? "no" : "unknown",
    creditDays: draft.creditDays?.join(", ") || "",
    creditStart: draft.creditStart || "",
    creditTermsNote: draft.creditTermsNote || "",
    sourceType: draft.sourceType || "",
    confidenceLevel: draft.confidenceLevel || "",
    hasDirectExperience: draft.hasDirectExperience || "not_sure",
    lastInteractionYear: draft.lastInteractionYear || "",
    relatedMaterialService: draft.relatedMaterialService || "",
    sourceNote: draft.sourceNote || "",
  };
}

function isBlankForm(value: FormState) {
  return JSON.stringify(value) === JSON.stringify(initialForm);
}

type SupplierImportOptions = {
  governorates: OptionItem[];
  supplierCategories: OptionItem[];
};

type SupplierImportedForm = {
  form: FormState;
  matchedFields: number;
  rowNumber: number;
};

const supplierImportAliases: Partial<Record<keyof FormState, string[]>> = {
  nameOriginal: ["supplier name", "company name", "supplier", "company", "name", "اسم المجهز", "اسم الشركة", "الشركة", "المجهز"],
  displayName: ["display name", "public name", "short name", "الاسم الظاهر", "اسم العرض", "الاسم المختصر"],
  nameLanguage: ["company name language", "name language", "لغة اسم الشركة", "لغة الاسم"],
  nameAr: ["arabic company name", "arabic name", "اسم الشركة بالعربية", "الاسم العربي"],
  nameEn: ["english company name", "english name", "اسم الشركة بالانجليزية", "اسم الشركة بالإنجليزية", "الاسم الانكليزي", "الاسم الإنجليزي"],
  shortDescription: ["short description", "description", "notes", "وصف مختصر", "الوصف", "ملاحظات"],
  businessType: ["business type", "company type", "نوع النشاط", "نوع الشركة", "النوع"],
  governorates: ["governorate", "governorates", "province", "provinces", "branches", "branch governorates", "محافظة", "المحافظة", "المحافظات", "الفروع", "محافظات الفروع"],
  branches: ["branch details", "supplier branches", "branch locations", "تفاصيل الفروع", "فروع المجهز", "مواقع الفروع"],
  city: ["city", "town", "المدينة", "مدينة"],
  marketArea: ["market area", "main market", "area", "السوق", "منطقة السوق", "المنطقة", "السوق الرئيسي"],
  address: ["address", "full address", "العنوان", "العنوان الكامل"],
  googleMapsLink: ["google maps", "google maps link", "map link", "رابط خرائط", "رابط خرائط google", "رابط الموقع"],
  coverageAreas: ["coverage areas", "coverage", "نطاق التغطية", "مناطق التغطية"],
  primaryPhone: ["primary phone", "phone", "phones", "mobile", "contact phone", "contact method", "الهاتف", "رقم الهاتف", "الموبايل", "وسيلة الاتصال"],
  secondaryPhone: ["secondary phone", "second phone", "alternate phone", "الهاتف الثاني", "رقم الهاتف الثاني", "رقم بديل"],
  whatsappAvailable: ["whatsapp", "whatsapp available", "واتساب", "واتس اب", "واتساب متاح"],
  email: ["email", "e-mail", "mail", "البريد الالكتروني", "البريد الإلكتروني", "الايميل", "الإيميل"],
  website: ["website", "site", "web site", "الموقع الالكتروني", "الموقع الإلكتروني", "الموقع"],
  facebook: ["facebook", "facebook page", "fb", "فيسبوك", "صفحة فيسبوك"],
  instagramLinkedin: ["instagram", "linkedin", "instagram linkedin", "انستغرام", "لينكدان", "لينكدإن"],
  contactPerson: ["contact person", "representative", "مسؤول الاتصال", "الشخص المسؤول", "جهة الاتصال"],
  contactPersonRole: ["contact role", "contact person role", "contact title", "position", "صفة مسؤول الاتصال", "صفة الشخص المسؤول", "دور مسؤول الاتصال", "منصب", "الدور"],
  mainCategories: ["main category", "main categories", "maincategories", "main category codes", "category codes", "category", "categories", "specialization", "specialty", "sector", "التصنيف الرئيسي", "التصنيفات الرئيسية", "أكواد التصنيف", "التصنيف", "التصنيفات", "التخصص", "المجال"],
  subcategories: ["subcategories", "sub categories", "فرعي", "التصنيفات الفرعية", "تخصصات فرعية"],
  capabilityTags: ["capability tags", "capabilities", "tags", "وسوم القدرات", "القدرات", "الوسوم"],
  paymentOptions: ["payment options", "payment", "خيارات الدفع", "الدفع"],
  acceptsCredit: ["accepts credit", "credit payment", "deferred payment", "payment on credit", "دفع آجل", "دفع اجل", "يقبل الدفع الآجل", "ائتمان"],
  creditDays: ["credit days", "payment term days", "net days", "مدة الائتمان", "مدة الدفع", "أيام الدفع", "ايام الدفع"],
  creditStart: ["credit starts from", "payment term starts", "credit period starts", "credit start", "بدء الاستحقاق", "بداية مدة الدفع", "بداية مدة الدفع الآجل", "احتساب المدة"],
  creditTermsNote: ["credit terms note", "payment terms note", "credit note", "ملاحظات الدفع الآجل", "ملاحظات الدفع الاجل", "شروط الدفع"],
  sourceType: ["source of information", "source type", "source", "how do you know this supplier", "مصدر المعلومات", "المصدر", "كيف تعرف المجهز"],
  confidenceLevel: ["confidence level", "confidence", "مستوى الثقة", "الثقة"],
  hasDirectExperience: ["direct experience", "previous direct experience", "experience", "خبرة مباشرة", "تعامل مباشر", "تجربة سابقة"],
  lastInteractionYear: ["last interaction year", "year", "سنة اخر تعامل", "سنة آخر تعامل", "آخر تعامل"],
  relatedMaterialService: ["related material service", "related category or service", "related category", "category or service", "material", "service", "التصنيف أو الخدمة المرتبطة", "التصنيف او الخدمة المرتبطة", "المادة", "الخدمة", "المادة او الخدمة", "المادة أو الخدمة"],
  sourceNote: ["source note", "note", "ملاحظة المصدر", "ملاحظة", "تفاصيل المصدر"],
};

const optionImportSynonyms: Record<string, string[]> = {
  company: ["co", "business", "شركة"],
  office: ["مكتب"],
  workshop: ["ورشه", "ورشة"],
  factory: ["plant", "manufacturing", "manufacturer", "معمل", "مصنع"],
  trader: ["merchant", "تاجر"],
  authorized_distributor: ["distributor", "distributer", "authorized dealer", "authorised distributor", "agent", "dealer", "موزع", "موزع معتمد", "وكيل"],
  importer: ["import", "imports", "importer only", "مستورد", "استيراد"],
  service_provider: ["services", "service", "contractor", "مزود خدمة", "مقدم خدمات", "خدمات"],
  individual_supplier: ["individual", "person", "freelancer", "مجهز فردي", "فرد"],

  all_iraq: ["all iraq", "iraq", "nationwide", "all governorates", "كل العراق", "جميع العراق"],
  local_only: ["local", "local only", "محلي", "محلي فقط"],
  governorate_level: ["governorate", "province level", "within governorate", "ضمن المحافظة"],
  imports_outside_iraq: ["outside iraq", "international import", "imports abroad", "استيراد خارجي", "خارج العراق"],

  valves: ["valve", "valvs", "صمام", "صمامات"],
  mechanical_materials: ["mechanical", "mechanic", "mech", "مواد ميكانيكية", "ميكانيك"],
  electrical_materials: ["electrical", "electric", "elect", "مواد كهربائية", "كهرباء"],
  piping_materials: ["pipe", "pipes", "piping", "أنابيب", "انابيب"],
  flanges_fittings: ["flange", "flanges", "fitting", "fittings", "فلنج", "فلنجات", "وصلات"],
  instrumentation: ["instrument", "instruments", "control instruments", "قياس", "سيطرة", "تحكم"],
  civil_construction: ["civil", "construction", "building materials", "مواد انشائية", "مواد إنشائية"],
  steel_fabrication: ["steel", "fabrication", "metal works", "تصنيع", "حديد"],
  welding_machining: ["welding", "machining", "lathe", "لحام", "خراطة"],
  safety_ppe: ["safety", "ppe", "hse", "personal protective", "سلامة", "وقاية"],
  tools_equipment: ["tools", "equipment", "عدة", "عدد", "معدات"],
  heavy_equipment_rental: ["heavy equipment", "rental", "rent", "تأجير معدات", "معدات ثقيلة"],
  transport_logistics: ["transport", "logistics", "shipping", "نقل", "لوجستيات"],
  office_supplies: ["office", "stationery", "مكتبية", "قرطاسية"],
  it_electronics: ["it", "electronics", "computer", "network", "تقنية", "الكترونيات", "إلكترونيات"],
  furniture: ["furnitures", "اثاث", "أثاث"],
  chemicals: ["chemical", "chem", "مواد كيمياوية", "مواد كيميائية"],
  oil_gas_materials: ["oil gas", "oil and gas", "petroleum", "نفط", "غاز"],
  power_plant_materials: ["power", "power plant", "محطات الطاقة", "طاقة"],
  general_trading: ["general trade", "trading", "تجارة عامة"],
  maintenance_services: ["maintenance", "repair service", "صيانة"],
  printing_advertising: ["printing", "advertising", "print", "طباعة", "اعلان", "إعلان"],

  local_stock: ["stock", "available stock", "inventory", "ready stock", "مخزون", "متوفر"],
  import_only: ["import only", "special order", "استيراد فقط"],
  custom_fabrication: ["custom", "fabricate", "fabrication", "تصنيع حسب الطلب"],
  fast_delivery: ["fast", "quick delivery", "urgent delivery", "تسليم سريع"],
  technical_support: ["technical", "tech support", "engineering support", "دعم فني"],
  site_visit: ["site visit", "visit", "زيارة موقع"],
  installation: ["install", "installation", "تنصيب", "تركيب"],
  warranty: ["guarantee", "warranty", "ضمان"],
  company_profile: ["profile", "company profile", "بروفايل", "ملف تعريفي"],
  project_experience: ["project experience", "previous projects", "خبرة مشاريع", "مشاريع سابقة"],
  obsolete_items: ["obsolete", "rare", "hard to find", "نادر", "متوقف"],
  repair_overhaul: ["repair", "overhaul", "اصلاح", "إصلاح", "تأهيل"],
  emergency_sourcing: ["emergency", "urgent", "طارئ", "طوارئ"],
  works_ngos: ["ngo", "ngos", "منظمات"],
  works_construction: ["construction companies", "contractors", "شركات إنشائية"],
  works_oil_gas: ["oil gas", "oil and gas", "نفط وغاز"],
  works_power_plants: ["power plants", "محطات الطاقة"],

  cash: ["cash payment", "cash", "نقد", "نقدا", "نقداً"],
  bank_transfer: ["bank", "bank transfer", "wire transfer", "transfer", "تحويل", "تحويل مصرفي"],
  usd: ["dollar", "dollars", "usd", "دولار"],
  iqd: ["dinar", "iraqi dinar", "iqd", "دينار"],
  official_invoice: ["invoice", "official invoice", "فاتورة", "فاتورة رسمية"],

  invoice_date: ["invoice", "invoice date", "from invoice", "تاريخ الفاتورة", "من الفاتورة"],
  delivery_date: ["delivery", "delivery date", "receipt date", "تاريخ الاستلام", "من الاستلام"],
  invoice_approval: ["invoice approval", "approved invoice", "اعتماد الفاتورة"],

  purchased_before: ["purchased", "bought", "buy", "past purchase", "تعامل سابق", "شراء سابق", "اشتريت"],
  requested_quotation: ["quotation", "quote", "rfq", "offer", "price offer", "عرض سعر", "تسعيرة"],
  trusted_recommendation: ["recommendation", "recommended", "referral", "trusted referral", "توصية", "مرشح"],
  market_visit: ["market", "market visit", "visited market", "زيارة السوق", "سوق"],
  found_online: ["online", "internet", "web", "website", "found online", "facebook", "linkedin", "انترنت", "إنترنت", "اونلاين", "أونلاين"],
  known_market_supplier: ["known", "known supplier", "market supplier", "معروف", "معروف بالسوق"],

  high: ["strong", "trusted", "sure", "good", "عالي", "عالية", "موثوق"],
  medium: ["average", "moderate", "middle", "متوسط", "متوسطة"],
  low: ["weak", "poor", "low confidence", "ضعيف", "منخفض"],
  needs_verification: ["verify", "verification", "needs check", "not verified", "تحتاج تحقق", "غير مؤكد"],
};

function extractSupplierImportForms(rows: string[][], current: FormState, options: SupplierImportOptions): SupplierImportedForm[] {
  const headerRowIndex = rows.findIndex((row) => row.filter((cell) => lookupSupplierImportField(cell)).length >= 3);
  if (headerRowIndex < 0) {
    return [mergeWorkbookRowsIntoForm(rows, current, options)];
  }

  const headers = rows[headerRowIndex];
  const forms = rows
    .slice(headerRowIndex + 1)
    .map((row, index) => {
      const fields: Partial<Record<keyof FormState, string>> = {};
      headers.forEach((header, cellIndex) => {
        const key = lookupSupplierImportField(header);
        const value = row[cellIndex]?.trim();
        if (key && value) {
          fields[key] = value;
        }
      });
      return {
        ...fieldsToForm(fields, initialForm, options),
        rowNumber: headerRowIndex + index + 2,
      };
    })
    .filter((item) => item.matchedFields > 0)
    .slice(0, 50);

  return forms.length ? forms : [mergeWorkbookRowsIntoForm(rows, current, options)];
}

function mergeWorkbookRowsIntoForm(rows: string[][], current: FormState, options: SupplierImportOptions): SupplierImportedForm {
  return {
    ...fieldsToForm(extractSupplierImportFields(rows), current, options),
    rowNumber: 1,
  };
}

function fieldsToForm(fields: Partial<Record<keyof FormState, string>>, current: FormState, options: SupplierImportOptions) {
  const next: FormState = { ...current, branches: [...(current.branches || [])] };
  let matchedFields = 0;

  const setText = (key: keyof FormState, value?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    if (next[key] !== trimmed) {
      matchedFields += 1;
    }
    (next[key] as string) = trimmed;
  };

  setText("nameOriginal", fields.nameOriginal);
  setText("displayName", fields.displayName);
  setText("nameAr", fields.nameAr);
  setText("nameEn", fields.nameEn);
  setText("shortDescription", fields.shortDescription);
  setText("city", fields.city);
  setText("marketArea", fields.marketArea);
  setText("address", fields.address);
  setText("googleMapsLink", fields.googleMapsLink);
  setText("secondaryPhone", fields.secondaryPhone);
  setText("email", fields.email);
  setText("website", fields.website);
  setText("facebook", fields.facebook);
  setText("instagramLinkedin", fields.instagramLinkedin);
  setText("contactPerson", fields.contactPerson);
  setText("contactPersonRole", fields.contactPersonRole);
  setText("subcategories", fields.subcategories);
  setText("creditDays", fields.creditDays);
  setText("creditTermsNote", fields.creditTermsNote);
  setText("lastInteractionYear", fields.lastInteractionYear);
  setText("relatedMaterialService", fields.relatedMaterialService);
  setText("sourceNote", fields.sourceNote);

  if (fields.primaryPhone) {
    if (fields.primaryPhone.includes("@")) {
      setText("email", fields.primaryPhone);
    } else {
      const phones = splitImportList(fields.primaryPhone);
      setText("primaryPhone", phones[0]);
      setText("secondaryPhone", fields.secondaryPhone || phones[1]);
    }
  }

  const nameLanguage = matchNameLanguage(fields.nameLanguage);
  if (nameLanguage) {
    next.nameLanguage = nameLanguage;
    matchedFields += 1;
  }

  const businessType = matchOptionValue(fields.businessType, businessTypes);
  if (businessType) {
    next.businessType = businessType;
    matchedFields += 1;
  }

  const governoratesList = mergeOptionList(next.governorates, fields.governorates, options.governorates);
  if (governoratesList.length > next.governorates.length) {
    matchedFields += 1;
  }
  next.governorates = governoratesList;

  const importedBranches = parseImportedBranches(fields.branches, options.governorates);
  if (importedBranches.length) {
    const branchKeys = new Set(next.branches.map((branch) => JSON.stringify(branch)));
    importedBranches.forEach((branch) => {
      const key = JSON.stringify(branch);
      if (!branchKeys.has(key)) {
        next.branches.push(branch);
        branchKeys.add(key);
        matchedFields += 1;
      }
    });
    next.governorates = Array.from(new Set([
      ...next.governorates,
      ...importedBranches.map((branch) => branch.governorate).filter(Boolean),
    ]));
  }

  const mainCategoriesList = mergeOptionList(next.mainCategories, fields.mainCategories, options.supplierCategories);
  if (mainCategoriesList.length > next.mainCategories.length) {
    matchedFields += 1;
  }
  next.mainCategories = mainCategoriesList;

  const sourceType = matchOptionValue(fields.sourceType, sourceTypes);
  if (sourceType) {
    next.sourceType = sourceType;
    matchedFields += 1;
  }

  const confidenceLevel = matchOptionValue(fields.confidenceLevel, confidenceLevels);
  if (confidenceLevel) {
    next.confidenceLevel = confidenceLevel;
    matchedFields += 1;
  }

  const whatsappAvailable = matchWhatsappAvailable(fields.whatsappAvailable);
  if (whatsappAvailable) {
    next.whatsappAvailable = whatsappAvailable;
    matchedFields += 1;
  }

  const hasDirectExperience = matchDirectExperience(fields.hasDirectExperience);
  if (hasDirectExperience) {
    next.hasDirectExperience = hasDirectExperience;
    matchedFields += 1;
  }

  const acceptsCredit = matchWhatsappAvailable(fields.acceptsCredit);
  if (acceptsCredit) {
    next.acceptsCredit = acceptsCredit;
    matchedFields += 1;
  }

  const creditStart = matchOptionValue(fields.creditStart, creditStarts);
  if (creditStart) {
    next.creditStart = creditStart;
    matchedFields += 1;
  }

  const coverageAreasList = mergeOptionList(next.coverageAreas, fields.coverageAreas, coverageAreas);
  const capabilityTagsList = mergeOptionList(next.capabilityTags, fields.capabilityTags, capabilityTags);
  const paymentOptionsList = mergeOptionList(next.paymentOptions, fields.paymentOptions, paymentOptions);
  if (coverageAreasList.length > next.coverageAreas.length) matchedFields += 1;
  if (capabilityTagsList.length > next.capabilityTags.length) matchedFields += 1;
  if (paymentOptionsList.length > next.paymentOptions.length) matchedFields += 1;
  next.coverageAreas = coverageAreasList;
  next.capabilityTags = capabilityTagsList;
  next.paymentOptions = paymentOptionsList;

  if (!next.displayName && next.nameOriginal) {
    next.displayName = next.nameOriginal;
  }

  return { form: next, matchedFields };
}

function extractSupplierImportFields(rows: string[][]) {
  const fields: Partial<Record<keyof FormState, string>> = {};
  const headerRowIndex = rows.findIndex((row) => row.filter((cell) => lookupSupplierImportField(cell)).length >= 3);
  if (headerRowIndex >= 0) {
    const dataRow = rows.slice(headerRowIndex + 1).find((row) => row.filter((cell) => cell?.trim()).length >= 2);
    if (dataRow) {
      rows[headerRowIndex].forEach((header, index) => {
        const key = lookupSupplierImportField(header);
        const value = dataRow[index]?.trim();
        if (key && value) {
          fields[key] = value;
        }
      });
    }
  }

  rows.forEach((row) => {
    const cells = row.map((cell) => cell?.trim() || "");
    if (cells.filter((cell) => lookupSupplierImportField(cell)).length >= 3) {
      return;
    }
    const candidates = [
      [cells[0], cells[1]],
      [cells[1], cells[2]],
    ];
    candidates.some(([label, value]) => {
      const key = lookupSupplierImportField(label);
      if (!key || !value || isImportHeaderValue(value)) {
        return false;
      }
      fields[key] = value;
      return true;
    });
  });

  return fields;
}

function lookupSupplierImportField(label?: string) {
  const normalized = normalizeImportText(label);
  if (!normalized) {
    return undefined;
  }
  const directKey = (Object.keys(initialForm) as Array<keyof FormState>).find((key) =>
    [key, key.replace(/([a-z])([A-Z])/g, "$1 $2")].some((candidate) => normalizeImportText(candidate) === normalized),
  );
  if (directKey) {
    return directKey;
  }
  const aliases = Object.entries(supplierImportAliases).flatMap(([key, values]) =>
    (values || []).map((value) => ({ key: key as keyof FormState, value: normalizeImportText(value) })),
  );
  const exact = aliases.find((alias) => alias.value === normalized);
  if (exact) {
    return exact.key;
  }
  return aliases
    .filter((alias) => alias.value.length >= 4)
    .sort((a, b) => b.value.length - a.value.length)
    .find((alias) => normalized.includes(alias.value))?.key;
}

function normalizeImportText(value?: string) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function isImportHeaderValue(value: string) {
  return ["answer", "value", "field", "question", "الجواب", "القيمة", "الحقل", "السؤال"].includes(normalizeImportText(value));
}
function splitImportList(value?: string) {
  return (value || "")
    .split(/[,،؛;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImportedBranches(value: string | undefined, governorateOptions: OptionItem[]) {
  return (value || "")
    .split(/[\n;؛]+/)
    .map((branch) => branch.trim())
    .filter(Boolean)
    .map((branch) => {
      const [governorateValue = "", city = "", marketArea = "", address = "", phone = ""] = branch
        .split("|")
        .map((item) => item.trim());
      return {
        governorate: matchOptionValue(governorateValue, governorateOptions) || governorateValue,
        city,
        marketArea,
        address,
        phone,
      };
    })
    .filter((branch) => branch.governorate || branch.city || branch.marketArea || branch.address || branch.phone);
}
function matchOptionValue(value: string | undefined, options: OptionItem[]) {
  const raw = value?.trim();
  if (!raw) {
    return "";
  }
  const normalized = normalizeImportText(value);
  if (!normalized) {
    return "";
  }
  const ranked = options
    .map((option) => ({
      option,
      score: Math.max(...optionImportCandidates(option).map((candidate) => scoreOptionImportMatch(normalized, candidate))),
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return best && best.score >= 0.82 ? best.option.value : "";
}

function mergeOptionList(current: string[], value: string | undefined, options: OptionItem[]) {
  const matched = splitImportList(value)
    .map((item) => matchOptionValue(item, options))
    .filter(Boolean);
  return Array.from(new Set([...current, ...matched]));
}

function optionImportCandidates(option: OptionItem) {
  return [
    option.value,
    option.value.replaceAll("_", " "),
    option.labelEn,
    option.labelAr,
    ...(optionImportSynonyms[option.value] || []),
  ];
}

function scoreOptionImportMatch(value: string, candidate: string) {
  const normalizedCandidate = normalizeImportText(candidate);
  if (!value || !normalizedCandidate) {
    return 0;
  }
  if (value === normalizedCandidate) {
    return 1;
  }
  if (value.length >= 4 && normalizedCandidate.includes(value)) {
    return 0.95;
  }
  if (normalizedCandidate.length >= 4 && value.includes(normalizedCandidate)) {
    return 0.93;
  }
  const valueTokens = optionMatchTokens(value);
  const candidateTokens = optionMatchTokens(normalizedCandidate);
  if (valueTokens.length && candidateTokens.length) {
    const overlap = valueTokens.filter((token) => candidateTokens.includes(token)).length;
    const ratio = overlap / Math.max(valueTokens.length, candidateTokens.length);
    if (overlap === valueTokens.length && ratio >= 0.5) {
      return 0.88;
    }
    if (ratio >= 0.67) {
      return 0.84;
    }
  }
  const similarity = normalizedSimilarity(value, normalizedCandidate);
  return similarity >= 0.82 ? similarity * 0.9 : 0;
}

function optionMatchTokens(value: string) {
  return value.split(" ").filter((token) => token.length >= 3);
}

function normalizedSimilarity(a: string, b: string) {
  const maxLength = Math.max(a.length, b.length);
  if (!maxLength) {
    return 1;
  }
  return 1 - levenshteinDistance(a, b) / maxLength;
}

function levenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);
  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const substitutionCost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function matchNameLanguage(value?: string): FormState["nameLanguage"] | "" {
  const normalized = normalizeImportText(value);
  if (!normalized) return "";
  if (["arabic", "ar", "عربي", "العربيه", "العربية"].map(normalizeImportText).includes(normalized)) return "arabic";
  if (["english", "en", "انكليزي", "انجليزي", "الانكليزيه", "الانجليزية"].map(normalizeImportText).includes(normalized)) return "english";
  if (["mixed", "both", "مختلط", "الاثنين", "كلاهما"].map(normalizeImportText).includes(normalized)) return "mixed";
  return "";
}
function matchWhatsappAvailable(value: string | undefined): FormState["whatsappAvailable"] | "" {
  const normalized = normalizeImportText(value);
  if (!normalized) return "";
  if (["yes", "y", "true", "available", "نعم", "اي", "متاح", "يوجد"].map(normalizeImportText).includes(normalized)) return "yes";
  if (["no", "n", "false", "not available", "لا", "غير متاح", "لا يوجد"].map(normalizeImportText).includes(normalized)) return "no";
  if (["unknown", "not sure", "unsure", "غير معروف", "غير متاكد"].map(normalizeImportText).includes(normalized)) return "unknown";
  return "";
}
function matchDirectExperience(value: string | undefined): FormState["hasDirectExperience"] | "" {
  const normalized = normalizeImportText(value);
  if (!normalized) return "";
  if (["yes", "y", "true", "نعم", "اي", "يوجد"].map(normalizeImportText).includes(normalized)) return "yes";
  if (["no", "n", "false", "لا", "لا يوجد"].map(normalizeImportText).includes(normalized)) return "no";
  if (["not sure", "unsure", "unknown", "غير متاكد", "غير معروف"].map(normalizeImportText).includes(normalized)) return "not_sure";
  return "";
}
