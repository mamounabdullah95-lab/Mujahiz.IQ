import { Bell, BookOpen, CheckCheck, FilePlus2, Heart, Mail, Plus, Search, Send, Settings, Star, Tags, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DisabledFileUpload } from "../../components/DisabledFileUpload";
import { DashboardError, DashboardPageHeader, DashboardPanel, DashboardSkeleton, InlineEmptyState } from "../../components/DashboardPrimitives";
import { Button, SelectField, TextAreaField, TextField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useTaxonomy } from "../../contexts/TaxonomyContext";
import { labelFor } from "../../data/constants";
import { auth } from "../../config/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { listSupplierCandidates } from "../../services/firestore";
import {
  createRfq,
  listBuyerRfqs,
  listConversationMessages,
  listConversations,
  listFavorites,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  removeFavorite,
  sendConversationMessage,
  updateRfqStatus,
} from "../../services/workspace";
import type { Conversation, ConversationMessage, FavoriteSupplier, RfqRecord, WorkspaceNotification } from "../../types/workspace";
import { toDate } from "../../utils/date";

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

const initialRfq = { title: "", description: "", quantity: "1", unit: "piece", location: "", closingDate: "", categoryId: "", recipientIds: [] as string[] };

export function BuyerRfqsPage() {
  const locale = useLocale();
  const [searchParams] = useSearchParams();
  const requestedSupplierId = searchParams.get("supplier") || "";
  const requestedCategoryId = searchParams.get("category") || "";
  const { firebaseUser, hasActiveAccess } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [items, setItems] = useState<RfqRecord[]>([]);
  const [form, setForm] = useState(() => ({
    ...initialRfq,
    categoryId: requestedCategoryId,
    recipientIds: requestedSupplierId ? [requestedSupplierId] : [],
  }));
  const [candidates, setCandidates] = useState<Array<{ id: string; displayName: string; nameOriginal: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const text = locale === "ar" ? {
    eyebrow: "دورة الشراء", title: "طلبات عروض الأسعار", description: "أنشئ طلباً منظماً وأرسله إلى مجهزين محددين. لا تُضاف أسعار أو عروض تجريبية.", newTitle: "إنشاء RFQ", titleLabel: "العنوان", desc: "وصف المادة أو الخدمة", quantity: "الكمية", unit: "الوحدة", location: "موقع التسليم", close: "تاريخ الإغلاق", category: "التصنيف", recipients: "المجهزون المستلمون", publish: "نشر الطلب", draft: "حفظ مسودة", empty: "لا توجد طلبات حتى الآن", inactive: "يلزم وصول فعال لاختيار مجهزين من الدليل، ويمكنك حفظ الطلب كمسودة.", none: "لا توجد شركات مطابقة ضمن التصنيف حالياً.", saved: "تم حفظ طلب عرض الأسعار." }
  : { eyebrow: "Procurement cycle", title: "RFQ requests", description: "Create a structured request and send it to selected suppliers. No demo quotations or prices are generated.", newTitle: "Create RFQ", titleLabel: "Title", desc: "Material or service description", quantity: "Quantity", unit: "Unit", location: "Delivery location", close: "Closing date", category: "Category", recipients: "Recipient suppliers", publish: "Publish request", draft: "Save draft", empty: "No requests yet", inactive: "Active directory access is required to select suppliers; you can still save a draft.", none: "No matching suppliers are currently available for this category.", saved: "The RFQ was saved." };
  const load = async () => { if (firebaseUser) setItems(await listBuyerRfqs(firebaseUser.uid)); };
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")); }, [firebaseUser?.uid]);
  useEffect(() => {
    if (!form.categoryId || !hasActiveAccess) { setCandidates([]); return; }
    void listSupplierCandidates([form.categoryId]).then((records) => setCandidates(records.map((item) => ({ id: item.id, displayName: item.displayName, nameOriginal: item.nameOriginal })))).catch(() => setCandidates([]));
  }, [form.categoryId, hasActiveAccess]);
  async function submit(status: "draft" | "published") {
    if (!firebaseUser || !form.title.trim() || !form.description.trim() || !form.closingDate || !form.categoryId) return;
    setBusy(true); setError("");
    try {
      await createRfq(firebaseUser.uid, { title: form.title.trim(), description: form.description.trim(), quantity: Math.max(1, Number(form.quantity) || 1), unit: form.unit.trim(), location: form.location.trim(), closingDate: form.closingDate, categoryId: form.categoryId, recipientIds: status === "published" ? form.recipientIds : [], status });
      setForm(initialRfq); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed"); } finally { setBusy(false); }
  }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[1.05fr_0.95fr]"><DashboardPanel title={text.newTitle}>{error ? <DashboardError message={error} /> : null}<div className="grid gap-4 sm:grid-cols-2"><TextField label={text.titleLabel} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} required /><TextField label={text.quantity} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} type="number" min="1" required /><TextField label={text.unit} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required /><TextField label={text.location} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /><TextField label={text.close} value={form.closingDate} onChange={(event) => setForm({ ...form, closingDate: event.target.value })} type="date" required /><SelectField label={text.category} value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value, recipientIds: [] })} required><option value="">—</option>{taxonomy.supplierCategories.map((item) => <option value={item.value} key={item.value}>{labelFor(taxonomy.supplierCategories, item.value, locale)}</option>)}</SelectField><TextAreaField className="sm:col-span-2" label={text.desc} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} required /></div><div className="mt-4"><DisabledFileUpload locale={locale} purpose="rfq_attachment" accepted="PDF, XLSX, JPG, PNG" maximumSize="10 MB" compact /></div><div className="mt-4"><div className="mb-2 text-sm font-black">{text.recipients}</div>{!hasActiveAccess ? <p className="text-xs font-bold text-clay">{text.inactive}</p> : candidates.length ? <div className="grid gap-2 sm:grid-cols-2">{candidates.map((supplier) => <label className="flex items-center gap-2 rounded-xl border border-borderSoft bg-creamLight p-3 text-xs font-bold" key={supplier.id}><input type="checkbox" checked={form.recipientIds.includes(supplier.id)} onChange={(event) => setForm({ ...form, recipientIds: event.target.checked ? [...form.recipientIds, supplier.id] : form.recipientIds.filter((id) => id !== supplier.id) })} />{supplier.displayName || supplier.nameOriginal}</label>)}</div> : <p className="text-xs font-semibold text-muted">{text.none}</p>}</div><div className="mt-5 flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={() => void submit("published")}><Send className="h-4 w-4" />{text.publish}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => void submit("draft")}><FilePlus2 className="h-4 w-4" />{text.draft}</Button></div></DashboardPanel><DashboardPanel title={text.title}>{items.length ? <div className="grid gap-3">{items.map((item) => <article className="rounded-xl border border-borderSoft bg-creamLight p-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black">{item.title}</h3><p className="mt-1 text-xs font-semibold text-muted">{labelFor(taxonomy.supplierCategories, item.categoryId, locale)} · {item.quantity} {item.unit}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber">{item.status}</span></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{item.description}</p><div className="mt-3 flex flex-wrap gap-2">{item.status === "draft" ? <Button variant="secondary" onClick={() => void updateRfqStatus(item.id, "published").then(load)}>{text.publish}</Button> : null}{!['closed','cancelled'].includes(item.status) ? <Button variant="ghost" onClick={() => void updateRfqStatus(item.id, "closed").then(load)}>{locale === "ar" ? "إغلاق" : "Close"}</Button> : null}</div></article>)}</div> : <InlineEmptyState title={text.empty} body={text.description} />}</DashboardPanel></div></div>;
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
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [error, setError] = useState("");
  const text = locale === "ar" ? { eyebrow: "مركز التنبيهات", title: "الإشعارات", description: "تحديثات الاعتماد والرسائل وطلبات الأسعار والوصول.", all: "تحديد الكل كمقروء", empty: "لا توجد إشعارات", open: "فتح" } : { eyebrow: "Notification center", title: "Notifications", description: "Approval, messaging, RFQ, and access updates.", all: "Mark all as read", empty: "No notifications", open: "Open" };
  const load = async () => { if (firebaseUser) setItems(await listNotifications(firebaseUser.uid)); };
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed")); }, [firebaseUser?.uid]);
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} actions={<Button variant="secondary" onClick={() => firebaseUser && void markAllNotificationsRead(firebaseUser.uid).then(load)}><CheckCheck className="h-4 w-4" />{text.all}</Button>} /><div className="grid gap-3 p-5 sm:p-7">{error ? <DashboardError message={error} /> : items.length ? items.map((item) => <article className={`flex flex-col gap-3 rounded-[16px] border p-4 sm:flex-row sm:items-center sm:justify-between ${item.read ? "border-borderSoft bg-white/70" : "border-amber/35 bg-white shadow-card"}`} key={item.id}><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-amber"><Bell className="h-5 w-5" /></span><div><h3 className="font-black">{locale === "ar" ? item.titleAr : item.titleEn}</h3><p className="mt-1 text-sm leading-6 text-muted">{locale === "ar" ? item.bodyAr : item.bodyEn}</p><span className="mt-1 block text-[11px] font-semibold text-muted">{formatDate(item.createdAt, locale)}</span></div></div><div className="flex gap-2">{item.link ? <Link to={item.link}><Button variant="secondary">{text.open}</Button></Link> : null}{!item.read ? <Button variant="ghost" onClick={() => firebaseUser && void markNotificationRead(item.id, firebaseUser.uid).then(load)}><CheckCheck className="h-4 w-4" /></Button> : null}</div></article>) : <InlineEmptyState title={text.empty} body={text.description} />}</div></div>;
}

export function AccountSettingsPage() {
  const locale = useLocale();
  const { appUser, updateProfile, logout } = useAuth();
  const [language, setLanguage] = useState<"ar" | "en">((appUser?.language as "ar" | "en") || locale);
  const [message, setMessage] = useState("");
  const text = locale === "ar" ? { eyebrow: "الحساب", title: "إعدادات الحساب", description: "إعدادات اللغة والأمان والوصول إلى بيانات الملف الشخصي.", language: "لغة الواجهة", save: "حفظ اللغة", profile: "تحديث الملف الشخصي", reset: "إرسال رابط تغيير كلمة المرور", resetSent: "تم إرسال رابط تغيير كلمة المرور إلى بريدك.", verified: "حالة البريد", yes: "مفعّل", no: "غير مفعّل", logout: "تسجيل الخروج" } : { eyebrow: "Account", title: "Account settings", description: "Language, security, and profile data controls.", language: "Interface language", save: "Save language", profile: "Update profile", reset: "Send password reset link", resetSent: "A password reset link was sent to your email.", verified: "Email status", yes: "Verified", no: "Not verified", logout: "Logout" };
  if (!appUser) return null;
  async function saveLanguage() { await updateProfile({ language }); localStorage.setItem("mujahiz-iq-locale", language); window.location.reload(); }
  async function resetPassword() { if (!auth || !appUser) return; await sendPasswordResetEmail(auth, appUser.email); setMessage(text.resetSent); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2"><DashboardPanel title={text.language}><SelectField label={text.language} value={language} onChange={(event) => setLanguage(event.target.value as "ar" | "en")}><option value="ar">العربية</option><option value="en">English</option></SelectField><Button className="mt-4" onClick={() => void saveLanguage()}><Settings className="h-4 w-4" />{text.save}</Button></DashboardPanel><DashboardPanel title={locale === "ar" ? "الأمان والملف" : "Security & profile"}><div className="grid gap-3 text-sm font-bold"><div className="flex justify-between rounded-xl bg-creamLight p-3"><span>{text.verified}</span><span className={auth?.currentUser?.emailVerified ? "text-mint" : "text-clay"}>{auth?.currentUser?.emailVerified ? text.yes : text.no}</span></div><Link to="/profile"><Button variant="secondary"><Mail className="h-4 w-4" />{text.profile}</Button></Link><Button variant="secondary" onClick={() => void resetPassword()}>{text.reset}</Button><Button variant="ghost" onClick={() => void logout()}>{text.logout}</Button>{message ? <p className="rounded-xl bg-successBg p-3 text-mint">{message}</p> : null}</div></DashboardPanel></div></div>;
}
