import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ClipboardCheck, Eye, FileClock, FileText, MessageSquare, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardError, DashboardPageHeader, DashboardPanel, DashboardSkeleton, InlineEmptyState, MetricCard, ProgressBar } from "../components/DashboardPrimitives";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { listMySubmissions } from "../services/firestore";
import { listSupplierRfqs } from "../services/workspace";
import type { SupplierSubmission } from "../types/domain";
import { formatDate } from "../utils/date";
import { localizedSupplierName } from "../utils/supplierDisplay";

const copy = {
  ar: {
    eyebrow: "مساحة عمل المجهز",
    title: "إدارة حضور شركتك",
    description: "أكمل ملف الشركة، تابع حالة المراجعة، واستعد للظهور أمام فرق المشتريات بعد اعتماد البيانات.",
    action: "إضافة أو تحديث الشركة",
    completion: "اكتمال ملف الحساب",
    companyStatus: "حالة ملف الشركة",
    views: "مشاهدات الملف",
    inquiries: "طلبات التواصل",
    rfqs: "طلبات عروض الأسعار",
    unavailable: "يبدأ القياس بعد اعتماد وربط ملف الشركة",
    companyReadiness: "جاهزية ملف الشركة",
    companyReadinessBody: "تعتمد النسبة على بيانات الحساب الحالية، وتتحسن عند استكمال طلب بيانات الشركة والمستندات.",
    missing: "بيانات تحتاج إلى استكمال",
    missingBody: "هذه الحقول تساعد الإدارة والمشترين على التحقق والتواصل.",
    noMissing: "بيانات الحساب الأساسية مكتملة",
    noMissingBody: "تابع الآن بإضافة بيانات الشركة والمنتجات والمستندات.",
    latest: "آخر طلبات الشركة",
    latestBody: "حالات الإرسال والمراجعة المرتبطة بحسابك.",
    noSubmissions: "لم ترسل بيانات شركة بعد",
    noSubmissionsBody: "ابدأ بإنشاء ملف شركتك. سيُراجع قبل ظهوره للمشترين.",
    preview: "معاينة صفحة الشركة",
    previewBody: "تُتاح المعاينة العامة بعد اعتماد الطلب وربط الحساب بملف الشركة.",
    pending: "قيد المراجعة",
    notStarted: "لم يبدأ",
    error: "تعذر تحميل بيانات الشركة حالياً.",
    documents: "المستندات والشهادات",
    documentsBody: "سيُفعّل رفع المستندات الموثقة ضمن مرحلة ملف الشركة التالية.",
  },
  en: {
    eyebrow: "Supplier workspace",
    title: "Manage your company presence",
    description: "Complete your company profile, track review status, and prepare to appear to procurement teams after approval.",
    action: "Add or update company",
    completion: "Account profile completion",
    companyStatus: "Company profile status",
    views: "Profile views",
    inquiries: "Contact requests",
    rfqs: "RFQ requests",
    unavailable: "Measurement starts after the company profile is approved and linked",
    companyReadiness: "Company profile readiness",
    companyReadinessBody: "The score uses current account data and improves when company details and documents are completed.",
    missing: "Information to complete",
    missingBody: "These fields help admins and buyers verify and contact your company.",
    noMissing: "Basic account details are complete",
    noMissingBody: "Continue by adding company data, products, and documents.",
    latest: "Latest company submissions",
    latestBody: "Submission and review statuses connected to your account.",
    noSubmissions: "No company data submitted yet",
    noSubmissionsBody: "Start your company profile. It will be reviewed before buyer visibility.",
    preview: "Preview company page",
    previewBody: "Public preview becomes available after approval and account-to-company linking.",
    pending: "Under review",
    notStarted: "Not started",
    error: "Company data could not be loaded right now.",
    documents: "Documents and certificates",
    documentsBody: "Verified document uploads will be enabled in the next company-profile phase.",
  },
};

