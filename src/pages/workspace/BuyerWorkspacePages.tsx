import { Bell, BookOpen, CheckCheck, CheckCircle2, ExternalLink, FilePlus2, Heart, Loader2, Mail, Plus, RefreshCw, Search, Send, Settings, Star, Tags, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DisabledFileUpload } from "../../components/DisabledFileUpload";
import { RfqReferenceLinks } from "../../components/RfqReferenceLinks";
import { RfqRevisionHistory } from "../../components/RfqRevisionHistory";
import { DashboardError, DashboardPageHeader, DashboardPanel, DashboardSkeleton, InlineEmptyState } from "../../components/DashboardPrimitives";
import { Button, SelectField, TextAreaField, TextField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { labelFor } from "../../data/constants";
import { rfqDeliveryTermOptions, rfqOptionLabel, rfqPaymentTermOptions, rfqPreferredCurrencyOptions, rfqUnitOptions } from "../../data/rfqOptions";
import { auth } from "../../config/firebase";
import { getEmailActionSettings } from "../../config/site";
import { sendPasswordResetEmail } from "firebase/auth";
import { getSupplier, listSupplierCandidates } from "../../services/firestore";
import {
  createRfq,
  listBuyerRfqs,
  listConversationMessages,
  listConversations,
  listFavorites,
  listRfqResponses,
  removeFavorite,
  sendConversationMessage,
  updateRfqStatus,
} from "../../services/workspace";
import type { Conversation, ConversationMessage, FavoriteSupplier, RfqRecord, RfqResponse } from "../../types/workspace";
import { toDate } from "../../utils/date";
import { localizedRfqResponseStatus } from "../../utils/rfqLifecycle";

function useLocale() {
  const { i18n } = useTranslation();
  return i18n.language.startsWith("ar") ? "ar" as const : "en" as const;
}

function formatDate(value: unknown, locale: "ar" | "en") {
  const date = toDate(value as never);
  return date ? new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
}

export function BuyerCategoriesPage() {
  const locale = useLocale();
  const { taxonomy } = useTaxonomy();
  const [search, setSearch] = useState("");
  const filtered = taxonomy.supplierCategories.filter((item) => `${item.labelAr} ${item.labelEn}`.toLowerCase().includes(search.toLowerCase()));
  const text = locale === "ar"
    ? { eyebrow: "دليل التوريد", title: "التصنيفات", description: "ابحث داخل التصنيفات وافتح المجهزين المرتبطين بكل مجال.", search: "ابحث في التصنيفات...", open: "عرض المجهزين", empty: "لا توجد تصنيفات مطابقة" }
    : { eyebrow: "Sourcing directory", title: "Categories", description: "Search the category catalogue and open suppliers related to each field.", search: "Search categories...", open: "View suppliers", empty: "No matching categories" };
  return (
    <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
      <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />
      <div className="grid gap-5 p-5 sm:p-7">
        <label className="relative"><Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="h-12 w-full rounded-xl border border-borderSoft bg-white ps-11 pe-4 text-sm font-bold outline-none focus:border-amber" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} /></label>
        {filtered.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <article className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card" key={item.value}><span className="grid h-11 w-11 place-items-center rounded-xl bg-cream text-amber"><Tags className="h-5 w-5" /></span><h3 className="mt-4 text-base font-black">{locale === "ar" ? item.labelAr : item.labelEn}</h3><Link className="mt-4 inline-flex items-center gap-2 text-sm font-black text-amber hover:text-ink" to={`/directory?category=${encodeURIComponent(item.value)}`}><BookOpen className="h-4 w-4" />{text.open}</Link></article>)}</div> : <InlineEmptyState title={text.empty} body="" />}
      </div>
    </div>
  );
}

export function BuyerFavoritesPage() {
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<FavoriteSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const text = locale === "ar"
    ? { eyebrow: "قائمة التوريد", title: "المفضلة", description: "الشركات التي حفظتها للعودة إليها والمقارنة بينها.", empty: "لم تضف أي مجهز إلى المفضلة بعد", emptyBody: "افتح دليل المجهزين، ثم استخدم زر المفضلة في صفحة الشركة.", open: "فتح الملف", remove: "إزالة" }
    : { eyebrow: "Sourcing shortlist", title: "Favorites", description: "Suppliers saved for later review and comparison.", empty: "You have not saved any suppliers yet", emptyBody: "Open the supplier directory and use the favorite action on a company profile.", open: "Open profile", remove: "Remove" };
  const load = async () => {
    if (!firebaseUser) return;
    setLoading(true); setError("");
    try { setItems(await listFavorites(firebaseUser.uid)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed"); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [firebaseUser?.uid]);
  if (loading) return <DashboardSkeleton />;
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-4 p-5 sm:p-7">{error ? <DashboardError message={error} retry={() => void load()} /> : null}{items.length ? items.map((item) => <article className="flex flex-col gap-4 rounded-[16px] border border-borderSoft bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between" key={item.id}><div><h3 className="font-black">{item.supplierName}</h3><p className="mt-1 text-xs font-semibold text-muted">{item.governorate || "—"} · {(item.categories || []).join(", ") || "—"}</p></div><div className="flex gap-2"><Link to={`/suppliers/${item.supplierId}`}><Button variant="secondary"><Star className="h-4 w-4" />{text.open}</Button></Link><Button variant="ghost" onClick={() => void removeFavorite(item.userId, item.supplierId).then(load)}><Trash2 className="h-4 w-4" />{text.remove}</Button></div></article>) : <InlineEmptyState title={text.empty} body={text.emptyBody} />}</div></div>;
}

const initialRfq = {
  title: "",
  description: "",
  quantity: "1",
  unit: "piece",
  unitOther: "",
  location: "",
  deliveryGovernorate: "",
  deliveryAddress: "",
  preferredCurrency: "either" as "IQD" | "USD" | "either",
  paymentTerms: "bank_transfer",
  paymentTermsOther: "",
  deliveryTerms: "supplier_delivery",
  deliveryTermsOther: "",
  referenceLinks: [] as string[],
  closingDate: "",
  categoryId: "",
  recipientIds: [] as string[],
};

type BuyerResponseView = RfqResponse & { supplierName: string };

export function BuyerRfqsPage() {
  const locale = useLocale();
  const [searchParams] = useSearchParams();
  const requestedSupplierId = searchParams.get("supplier") || "";
  const requestedCategoryId = searchParams.get("category") || "";
  const { firebaseUser, hasActiveAccess } = useAuth();
  const { taxonomy } = useTaxonomy();
  const responsesPanelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<RfqRecord[]>([]);
  const [selected, setSelected] = useState<RfqRecord | null>(null);
  const [responses, setResponses] = useState<BuyerResponseView[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responseError, setResponseError] = useState("");
  const [form, setForm] = useState(() => ({
    ...initialRfq,
    categoryId: requestedCategoryId,
    recipientIds: requestedSupplierId ? [requestedSupplierId] : [],
  }));
  const [candidates, setCandidates] = useState<Array<{ id: string; displayName: string; nameOriginal: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const text = locale === "ar" ? {
    eyebrow: "دورة الشراء",
    title: "طلبات عروض الأسعار",
    description: "أنشئ طلباً منظماً قابلاً للتحليل، ثم قارن عروض المجهزين المستلمة في مكان واحد.",
    newTitle: "إنشاء طلب عرض سعر",
    titleLabel: "عنوان الطلب",
    desc: "وصف المادة أو الخدمة",
    quantity: "الكمية",
    unit: "الوحدة",
    unitOther: "اسم الوحدة الأخرى",
    governorate: "محافظة التسليم",
    address: "عنوان التسليم التفصيلي",
    addressHint: "مثال: بغداد، الكرادة، شارع 62، مخزن الشركة.",
    close: "تاريخ إغلاق استلام العروض",
    category: "التصنيف",
    preferredCurrency: "عملة العرض المفضلة",
    paymentTerms: "شروط الدفع المفضلة",
    paymentTermsOther: "شروط دفع أخرى",
    deliveryTerms: "طريقة وشروط التسليم المفضلة",
    deliveryTermsOther: "شروط تسليم أخرى",
    recipients: "المجهزون المستهدفون",
    publish: "نشر الطلب",
    draft: "حفظ كمسودة",
    empty: "لا توجد طلبات حتى الآن",
    inactive: "يجب أن يكون وصولك فعالاً لإرسال الطلب إلى المجهزين.",
    none: "لا يوجد مجهزون مؤهلون لهذا التصنيف حتى الآن.",
    saved: "تم حفظ طلب عرض السعر.",
    required: "أكمل الحقول المطلوبة والخيارات المرتبطة بخيار أخرى.",
    recipientRequired: "اختر مجهزاً واحداً على الأقل قبل نشر الطلب.",
    invalidDate: "يجب أن يكون تاريخ الإغلاق اليوم أو لاحقاً.",
    invalidLink: "استخدم روابط HTTPS عامة وآمنة فقط، وبحد أقصى خمسة روابط.",
    confirmPublish: "هل تريد نشر الطلب وإرساله إلى المجهزين المحددين؟",
    responses: "العروض المستلمة والمقارنة",
    selectRequest: "اختر طلباً من القائمة لعرض المقارنة.",
    noResponses: "لم يصل أي عرض لهذا الطلب بعد.",
    closeRequest: "إغلاق الطلب",
    publishDraft: "نشر المسودة",
    view: "عرض ومقارنة",
    price: "السعر",
    delivery: "مدة التجهيز",
    days: "يوم",
    publishedOnly: "يجب نشر الطلب قبل استلام العروض.",
    confirmClose: "هل تريد إغلاق هذا الطلب؟ لن تُقبل عروض جديدة بعد الإغلاق.",
    requestedTerms: "الشروط المطلوبة",
    offeredPayment: "شروط الدفع المعروضة",
    offeredDelivery: "شروط التسليم المعروضة",
    links: "الروابط الداعمة",
    loading: "جارٍ تحميل العروض...",
    quotation: "عرض",
  } : {
    eyebrow: "Procurement cycle",
    title: "RFQ requests",
    description: "Create a structured, analysis-ready request and compare received quotations in one place.",
    newTitle: "Create RFQ",
    titleLabel: "Request title",
    desc: "Material or service description",
    quantity: "Quantity",
    unit: "Unit",
    unitOther: "Other unit name",
    governorate: "Delivery governorate",
    address: "Detailed delivery address",
    addressHint: "Example: Baghdad, Karrada, Street 62, company warehouse.",
    close: "Quotation closing date",
    category: "Category",
    preferredCurrency: "Preferred quotation currency",
    paymentTerms: "Preferred payment terms",
    paymentTermsOther: "Other payment terms",
    deliveryTerms: "Preferred delivery method and terms",
    deliveryTermsOther: "Other delivery terms",
    recipients: "Recipient suppliers",
    publish: "Publish request",
    draft: "Save draft",
    empty: "No requests yet",
    inactive: "Active access is required to select suppliers and publish; you can still save a draft.",
    none: "No account-enabled suppliers are available for this category.",
    saved: "The RFQ was saved.",
    required: "Complete the required fields and any selected Other option.",
    recipientRequired: "Select at least one supplier before publishing.",
    invalidDate: "Choose today or a future closing date.",
    invalidLink: "Use valid HTTPS links only, with no more than five links.",
    confirmPublish: "Publish this RFQ and notify the selected suppliers?",
    responses: "Received quotations and comparison",
    selectRequest: "Select a request from the list to review its quotations.",
    noResponses: "No quotation has been received for this request.",
    closeRequest: "Close request",
    publishDraft: "Publish draft",
    view: "View and compare",
    price: "Price",
    delivery: "Lead time",
    days: "days",
    publishedOnly: "Quotations appear after the request is published.",
    confirmClose: "Close this request? Suppliers will no longer be able to submit quotations.",
    requestedTerms: "Requested RFQ details",
    offeredPayment: "Offered payment terms",
    offeredDelivery: "Offered delivery terms",
    links: "Supporting links",
    loading: "Loading quotations...",
    quotation: "quotation",
  };

  const load = async () => {
    if (!firebaseUser) return [];
    const values = await listBuyerRfqs(firebaseUser.uid);
    setItems(values);
    setSelected((current) => current ? values.find((item) => item.id === current.id) || null : current);
    return values;
  };

  async function openRequest(item: RfqRecord) {
    setSelected(item);
    setResponses([]);
    setResponseError("");
    setResponsesLoading(item.status !== "draft");
    if (item.status === "draft") {
      setResponsesLoading(false);
      return;
    }
    try {
      const values = await listRfqResponses(item.id);
      const enriched = await Promise.all(values.map(async (response) => {
        const supplier = await getSupplier(response.supplierProfileId).catch(() => null);
        return { ...response, supplierName: supplier?.displayName || supplier?.nameOriginal || response.supplierProfileId };
      }));
      setResponses(enriched);
    } catch (reason) {
      setResponseError(reason instanceof Error ? reason.message : "Failed");
    } finally {
      setResponsesLoading(false);
    }
  }

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed"));
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!form.categoryId || !hasActiveAccess) {
      setCandidates([]);
      return;
    }
    void listSupplierCandidates([form.categoryId])
      .then((records) => setCandidates(records.map((item) => ({ id: item.id, displayName: item.displayName, nameOriginal: item.nameOriginal }))))
      .catch(() => setCandidates([]));
  }, [form.categoryId, hasActiveAccess]);

  useEffect(() => {
    if (!selected) return;
    const timer = window.setTimeout(() => responsesPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => window.clearTimeout(timer);
  }, [selected?.id]);

  async function submit(status: "draft" | "published") {
    setError("");
    setNotice("");
    const missingOther = (form.unit === "other" && !form.unitOther.trim())
      || (form.paymentTerms === "other" && !form.paymentTermsOther.trim())
      || (form.deliveryTerms === "other" && !form.deliveryTermsOther.trim());
    if (
      !firebaseUser
      || !form.title.trim()
      || !form.description.trim()
      || !form.unit
      || !form.deliveryGovernorate
      || !form.deliveryAddress.trim()
      || !form.closingDate
      || !form.categoryId
      || missingOther
    ) {
      setError(text.required);
      return;
    }
    if (Date.parse(form.closingDate + "T23:59:59") < Date.now()) {
      setError(text.invalidDate);
      return;
    }
    if (status === "published" && form.recipientIds.length === 0) {
      setError(text.recipientRequired);
      return;
    }
    if (status === "published" && !window.confirm(text.confirmPublish)) return;
    setBusy(true);
    try {
      const location = [form.deliveryGovernorate, form.deliveryAddress.trim()].filter(Boolean).join(" - ");
      const id = await createRfq(firebaseUser.uid, {
        title: form.title.trim(),
        description: form.description.trim(),
        quantity: Math.max(1, Number(form.quantity) || 1),
        unit: form.unit,
        unitOther: form.unitOther.trim(),
        location,
        deliveryGovernorate: form.deliveryGovernorate,
        deliveryAddress: form.deliveryAddress.trim(),
        preferredCurrency: form.preferredCurrency,
        paymentTerms: form.paymentTerms,
        paymentTermsOther: form.paymentTermsOther.trim(),
        deliveryTerms: form.deliveryTerms,
        deliveryTermsOther: form.deliveryTermsOther.trim(),
        referenceLinks: form.referenceLinks,
        closingDate: form.closingDate,
        categoryId: form.categoryId,
        recipientIds: form.recipientIds,
        status,
      });
      setForm(initialRfq);
      setNotice(text.saved);
      const values = await load();
      const created = values.find((item) => item.id === id);
      if (created) await openRequest(created);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Failed";
      setError(message === "invalid_reference_link" ? text.invalidLink : message);
    } finally {
      setBusy(false);
    }
  }

  async function publishDraft(item: RfqRecord) {
    setError("");
    if (!item.recipientIds.length) {
      setError(text.recipientRequired);
      return;
    }
    if (!window.confirm(text.confirmPublish)) return;
    try {
      await updateRfqStatus(item.id, "published");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed");
    }
  }

  async function closeRequest(item: RfqRecord) {
    if (!window.confirm(text.confirmClose)) return;
    try {
      await updateRfqStatus(item.id, "closed");
      await load();
      setSelected(null);
      setResponses([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed");
    }
  }

  const minimumDate = new Date().toISOString().slice(0, 10);
  const option = (item: { value: string; labelAr: string; labelEn: string }) => (
    <option value={item.value} key={item.value}>{locale === "ar" ? item.labelAr : item.labelEn}</option>
  );
  const requestedLocation = (item: RfqRecord) => {
    const governorate = item.deliveryGovernorate
      ? labelFor(taxonomy.governorates, item.deliveryGovernorate, locale)
      : "";
    return [governorate, item.deliveryAddress].filter(Boolean).join(" - ") || item.location || "—";
  };

  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
    <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} />
    <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[1.05fr_0.95fr]">
      <DashboardPanel title={text.newTitle}>
        {error ? <DashboardError message={error} /> : null}
        {notice ? <div className="mb-4 flex items-center gap-2 rounded-xl bg-successBg p-3 text-sm font-black text-mint"><CheckCircle2 className="h-5 w-5" />{notice}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={text.titleLabel} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} required />
          <TextField label={text.quantity} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} type="number" min="1" required />
          <SelectField label={text.unit} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value, unitOther: event.target.value === "other" ? form.unitOther : "" })} required>
            {rfqUnitOptions.map(option)}
          </SelectField>
          {form.unit === "other" ? <TextField label={text.unitOther} value={form.unitOther} onChange={(event) => setForm({ ...form, unitOther: event.target.value })} maxLength={120} required /> : null}
          <SelectField label={text.governorate} value={form.deliveryGovernorate} onChange={(event) => setForm({ ...form, deliveryGovernorate: event.target.value })} required>
            <option value="">{text.governorate}</option>
            {taxonomy.governorates.map(option)}
          </SelectField>
          <TextField label={text.address} hint={text.addressHint} value={form.deliveryAddress} onChange={(event) => setForm({ ...form, deliveryAddress: event.target.value })} maxLength={300} required />
          <TextField label={text.close} value={form.closingDate} onChange={(event) => setForm({ ...form, closingDate: event.target.value })} type="date" min={minimumDate} required />
          <SelectField label={text.category} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value, recipientIds: [] })} required>
            <option value="">{text.category}</option>
            {taxonomy.supplierCategories.map(option)}
          </SelectField>
          <SelectField label={text.preferredCurrency} value={form.preferredCurrency} onChange={(event) => setForm({ ...form, preferredCurrency: event.target.value as "IQD" | "USD" | "either" })} required>
            {rfqPreferredCurrencyOptions.map(option)}
          </SelectField>
          <SelectField label={text.paymentTerms} value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value, paymentTermsOther: event.target.value === "other" ? form.paymentTermsOther : "" })} required>
            {rfqPaymentTermOptions.map(option)}
          </SelectField>
          {form.paymentTerms === "other" ? <TextField label={text.paymentTermsOther} value={form.paymentTermsOther} onChange={(event) => setForm({ ...form, paymentTermsOther: event.target.value })} maxLength={120} required /> : null}
          <SelectField label={text.deliveryTerms} value={form.deliveryTerms} onChange={(event) => setForm({ ...form, deliveryTerms: event.target.value, deliveryTermsOther: event.target.value === "other" ? form.deliveryTermsOther : "" })} required>
            {rfqDeliveryTermOptions.map(option)}
          </SelectField>
          {form.deliveryTerms === "other" ? <TextField label={text.deliveryTermsOther} value={form.deliveryTermsOther} onChange={(event) => setForm({ ...form, deliveryTermsOther: event.target.value })} maxLength={120} required /> : null}
          <TextAreaField className="sm:col-span-2" label={text.desc} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} required />
        </div>
        <div className="mt-4 grid gap-4">
          <RfqReferenceLinks locale={locale} links={form.referenceLinks} onChange={(referenceLinks) => setForm({ ...form, referenceLinks })} />
          <DisabledFileUpload locale={locale} purpose="rfq_attachment" accepted="PDF, XLSX, JPG, PNG" maximumSize="10 MB" compact />
        </div>
        <div className="mt-4">
          <div className="mb-2 text-sm font-black">{text.recipients}</div>
          {!hasActiveAccess ? <p className="text-xs font-bold text-clay">{text.inactive}</p> : candidates.length ? <div className="grid gap-2 sm:grid-cols-2">{candidates.map((supplier) => <label className="flex items-center gap-2 rounded-xl border border-borderSoft bg-creamLight p-3 text-xs font-bold" key={supplier.id}><input type="checkbox" checked={form.recipientIds.includes(supplier.id)} onChange={(event) => setForm({ ...form, recipientIds: event.target.checked ? [...form.recipientIds, supplier.id] : form.recipientIds.filter((id) => id !== supplier.id) })} />{supplier.displayName || supplier.nameOriginal}</label>)}</div> : <p className="text-xs font-semibold text-muted">{text.none}</p>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !hasActiveAccess} onClick={() => void submit("published")}><Send className="h-4 w-4" />{text.publish}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void submit("draft")}><FilePlus2 className="h-4 w-4" />{text.draft}</Button>
        </div>
      </DashboardPanel>

      <DashboardPanel title={text.title}>
        {items.length ? <div className="grid gap-3">{items.map((item) => <article className={"rounded-xl border p-4 transition " + (selected?.id === item.id ? "border-amber bg-cream shadow-card" : "border-borderSoft bg-creamLight")} key={item.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-black">{item.title}</h3><p className="mt-1 text-xs font-semibold text-muted">{labelFor(taxonomy.supplierCategories, item.categoryId, locale)} / {item.quantity} {rfqOptionLabel(rfqUnitOptions, item.unit, locale, item.unitOther)}</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber">{item.status}</span>
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{item.description}</p>
          <p className="mt-2 text-xs font-semibold text-muted">{requestedLocation(item)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" aria-controls="rfq-comparison" onClick={() => void openRequest(item)}>{text.view}</Button>
            {item.status === "draft" ? <Button type="button" variant="secondary" disabled={!hasActiveAccess} onClick={() => void publishDraft(item)}>{text.publishDraft}</Button> : null}
            {!["closed", "cancelled"].includes(item.status) ? <Button type="button" variant="ghost" onClick={() => void closeRequest(item)}>{text.closeRequest}</Button> : null}
          </div>
        </article>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}
      </DashboardPanel>

      <div className="scroll-mt-24 xl:col-span-2" id="rfq-comparison" ref={responsesPanelRef}>
        <DashboardPanel title={selected ? text.responses + ": " + selected.title : text.responses}>
          {selected ? <>
            <div className="mb-5 grid gap-3 rounded-xl border border-borderSoft bg-creamLight p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><div className="text-xs font-bold text-muted">{text.quantity}</div><div className="mt-1 font-black">{selected.quantity} {rfqOptionLabel(rfqUnitOptions, selected.unit, locale, selected.unitOther)}</div></div>
              <div><div className="text-xs font-bold text-muted">{text.governorate}</div><div className="mt-1 font-black">{requestedLocation(selected)}</div></div>
              <div><div className="text-xs font-bold text-muted">{text.paymentTerms}</div><div className="mt-1 font-black">{rfqOptionLabel(rfqPaymentTermOptions, selected.paymentTerms, locale, selected.paymentTermsOther)}</div></div>
              <div><div className="text-xs font-bold text-muted">{text.deliveryTerms}</div><div className="mt-1 font-black">{rfqOptionLabel(rfqDeliveryTermOptions, selected.deliveryTerms, locale, selected.deliveryTermsOther)}</div></div>
            </div>
            {selected.status === "draft" ? <InlineEmptyState title={text.publishedOnly} body="" /> : responsesLoading ? <div className="flex min-h-40 items-center justify-center gap-3 text-sm font-black text-muted"><Loader2 className="h-5 w-5 animate-spin text-amber" />{text.loading}</div> : responseError ? <DashboardError message={responseError} retry={() => void openRequest(selected)} /> : responses.length ? <>
              <div className="mb-4 text-sm font-black text-ink">{responses.length} {text.quotation}</div>
              <div className="grid gap-4 lg:grid-cols-2">{responses.map((response) => <article className="rounded-xl border border-borderSoft bg-white p-5 shadow-card" key={response.id}>
                <div className="flex items-start justify-between gap-3"><h3 className="font-black">{response.supplierName}</h3><span className="rounded-full bg-successBg px-3 py-1 text-xs font-black text-mint">{localizedRfqResponseStatus(response.status, locale)}</span></div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{response.message}</p>
                <dl className="mt-4 grid gap-3 rounded-xl bg-creamLight p-4 text-xs sm:grid-cols-2">
                  <div><dt className="font-bold text-muted">{text.price}</dt><dd className="mt-1 text-base font-black">{response.price ?? "—"} {response.price !== undefined ? response.currency : ""}</dd></div>
                  <div><dt className="font-bold text-muted">{text.delivery}</dt><dd className="mt-1 text-base font-black">{response.deliveryDays ?? "—"} {response.deliveryDays ? text.days : ""}</dd></div>
                  <div><dt className="font-bold text-muted">{text.offeredPayment}</dt><dd className="mt-1 font-black">{rfqOptionLabel(rfqPaymentTermOptions, response.paymentTerms, locale, response.paymentTermsOther)}</dd></div>
                  <div><dt className="font-bold text-muted">{text.offeredDelivery}</dt><dd className="mt-1 font-black">{rfqOptionLabel(rfqDeliveryTermOptions, response.deliveryTerms, locale, response.deliveryTermsOther)}</dd></div>
                </dl>
                {response.referenceLinks?.length ? <div className="mt-4"><div className="mb-2 text-xs font-bold text-muted">{text.links}</div><div className="flex flex-wrap gap-2">{response.referenceLinks.map((link, index) => <a className="inline-flex items-center gap-1 rounded-lg border border-borderSoft px-3 py-2 text-xs font-black text-river hover:border-amber hover:text-amber" href={link} key={link} rel="noreferrer" target="_blank"><ExternalLink className="h-3.5 w-3.5" />{index + 1}</a>)}</div></div> : null}
                <RfqRevisionHistory
                  response={response}
                  locale={locale}
                  scope={{ viewer: "buyer", buyerId: selected.buyerId }}
                />
              </article>)}</div>
            </> : <InlineEmptyState title={text.noResponses} body="" />}
          </> : <InlineEmptyState title={text.selectRequest} body="" />}
        </DashboardPanel>
      </div>
    </div>
  </div>;
}

export function WorkspaceMessagesPage() {
  const locale = useLocale();
  const [searchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("conversation") || "";
  const { firebaseUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState(requestedConversationId);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const text = locale === "ar" ? { eyebrow: "التواصل", title: "الرسائل", description: "محادثات مهنية مرتبطة بالمجهزين وطلبات عروض الأسعار.", empty: "لا توجد محادثات بعد", emptyBody: "تبدأ المحادثة من ملف المجهز أو من طلب عرض سعر فعلي.", placeholder: "اكتب رسالة مهنية...", send: "إرسال", choose: "اختر محادثة" } : { eyebrow: "Communication", title: "Messages", description: "Professional conversations connected to suppliers and RFQ workflows.", empty: "No conversations yet", emptyBody: "A conversation starts from a supplier profile or a real RFQ.", placeholder: "Write a professional message...", send: "Send", choose: "Choose a conversation" };
  const load = async () => { if (firebaseUser) { const records = await listConversations(firebaseUser.uid); setConversations(records); setSelected((current) => current && records.some((item) => item.id === current) ? current : records.find((item) => item.id === requestedConversationId)?.id || records[0]?.id || ""); } };
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")); }, [firebaseUser?.uid]);
  useEffect(() => { if (selected) void listConversationMessages(selected).then(setMessages).catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")); else setMessages([]); }, [selected]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!firebaseUser || !selected || !body.trim()) return; await sendConversationMessage(selected, firebaseUser.uid, body); setBody(""); setMessages(await listConversationMessages(selected)); await load(); }
  const selectedConversation = conversations.find((item) => item.id === selected);
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid min-h-[35rem] gap-5 p-5 sm:p-7 lg:grid-cols-[20rem_1fr]"><DashboardPanel title={text.title}>{error ? <DashboardError message={error} /> : conversations.length ? <div className="grid gap-2">{conversations.map((item) => { const other = Object.entries(item.participantLabels || {}).find(([id]) => id !== firebaseUser?.uid)?.[1] || item.supplierId || "Conversation"; return <button className={`rounded-xl border p-3 text-start ${selected === item.id ? "border-amber bg-cream" : "border-borderSoft bg-white"}`} type="button" onClick={() => setSelected(item.id)} key={item.id}><div className="font-black">{other}</div><div className="mt-1 truncate text-xs font-semibold text-muted">{item.lastMessage || "—"}</div></button>; })}</div> : <InlineEmptyState compact title={text.empty} body={text.emptyBody} />}</DashboardPanel><DashboardPanel title={selectedConversation ? Object.entries(selectedConversation.participantLabels || {}).find(([id]) => id !== firebaseUser?.uid)?.[1] || text.title : text.choose}>{selected ? <><div className="grid max-h-[24rem] gap-3 overflow-y-auto rounded-xl bg-creamLight p-3">{messages.map((message) => <div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-6 ${message.senderId === firebaseUser?.uid ? "ms-auto bg-navy text-white" : "me-auto border border-borderSoft bg-white text-ink"}`} key={message.id}><p>{message.body}</p><span className="mt-1 block text-[10px] opacity-65">{formatDate(message.createdAt, locale)}</span></div>)}</div><form className="mt-4 grid gap-3" onSubmit={(event) => void submit(event)}><TextAreaField label={text.placeholder} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} /><DisabledFileUpload locale={locale} purpose="message_attachment" compact /><Button type="submit"><Send className="h-4 w-4" />{text.send}</Button></form></> : <InlineEmptyState title={text.empty} body={text.emptyBody} />}</DashboardPanel></div></div>;
}

export function WorkspaceNotificationsPage() {
  const locale = useLocale();
  const {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    markRead,
    markAllRead,
  } = useNotifications();
  const text = locale === "ar"
    ? { eyebrow: "مركز التنبيهات", title: "الإشعارات", description: "تحديثات الاعتماد والرسائل وطلبات الأسعار والوصول.", all: "تحديد الكل كمقروء", allLoaded: "تحديد الإشعارات المحملة كمقروءة", empty: "لا توجد إشعارات", open: "فتح", refresh: "تحديث", more: "تحميل المزيد" }
    : { eyebrow: "Notification center", title: "Notifications", description: "Approval, messaging, RFQ, and access updates.", all: "Mark all as read", allLoaded: "Mark loaded notifications as read", empty: "No notifications", open: "Open", refresh: "Refresh", more: "Load more" };

  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
    <DashboardPageHeader
      eyebrow={text.eyebrow}
      title={text.title}
      description={text.description}
      actions={<>
        <Button variant="secondary" onClick={refresh}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{text.refresh}</Button>
        <Button variant="secondary" onClick={() => void markAllRead()}><CheckCheck className="h-4 w-4" />{hasMore ? text.allLoaded : text.all}</Button>
      </>}
    />
    <div className="grid gap-3 p-5 sm:p-7">
      {error ? <DashboardError message={error} retry={refresh} /> : items.length ? items.map((item) => <article className={`flex flex-col gap-3 rounded-[16px] border p-4 sm:flex-row sm:items-center sm:justify-between ${item.read ? "border-borderSoft bg-white/70" : "border-amber/35 bg-white shadow-card"}`} key={item.id}>
        <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-amber"><Bell className="h-5 w-5" /></span><div><h3 className="font-black">{locale === "ar" ? item.titleAr : item.titleEn}</h3><p className="mt-1 text-sm leading-6 text-muted">{locale === "ar" ? item.bodyAr : item.bodyEn}</p><span className="mt-1 block text-[11px] font-semibold text-muted">{formatDate(item.createdAt, locale)}</span></div></div>
        <div className="flex gap-2">{item.link ? <Link to={item.link}><Button variant="secondary">{text.open}</Button></Link> : null}{!item.read ? <Button variant="ghost" onClick={() => void markRead(item.id)}><CheckCheck className="h-4 w-4" /></Button> : null}</div>
      </article>) : loading ? <DashboardSkeleton /> : <InlineEmptyState title={text.empty} body={text.description} />}
      {hasMore ? <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{text.more}</Button> : null}
    </div>
  </div>;
}

export function AccountSettingsPage() {
  const locale = useLocale();
  const { appUser, updateProfile, logout } = useAuth();
  const [language, setLanguage] = useState<"ar" | "en">((appUser?.language as "ar" | "en") || locale);
  const [message, setMessage] = useState("");
  const text = locale === "ar" ? { eyebrow: "الحساب", title: "إعدادات الحساب", description: "إعدادات اللغة والأمان والوصول إلى بيانات الملف الشخصي.", language: "لغة الواجهة", save: "حفظ اللغة", profile: "تحديث الملف الشخصي", reset: "إرسال رابط تغيير كلمة المرور", resetSent: "تم إرسال رابط تغيير كلمة المرور إلى بريدك.", verified: "حالة البريد", yes: "مفعّل", no: "غير مفعّل", logout: "تسجيل الخروج" } : { eyebrow: "Account", title: "Account settings", description: "Language, security, and profile data controls.", language: "Interface language", save: "Save language", profile: "Update profile", reset: "Send password reset link", resetSent: "A password reset link was sent to your email.", verified: "Email status", yes: "Verified", no: "Not verified", logout: "Logout" };
  if (!appUser) return null;
  async function saveLanguage() { await updateProfile({ language }); localStorage.setItem("mujahiz-iq-locale", language); window.location.reload(); }
  async function resetPassword() { if (!auth || !appUser) return; await sendPasswordResetEmail(auth, appUser.email, getEmailActionSettings("/login")); setMessage(text.resetSent); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2"><DashboardPanel title={text.language}><SelectField label={text.language} value={language} onChange={(event) => setLanguage(event.target.value as "ar" | "en")}><option value="ar">العربية</option><option value="en">English</option></SelectField><Button className="mt-4" onClick={() => void saveLanguage()}><Settings className="h-4 w-4" />{text.save}</Button></DashboardPanel><DashboardPanel title={locale === "ar" ? "الأمان والملف" : "Security & profile"}><div className="grid gap-3 text-sm font-bold"><div className="flex justify-between rounded-xl bg-creamLight p-3"><span>{text.verified}</span><span className={auth?.currentUser?.emailVerified ? "text-mint" : "text-clay"}>{auth?.currentUser?.emailVerified ? text.yes : text.no}</span></div><Link to="/profile"><Button variant="secondary"><Mail className="h-4 w-4" />{text.profile}</Button></Link><Button variant="secondary" onClick={() => void resetPassword()}>{text.reset}</Button><Button variant="ghost" onClick={() => void logout()}>{text.logout}</Button>{message ? <p className="rounded-xl bg-successBg p-3 text-mint">{message}</p> : null}</div></DashboardPanel></div></div>;
}
