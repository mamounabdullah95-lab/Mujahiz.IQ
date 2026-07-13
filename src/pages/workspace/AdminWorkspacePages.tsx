import { Activity, BarChart3, CheckCircle2, Cloud, Database, Download, FileText, HardDrive, LockKeyhole, Plus, Save, Settings, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DisabledFileUpload } from "../../components/DisabledFileUpload";
import { DashboardError, DashboardPageHeader, DashboardPanel, InlineEmptyState, MetricCard } from "../../components/DashboardPrimitives";
import { Button, SelectField, TextAreaField, TextField } from "../../components/ui";
import { isFirebaseConfigured } from "../../config/firebase";
import { features } from "../../config/features";
import { useAuth } from "../../contexts/AuthContext";
import { defaultRegistrationSectors } from "../../data/registrationSectors";
import {
  getAdminOperationsSettings,
  getBrandingSettings,
  getOperationalReport,
  listContentPages,
  listRegistrationSectors,
  saveAdminOperationsSettings,
  saveBrandingSettings,
  saveContentPage,
  saveRegistrationSectors,
} from "../../services/workspace";
import type { AdminOperationsSettings, BrandingSettings, ContentPageRecord, OperationalReport, RegistrationSector } from "../../types/workspace";

function useLocale() {
  const { i18n } = useTranslation();
  return i18n.language.startsWith("ar") ? "ar" as const : "en" as const;
}

const emptyReport: OperationalReport = { users: 0, buyers: 0, supplierAccounts: 0, approvedSuppliers: 0, pendingSubmissions: 0, approvedSubmissions: 0, rejectedSubmissions: 0, accessGrants: 0, pendingTerms: 0, reviews: 0, feedback: 0 };

