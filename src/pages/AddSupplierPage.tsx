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
      setMessage(t("supplierI×­¹ÒÚ$z{-®éÜj×'7G&öær"Â'G'W7FVB"Â'7W&R"Â&vööB"Â-‹Š}˜M˜¢"Â-‹Š}˜M˜­Š’"Â-˜]˜Š½˜˜"%ÒÀ¢ÖVF—VÓ¢²&fW&vR"Â&ÖöFW&FR"Â&Ö–FFÆR"Â-˜]Š­˜‹=‹r"Â-˜]Š­˜‹=‹}Š’%ÒÀ¢Æ÷s¢²'vV²"Â'ö÷""Â&Æ÷r6öæf–FVæ6R"Â-‹m‹˜­˜"Â-˜]˜mŠí˜‹b%ÒÀ¢æVVG5÷fW&–f–6F–öã¢²'fW&–g’"Â'fW&–f–6F–öâ"Â&æVVG26†V6²"Â&æ÷BfW&–f–VB"Â-Š­ŠİŠ­Š}ŠÂŠ­Šİ˜-˜""Â-‹­˜­‹˜]ŠM˜=Šò%ÒÀ§Ó° ¦gVæ7F–öâW‡G&7E7WÆ–W$–×÷'Df÷&×2‡&÷w3¢7G&–æuµÕµÒÂ7W'&VçC¢f÷&Õ7FFRÂ÷F–öç3¢7WÆ–W$–×÷'D÷F–öç2“¢7WÆ–W$–×÷'FVDf÷&ÕµÒ°¢6öç7B†VFW%&÷t–æFW‚Ò&÷w2æf–æD–æFW‚‚‡&÷r’Óâ&÷ræf–ÇFW"‚†6VÆÂ’ÓâÆöö·W7WÆ–W$–×÷'Df–VÆB†6VÆÂ’’æÆVæwF‚ãÒ2“°¢–b††VFW%&÷t–æFW‚Â’°¢&WGW&â¶ÖW&vUv÷&¶&ööµ&÷w4–çFôf÷&Ò‡&÷w2Â7W'&VçBÂ÷F–öç2•Ó°¢Ğ ¢6öç7B†VFW'2Ò&÷w5¶†VFW%&÷t–æFW…Ó°¢6öç7Bf÷&×2Ò&÷w0¢ç6Æ–6R††VFW%&÷t–æFW‚²¢æÖ‚‡&÷rÂ–æFW‚’Óâ°¢6öç7Bf–VÆG3¢'F–ÃÅ&V6÷&CÆ¶W–öbf÷&Õ7FFRÂ7G&–æsãâÒ·Ó°¢†VFW'2æf÷$V6‚‚††VFW"Â6VÆÄ–æFW‚’Óâ°¢6öç7B¶W’ÒÆöö·W7WÆ–W$–×÷'Df–VÆB††VFW"“°¢6öç7BfÇVRÒ&÷u¶6VÆÄ–æFW…ÓòçG&–Ò‚“°¢–b†¶W’bbfÇVR’°¢f–VÆG5¶¶W•ÒÒfÇVS°¢Ğ¢Ò“°¢&WGW&â°¢ââæf–VÆG5Fôf÷&Ò†f–VÆG2Â–æ—F–Äf÷&ÒÂ÷F–öç2’À¢&÷tçVÖ&W#¢†VFW%&÷t–æFW‚²–æFW‚²"À¢Ó°¢Ò¢æf–ÇFW"‚†—FVÒ’Óâ—FVÒæÖF6†VDf–VÆG2â¢ç6Æ–6RƒÂS“° ¢&WGW&âf÷&×2æÆVæwF‚òf÷&×2¢¶ÖW&vUv÷&¶&ööµ&÷w4–çFôf÷&Ò‡&÷w2Â7W'&VçBÂ÷F–öç2•Ó°§Ğ ¦gVæ7F–öâÖW&vUv÷&¶&ööµ&÷w4–çFôf÷&Ò‡&÷w3¢7G&–æuµÕµÒÂ7W'&VçC¢f÷&Õ7FFRÂ÷F–öç3¢7WÆ–W$–×÷'D÷F–öç2“¢7WÆ–W$–×÷'FVDf÷&Ò°¢&WGW&â°¢ââæf–VÆG5Fôf÷&Ò†W‡G&7E7WÆ–W$–×÷'Df–VÆG2‡&÷w2’Â7W'&VçBÂ÷F–öç2’À¢&÷tçVÖ&W#¢À¢Ó°§Ğ ¦gVæ7F–öâf–VÆG5Fôf÷&Ò†f–VÆG3¢'F–ÃÅ&V6÷&CÆ¶W–öbf÷&Õ7FFRÂ7G&–æsãâÂ7W'&VçC¢f÷&Õ7FFRÂ÷F–öç3¢7WÆ–W$–×÷'D÷F–öç2’°¢6öç7BæW‡C¢f÷&Õ7FFRÒ²ââæ7W'&VçBÂ'&æ6†W3¢²âââ†7W'&VçBæ'&æ6†W2ÇÂµÒ•ÒÓ°¢ÆWBÖF6†VDf–VÆG2Ò° ¢6öç7B6WEFW‡BÒ†¶W“¢¶W–öbf÷&Õ7FFRÂfÇVSó¢7G&–ær’Óâ°¢6öç7BG&–ÖÖVBÒfÇVSòçG&–Ò‚“°¢–b‚G&–ÖÖVB’&WGW&ã°¢–b†æW‡E¶¶W•ÒÓÒG&–ÖÖVB’°¢ÖF6†VDf–VÆG2³Ò°¢Ğ¢†æW‡E¶¶W•Ò27G&–ær’ÒG&–ÖÖVC°¢Ó° ¢6WEFW‡B‚&æÖT÷&–v–æÂ"Âf–VÆG2ææÖT÷&–v–æÂ“°¢6WEFW‡B‚&F—7Æ”æÖR"Âf–VÆG2æF—7Æ”æÖR“°¢6WEFW‡B‚&æÖT""Âf–VÆG2ææÖT"“°¢6WEFW‡B‚&æÖTVâ"Âf–VÆG2ææÖTVâ“°¢6WEFW‡B‚'6†÷'DFW67&—F–öâ"Âf–VÆG2ç6†÷'DFW67&—F–öâ“°¢6WEFW‡B‚&6—G’"Âf–VÆG2æ6—G’“°¢6WEFW‡B‚&Ö&¶WD&V"Âf–VÆG2æÖ&¶WD&V“°¢6WEFW‡B‚&FG&W72"Âf–VÆG2æFG&W72“°¢6WEFW‡B‚&vöövÆTÖ4Æ–æ²"Âf–VÆG2ævöövÆTÖ4Æ–æ²“°¢6WEFW‡B‚'6V6öæF'•†öæR"Âf–VÆG2ç6V6öæF'•†öæR“°¢6WEFW‡B‚&VÖ–Â"Âf–VÆG2æVÖ–Â“°¢6WEFW‡B‚'vV'6—FR"Âf–VÆG2çvV'6—FR“°¢6WEFW‡B‚&f6V&öö²"Âf–VÆG2æf6V&öö²“°¢6WEFW‡B‚&–ç7Fw&ÔÆ–æ¶VF–â"Âf–VÆG2æ–ç7Fw&ÔÆ–æ¶VF–â“°¢6WEFW‡B‚&6öçF7EW'6öâ"Âf–VÆG2æ6öçF7EW'6öâ“°¢6WEFW‡B‚&6öçF7EW'6öå&öÆR"Âf–VÆG2æ6öçF7EW'6öå&öÆR“°¢6WEFW‡B‚'7V&6FVv÷&–W2"Âf–VÆG2ç7V&6FVv÷&–W2“°¢6WEFW‡B‚&7&VF—DF—2"Âf–VÆG2æ7&VF—DF—2“°¢6WEFW‡B‚&7&VF—EFW&×4æ÷FR"Âf–VÆG2æ7&VF—EFW&×4æ÷FR“°¢6WEFW‡B‚&Æ7D–çFW&7F–öå–V""Âf–VÆG2æÆ7D–çFW&7F–öå–V"“°¢6WEFW‡B‚'&VÆFVDÖFW&–Å6W'f–6R"Âf–VÆG2ç&VÆFVDÖFW&–Å6W'f–6R“°¢6WEFW‡B‚'6÷W&6Tæ÷FR"Âf–VÆG2ç6÷W&6Tæ÷FR“° ¢–b†f–VÆG2ç&–Ö'•†öæR’°¢–b†f–VÆG2ç&–Ö'•†öæRæ–æ6ÇVFW2‚$"’’°¢6WEFW‡B‚&VÖ–Â"Âf–VÆG2ç&–Ö'•†öæR“°¢ÒVÇ6R°¢6öç7B†öæW2Ò7Æ—D–×÷'DÆ—7B†f–VÆG2ç&–Ö'•†öæR“°¢6WEFW‡B‚'&–Ö'•†öæR"Â†öæW5³Ò“°¢6WEFW‡B‚'6V6öæF'•†öæR"Âf–VÆG2ç6V6öæF'•†öæRÇÂ†öæW5³Ò“°¢Ğ¢Ğ ¢6öç7BæÖTÆæwVvRÒÖF6„æÖTÆæwVvR†f–VÆG2ææÖTÆæwVvR“°¢–b†æÖTÆæwVvR’°¢æW‡BææÖTÆæwVvRÒæÖTÆæwVvS°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7B'W6–æW75G—RÒÖF6„÷F–öåfÇVR†f–VÆG2æ'W6–æW75G—RÂ'W6–æW75G—W2“°¢–b†'W6–æW75G—R’°¢æW‡Bæ'W6–æW75G—RÒ'W6–æW75G—S°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7Bv÷fW&æ÷&FW4Æ—7BÒÖW&vT÷F–öäÆ—7B†æW‡Bæv÷fW&æ÷&FW2Âf–VÆG2æv÷fW&æ÷&FW2Â÷F–öç2æv÷fW&æ÷&FW2“°¢–b†v÷fW&æ÷&FW4Æ—7BæÆVæwF‚âæW‡Bæv÷fW&æ÷&FW2æÆVæwF‚’°¢ÖF6†VDf–VÆG2³Ò°¢Ğ¢æW‡Bæv÷fW&æ÷&FW2Òv÷fW&æ÷&FW4Æ—7C° ¢6öç7B–×÷'FVD'&æ6†W2Ò'6T–×÷'FVD'&æ6†W2†f–VÆG2æ'&æ6†W2Â÷F–öç2æv÷fW&æ÷&FW2“°¢–b†–×÷'FVD'&æ6†W2æÆVæwF‚’°¢6öç7B'&æ6„¶W—2ÒæWr6WB†æW‡Bæ'&æ6†W2æÖ‚†'&æ6‚’Óâ¥4ôâç7G&–æv–g’†'&æ6‚’’“°¢–×÷'FVD'&æ6†W2æf÷$V6‚‚†'&æ6‚’Óâ°¢6öç7B¶W’Ò¥4ôâç7G&–æv–g’†'&æ6‚“°¢–b‚'&æ6„¶W—2æ†2†¶W’’’°¢æW‡Bæ'&æ6†W2çW6‚†'&æ6‚“°¢'&æ6„¶W—2æFB†¶W’“°¢ÖF6†VDf–VÆG2³Ò°¢Ğ¢Ò“°¢æW‡Bæv÷fW&æ÷&FW2Ò'&’æg&öÒ†æWr6WB…°¢ââææW‡Bæv÷fW&æ÷&FW2À¢ââæ–×÷'FVD'&æ6†W2æÖ‚†'&æ6‚’Óâ'&æ6‚æv÷fW&æ÷&FR’æf–ÇFW"„&ööÆVâ’À¢Ò’“°¢Ğ ¢6öç7BÖ–ä6FVv÷&–W4Æ—7BÒÖW&vT÷F–öäÆ—7B†æW‡BæÖ–ä6FVv÷&–W2Âf–VÆG2æÖ–ä6FVv÷&–W2Â÷F–öç2ç7WÆ–W$6FVv÷&–W2“°¢–b†Ö–ä6FVv÷&–W4Æ—7BæÆVæwF‚âæW‡BæÖ–ä6FVv÷&–W2æÆVæwF‚’°¢ÖF6†VDf–VÆG2³Ò°¢Ğ¢æW‡BæÖ–ä6FVv÷&–W2ÒÖ–ä6FVv÷&–W4Æ—7C° ¢6öç7B6÷W&6UG—RÒÖF6„÷F–öåfÇVR†f–VÆG2ç6÷W&6UG—RÂ6÷W&6UG—W2“°¢–b‡6÷W&6UG—R’°¢æW‡Bç6÷W&6UG—RÒ6÷W&6UG—S°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7B6öæf–FVæ6TÆWfVÂÒÖF6„÷F–öåfÇVR†f–VÆG2æ6öæf–FVæ6TÆWfVÂÂ6öæf–FVæ6TÆWfVÇ2“°¢–b†6öæf–FVæ6TÆWfVÂ’°¢æW‡Bæ6öæf–FVæ6TÆWfVÂÒ6öæf–FVæ6TÆWfVÃ°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7Bv†G6f–Æ&ÆRÒÖF6…v†G6f–Æ&ÆR†f–VÆG2çv†G6f–Æ&ÆR“°¢–b‡v†G6f–Æ&ÆR’°¢æW‡Bçv†G6f–Æ&ÆRÒv†G6f–Æ&ÆS°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7B†4F—&V7DW‡W&–Væ6RÒÖF6„F—&V7DW‡W&–Væ6R†f–VÆG2æ†4F—&V7DW‡W&–Væ6R“°¢–b††4F—&V7DW‡W&–Væ6R’°¢æW‡Bæ†4F—&V7DW‡W&–Væ6RÒ†4F—&V7DW‡W&–Væ6S°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7B66WG47&VF—BÒÖF6…v†G6f–Æ&ÆR†f–VÆG2æ66WG47&VF—B“°¢–b†66WG47&VF—B’°¢æW‡Bæ66WG47&VF—BÒ66WG47&VF—C°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7B7&VF—E7F'BÒÖF6„÷F–öåfÇVR†f–VÆG2æ7&VF—E7F'BÂ7&VF—E7F'G2“°¢–b†7&VF—E7F'B’°¢æW‡Bæ7&VF—E7F'BÒ7&VF—E7F'C°¢ÖF6†VDf–VÆG2³Ò°¢Ğ ¢6öç7B6÷fW&vT&V4Æ—7BÒÖW&vT÷F–öäÆ—7B†æW‡Bæ6÷fW&vT&V2Âf–VÆG2æ6÷fW&vT&V2Â6÷fW&vT&V2“°¢6öç7B6&–Æ—G•Fw4Æ—7BÒÖW&vT÷F–öäÆ—7B†æW‡Bæ6&–Æ—G•Fw2Âf–VÆG2æ6&–Æ—G•Fw2Â6&–Æ—G•Fw2“°¢6öç7B–ÖVçD÷F–öç4Æ—7BÒÖW&vT÷F–öäÆ—7B†æW‡Bç–ÖVçD÷F–öç2Âf–VÆG2ç–ÖVçD÷F–öç2Â–ÖVçD÷F–öç2“°¢–b†6÷fW&vT&V4Æ—7BæÆVæwF‚âæW‡Bæ6÷fW&vT&V2æÆVæwF‚’ÖF6†VDf–VÆG2³Ò°¢–b†6&–Æ—G•Fw4Æ—7BæÆVæwF‚âæW‡Bæ6&–Æ—G•Fw2æÆVæwF‚’ÖF6†VDf–VÆG2³Ò°¢–b‡–ÖVçD÷F–öç4Æ—7BæÆVæwF‚âæW‡Bç–ÖVçD÷F–öç2æÆVæwF‚’ÖF6†VDf–VÆG2³Ò°¢æW‡Bæ6÷fW&vT&V2Ò6÷fW&vT&V4Æ—7C°¢æW‡Bæ6&–Æ—G•Fw2Ò6&–Æ—G•Fw4Æ—7C°¢æW‡Bç–ÖVçD÷F–öç2Ò–ÖVçD÷F–öç4Æ—7C° ¢–b‚æW‡BæF—7Æ”æÖRbbæW‡BææÖT÷&–v–æÂ’°¢æW‡BæF—7Æ”æÖRÒæW‡BææÖT÷&–v–æÃ°¢Ğ ¢&WGW&â²f÷&Ó¢æW‡BÂÖF6†VDf–VÆG2Ó°§Ğ ¦gVæ7F–öâW‡G&7E7WÆ–W$–×÷'Df–VÆG2‡&÷w3¢7G&–æuµÕµÒ’°¢6öç7Bf–VÆG3¢'F–ÃÅ&V6÷&CÆ¶W–öbf÷&Õ7FFRÂ7G&–æsãâÒ·Ó°¢6öç7B†VFW%&÷t–æFW‚Ò&÷w2æf–æD–æFW‚‚‡&÷r’Óâ&÷ræf–ÇFW"‚†6VÆÂ’ÓâÆöö·W7WÆ–W$–×÷'Df–VÆB†6VÆÂ’’æÆVæwF‚ãÒ2“°¢–b††VFW%&÷t–æFW‚ãÒ’°¢6öç7BFF&÷rÒ&÷w2ç6Æ–6R††VFW%&÷t–æFW‚²’æf–æB‚‡&÷r’Óâ&÷ræf–ÇFW"‚†6VÆÂ’Óâ6VÆÃòçG&–Ò‚’’æÆVæwF‚ãÒ"“°¢–b†FF&÷r’°¢&÷w5¶†VFW%&÷t–æFW…Òæf÷$V6‚‚††VFW"Â–æFW‚’Óâ°¢6öç7B¶W’ÒÆöö·W7WÆ–W$–×÷'Df–VÆB††VFW"“°¢6öç7BfÇVRÒFF&÷u¶–æFW…ÓòçG&–Ò‚“°¢–b†¶W’bbfÇVR’°¢f–VÆG5¶¶W•ÒÒfÇVS°¢Ğ¢Ò“°¢Ğ¢Ğ ¢&÷w2æf÷$V6‚‚‡&÷r’Óâ°¢6öç7B6VÆÇ2Ò&÷ræÖ‚†6VÆÂ’Óâ6VÆÃòçG&–Ò‚’ÇÂ""“°¢–b†6VÆÇ2æf–ÇFW"‚†6VÆÂ’ÓâÆöö·W7WÆ–W$–×÷'Df–VÆB†6VÆÂ’’æÆVæwF‚ãÒ2’°¢&WGW&ã°¢Ğ¢6öç7B6æF–FFW2Ò°¢¶6VÆÇ5³ÒÂ6VÆÇ5³ÕÒÀ¢¶6VÆÇ5³ÒÂ6VÆÇ5³%ÕÒÀ¢Ó°¢6æF–FFW2ç6öÖR‚…¶Æ&VÂÂfÇVUÒ’Óâ°¢6öç7B¶W’ÒÆöö·W7WÆ–W$–×÷'Df–VÆB†Æ&VÂ“°¢–b‚¶W’ÇÂfÇVRÇÂ—4–×÷'D†VFW%fÇVR‡fÇVR’’°¢&WGW&âfÇ6S°¢Ğ¢f–VÆG5¶¶W•ÒÒfÇVS°¢&WGW&âG'VS°¢Ò“°¢Ò“° ¢&WGW&âf–VÆG3°§Ğ ¦gVæ7F–öâÆöö·W7WÆ–W$–×÷'Df–VÆB†Æ&VÃó¢7G&–ær’°¢6öç7Bæ÷&ÖÆ—¦VBÒæ÷&ÖÆ—¦T–×÷'EFW‡B†Æ&VÂ“°¢–b‚æ÷&ÖÆ—¦VB’°¢&WGW&âVæFVf–æVC°¢Ğ¢6öç7BF—&V7D¶W’Ò„ö&¦V7Bæ¶W—2†–æ—F–Äf÷&Ò’2'&“Æ¶W–öbf÷&Õ7FFSâ’æf–æB‚†¶W’’Óà¢¶¶W’Â¶W’ç&WÆ6R‚ò…¶×¥Ò’…´Õ¥Ò’örÂ"CC""•Òç6öÖR‚†6æF–FFR’Óâæ÷&ÖÆ—¦T–×÷'EFW‡B†6æF–FFR’ÓÓÒæ÷&ÖÆ—¦VB’À¢“°¢–b†F—&V7D¶W’’°¢&WGW&âF—&V7D¶W“°¢Ğ¢6öç7BÆ–6W2Òö&¦V7BæVçG&–W2‡7WÆ–W$–×÷'DÆ–6W2’æfÆDÖ‚…¶¶W’ÂfÇVW5Ò’Óà¢‡fÇVW2ÇÂµÒ’æÖ‚‡fÇVR’Óâ‡²¶W“¢¶W’2¶W–öbf÷&Õ7FFRÂfÇVS¢æ÷&ÖÆ—¦T–×÷'EFW‡B‡fÇVR’Ò’’À¢“°¢6öç7BW†7BÒÆ–6W2æf–æB‚†Æ–2’ÓâÆ–2çfÇVRÓÓÒæ÷&ÖÆ—¦VB“°¢–b†W†7B’°¢&WGW&âW†7Bæ¶W“°¢Ğ¢&WGW&âÆ–6W0¢æf–ÇFW"‚†Æ–2’ÓâÆ–2çfÇVRæÆVæwF‚ãÒB¢ç6÷'B‚†Â"’Óâ"çfÇVRæÆVæwF‚ÒçfÇVRæÆVæwF‚¢æf–æB‚†Æ–2’Óâæ÷&ÖÆ—¦VBæ–æ6ÇVFW2†Æ–2çfÇVR’“òæ¶W“°§Ğ ¦gVæ7F–öâæ÷&ÖÆ—¦T–×÷'EFW‡B‡fÇVSó¢7G&–ær’°¢&WGW&â‡fÇVRÇÂ""¢çG&–Ò‚¢çFôÆ÷vW$66R‚¢ç&WÆ6R‚õµÇScD"ÕÇScTeÇScsÒörÂ""¢ç&WÆ6R‚õ½Š=Š]Š%ÒörÂ-Šr"¢ç&WÆ6R‚ı˜’örÂ-˜¢"¢ç&WÆ6R‚ıŠ’örÂ-˜r"¢ç&WÆ6R‚õµæ×£Ó•ÇScÕÇSffeÒ²örÂ""¢ç&WÆ6R‚õÇ2²örÂ""¢çG&–Ò‚“°§Ğ¦gVæ7F–öâ—4–×÷'D†VFW%fÇVR‡fÇVS¢7G&–ær’°¢&WGW&â²&ç7vW""Â'fÇVR"Â&f–VÆB"Â'VW7F–öâ"Â-Š}˜MŠÍ˜Š}Š‚"Â-Š}˜M˜-˜­˜]Š’"Â-Š}˜MŠİ˜-˜B"Â-Š}˜M‹=ŠMŠ}˜B%Òæ–æ6ÇVFW2†æ÷&ÖÆ—¦T–×÷'EFW‡B‡fÇVR’“°§Ğ¦gVæ7F–öâ7Æ—D–×÷'DÆ—7B‡fÇVSó¢7G&–ær’°¢&WGW&â‡fÇVRÇÂ""¢ç7Æ—B‚õ²ÍˆÍ‰³µÆçÅÒ²ò¢æÖ‚†—FVÒ’Óâ—FVÒçG&–Ò‚’¢æf–ÇFW"„&ööÆVâ“°§Ğ ¦gVæ7F–öâ'6T–×÷'FVD'&æ6†W2‡fÇVS¢7G&–ærÂVæFVf–æVBÂv÷fW&æ÷&FT÷F–öç3¢÷F–öä—FVÕµÒ’°¢&WGW&â‡fÇVRÇÂ""¢ç7Æ—B‚õµÆã½‰µÒ²ò¢æÖ‚†'&æ6‚’Óâ'&æ6‚çG&–Ò‚’¢æf–ÇFW"„&ööÆVâ¢æÖ‚†'&æ6‚’Óâ°¢6öç7B¶v÷fW&æ÷&FUfÇVRÒ""Â6—G’Ò""ÂÖ&¶WD&VÒ""ÂFG&W72Ò""Â†öæRÒ"%ÒÒ'&æ6€¢ç7Æ—B‚'Â"¢æÖ‚†—FVÒ’Óâ—FVÒçG&–Ò‚’“°¢&WGW&â°¢v÷fW&æ÷&FS¢ÖF6„÷F–öåfÇVR†v÷fW&æ÷&FUfÇVRÂv÷fW&æ÷&FT÷F–öç2’ÇÂv÷fW&æ÷&FUfÇVRÀ¢6—G’À¢Ö&¶WD&VÀ¢FG&W72À¢†öæRÀ¢Ó°¢Ò¢æf–ÇFW"‚†'&æ6‚’Óâ'&æ6‚æv÷fW&æ÷&FRÇÂ'&æ6‚æ6—G’ÇÂ'&æ6‚æÖ&¶WD&VÇÂ'&æ6‚æFG&W72ÇÂ'&æ6‚ç†öæR“°§Ğ¦gVæ7F–öâÖF6„÷F–öåfÇVR‡fÇVS¢7G&–ærÂVæFVf–æVBÂ÷F–öç3¢÷F–öä—FVÕµÒ’°¢6öç7B&rÒfÇVSòçG&–Ò‚“°¢–b‚&r’°¢&WGW&â"#°¢Ğ¢6öç7Bæ÷&ÖÆ—¦VBÒæ÷&ÖÆ—¦T–×÷'EFW‡B‡fÇVR“°¢–b‚æ÷&ÖÆ—¦VB’°¢&WGW&â"#°¢Ğ¢6öç7B&æ¶VBÒ÷F–öç0¢æÖ‚†÷F–öâ’Óâ‡°¢÷F–öâÀ¢66÷&S¢ÖF‚æÖ‚‚ââæ÷F–öä–×÷'D6æF–FFW2†÷F–öâ’æÖ‚†6æF–FFR’Óâ66÷&T÷F–öä–×÷'DÖF6‚†æ÷&ÖÆ—¦VBÂ6æF–FFR’’’À¢Ò’¢ç6÷'B‚†Â"’Óâ"ç66÷&RÒç66÷&R“°¢6öç7B&W7BÒ&æ¶VE³Ó°¢&WGW&â&W7Bbb&W7Bç66÷&RãÒãƒ"ò&W7Bæ÷F–öâçfÇVR¢"#°§Ğ ¦gVæ7F–öâÖW&vT÷F–öäÆ—7B†7W'&VçC¢7G&–æuµÒÂfÇVS¢7G&–ærÂVæFVf–æVBÂ÷F–öç3¢÷F–öä—FVÕµÒ’°¢6öç7BÖF6†VBÒ7Æ—D–×÷'DÆ—7B‡fÇVR¢æÖ‚†—FVÒ’ÓâÖF6„÷F–öåfÇVR†—FVÒÂ÷F–öç2’¢æf–ÇFW"„&ööÆVâ“°¢&WGW&â'&’æg&öÒ†æWr6WB…²ââæ7W'&VçBÂââæÖF6†VEÒ’“°§Ğ ¦gVæ7F–öâ÷F–öä–×÷'D6æF–FFW2†÷F–öã¢÷F–öä—FVÒ’°¢&WGW&â°¢÷F–öâçfÇVRÀ¢÷F–öâçfÇVRç&WÆ6TÆÂ‚%ò"Â""’À¢÷F–öâæÆ&VÄVâÀ¢÷F–öâæÆ&VÄ"À¢âââ†÷F–öä–×÷'E7–æöç–×5¶÷F–öâçfÇVUÒÇÂµÒ’À¢Ó°§Ğ ¦gVæ7F–öâ66÷&T÷F–öä–×÷'DÖF6‚‡fÇVS¢7G&–ærÂ6æF–FFS¢7G&–ær’°¢6öç7Bæ÷&ÖÆ—¦VD6æF–FFRÒæ÷&ÖÆ—¦T–×÷'EFW‡B†6æF–FFR“°¢–b‚fÇVRÇÂæ÷&ÖÆ—¦VD6æF–FFR’°¢&WGW&â°¢Ğ¢–b‡fÇVRÓÓÒæ÷&ÖÆ—¦VD6æF–FFR’°¢&WGW&â°¢Ğ¢–b‡fÇVRæÆVæwF‚ãÒBbbæ÷&ÖÆ—¦VD6æF–FFRæ–æ6ÇVFW2‡fÇVR’’°¢&WGW&âã“S°¢Ğ¢–b†æ÷&ÖÆ—¦VD6æF–FFRæÆVæwF‚ãÒBbbfÇVRæ–æ6ÇVFW2†æ÷&ÖÆ—¦VD6æF–FFR’’°¢&WGW&âã“3°¢Ğ¢6öç7BfÇVUFö¶Vç2Ò÷F–öäÖF6…Fö¶Vç2‡fÇVR“°¢6öç7B6æF–FFUFö¶Vç2Ò÷F–öäÖF6…Fö¶Vç2†æ÷&ÖÆ—¦VD6æF–FFR“°¢–b‡fÇVUFö¶Vç2æÆVæwF‚bb6æF–FFUFö¶Vç2æÆVæwF‚’°¢6öç7B÷fW&ÆÒfÇVUFö¶Vç2æf–ÇFW"‚‡Fö¶Vâ’Óâ6æF–FFUFö¶Vç2æ–æ6ÇVFW2‡Fö¶Vâ’’æÆVæwFƒ°¢6öç7B&F–òÒ÷fW&ÆòÖF‚æÖ‚‡fÇVUFö¶Vç2æÆVæwF‚Â6æF–FFUFö¶Vç2æÆVæwF‚“°¢–b†÷fW&ÆÓÓÒfÇVUFö¶Vç2æÆVæwF‚bb&F–òãÒãR’°¢&WGW&âãƒƒ°¢Ğ¢–b‡&F–òãÒãcr’°¢&WGW&âãƒC°¢Ğ¢Ğ¢6öç7B6–Ö–Æ&—G’Òæ÷&ÖÆ—¦VE6–Ö–Æ&—G’‡fÇVRÂæ÷&ÖÆ—¦VD6æF–FFR“°¢&WGW&â6–Ö–Æ&—G’ãÒãƒ"ò6–Ö–Æ&—G’¢ã’¢°§Ğ ¦gVæ7F–öâ÷F–öäÖF6…Fö¶Vç2‡fÇVS¢7G&–ær’°¢&WGW&âfÇVRç7Æ—B‚""’æf–ÇFW"‚‡Fö¶Vâ’ÓâFö¶VâæÆVæwF‚ãÒ2“°§Ğ ¦gVæ7F–öâæ÷&ÖÆ—¦VE6–Ö–Æ&—G’†¢7G&–ærÂ#¢7G&–ær’°¢6öç7BÖ„ÆVæwF‚ÒÖF‚æÖ‚†æÆVæwF‚Â"æÆVæwF‚“°¢–b‚Ö„ÆVæwF‚’°¢&WGW&â°¢Ğ¢&WGW&âÒÆWfVç6‡FV–äF—7Fæ6R†Â"’òÖ„ÆVæwFƒ°§Ğ ¦gVæ7F–öâÆWfVç6‡FV–äF—7Fæ6R†¢7G&–ærÂ#¢7G&–ær’°¢6öç7B&Wf–÷W2Ò'&’æg&öÒ‡²ÆVæwFƒ¢"æÆVæwF‚²ÒÂ…òÂ–æFW‚’Óâ–æFW‚“°¢6öç7B7W'&VçBÒ'&’æg&öÒ‡²ÆVæwFƒ¢"æÆVæwF‚²ÒÂ‚’Óâ“°¢f÷"†ÆWB&÷rÒ²&÷rÃÒæÆVæwFƒ²&÷r³Ò’°¢7W'&VçE³ÒÒ&÷s°¢f÷"†ÆWB6öÇVÖâÒ²6öÇVÖâÃÒ"æÆVæwFƒ²6öÇVÖâ³Ò’°¢6öç7B7V'7F—GWF–öä6÷7BÒ·&÷rÒÒÓÓÒ%¶6öÇVÖâÒÒò¢°¢7W'&VçE¶6öÇVÖåÒÒÖF‚æÖ–â€¢7W'&VçE¶6öÇVÖâÒÒ²À¢&Wf–÷W5¶6öÇVÖåÒ²À¢&Wf–÷W5¶6öÇVÖâÒÒ²7V'7F—GWF–öä6÷7BÀ¢“°¢Ğ¢&Wf–÷W2ç7Æ–6RƒÂ&Wf–÷W2æÆVæwF‚Âââæ7W'&VçB“°¢Ğ¢&WGW&â&Wf–÷W5¶"æÆVæwF…Ó°§Ğ ¦gVæ7F–öâÖF6„æÖTÆæwVvR‡fÇVSó¢7G&–ær“¢f÷&Õ7FFU²&æÖTÆæwVvR%ÒÂ""°¢6öç7Bæ÷&ÖÆ—¦VBÒæ÷&ÖÆ—¦T–×÷'EFW‡B‡fÇVR“°¢–b‚æ÷&ÖÆ—¦VB’&WGW&â"#°¢–b…²&&&–2"Â&""Â-‹‹Š˜¢"Â-Š}˜M‹‹Š˜­˜r"Â-Š}˜M‹‹Š˜­Š’%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â&&&–2#°¢–b…²&VævÆ—6‚"Â&Vâ"Â-Š}˜m˜=˜M˜­‹-˜¢"Â-Š}˜mŠÍ˜M˜­‹-˜¢"Â-Š}˜MŠ}˜m˜=˜M˜­‹-˜­˜r"Â-Š}˜MŠ}˜mŠÍ˜M˜­‹-˜­Š’%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â&VævÆ—6‚#°¢–b…²&Ö—†VB"Â&&÷F‚"Â-˜]ŠíŠ­˜M‹r"Â-Š}˜MŠ}Š½˜m˜­˜b"Â-˜=˜MŠ}˜}˜]Šr%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â&Ö—†VB#°¢&WGW&â"#°§Ğ¦gVæ7F–öâÖF6…v†G6f–Æ&ÆR‡fÇVS¢7G&–ærÂVæFVf–æVB“¢f÷&Õ7FFU²'v†G6f–Æ&ÆR%ÒÂ""°¢6öç7Bæ÷&ÖÆ—¦VBÒæ÷&ÖÆ—¦T–×÷'EFW‡B‡fÇVR“°¢–b‚æ÷&ÖÆ—¦VB’&WGW&â"#°¢–b…²'–W2"Â'’"Â'G'VR"Â&f–Æ&ÆR"Â-˜m‹˜R"Â-Š}˜¢"Â-˜]Š­Š}ŠÒ"Â-˜­˜ŠÍŠò%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â'–W2#°¢–b…²&æò"Â&â"Â&fÇ6R"Â&æ÷Bf–Æ&ÆR"Â-˜MŠr"Â-‹­˜­‹˜]Š­Š}ŠÒ"Â-˜MŠr˜­˜ŠÍŠò%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â&æò#°¢–b…²'Væ¶æ÷vâ"Â&æ÷B7W&R"Â'Vç7W&R"Â-‹­˜­‹˜]‹‹˜˜"Â-‹­˜­‹˜]Š­Š}˜=Šò%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â'Væ¶æ÷vâ#°¢&WGW&â"#°§Ğ¦gVæ7F–öâÖF6„F—&V7DW‡W&–Væ6R‡fÇVS¢7G&–ærÂVæFVf–æVB“¢f÷&Õ7FFU²&†4F—&V7DW‡W&–Væ6R%ÒÂ""°¢6öç7Bæ÷&ÖÆ—¦VBÒæ÷&ÖÆ—¦T–×÷'EFW‡B‡fÇVR“°¢–b‚æ÷&ÖÆ—¦VB’&WGW&â"#°¢–b…²'–W2"Â'’"Â'G'VR"Â-˜m‹˜R"Â-Š}˜¢"Â-˜­˜ŠÍŠò%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â'–W2#°¢–b…²&æò"Â&â"Â&fÇ6R"Â-˜MŠr"Â-˜MŠr˜­˜ŠÍŠò%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â&æò#°¢–b…²&æ÷B7W&R"Â'Vç7W&R"Â'Væ¶æ÷vâ"Â-‹­˜­‹˜]Š­Š}˜=Šò"Â-‹­˜­‹˜]‹‹˜˜%ÒæÖ†æ÷&ÖÆ—¦T–×÷'EFW‡B’æ–æ6ÇVFW2†æ÷&ÖÆ—¦VB’’&WGW&â&æ÷E÷7W&R#°¢&WGW&â"#°§Ğ 