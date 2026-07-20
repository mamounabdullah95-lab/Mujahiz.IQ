import { BarChart3, Boxes, CheckCircle2, ExternalLink, FileCheck2, FileText, Plus, Save, Send, Tags, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DisabledFileUpload } from "../../components/DisabledFileUpload";
import { RfqReferenceLinks } from "../../components/RfqReferenceLinks";
import { RfqLifecycleTimeline } from "../../components/RfqLifecycleTimeline";
import { RfqRevisionHistory } from "../../components/RfqRevisionHistory";
import { DashboardError, DashboardPageHeader, DashboardPanel, InlineEmptyState, MetricCard, ProgressBar } from "../../components/DashboardPrimitives";
import { Button, ChipGroup, SelectField, TextAreaField, TextField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { labelFor } from "../../data/constants";
import { rfqDeliveryTermOptions, rfqOptionLabel, rfqPaymentTermOptions, rfqPreferredCurrencyOptions, rfqUnitOptions } from "../../data/rfqOptions";
import { getSupplier } from "../../services/firestore";
import { updateOwnSupplierCategories } from "../../services/supplierWorkspace";
import {
  deleteSupplierDocumentMetadata,
  deleteSupplierProduct,
  getSupplierRfqResponse,
  isRfqAcceptingResponses,
  listSupplierDocuments,
  listSupplierProducts,
  listSupplierRfqLifecyclePage,
  saveSupplierDocumentMetadata,
  saveSupplierProduct,
  submitRfqResponse,
  type SupplierRfqLifecycleCursor,
} from "../../services/workspace";
import type { Supplier } from "../../types/domain";
import type { RfqResponse, SupplierDocumentMetadata, SupplierProduct } from "../../types/workspace";
import { toDate } from "../../utils/date";
import { currentRfqRevision, localizedRfqResponseStatus, localizedRfqStatus, partitionSupplierRfqLifecycle, type SupplierRfqLifecycleItem } from "../../utils/rfqLifecycle";
import { AccountSettingsPage, WorkspaceMessagesPage, WorkspaceNotificationsPage } from "./BuyerWorkspacePages";

function useLocale() {
  const { i18n } = useTranslation();
  return i18n.language.startsWith("ar") ? "ar" as const : "en" as const;
}

function formatWorkspaceDate(value: unknown, locale: "ar" | "en") {
  const date = toDate(value as never);
  return date ? new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
}

function MissingSupplierProfile({ locale }: { locale: "ar" | "en" }) {
  return <InlineEmptyState title={locale === "ar" ? "لا يوجد ملف شركة مرتبط بالحساب" : "No company profile is linked to this account"} body={locale === "ar" ? "أنشئ ملف الشركة وأرسله للمراجعة، ثم ستظهر وظائف المنتجات والمستندات وطلبات الأسعار." : "Create and submit the company profile for review to activate products, documents, and RFQ workflows."} />;
}

const emptyProduct: { nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; categoryId: string; type: "product" | "service"; status: "draft" } = { nameAr: "", nameEn: "", descriptionAr: "", descriptionEn: "", categoryId: "", type: "product", status: "draft" };

export function SupplierProductsPage() {
  const locale = useLocale();
  const { appUser, firebaseUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [items, setItems] = useState<SupplierProduct[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [error, setError] = useState("");
  const loadRequestRef = useRef(0);
  const supplierId = appUser?.supplierProfileId;
  const ownerUserId = firebaseUser?.uid;
  const loadError = locale === "ar" ? "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0648\u0627\u0644\u062e\u062f\u0645\u0627\u062a. \u064a\u0631\u062c\u0649 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629\u060c \u0623\u0648 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629 \u0625\u0630\u0627 \u0627\u0633\u062a\u0645\u0631\u062a \u0627\u0644\u0645\u0634\u0643\u0644\u0629." : "Product and service records could not be loaded. Please retry or contact platform administration if the issue continues.";
  const text = locale === "ar" ? { eyebrow: "الكتالوج", title: "المنتجات والخدمات", description: "أضف بيانات نصية حقيقية لما توفره الشركة. الصور غير متاحة في المرحلة الحالية.", new: "إضافة منتج أو خدمة", nameAr: "الاسم بالعربية", nameEn: "الاسم بالإنجليزية", descAr: "الوصف بالعربية", descEn: "الوصف بالإنجليزية", category: "التصنيف", type: "النوع", product: "منتج", service: "خدمة", save: "حفظ", empty: "لا توجد منتجات أو خدمات", archive: "حذف" } : { eyebrow: "Catalogue", title: "Products & services", description: "Add factual text information about the company's offering. Images are unavailable in this release.", new: "Add product or service", nameAr: "Arabic name", nameEn: "English name", descAr: "Arabic description", descEn: "English description", category: "Category", type: "Type", product: "Product", service: "Service", save: "Save", empty: "No products or services", archive: "Delete" };
  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    if (!supplierId || !ownerUserId) {
      if (loadRequestRef.current === requestId) { setItems([]); setError(""); }
      return;
    }
    setError("");
    try {
      const records = await listSupplierProducts(supplierId, ownerUserId);
      if (loadRequestRef.current === requestId) setItems(records);
    } catch {
      if (loadRequestRef.current === requestId) { setItems([]); setError(loadError); }
    }
  }, [loadError, ownerUserId, supplierId]);
  useEffect(() => {
    void load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supplierId || !firebaseUser || (!form.nameAr.trim() && !form.nameEn.trim()) || !form.categoryId) return; await saveSupplierProduct({ ...form, supplierId, ownerUserId: firebaseUser.uid }); setForm(emptyProduct); await load(); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[0.9fr_1.1fr]"><DashboardPanel title={text.new}>{supplierId ? <form className="grid gap-4" onSubmit={(event) => void submit(event)}><div className="grid gap-4 sm:grid-cols-2"><TextField label={text.nameAr} value={form.nameAr} onChange={(event) => setForm({ ...form, nameAr: event.target.value })} dir="rtl" /><TextField label={text.nameEn} value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} dir="ltr" /><SelectField label={text.category} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">—</option>{taxonomy.supplierCategories.map((item) => <option key={item.value} value={item.value}>{labelFor(taxonomy.supplierCategories, item.value, locale)}</option>)}</SelectField><SelectField label={text.type} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as "product" | "service" })}><option value="product">{text.product}</option><option value="service">{text.service}</option></SelectField><TextAreaField label={text.descAr} value={form.descriptionAr} onChange={(event) => setForm({ ...form, descriptionAr: event.target.value })} dir="rtl" /><TextAreaField label={text.descEn} value={form.descriptionEn} onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })} dir="ltr" /></div><DisabledFileUpload locale={locale} purpose="product_media" accepted="JPG, PNG, WEBP" maximumSize="3 MB" /><Button type="submit"><Save className="h-4 w-4" />{text.save}</Button></form> : <MissingSupplierProfile locale={locale} />}</DashboardPanel><DashboardPanel title={text.title}>{error ? <DashboardError message={error} retry={() => void load()} /> : items.length ? <div className="grid gap-3">{items.map((item) => <article className="rounded-xl border border-borderSoft bg-creamLight p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}</h3><p className="mt-1 text-xs font-semibold text-muted">{item.type === "product" ? text.product : text.service} · {labelFor(taxonomy.supplierCategories, item.categoryId, locale)}</p></div><Button variant="ghost" onClick={() => void deleteSupplierProduct(item.id).then(load)}><Trash2 className="h-4 w-4" /></Button></div><p className="mt-3 text-sm leading-6 text-muted">{locale === "ar" ? item.descriptionAr || item.descriptionEn || "—" : item.descriptionEn || item.descriptionAr || "—"}</p></article>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}</DashboardPanel></div></div>;
}

export function SupplierCategoriesPage() {
  const locale = useLocale();
  const { appUser, firebaseUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState("");
  const [message, setMessage] = useState("");
  const supplierId = appUser?.supplierProfileId;
  const text = locale === "ar" ? { eyebrow: "ملف الشركة", title: "تصنيفات الشركة", description: "اختر المجالات التي توفرها الشركة فعلياً واكتب التخصصات الفرعية بصورة واضحة.", sub: "التصنيفات الفرعية", subPlaceholder: "مثال: مقاييس ضغط، صمامات تحكم، معايرة", save: "حفظ التصنيفات", saved: "تم حفظ تصنيفات الشركة." } : { eyebrow: "Company profile", title: "Company categories", description: "Select fields the company actually supplies and add clear subcategory terms.", sub: "Subcategories", subPlaceholder: "Example: pressure gauges, control valves, calibration", save: "Save categories", saved: "Company categories were saved." };
  useEffect(() => { if (!supplierId) return; void getSupplier(supplierId).then((record) => { setSupplier(record); setCategories(record?.categories || []); setSubcategories((record?.subcategories || []).join(", ")); }); }, [supplierId]);
  async function save() { if (!supplierId || !firebaseUser) return; const values = subcategories.split(/[,،\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 30); await updateOwnSupplierCategories(supplierId, firebaseUser.uid, categories, values); setMessage(text.saved); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="p-5 sm:p-7"><DashboardPanel title={text.title}>{supplierId && supplier ? <div className="grid gap-5"><ChipGroup options={taxonomy.supplierCategories.map((item) => ({ value: item.value, label: labelFor(taxonomy.supplierCategories, item.value, locale) }))} values={categories} onChange={setCategories} /><TextAreaField label={text.sub} value={subcategories} onChange={(event) => setSubcategories(event.target.value)} placeholder={text.subPlaceholder} /><div className="flex items-center gap-3"><Button onClick={() => void save()}><Save className="h-4 w-4" />{text.save}</Button>{message ? <span className="text-sm font-bold text-mint">{message}</span> : null}</div></div> : <MissingSupplierProfile locale={locale} />}</DashboardPanel></div></div>;
}

const emptyDocument = { name: "", documentType: "commercial_registration", description: "", certificateNumber: "", issuer: "", issueDate: "", expiryDate: "" };

export function SupplierDocumentsPage() {
  const locale = useLocale();
  const { appUser, firebaseUser } = useAuth();
  const [items, setItems] = useState<SupplierDocumentMetadata[]>([]);
  const [form, setForm] = useState(emptyDocument);
  const [error, setError] = useState("");
  const loadRequestRef = useRef(0);
  const supplierId = appUser?.supplierProfileId;
  const ownerUserId = firebaseUser?.uid;
  const loadError = locale === "ar" ? "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a. \u064a\u0631\u062c\u0649 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629\u060c \u0623\u0648 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629 \u0625\u0630\u0627 \u0627\u0633\u062a\u0645\u0631\u062a \u0627\u0644\u0645\u0634\u0643\u0644\u0629." : "Document records could not be loaded. Please retry or contact platform administration if the issue continues.";
  const text = locale === "ar" ? { eyebrow: "الامتثال", title: "المستندات والشهادات", description: "يمكن إدخال معلومات المستند نصياً فقط. هذا لا يعني رفع نسخة أو توثيقها.", new: "بيانات مستند", name: "اسم المستند", type: "نوع المستند", number: "رقم الشهادة أو الوثيقة", issuer: "جهة الإصدار", issue: "تاريخ الإصدار", expiry: "تاريخ الانتهاء", desc: "وصف", save: "حفظ البيانات النصية", empty: "لا توجد بيانات مستندات", metadata: "بيانات فقط، دون ملف مرفوع" } : { eyebrow: "Compliance", title: "Documents & certificates", description: "Document metadata can be entered as text only. This does not upload or verify a copy.", new: "Document metadata", name: "Document name", type: "Document type", number: "Certificate or document number", issuer: "Issuer", issue: "Issue date", expiry: "Expiry date", desc: "Description", save: "Save text metadata", empty: "No document metadata", metadata: "Metadata only; no file is uploaded" };
  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    if (!supplierId || !ownerUserId) {
      if (loadRequestRef.current === requestId) { setItems([]); setError(""); }
      return;
    }
    setError("");
    try {
      const records = await listSupplierDocuments(supplierId, ownerUserId);
      if (loadRequestRef.current === requestId) setItems(records);
    } catch {
      if (loadRequestRef.current === requestId) { setItems([]); setError(loadError); }
    }
  }, [loadError, ownerUserId, supplierId]);
  useEffect(() => {
    void load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supplierId || !firebaseUser || !form.name.trim()) return; await saveSupplierDocumentMetadata({ ...form, supplierId, ownerUserId: firebaseUser.uid }); setForm(emptyDocument); await load(); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[0.9fr_1.1fr]"><DashboardPanel title={text.new}>{supplierId ? <form className="grid gap-4" onSubmit={(event) => void submit(event)}><div className="grid gap-4 sm:grid-cols-2"><TextField label={text.name} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><SelectField label={text.type} value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}><option value="commercial_registration">Commercial registration</option><option value="tax_certificate">Tax certificate</option><option value="quality_certificate">Quality certificate</option><option value="authorization">Authorization</option><option value="other">Other</option></SelectField><TextField label={text.number} value={form.certificateNumber} onChange={(event) => setForm({ ...form, certificateNumber: event.target.value })} /><TextField label={text.issuer} value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.target.value })} /><TextField label={text.issue} value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} type="date" /><TextField label={text.expiry} value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} type="date" /><TextAreaField className="sm:col-span-2" label={text.desc} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><DisabledFileUpload locale={locale} purpose="supplier_document" accepted="PDF, JPG, PNG" maximumSize="5 MB" /><Button type="submit"><Save className="h-4 w-4" />{text.save}</Button></form> : <MissingSupplierProfile locale={locale} />}</DashboardPanel><DashboardPanel title={text.title}>{error ? <DashboardError message={error} retry={() => void load()} /> : items.length ? <div className="grid gap-3">{items.map((item) => <article className="rounded-xl border border-borderSoft bg-creamLight p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{item.name}</h3><p className="mt-1 text-xs font-bold text-amber">{text.metadata}</p></div><Button variant="ghost" onClick={() => void deleteSupplierDocumentMetadata(item.id).then(load)}><Trash2 className="h-4 w-4" /></Button></div><dl className="mt-3 grid gap-2 text-xs font-semibold text-muted sm:grid-cols-2"><div>{text.type}: {item.documentType}</div><div>{text.number}: {item.certificateNumber || "—"}</div><div>{text.issuer}: {item.issuer || "—"}</div><div>{text.expiry}: {item.expiryDate || "—"}</div></dl></article>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}</DashboardPanel></div></div>;
}

const emptyRfqResponse = {
  message: "",
  price: "",
  currency: "IQD" as "IQD" | "USD",
  deliveryDays: "",
  paymentTerms: "bank_transfer",
  paymentTermsOther: "",
  deliveryTerms: "supplier_delivery",
  deliveryTermsOther: "",
  referenceLinks: [] as string[],
};

export function SupplierRfqsPage() {
  const locale = useLocale();
  const { appUser, firebaseUser } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [items, setItems] = useState<SupplierRfqLifecycleItem[]>([]);
  const [selected, setSelected] = useState<SupplierRfqLifecycleItem | null>(null);
  const [response, setResponse] = useState<RfqResponse | null>(null);
  const [tab, setTab] = useState<"invitations" | "quotations" | "history">("invitations");
  const [cursor, setCursor] = useState<SupplierRfqLifecycleCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [form, setForm] = useState(emptyRfqResponse);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loadRequestRef = useRef(0);
  const selectionRequestRef = useRef(0);
  const text = locale === "ar" ? {
    eyebrow: "فرص التوريد",
    title: "طلبات عروض الأسعار",
    description: "راجع متطلبات المشتري وأرسل سعراً وشروط دفع وتسليم منظمة وقابلة للمقارنة.",
    empty: "لا توجد طلبات مفتوحة موجهة إلى شركتك",
    respond: "تفاصيل الطلب وعرض السعر",
    message: "تفاصيل العرض",
    messageHint: "وضح المواصفات المشمولة والاستثناءات والملاحظات الفنية.",
    price: "السعر الإجمالي",
    currency: "عملة العرض",
    delivery: "مدة التجهيز بالأيام",
    paymentTerms: "شروط الدفع المعروضة",
    paymentTermsOther: "شروط دفع أخرى",
    deliveryTerms: "طريقة وشروط التسليم المعروضة",
    deliveryTermsOther: "شروط تسليم أخرى",
    send: "إرسال العرض",
    update: "تحديث العرض",
    sent: "تم إرسال العرض",
    quantity: "الكمية",
    location: "موقع التسليم",
    closing: "تاريخ الإغلاق",
    category: "التصنيف",
    preferredCurrency: "عملة العرض المفضلة",
    requestedPayment: "شروط الدفع المطلوبة",
    requestedDelivery: "شروط التسليم المطلوبة",
    supportingLinks: "روابط المشتري الداعمة",
    confirm: "هل تريد إرسال عرض السعر إلى المشتري؟",
    closed: "انتهت مدة الطلب أو تم إغلاقه ولا يمكن إرسال عرض جديد.",
    profileRequired: "يجب اعتماد ملف شركتك وربطه بحسابك قبل إرسال عروض الأسعار.",
    required: "أكمل تفاصيل العرض والسعر وشروط الدفع والتسليم.",
    invalidLink: "استخدم روابط HTTPS عامة وآمنة فقط، وبحد أقصى خمسة روابط.",
    responseLoadError: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0639\u0631\u0636 \u0627\u0644\u0633\u0639\u0631. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649\u060c \u0648\u0625\u0630\u0627 \u0627\u0633\u062a\u0645\u0631\u062a \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0641\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062f\u0639\u0645.",
    responseSubmitError: "\u062a\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0639\u0631\u0636 \u0627\u0644\u0633\u0639\u0631. \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u062a\u0635\u0627\u0644\u0643 \u0648\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.",
    invitations: "الطلبات المفتوحة",
    quotations: "عروضي المقدمة",
    history: "السجل والمغلقة",
    loadMore: "تحميل المزيد",
    revision: "النسخة الحالية",
    firstSubmitted: "تاريخ الإرسال الأول",
    lastUpdated: "آخر تحديث",
    readOnlyResult: "تم إغلاق الطلب، ولم تُسجل نتيجة ترسية بعد.",
  } : {
    eyebrow: "Supply opportunities",
    title: "RFQ requests",
    description: "Review the buyer requirements and submit structured, comparable price, payment, and delivery terms.",
    empty: "No open requests are addressed to the company",
    respond: "Request and quotation details",
    message: "Quotation details",
    messageHint: "Clarify included specifications, exclusions, and technical notes.",
    price: "Total price",
    currency: "Quotation currency",
    delivery: "Lead time in days",
    paymentTerms: "Offered payment terms",
    paymentTermsOther: "Other payment terms",
    deliveryTerms: "Offered delivery method and terms",
    deliveryTermsOther: "Other delivery terms",
    send: "Send quotation",
    update: "Update quotation",
    sent: "Quotation sent",
    quantity: "Quantity",
    location: "Delivery location",
    closing: "Closing date",
    category: "Category",
    preferredCurrency: "Buyer preferred currency",
    requestedPayment: "Requested payment terms",
    requestedDelivery: "Requested delivery terms",
    supportingLinks: "Buyer supporting links",
    confirm: "Send this quotation to the buyer?",
    closed: "This request is closed and no longer accepts quotations.",
    profileRequired: "An approved company profile must be linked before RFQs can be received.",
    required: "Complete the price, lead time, payment terms, and delivery terms.",
    invalidLink: "Use valid HTTPS links only, with no more than five links.",
    responseLoadError: "We could not load your quotation. Try again, or contact support if the issue continues.",
    responseSubmitError: "We could not send your quotation. Check your connection and try again.",
    invitations: "Open requests",
    quotations: "My quotations",
    history: "History",
    loadMore: "Load more",
    revision: "Current revision",
    firstSubmitted: "First submitted",
    lastUpdated: "Last updated",
    readOnlyResult: "The RFQ is closed; no award result has been recorded yet.",
  };

  const load = async (nextCursor: SupplierRfqLifecycleCursor | null = null, append = false) => {
    const requestId = ++loadRequestRef.current;
    if (!firebaseUser || !appUser?.supplierProfileId) {
      setItems([]);
      setCursor(null);
      setHasMore(false);
      return;
    }
    const page = await listSupplierRfqLifecyclePage(firebaseUser.uid, appUser.supplierProfileId, nextCursor);
    if (requestId !== loadRequestRef.current) return;
    setItems((current) => {
      const merged = new Map<string, SupplierRfqLifecycleItem>();
      if (append) current.forEach((item) => merged.set(item.rfq.id, item));
      page.items.forEach((item) => {
        const previous = merged.get(item.rfq.id);
        merged.set(item.rfq.id, { rfq: item.rfq, response: item.response || previous?.response || null });
      });
      return [...merged.values()];
    });
    setCursor(page.cursor);
    setHasMore(page.hasMore);
  };

  async function selectRequest(item: SupplierRfqLifecycleItem) {
    const requestId = ++selectionRequestRef.current;
    setSelected(item);
    setResponse(item.response);
    setError("");
    if (!firebaseUser || !appUser?.supplierProfileId) return;
    try {
      const current = await getSupplierRfqResponse(item.rfq.id, firebaseUser.uid, appUser.supplierProfileId);
      if (requestId !== selectionRequestRef.current) return;
      setResponse(current);
      setSelected({ ...item, response: current });
      setForm(current ? {
        message: current.message,
        price: current.price?.toString() || "",
        currency: current.currency || "IQD",
        deliveryDays: current.deliveryDays?.toString() || "",
        paymentTerms: current.paymentTerms || "bank_transfer",
        paymentTermsOther: current.paymentTermsOther || "",
        deliveryTerms: current.deliveryTerms || "supplier_delivery",
        deliveryTermsOther: current.deliveryTermsOther || "",
        referenceLinks: current.referenceLinks || [],
      } : emptyRfqResponse);
    } catch {
      setError(text.responseLoadError);
    }
  }

  useEffect(() => {
    setItems([]);
    setSelected(null);
    setResponse(null);
    setCursor(null);
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed"));
    return () => {
      loadRequestRef.current += 1;
      selectionRequestRef.current += 1;
    };
  }, [firebaseUser?.uid, appUser?.supplierProfileId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const missingOther = (form.paymentTerms === "other" && !form.paymentTermsOther.trim())
      || (form.deliveryTerms === "other" && !form.deliveryTermsOther.trim());
    if (
      !selected
      || !firebaseUser
      || !appUser?.supplierProfileId
      || !form.message.trim()
      || !form.price
      || !form.deliveryDays
      || missingOther
    ) {
      setError(text.required);
      return;
    }
    if (!isRfqAcceptingResponses(selected.rfq)) {
      setError(text.closed);
      return;
    }
    if (!window.confirm(text.confirm)) return;
    setBusy(true);
    try {
      await submitRfqResponse({
        rfqId: selected.rfq.id,
        supplierUserId: firebaseUser.uid,
        supplierProfileId: appUser.supplierProfileId,
        message: form.message.trim(),
        price: Number(form.price),
        currency: form.currency,
        deliveryDays: Number(form.deliveryDays),
        paymentTerms: form.paymentTerms,
        paymentTermsOther: form.paymentTermsOther.trim(),
        deliveryTerms: form.deliveryTerms,
        deliveryTermsOther: form.deliveryTermsOther.trim(),
        referenceLinks: form.referenceLinks,
      });
      await selectRequest(selected);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      setError(
        message === "invalid_reference_link"
          ? text.invalidLink
          : message === "rfq_closed"
            ? text.closed
            : message === "invalid_rfq_response"
              ? text.required
              : text.responseSubmitError,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!appUser?.supplierProfileId) return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="p-5 sm:p-7"><InlineEmptyState title={text.profileRequired} body="" /></div></div>;

  const option = (item: { value: string; labelAr: string; labelEn: string }) => (
    <option value={item.value} key={item.value}>{locale === "ar" ? item.labelAr : item.labelEn}</option>
  );
  const partitions = useMemo(() => partitionSupplierRfqLifecycle(items), [items]);
  const visibleItems = partitions[tab];
  const requestLocation = selected ? [
    selected.rfq.deliveryGovernorate ? labelFor(taxonomy.governorates, selected.rfq.deliveryGovernorate, locale) : "",
    selected.rfq.deliveryAddress,
  ].filter(Boolean).join(" - ") || selected.rfq.location || "?" : "?";

  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
    <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />
    <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[0.9fr_1.1fr]">
      <DashboardPanel title={text.title}>
        <div className="mb-4 grid grid-cols-3 gap-2">{(["invitations", "quotations", "history"] as const).map((item) => <button className={`rounded-xl border px-2 py-3 text-xs font-black transition ${tab === item ? "border-river bg-river text-white" : "border-borderSoft bg-white text-ink"}`} type="button" onClick={() => setTab(item)} key={item}>{text[item]} <span className="ms-1 opacity-75">{partitions[item].length}</span></button>)}</div>
        {visibleItems.length ? <div className="grid gap-3">{visibleItems.map((item) => <button className={"rounded-xl border p-4 text-start transition " + (selected?.rfq.id === item.rfq.id ? "border-amber bg-cream shadow-card" : "border-borderSoft bg-creamLight")} type="button" onClick={() => void selectRequest(item)} key={item.rfq.id}>
          <div className="flex items-center justify-between gap-2"><h3 className="font-black">{item.rfq.title}</h3><span className="text-xs font-bold text-amber">{localizedRfqStatus(item.rfq, locale)}</span></div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.rfq.description}</p>
          <p className="mt-2 text-xs font-semibold text-muted">{item.rfq.quantity} {rfqOptionLabel(rfqUnitOptions, item.rfq.unit, locale, item.rfq.unitOther)} · {item.rfq.closingDate}</p>
          {item.response ? <p className="mt-2 text-xs font-black text-river">{localizedRfqResponseStatus(item.response.status, locale)} · V{currentRfqRevision(item.response)}</p> : null}
        </button>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}
        {hasMore ? <Button className="mt-4 w-full" variant="secondary" disabled={loadingMore} onClick={() => {
          if (!cursor) return;
          setLoadingMore(true);
          void load(cursor, true).catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")).finally(() => setLoadingMore(false));
        }}>{text.loadMore}</Button> : null}
      </DashboardPanel>

      <DashboardPanel title={selected ? text.respond + ": " + selected.rfq.title : text.respond}>
        {error ? <DashboardError message={error} /> : null}
        {selected ? <>
          {response ? <div className="mb-4 flex items-center gap-2 rounded-xl bg-successBg p-3 text-sm font-black text-mint"><CheckCircle2 className="h-5 w-5" />{text.sent}</div> : null}
          <dl className="mb-5 grid gap-3 rounded-xl border border-borderSoft bg-creamLight p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-bold text-muted">{text.quantity}</dt><dd className="mt-1 font-black">{selected.rfq.quantity} {rfqOptionLabel(rfqUnitOptions, selected.rfq.unit, locale, selected.rfq.unitOther)}</dd></div>
            <div><dt className="text-xs font-bold text-muted">{text.location}</dt><dd className="mt-1 font-black">{requestLocation}</dd></div>
            <div><dt className="text-xs font-bold text-muted">{text.closing}</dt><dd className="mt-1 font-black">{selected.rfq.closingDate}</dd></div>
            <div><dt className="text-xs font-bold text-muted">{text.category}</dt><dd className="mt-1 font-black">{labelFor(taxonomy.supplierCategories, selected.rfq.categoryId, locale)}</dd></div>
            <div><dt className="text-xs font-bold text-muted">{text.preferredCurrency}</dt><dd className="mt-1 font-black">{rfqOptionLabel(rfqPreferredCurrencyOptions, selected.rfq.preferredCurrency, locale)}</dd></div>
            <div><dt className="text-xs font-bold text-muted">{text.requestedPayment}</dt><dd className="mt-1 font-black">{rfqOptionLabel(rfqPaymentTermOptions, selected.rfq.paymentTerms, locale, selected.rfq.paymentTermsOther)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-bold text-muted">{text.requestedDelivery}</dt><dd className="mt-1 font-black">{rfqOptionLabel(rfqDeliveryTermOptions, selected.rfq.deliveryTerms, locale, selected.rfq.deliveryTermsOther)}</dd></div>
          </dl>
          <p className="mb-5 whitespace-pre-wrap text-sm leading-7 text-muted">{selected.rfq.description}</p>
          {selected.rfq.referenceLinks?.length ? <div className="mb-5 rounded-xl border border-borderSoft bg-white p-4"><div className="mb-2 text-xs font-bold text-muted">{text.supportingLinks}</div><div className="flex flex-wrap gap-2">{selected.rfq.referenceLinks.map((link, index) => <a className="inline-flex items-center gap-1 rounded-lg border border-borderSoft px-3 py-2 text-xs font-black text-river hover:border-amber hover:text-amber" href={link} key={link} rel="noreferrer" target="_blank"><ExternalLink className="h-3.5 w-3.5" />{index + 1}</a>)}</div></div> : null}
          {response ? <div className="mb-5 grid gap-2 rounded-xl border border-borderSoft bg-white p-4 text-xs sm:grid-cols-3"><div><span className="font-bold text-muted">{text.revision}</span><strong className="mt-1 block">V{currentRfqRevision(response)}</strong></div><div><span className="font-bold text-muted">{text.firstSubmitted}</span><strong className="mt-1 block">{formatWorkspaceDate(response.firstSubmittedAt || response.createdAt, locale)}</strong></div><div><span className="font-bold text-muted">{text.lastUpdated}</span><strong className="mt-1 block">{formatWorkspaceDate(response.updatedAt, locale)}</strong></div></div> : null}
          {response ? <RfqLifecycleTimeline rfq={selected.rfq} response={response} locale={locale} /> : null}
          {isRfqAcceptingResponses(selected.rfq) ? <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            <TextAreaField label={text.message} hint={text.messageHint} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} maxLength={2000} required />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label={text.price} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} type="number" min="0" step="0.01" required />
              <SelectField label={text.currency} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as "IQD" | "USD" })} required>
                {rfqPreferredCurrencyOptions.filter((item) => item.value !== "either").map(option)}
              </SelectField>
              <TextField label={text.delivery} value={form.deliveryDays} onChange={(event) => setForm({ ...form, deliveryDays: event.target.value })} type="number" min="1" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label={text.paymentTerms} value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value, paymentTermsOther: event.target.value === "other" ? form.paymentTermsOther : "" })} required>
                {rfqPaymentTermOptions.map(option)}
              </SelectField>
              {form.paymentTerms === "other" ? <TextField label={text.paymentTermsOther} value={form.paymentTermsOther} onChange={(event) => setForm({ ...form, paymentTermsOther: event.target.value })} maxLength={120} required /> : null}
              <SelectField label={text.deliveryTerms} value={form.deliveryTerms} onChange={(event) => setForm({ ...form, deliveryTerms: event.target.value, deliveryTermsOther: event.target.value === "other" ? form.deliveryTermsOther : "" })} required>
                {rfqDeliveryTermOptions.map(option)}
              </SelectField>
              {form.deliveryTerms === "other" ? <TextField label={text.deliveryTermsOther} value={form.deliveryTermsOther} onChange={(event) => setForm({ ...form, deliveryTermsOther: event.target.value })} maxLength={120} required /> : null}
            </div>
            <RfqReferenceLinks locale={locale} links={form.referenceLinks} onChange={(referenceLinks) => setForm({ ...form, referenceLinks })} />
            <DisabledFileUpload locale={locale} purpose="rfq_attachment" compact />
            <Button type="submit" disabled={busy}><Send className="h-4 w-4" />{response ? text.update : text.send}</Button>
          </form> : <DashboardError message={response ? text.readOnlyResult : text.closed} />}
          {response ? <RfqRevisionHistory
            response={response}
            locale={locale}
            scope={{
              viewer: "supplier",
              buyerId: selected.rfq.buyerId,
              supplierUserId: response.supplierUserId,
              supplierProfileId: response.supplierProfileId,
            }}
          /> : null}
        </> : <InlineEmptyState title={text.empty} body={text.description} />}
      </DashboardPanel>
    </div>
  </div>;
}

