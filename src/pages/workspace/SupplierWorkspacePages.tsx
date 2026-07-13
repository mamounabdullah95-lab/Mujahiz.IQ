import { BarChart3, Boxes, CheckCircle2, FileCheck2, FileText, Plus, Save, Send, Tags, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DisabledFileUpload } from "../../components/DisabledFileUpload";
import { DashboardError, DashboardPageHeader, DashboardPanel, InlineEmptyState, MetricCard, ProgressBar } from "../../components/DashboardPrimitives";
import { Button, ChipGroup, SelectField, TextAreaField, TextField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { labelFor } from "../../data/constants";
import { getSupplier } from "../../services/firestore";
import { updateOwnSupplierCategories } from "../../services/supplierWorkspace";
import {
  deleteSupplierDocumentMetadata,
  deleteSupplierProduct,
  listRfqResponses,
  listSupplierDocuments,
  listSupplierProducts,
  listSupplierRfqs,
  saveSupplierDocumentMetadata,
  saveSupplierProduct,
  submitRfqResponse,
} from "../../services/workspace";
import type { Supplier } from "../../types/domain";
import type { RfqRecord, RfqResponse, SupplierDocumentMetadata, SupplierProduct } from "../../types/workspace";
import { AccountSettingsPage, WorkspaceMessagesPage, WorkspaceNotificationsPage } from "./BuyerWorkspacePages";

function useLocale() {
  const { i18n } = useTranslation();
  return i18n.language.startsWith("ar") ? "ar" as const : "en" as const;
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
  const supplierId = appUser?.supplierProfileId;
  const text = locale === "ar" ? { eyebrow: "الكتالوج", title: "المنتجات والخدمات", description: "أضف بيانات نصية حقيقية لما توفره الشركة. الصور غير متاحة في المرحلة الحالية.", new: "إضافة منتج أو خدمة", nameAr: "الاسم بالعربية", nameEn: "الاسم بالإنجليزية", descAr: "الوصف بالعربية", descEn: "الوصف بالإنجليزية", category: "التصنيف", type: "النوع", product: "منتج", service: "خدمة", save: "حفظ", empty: "لا توجد منتجات أو خدمات", archive: "حذف" } : { eyebrow: "Catalogue", title: "Products & services", description: "Add factual text information about the company's offering. Images are unavailable in this release.", new: "Add product or service", nameAr: "Arabic name", nameEn: "English name", descAr: "Arabic description", descEn: "English description", category: "Category", type: "Type", product: "Product", service: "Service", save: "Save", empty: "No products or services", archive: "Delete" };
  const load = async () => { if (supplierId) setItems(await listSupplierProducts(supplierId)); };
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")); }, [supplierId]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supplierId || !firebaseUser || (!form.nameAr.trim() && !form.nameEn.trim()) || !form.categoryId) return; await saveSupplierProduct({ ...form, supplierId, ownerUserId: firebaseUser.uid }); setForm(emptyProduct); await load(); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[0.9fr_1.1fr]"><DashboardPanel title={text.new}>{supplierId ? <form className="grid gap-4" onSubmit={(event) => void submit(event)}><div className="grid gap-4 sm:grid-cols-2"><TextField label={text.nameAr} value={form.nameAr} onChange={(event) => setForm({ ...form, nameAr: event.target.value })} dir="rtl" /><TextField label={text.nameEn} value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} dir="ltr" /><SelectField label={text.category} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">—</option>{taxonomy.supplierCategories.map((item) => <option key={item.value} value={item.value}>{labelFor(taxonomy.supplierCategories, item.value, locale)}</option>)}</SelectField><SelectField label={text.type} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as "product" | "service" })}><option value="product">{text.product}</option><option value="service">{text.service}</option></SelectField><TextAreaField label={text.descAr} value={form.descriptionAr} onChange={(event) => setForm({ ...form, descriptionAr: event.target.value })} dir="rtl" /><TextAreaField label={text.descEn} value={form.descriptionEn} onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })} dir="ltr" /></div><DisabledFileUpload locale={locale} purpose="product_media" accepted="JPG, PNG, WEBP" maximumSize="3 MB" /><Button type="submit"><Save className="h-4 w-4" />{text.save}</Button></form> : <MissingSupplierProfile locale={locale} />}</DashboardPanel><DashboardPanel title={text.title}>{error ? <DashboardError message={error} /> : items.length ? <div className="grid gap-3">{items.map((item) => <article className="rounded-xl border border-borderSoft bg-creamLight p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}</h3><p className="mt-1 text-xs font-semibold text-muted">{item.type === "product" ? text.product : text.service} · {labelFor(taxonomy.supplierCategories, item.categoryId, locale)}</p></div><Button variant="ghost" onClick={() => void deleteSupplierProduct(item.id).then(load)}><Trash2 className="h-4 w-4" /></Button></div><p className="mt-3 text-sm leading-6 text-muted">{locale === "ar" ? item.descriptionAr || item.descriptionEn || "—" : item.descriptionEn || item.descriptionAr || "—"}</p></article>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}</DashboardPanel></div></div>;
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
  const supplierId = appUser?.supplierProfileId;
  const text = locale === "ar" ? { eyebrow: "الامتثال", title: "المستندات والشهادات", description: "يمكن إدخال معلومات المستند نصياً فقط. هذا لا يعني رفع نسخة أو توثيقها.", new: "بيانات مستند", name: "اسم المستند", type: "نوع المستند", number: "رقم الشهادة أو الوثيقة", issuer: "جهة الإصدار", issue: "تاريخ الإصدار", expiry: "تاريخ الانتهاء", desc: "وصف", save: "حفظ البيانات النصية", empty: "لا توجد بيانات مستندات", metadata: "بيانات فقط، دون ملف مرفوع" } : { eyebrow: "Compliance", title: "Documents & certificates", description: "Document metadata can be entered as text only. This does not upload or verify a copy.", new: "Document metadata", name: "Document name", type: "Document type", number: "Certificate or document number", issuer: "Issuer", issue: "Issue date", expiry: "Expiry date", desc: "Description", save: "Save text metadata", empty: "No document metadata", metadata: "Metadata only; no file is uploaded" };
  const load = async () => { if (supplierId) setItems(await listSupplierDocuments(supplierId)); };
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")); }, [supplierId]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!supplierId || !firebaseUser || !form.name.trim()) return; await saveSupplierDocumentMetadata({ ...form, supplierId, ownerUserId: firebaseUser.uid }); setForm(emptyDocument); await load(); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[0.9fr_1.1fr]"><DashboardPanel title={text.new}>{supplierId ? <form className="grid gap-4" onSubmit={(event) => void submit(event)}><div className="grid gap-4 sm:grid-cols-2"><TextField label={text.name} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><SelectField label={text.type} value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}><option value="commercial_registration">Commercial registration</option><option value="tax_certificate">Tax certificate</option><option value="quality_certificate">Quality certificate</option><option value="authorization">Authorization</option><option value="other">Other</option></SelectField><TextField label={text.number} value={form.certificateNumber} onChange={(event) => setForm({ ...form, certificateNumber: event.target.value })} /><TextField label={text.issuer} value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.target.value })} /><TextField label={text.issue} value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} type="date" /><TextField label={text.expiry} value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} type="date" /><TextAreaField className="sm:col-span-2" label={text.desc} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><DisabledFileUpload locale={locale} purpose="supplier_document" accepted="PDF, JPG, PNG" maximumSize="5 MB" /><Button type="submit"><Save className="h-4 w-4" />{text.save}</Button></form> : <MissingSupplierProfile locale={locale} />}</DashboardPanel><DashboardPanel title={text.title}>{error ? <DashboardError message={error} /> : items.length ? <div className="grid gap-3">{items.map((item) => <article className="rounded-xl border border-borderSoft bg-creamLight p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{item.name}</h3><p className="mt-1 text-xs font-bold text-amber">{text.metadata}</p></div><Button variant="ghost" onClick={() => void deleteSupplierDocumentMetadata(item.id).then(load)}><Trash2 className="h-4 w-4" /></Button></div><dl className="mt-3 grid gap-2 text-xs font-semibold text-muted sm:grid-cols-2"><div>{text.type}: {item.documentType}</div><div>{text.number}: {item.certificateNumber || "—"}</div><div>{text.issuer}: {item.issuer || "—"}</div><div>{text.expiry}: {item.expiryDate || "—"}</div></dl></article>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}</DashboardPanel></div></div>;
}

export function SupplierRfqsPage() {
  const locale = useLocale();
  const { appUser, firebaseUser } = useAuth();
  const [items, setItems] = useState<RfqRecord[]>([]);
  const [selected, setSelected] = useState<RfqRecord | null>(null);
  const [responses, setResponses] = useState<RfqResponse[]>([]);
  const [form, setForm] = useState({ message: "", price: "", currency: "IQD" as "IQD" | "USD", deliveryDays: "" });
  const [error, setError] = useState("");
  const text = locale === "ar" ? { eyebrow: "فرص التوريد", title: "طلبات عروض الأسعار", description: "الطلبات المرسلة إلى شركتك فقط، مع رد مهني موحد دون مرفقات حالياً.", empty: "لا توجد طلبات موجهة إلى الشركة", respond: "تقديم رد", message: "تفاصيل العرض", price: "السعر (اختياري)", delivery: "مدة التجهيز بالأيام", send: "إرسال العرض", sent: "تم إرسال العرض" } : { eyebrow: "Supply opportunities", title: "RFQ requests", description: "Requests addressed to your company only, with a structured response and no attachments in this release.", empty: "No requests are addressed to the company", respond: "Submit response", message: "Quotation details", price: "Price (optional)", delivery: "Delivery lead time in days", send: "Send quotation", sent: "Quotation sent" };
  const load = async () => { if (firebaseUser) setItems(await listSupplierRfqs(firebaseUser.uid, appUser?.supplierProfileId)); };
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")); }, [firebaseUser?.uid, appUser?.supplierProfileId]);
  useEffect(() => { if (selected) void listRfqResponses(selected.id).then((values) => setResponses(values.filter((item) => item.supplierUserId === firebaseUser?.uid))); }, [selected?.id]);
  async function submit(event: FormEvent) { event.preventDefault(); if (!selected || !firebaseUser || !appUser?.supplierProfileId || !form.message.trim()) return; await submitRfqResponse({ rfqId: selected.id, supplierUserId: firebaseUser.uid, supplierProfileId: appUser.supplierProfileId, message: form.message.trim(), price: form.price ? Number(form.price) : undefined, currency: form.currency, deliveryDays: form.deliveryDays ? Number(form.deliveryDays) : undefined }); setResponses(await listRfqResponses(selected.id)); setForm({ message: "", price: "", currency: "IQD", deliveryDays: "" }); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[0.9fr_1.1fr]"><DashboardPanel title={text.title}>{error ? <DashboardError message={error} /> : items.length ? <div className="grid gap-3">{items.map((item) => <button className={`rounded-xl border p-4 text-start ${selected?.id === item.id ? "border-amber bg-cream" : "border-borderSoft bg-creamLight"}`} type="button" onClick={() => setSelected(item)} key={item.id}><div className="flex items-center justify-between gap-2"><h3 className="font-black">{item.title}</h3><span className="text-xs font-bold text-amber">{item.status}</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.description}</p></button>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}</DashboardPanel><DashboardPanel title={selected ? `${text.respond}: ${selected.title}` : text.respond}>{selected ? <>{responses.some((item) => item.supplierUserId === firebaseUser?.uid) ? <div className="mb-4 flex items-center gap-2 rounded-xl bg-successBg p-3 text-sm font-black text-mint"><CheckCircle2 className="h-5 w-5" />{text.sent}</div> : null}<form className="grid gap-4" onSubmit={(event) => void submit(event)}><TextAreaField label={text.message} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} maxLength={2000} required /><div className="grid gap-4 sm:grid-cols-3"><TextField label={text.price} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} type="number" min="0" /><SelectField label="Currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as "IQD" | "USD" })}><option value="IQD">IQD</option><option value="USD">USD</option></SelectField><TextField label={text.delivery} value={form.deliveryDays} onChange={(event) => setForm({ ...form, deliveryDays: event.target.value })} type="number" min="1" /></div><DisabledFileUpload locale={locale} purpose="rfq_attachment" compact /><Button type="submit"><Send className="h-4 w-4" />{text.send}</Button></form></> : <InlineEmptyState title={text.empty} body={text.description} />}</DashboardPanel></div></div>;
}