export function SupplierDashboardPage() {
  const { i18n } = useTranslation();
  const { appUser, firebaseUser } = useAuth();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = copy[locale];
  const [submissions, setSubmissions] = useState<SupplierSubmission[]>([]);
  const [rfqCount, setRfqCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    setError("");
    try {
      const [nextSubmissions, rfqs] = await Promise.all([
        listMySubmissions(firebaseUser.uid),
        listSupplierRfqs(firebaseUser.uid, appUser?.supplierProfileId),
      ]);
      setSubmissions(nextSubmissions);
      setRfqCount(rfqs.length);
    } catch {
      setError(text.error);
    } finally {
      setLoading(false);
    }
  }, [appUser?.supplierProfileId, firebaseUser, text.error]);

  useEffect(() => { void load(); }, [load]);

  const profile = useMemo(() => {
    if (!appUser) return { completion: 0, missing: [] as string[] };
    const fields = [
      { value: appUser.organization, ar: "اسم الشركة", en: "Company name" },
      { value: appUser.phone, ar: "رقم الهاتف", en: "Phone number" },
      { value: appUser.jobTitle, ar: "المسمى الوظيفي", en: "Job title" },
      { value: appUser.governorate, ar: "المحافظة", en: "Governorate" },
      { value: appUser.city, ar: "المدينة", en: "City" },
      { value: appUser.sector, ar: "قطاع العمل", en: "Business sector" },
    ];
    const completed = fields.filter((field) => String(field.value || "").trim()).length;
    return { completion: Math.round((completed / fields.length) * 100), missing: fields.filter((field) => !String(field.value || "").trim()).map((field) => field[locale]) };
  }, [appUser, locale]);

  if (!appUser) return null;
  if (loading) return <DashboardSkeleton />;

  const latest: SupplierSubmission | undefined = submissions.length ? submissions[0] : undefined;
  const companyStatus = appUser.supplierProfileId ? "approved" : latest?.submissionStatus || "not_started";
  const approvedCount = submissions.filter((item) => item.submissionStatus === "approved").length;
  const pendingCount = submissions.filter((item) => item.submissionStatus === "pending_review" || item.submissionStatus === "possible_duplicate").length;

  return (
    <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
      <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} actions={<Link to="/suppliers/new"><Button><Plus className="h-4 w-4" />{text.action}</Button></Link>} />
      <div className="grid gap-5 p-5 sm:p-7">
        {error ? <DashboardError message={error} retry={() => void load()} /> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label={text.completion} value={`${profile.completion}%`} icon={Building2} tone={profile.completion === 100 ? "good" : "warning"} to="/profile" />
          <MetricCard label={text.companyStatus} value={companyStatus === "not_started" ? text.notStarted : <StatusBadge value={companyStatus} />} helper={pendingCount ? `${pendingCount} ${text.pending}` : undefined} icon={ClipboardCheck} tone={companyStatus === "approved" ? "good" : "warning"} to="/my-submissions" />
          <MetricCard label={text.rfqs} value={rfqCount} icon={FileClock} tone={rfqCount ? "warning" : "neutral"} to="/supplier/rfqs" />
          <MetricCard label={text.views} value="—" helper={text.unavailable} icon={Eye} to="/supplier/analytics" />
          <MetricCard label={text.inquiries} value="—" helper={text.unavailable} icon={MessageSquare} to="/supplier/messages" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <DashboardPanel title={text.companyReadiness} description={text.companyReadinessBody}>
            <ProgressBar value={profile.completion} label={text.completion} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link className="rounded-[14px] bg-successBg p-4 transition hover:ring-2 hover:ring-mint/30" to="/my-submissions"><div className="flex items-center gap-2 text-sm font-black text-mint"><CheckCircle2 className="h-5 w-5" />{locale === "ar" ? "طلبات معتمدة" : "Approved submissions"}</div><div className="mt-2 text-2xl font-black text-ink">{approvedCount}</div></Link>
              <Link className="rounded-[14px] bg-cream p-4 transition hover:ring-2 hover:ring-amber/30" to="/my-submissions"><div className="flex items-center gap-2 text-sm font-black text-amber"><ClipboardCheck className="h-5 w-5" />{text.pending}</div><div className="mt-2 text-2xl font-black text-ink">{pendingCount}</div></Link>
            </div>
          </DashboardPanel>
          <DashboardPanel title={text.missing} description={text.missingBody}>
            {profile.missing.length ? <div className="grid gap-2">{profile.missing.map((item) => <div className="flex items-center gap-2 rounded-xl border border-amber/20 bg-cream px-3 py-2.5 text-sm font-bold text-ink" key={item}><AlertTriangle className="h-4 w-4 shrink-0 text-amber" />{item}</div>)}</div> : <InlineEmptyState compact title={text.noMissing} body={text.noMissingBody} />}
          </DashboardPanel>
        </div>

        <DashboardPanel title={text.latest} description={text.latestBody} actions={<Link className="inline-flex items-center gap-1 text-xs font-black text-amber hover:text-ink" to="/my-submissions">{locale === "ar" ? "عرض الكل" : "View all"}<ArrowRight className="h-4 w-4" /></Link>}>
          {submissions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-borderSoft text-start text-xs font-black text-muted"><th className="px-3 py-3 text-start">{locale === "ar" ? "الشركة" : "Company"}</th><th className="px-3 py-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th><th className="px-3 py-3 text-start">{locale === "ar" ? "تاريخ الإرسال" : "Submitted"}</th><th className="px-3 py-3 text-start">{locale === "ar" ? "ملاحظة الإدارة" : "Admin note"}</th></tr></thead>
                <tbody>{submissions.slice(0, 5).map((item) => <tr className="border-b border-borderSoft/70 last:border-0" key={item.id}><td className="px-3 py-3 font-black text-ink">{localizedSupplierName(item.supplierData, locale)}</td><td className="px-3 py-3"><StatusBadge value={item.submissionStatus} /></td><td className="px-3 py-3 font-semibold text-muted">{formatDate(item.createdAt, locale)}</td><td className="max-w-xs truncate px-3 py-3 font-semibold text-muted">{item.adminNotes || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <InlineEmptyState title={text.noSubmissions} body={text.noSubmissionsBody} />}
        </DashboardPanel>

        <div className="grid gap-5 lg:grid-cols-2">
          <DashboardPanel title={text.preview} description={text.previewBody}>{appUser.supplierProfileId ? <Link to={`/suppliers/${appUser.supplierProfileId}`}><Button variant="secondary"><Eye className="h-4 w-4" />{locale === "ar" ? "عرض الصفحة كما يراها المشترون" : "View the buyer-facing page"}</Button></Link> : <InlineEmptyState compact title={latest?.submissionStatus === "approved" ? (locale === "ar" ? "بانتظار إتمام الربط" : "Waiting for profile linking") : text.preview} body={text.previewBody} />}</DashboardPanel>
          <DashboardPanel title={text.documents} description={text.documentsBody}><div className="flex items-start gap-3 rounded-[14px] border border-borderSoft bg-creamLight p-4"><FileText className="mt-0.5 h-5 w-5 shrink-0 text-amber" /><div><div className="text-sm font-black text-ink">{locale === "ar" ? "قريباً" : "Coming soon"}</div><p className="mt-1 text-xs font-semibold leading-6 text-muted">{text.documentsBody}</p></div></div></DashboardPanel>
        </div>
      </div>
    </div>
  );
}