export function SupplierAnalyticsPage() {
  const locale = useLocale();
  const { appUser, firebaseUser } = useAuth();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState(0);
  const [documents, setDocuments] = useState(0);
  const [error, setError] = useState("");
  const loadRequestRef = useRef(0);
  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const supplierId = appUser?.supplierProfileId;
    const ownerUserId = firebaseUser?.uid;
    if (!supplierId || !ownerUserId) {
      if (loadRequestRef.current === requestId) { setSupplier(null); setProducts(0); setDocuments(0); setError(""); }
      return;
    }
    setError("");
    const results = await Promise.allSettled([
      getSupplier(supplierId),
      listSupplierProducts(supplierId, ownerUserId),
      listSupplierDocuments(supplierId, ownerUserId),
    ]);
    if (loadRequestRef.current !== requestId) return;
    setSupplier(results[0].status === "fulfilled" ? results[0].value : null);
    setProducts(results[1].status === "fulfilled" ? results[1].value.length : 0);
    setDocuments(results[2].status === "fulfilled" ? results[2].value.length : 0);
    if (results.some((result) => result.status === "rejected")) {
      setError(locale === "ar" ? "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0628\u0639\u0636 \u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a \u0645\u0644\u0641 \u0627\u0644\u0634\u0631\u0643\u0629. \u064a\u0631\u062c\u0649 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629." : "Some company profile metrics could not be loaded. Please retry.");
    }
  }, [appUser?.supplierProfileId, firebaseUser?.uid, locale]);
  useEffect(() => {
    void load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);
  const completion = useMemo(() => { if (!supplier) return 0; const fields = [supplier.displayName || supplier.nameOriginal, supplier.categories.length, supplier.phones.length, supplier.governorate, supplier.email || supplier.website, products, documents]; return Math.round(fields.filter(Boolean).length / fields.length * 100); }, [supplier, products, documents]);
  const text = locale === "ar" ? { eyebrow: "أداء الملف", title: "إحصائيات الملف", description: "مؤشرات حقيقية مشتقة من بيانات الشركة الحالية. الزيارات والظهور لا تُعرض قبل تفعيل القياس.", completion: "اكتمال الملف", rating: "متوسط التقييم", reviews: "عدد المراجعات", products: "المنتجات والخدمات", documents: "بيانات المستندات", views: "الزيارات", unavailable: "غير مقاسة بعد" } : { eyebrow: "Profile performance", title: "Profile analytics", description: "Factual metrics derived from current company data. Views and impressions are not shown before tracking is enabled.", completion: "Profile completion", rating: "Average rating", reviews: "Review count", products: "Products & services", documents: "Document metadata", views: "Views", unavailable: "Not measured yet" };
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7">{error ? <DashboardError message={error} retry={() => void load()} /> : null}{supplier ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label={text.rating} value={supplier.averageRating?.toFixed(1) || "0.0"} icon={BarChart3} /><MetricCard label={text.reviews} value={supplier.reviewCount || 0} icon={FileCheck2} /><MetricCard label={text.products} value={products} icon={Boxes} /><MetricCard label={text.documents} value={documents} icon={FileText} /><MetricCard label={text.views} value="—" helper={text.unavailable} icon={BarChart3} /></div><DashboardPanel title={text.completion}><ProgressBar value={completion} label={text.completion} /></DashboardPanel></> : <MissingSupplierProfile locale={locale} />}</div></div>;
}

export { AccountSettingsPage as SupplierSettingsPage, WorkspaceMessagesPage as SupplierMessagesPage, WorkspaceNotificationsPage as SupplierNotificationsPage };