export function SupplierAnalyticsPage() {
  const locale = useLocale();
  const { appUser } = useAuth();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState(0);
  const [documents, setDocuments] = useState(0);
  useEffect(() => { const id = appUser?.supplierProfileId; if (!id) return; void Promise.all([getSupplier(id), listSupplierProducts(id), listSupplierDocuments(id)]).then(([record, productItems, documentItems]) => { setSupplier(record); setProducts(productItems.length); setDocuments(documentItems.length); }); }, [appUser?.supplierProfileId]);
  const completion = useMemo(() => { if (!supplier) return 0; const fields = [supplier.displayName || supplier.nameOriginal, supplier.categories.length, supplier.phones.length, supplier.governorate, supplier.email || supplier.website, products, documents]; return Math.round(fields.filter(Boolean).length / fields.length * 100); }, [supplier, products, documents]);
  const text = locale === "ar" ? { eyebrow: "أداء الملف", title: "إحصائيات الملف", description: "مؤشرات حقيقية مشتقة من بيانات الشركة الحالية. الزيارات والظهور لا تُعرض قبل تفعيل القياس.", completion: "اكتمال الملف", rating: "متوسط التقييم", reviews: "عدد المراجعات", products: "المنتجات والخدمات", documents: "بيانات المستندات", views: "الزيارات", unavailable: "غير مقاسة بعد" } : { eyebrow: "Profile performance", title: "Profile analytics", description: "Factual metrics derived from current company data. Views and impressions are not shown before tracking is enabled.", completion: "Profile completion", rating: "Average rating", reviews: "Review count", products: "Products & services", documents: "Document metadata", views: "Views", unavailable: "Not measured yet" };
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7">{supplier ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label={text.rating} value={supplier.averageRating?.toFixed(1) || "0.0"} icon={BarChart3} /><MetricCard label={text.reviews} value={supplier.reviewCount || 0} icon={FileCheck2} /><MetricCard label={text.products} value={products} icon={Boxes} /><MetricCard label={text.documents} value={documents} icon={FileText} /><MetricCard label={text.views} value="—" helper={text.unavailable} icon={BarChart3} /></div><DashboardPanel title={text.completion}><ProgressBar value={completion} label={text.completion} /></DashboardPanel></> : <MissingSupplierProfile locale={locale} />}</div></div>;
}

export { AccountSettingsPage as SupplierSettingsPage, WorkspaceMessagesPage as SupplierMessagesPage, WorkspaceNotificationsPage as SupplierNotificationsPage };