export function AdminReportsPage() {
  const locale = useLocale();
  const [report, setReport] = useState(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const text = locale === "ar" ? { eyebrow: "التحليل التشغيلي", title: "التقارير", description: "مؤشرات إجمالية من Firestore دون كشف البريد أو الهاتف أو البيانات الحساسة.", export: "تصدير الملخص CSV", users: "جميع المستخدمين", buyers: "المشترون", supplierAccounts: "حسابات المجهزين", suppliers: "المجهزون المعتمدون", pending: "طلبات بانتظار المراجعة", approved: "طلبات مقبولة", rejected: "طلبات مرفوضة", grants: "منح الوصول", terms: "اقتراحات القاموس", reviews: "التقييمات", feedback: "البلاغات" } : { eyebrow: "Operational analytics", title: "Reports", description: "Aggregate Firestore metrics without exposing email, phone, or other sensitive data.", export: "Export summary CSV", users: "All users", buyers: "Buyers", supplierAccounts: "Supplier accounts", suppliers: "Approved suppliers", pending: "Pending submissions", approved: "Approved submissions", rejected: "Rejected submissions", grants: "Access grants", terms: "Dictionary suggestions", reviews: "Reviews", feedback: "Reports & support" };
  const load = async () => { setLoading(true); setError(""); try { setReport(await getOperationalReport()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  function exportCsv() { const rows = [["metric", "value"], ...Object.entries(report)]; const csv = rows.map((row) => row.join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `mujahiz-operational-summary-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); }
  const cards = [[text.users, report.users, Users], [text.buyers, report.buyers, Users], [text.supplierAccounts, report.supplierAccounts, Users], [text.suppliers, report.approvedSuppliers, Database], [text.pending, report.pendingSubmissions, Activity], [text.approved, report.approvedSubmissions, CheckCircle2], [text.rejected, report.rejectedSubmissions, FileText], [text.grants, report.accessGrants, ShieldCheck], [text.terms, report.pendingTerms, FileText], [text.reviews, report.reviews, BarChart3], [text.feedback, report.feedback, Activity]] as const;
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} actions={<><Button variant="secondary" onClick={() => void load()}><Activity className="h-4 w-4" />{locale === "ar" ? "تحديث" : "Refresh"}</Button><Button onClick={exportCsv}><Download className="h-4 w-4" />{text.export}</Button></>} /><div className="p-5 sm:p-7">{error ? <DashboardError message={error} retry={() => void load()} /> : null}<div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${loading ? "animate-pulse" : ""}`}>{cards.map(([label, value, icon]) => <MetricCard key={label} label={label} value={loading ? "—" : value} icon={icon} />)}</div></div></div>;
}

export function AdminOperationalSettingsPage() {
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [settings, setSettings] = useState<AdminOperationsSettings>({ reviewNotifications: true, showIncompleteSuppliers: false, requireDuplicateReason: true, dictionarySuggestionMinimum: 2 });
  const [message, setMessage] = useState("");
  const text = locale === "ar" ? { eyebrow: "التشغيل اليومي", title: "إعدادات الإدارة", description: "إعدادات تشغيلية لا تشمل الأمان أو أدوار Owner.", notifications: "إشعارات طابور المراجعة", incomplete: "إظهار المجهزين غير المكتملين للإدارة", duplicate: "إلزام سبب عند تجاوز تنبيه التكرار", minimum: "الحد الأدنى لتكرار اقتراح القاموس", save: "حفظ الإعدادات", saved: "تم حفظ إعدادات الإدارة." } : { eyebrow: "Daily operations", title: "Admin settings", description: "Operational preferences that exclude security and Owner-level roles.", notifications: "Review queue notifications", incomplete: "Show incomplete suppliers to admins", duplicate: "Require a reason when overriding duplicate warnings", minimum: "Minimum dictionary suggestion frequency", save: "Save settings", saved: "Admin settings were saved." };
  useEffect(() => { void getAdminOperationsSettings().then(setSettings); }, []);
  async function save() { if (!firebaseUser) return; await saveAdminOperationsSettings(settings, firebaseUser.uid); setMessage(text.saved); }
  const toggle = (key: "reviewNotifications" | "showIncompleteSuppliers" | "requireDuplicateReason") => <label className="flex items-center justify-between gap-4 rounded-xl border border-borderSoft bg-creamLight p-4 text-sm font-black"><span>{key === "reviewNotifications" ? text.notifications : key === "showIncompleteSuppliers" ? text.incomplete : text.duplicate}</span><input type="checkbox" checked={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} /></label>;
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="p-5 sm:p-7"><DashboardPanel title={text.title}><div className="grid gap-4">{toggle("reviewNotifications")}{toggle("showIncompleteSuppliers")}{toggle("requireDuplicateReason")}<TextField label={text.minimum} value={settings.dictionarySuggestionMinimum} onChange={(event) => setSettings({ ...settings, dictionarySuggestionMinimum: Math.max(1, Number(event.target.value) || 1) })} type="number" min="1" max="100" /><div className="flex items-center gap-3"><Button onClick={() => void save()}><Save className="h-4 w-4" />{text.save}</Button>{message ? <span className="text-sm font-bold text-mint">{message}</span> : null}</div></div></DashboardPanel></div></div>;
}

const permissionRows = [
  ["Owner", true, true, true, true, true, true, true, true],
  ["Admin", true, true, true, false, true, false, true, false],
  ["Buyer", true, true, true, false, false, false, false, false],
  ["Supplier", true, true, true, false, false, false, false, false],
] as const;

export function OwnerRolesPage() {
  const locale = useLocale();
  const columns = locale === "ar" ? ["الدور", "قراءة", "إنشاء", "تعديل", "حذف", "اعتماد", "إدارة أدوار", "تصدير", "بيانات حساسة"] : ["Role", "Read", "Create", "Edit", "Delete", "Approve", "Manage roles", "Export", "Sensitive data"];
  const description = locale === "ar" ? "مصفوفة الصلاحيات الفعلية التي تفرضها المسارات وقواعد Firestore. لا يمكن خفض صلاحية آخر Owner من هذه الواجهة." : "The effective permission matrix enforced by routes and Firestore rules. The final Owner cannot be demoted from this interface.";
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={locale === "ar" ? "الأمان" : "Security"} title={locale === "ar" ? "الأدوار والصلاحيات" : "Roles & permissions"} description={description} actions={<Link to="/super-admin/users"><Button><Users className="h-4 w-4" />{locale === "ar" ? "إدارة المستخدمين" : "Manage users"}</Button></Link>} /><div className="p-5 sm:p-7"><DashboardPanel title={locale === "ar" ? "مصفوفة الصلاحيات" : "Permission matrix"}><div className="overflow-x-auto"><table className="w-full min-w-[52rem] border-separate border-spacing-0 text-sm"><thead><tr>{columns.map((item) => <th className="border-b border-borderSoft bg-cream px-3 py-3 text-start font-black" key={item}>{item}</th>)}</tr></thead><tbody>{permissionRows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className="border-b border-borderSoft px-3 py-3 font-bold" key={index}>{index === 0 ? cell : cell ? <CheckCircle2 className="h-5 w-5 text-mint" /> : <LockKeyhole className="h-5 w-5 text-muted/50" />}</td>)}</tr>)}</tbody></table></div></DashboardPanel></div></div>;
}

export function OwnerBrandingPage() {
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [settings, setSettings] = useState<BrandingSettings>({ primaryColor: "#062b4d", secondaryColor: "#0b4f76", accentColor: "#f37021", introAr: "", introEn: "", assetUploadStatus: "upload_pending_launch" });
  const [message, setMessage] = useState("");
  const text = locale === "ar" ? { eyebrow: "النظام البصري", title: "الهوية البصرية", description: "تحكم آمن بالنصوص والألوان مع معاينة. تبقى الأصول الحالية كما هي ورفع الصور معطلاً.", primary: "اللون الأساسي", secondary: "اللون المساعد", accent: "لون الإبراز", introAr: "النص التعريفي بالعربية", introEn: "النص التعريفي بالإنجليزية", save: "حفظ الإعدادات", saved: "تم حفظ إعدادات الهوية النصية." } : { eyebrow: "Visual system", title: "Branding", description: "Safe text and color controls with preview. Current assets remain unchanged and image uploads are disabled.", primary: "Primary color", secondary: "Secondary color", accent: "Accent color", introAr: "Arabic introduction", introEn: "English introduction", save: "Save settings", saved: "Text branding settings were saved." };
  useEffect(() => { void getBrandingSettings().then(setSettings); }, []);
  async function save() { if (!firebaseUser) return; await saveBrandingSettings(settings, firebaseUser.uid); setMessage(text.saved); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-2"><DashboardPanel title={locale === "ar" ? "الإعدادات" : "Settings"}><div className="grid gap-4 sm:grid-cols-3"><TextField label={text.primary} value={settings.primaryColor} onChange={(event) => setSettings({ ...settings, primaryColor: event.target.value })} type="color" /><TextField label={text.secondary} value={settings.secondaryColor} onChange={(event) => setSettings({ ...settings, secondaryColor: event.target.value })} type="color" /><TextField label={text.accent} value={settings.accentColor} onChange={(event) => setSettings({ ...settings, accentColor: event.target.value })} type="color" /></div><div className="mt-4 grid gap-4"><TextAreaField label={text.introAr} value={settings.introAr} onChange={(event) => setSettings({ ...settings, introAr: event.target.value })} dir="rtl" /><TextAreaField label={text.introEn} value={settings.introEn} onChange={(event) => setSettings({ ...settings, introEn: event.target.value })} dir="ltr" /><DisabledFileUpload locale={locale} purpose="branding_asset" accepted="SVG, PNG, ICO, WEBP" maximumSize="3 MB" /><div className="flex items-center gap-3"><Button onClick={() => void save()}><Save className="h-4 w-4" />{text.save}</Button>{message ? <span className="text-sm font-bold text-mint">{message}</span> : null}</div></div></DashboardPanel><DashboardPanel title={locale === "ar" ? "المعاينة" : "Preview"}><div className="rounded-[16px] border border-borderSoft p-6" style={{ borderColor: settings.accentColor }}><div className="h-3 w-24 rounded-full" style={{ background: settings.primaryColor }} /><h3 className="mt-6 text-2xl font-black" style={{ color: settings.primaryColor }}>{locale === "ar" ? settings.introAr : settings.introEn}</h3><button className="mt-5 rounded-xl px-5 py-3 text-sm font-black text-white" type="button" style={{ background: settings.accentColor }}>{locale === "ar" ? "زر المعاينة" : "Preview action"}</button></div></DashboardPanel></div></div>;
}

const pageSeeds = ["about", "how-it-works", "suppliers", "buyers", "faq", "contact", "resources", "terms", "privacy", "security"];

export function OwnerContentPage() {
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<ContentPageRecord[]>([]);
  const [selectedId, setSelectedId] = useState("about");
  const [message, setMessage] = useState("");
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || { id: selectedId, slug: selectedId, titleAr: "", titleEn: "", contentAr: "", contentEn: "", status: "draft" as const, order: Math.max(1, pageSeeds.indexOf(selectedId) + 1), updatedBy: firebaseUser?.uid || "", updatedAt: null }, [items, selectedId, firebaseUser?.uid]);
  const text = locale === "ar" ? { eyebrow: "إدارة المحتوى", title: "الصفحات والمحتوى", description: "CMS ثنائي اللغة للصفحات العامة، مع فصل النص العربي عن الإنجليزي وحالة نشر واضحة.", page: "الصفحة", titleAr: "العنوان العربي", titleEn: "العنوان الإنجليزي", contentAr: "المحتوى العربي", contentEn: "المحتوى الإنجليزي", status: "حالة النشر", save: "حفظ الصفحة", saved: "تم حفظ الصفحة." } : { eyebrow: "Content management", title: "Pages & content", description: "A bilingual CMS for public pages with separate Arabic and English content and explicit publication state.", page: "Page", titleAr: "Arabic title", titleEn: "English title", contentAr: "Arabic content", contentEn: "English content", status: "Publication status", save: "Save page", saved: "The page was saved." };
  const load = async () => setItems(await listContentPages(false));
  useEffect(() => { void load(); }, []);
  function patch(value: Partial<ContentPageRecord>) { setItems((current) => { const exists = current.some((item) => item.id === selected.id); return exists ? current.map((item) => item.id === selected.id ? { ...item, ...value } : item) : [...current, { ...selected, ...value } as ContentPageRecord]; }); }
  async function save() { if (!firebaseUser) return; await saveContentPage({ ...selected, updatedBy: firebaseUser.uid }); setMessage(text.saved); await load(); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="p-5 sm:p-7"><DashboardPanel title={text.title}><div className="grid gap-4"><SelectField label={text.page} value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(""); }}>{pageSeeds.map((slug) => <option value={slug} key={slug}>{slug}</option>)}</SelectField><div className="grid gap-4 sm:grid-cols-2"><TextField label={text.titleAr} value={selected.titleAr} onChange={(event) => patch({ titleAr: event.target.value })} dir="rtl" /><TextField label={text.titleEn} value={selected.titleEn} onChange={(event) => patch({ titleEn: event.target.value })} dir="ltr" /><TextAreaField className="min-h-48" label={text.contentAr} value={selected.contentAr} onChange={(event) => patch({ contentAr: event.target.value })} dir="rtl" /><TextAreaField className="min-h-48" label={text.contentEn} value={selected.contentEn} onChange={(event) => patch({ contentEn: event.target.value })} dir="ltr" /></div><SelectField label={text.status} value={selected.status} onChange={(event) => patch({ status: event.target.value as "draft" | "published" })}><option value="draft">Draft</option><option value="published">Published</option></SelectField><DisabledFileUpload locale={locale} purpose="content_asset" compact /><div className="flex items-center gap-3"><Button onClick={() => void save()}><Save className="h-4 w-4" />{text.save}</Button>{message ? <span className="text-sm font-bold text-mint">{message}</span> : null}</div></div></DashboardPanel></div></div>;
}

export function OwnerIntegrationsPage() {
  const locale = useLocale();
  const items = [
    { name: "Firebase Authentication", status: isFirebaseConfigured ? "connected" : "not_configured", detailAr: "تسجيل الدخول وتفعيل البريد", detailEn: "Authentication and email verification" },
    { name: "Cloud Firestore", status: isFirebaseConfigured ? "connected" : "not_configured", detailAr: "قاعدة البيانات التشغيلية", detailEn: "Operational database" },
    { name: "Firebase Storage", status: features.fileUploads ? "backend_required" : "disabled", detailAr: "معطل وفق سياسة المرحلة الحالية ولا توجد عملية رفع", detailEn: "Disabled by current release policy; no upload operation is active" },
    { name: "Analytics", status: "not_configured", detailAr: "لا يوجد Stream تحليلات مفعّل في الكود الحالي", detailEn: "No analytics stream is active in the current code" },
  ];
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={locale === "ar" ? "حالة الخدمات" : "Service health"} title={locale === "ar" ? "التكاملات" : "Integrations"} description={locale === "ar" ? "تعرض الخدمات الموجودة فعلياً فقط، من دون مفاتيح أو أسرار." : "Only real integrations are shown, without keys or secrets."} /><div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-2">{items.map((item) => <article className="rounded-[16px] border border-borderSoft bg-white p-5 shadow-card" key={item.name}><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cream text-amber"><Cloud className="h-5 w-5" /></span><span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === "connected" ? "bg-successBg text-mint" : item.status === "disabled" ? "bg-cream text-amber" : "bg-slate-100 text-muted"}`}>{item.status}</span></div><h3 className="mt-4 font-black">{item.name}</h3><p className="mt-2 text-sm leading-6 text-muted">{locale === "ar" ? item.detailAr : item.detailEn}</p></article>)}</div></div>;
}

export function OwnerBackupsPage() {
  const locale = useLocale();
  const text = locale === "ar" ? { eyebrow: "استمرارية العمل", title: "النسخ الاحتياطي", description: "لا توجد حالياً وظيفة تصدير Firestore مهيأة داخل المشروع، لذلك لا يظهر زر وهمي يدّعي إنشاء نسخة.", status: "الحالة", value: "غير مهيأ", need: "يتطلب إعداد Google Cloud Firestore Export وصلاحيات IAM وموقع تخزين وسياسة احتفاظ. لن يتم تفعيل ذلك أو طلب Billing في هذه المرحلة.", history: "سجل النسخ", empty: "لم تُسجل محاولات نسخ احتياطي" } : { eyebrow: "Business continuity", title: "Backups", description: "No Firestore export workflow is configured in the project, so no fake backup button is presented.", status: "Status", value: "Not configured", need: "This requires Google Cloud Firestore Export, IAM permissions, a storage location, and a retention policy. It is not enabled and Billing is not requested in this release.", history: "Backup history", empty: "No backup attempts have been recorded" };
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} /><div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-2"><DashboardPanel title={text.status}><div className="flex items-center gap-4 rounded-xl bg-cream p-4"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-amber"><HardDrive className="h-6 w-6" /></span><div><div className="font-black text-amber">{text.value}</div><p className="mt-1 text-sm leading-6 text-muted">{text.need}</p></div></div></DashboardPanel><DashboardPanel title={text.history}><InlineEmptyState title={text.empty} body={text.description} /></DashboardPanel></div></div>;
}

export function RegistrationSectorsPage() {
  const locale = useLocale();
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<RegistrationSector[]>(defaultRegistrationSectors);
  const [message, setMessage] = useState("");
  useEffect(() => { void listRegistrationSectors().then(setItems); }, []);
  const update = (index: number, patch: Partial<RegistrationSector>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const add = () => setItems((current) => [...current, { value: `sector_${Date.now()}`, labelAr: "", labelEn: "", order: current.length + 1, active: true }]);
  async function save() { if (!firebaseUser) return; await saveRegistrationSectors(items, firebaseUser.uid); setMessage(locale === "ar" ? "تم حفظ قطاعات التسجيل." : "Registration sectors were saved."); }
  return <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card"><DashboardPageHeader eyebrow={locale === "ar" ? "إعدادات التسجيل" : "Registration settings"} title={locale === "ar" ? "مجالات المشتريات والقطاعات" : "Procurement fields & sectors"} description={locale === "ar" ? "قائمة ثنائية اللغة تظهر في تسجيل حساب المشتري، ويمكن ترتيبها أو تعطيلها." : "A bilingual list shown during buyer registration that can be ordered or disabled."} actions={<Button variant="secondary" onClick={add}><Plus className="h-4 w-4" />{locale === "ar" ? "إضافة قطاع" : "Add sector"}</Button>} /><div className="p-5 sm:p-7"><DashboardPanel title={locale === "ar" ? "القطاعات" : "Sectors"}><div className="grid gap-3">{items.map((item, index) => <div className="grid gap-3 rounded-xl border border-borderSoft bg-creamLight p-3 sm:grid-cols-[1fr_1fr_9rem_auto]" key={`${item.value}-${index}`}><TextField label="العربية" value={item.labelAr} onChange={(event) => update(index, { labelAr: event.target.value })} dir="rtl" /><TextField label="English" value={item.labelEn} onChange={(event) => update(index, { labelEn: event.target.value })} dir="ltr" /><TextField label={locale === "ar" ? "الترتيب" : "Order"} value={item.order} onChange={(event) => update(index, { order: Number(event.target.value) || index + 1 })} type="number" /><label className="flex items-center justify-center gap-2 text-sm font-black"><input type="checkbox" checked={item.active} onChange={(event) => update(index, { active: event.target.checked })} />{locale === "ar" ? "فعال" : "Active"}</label></div>)}<div className="flex items-center gap-3"><Button onClick={() => void save()}><Save className="h-4 w-4" />{locale === "ar" ? "حفظ" : "Save"}</Button>{message ? <span className="text-sm font-bold text-mint">{message}</span> : null}</div></div></DashboardPanel></div></div>;
}
