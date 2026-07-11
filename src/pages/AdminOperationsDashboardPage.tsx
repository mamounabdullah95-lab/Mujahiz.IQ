import { Activity, Building2, ClipboardCheck, LifeBuoy, RefreshCw, Star, Tags, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardError, DashboardPageHeader, DashboardPanel, DashboardSkeleton, InlineEmptyState, MetricCard } from "../components/DashboardPrimitives";
import { Button } from "../components/ui";
import { listAuditLogs } from "../services/firestore";
import { getPortalMetrics, type PortalMetrics } from "../services/portalDashboard";
import type { AuditLog } from "../types/domain";
import { formatDate } from "../utils/date";

const initialMetrics: PortalMetrics = { totalUsers: 0, buyerAccounts: 0, supplierAccounts: 0, admins: 0, superAdmins: 0, pendingUsers: 0, approvedSuppliers: 0, pendingCompanies: 0, rejectedCompanies: 0, pendingReviews: 0, pendingFeedback: 0, pendingTerms: 0, categories: 0 };

export function AdminOperationsDashboardPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const [metrics, setMetrics] = useState(initialMetrics);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextMetrics, logs] = await Promise.all([getPortalMetrics(), listAuditLogs()]);
      setMetrics(nextMetrics);
      setActivity(logs.slice(0, 8));
    } catch {
      setError(locale === "ar" ? "تعذر تحميل مؤشرات الإدارة حالياً." : "Admin metrics could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <DashboardSkeleton />;

  return (
    <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
      <DashboardPageHeader eyebrow={locale === "ar" ? "إدارة العمليات اليومية" : "Daily operations"} title={locale === "ar" ? "لوحة مدير النظام" : "Admin dashboard"} description={locale === "ar" ? "تابع طلبات اعتماد الشركات والمستخدمين والمراجعات والبلاغات من مساحة تشغيل واحدة." : "Monitor company approvals, users, reviews, and support items from one operations workspace."} actions={<Button variant="secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" />{locale === "ar" ? "تحديث" : "Refresh"}</Button>} />
      <div className="grid gap-5 p-5 sm:p-7">
        {error ? <DashboardError message={error} retry={() => void load()} /> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard label={locale === "ar" ? "المجهزون المعتمدون" : "Approved suppliers"} value={metrics.approvedSuppliers} icon={Building2} tone="good" />
          <MetricCard label={locale === "ar" ? "حسابات المجهزين" : "Supplier accounts"} value={metrics.supplierAccounts} icon={Users} />
          <MetricCard label={locale === "ar" ? "حسابات المشترين" : "Buyer accounts"} value={metrics.buyerAccounts} icon={Users} />
          <MetricCard label={locale === "ar" ? "شركات بانتظار المراجعة" : "Companies awaiting review"} value={metrics.pendingCompanies} icon={ClipboardCheck} tone={metrics.pendingCompanies ? "warning" : "neutral"} />
          <MetricCard label={locale === "ar" ? "تقييمات بانتظار المراجعة" : "Pending reviews"} value={metrics.pendingReviews} icon={Star} tone={metrics.pendingReviews ? "warning" : "neutral"} />
          <MetricCard label={locale === "ar" ? "بلاغات ودعم" : "Reports & support"} value={metrics.pendingFeedback} icon={LifeBuoy} tone={metrics.pendingFeedback ? "warning" : "neutral"} />
        </div>

        <DashboardPanel title={locale === "ar" ? "مركز العمليات" : "Operations center"} description={locale === "ar" ? "الأقسام التي تحتاج متابعة إدارية مباشرة." : "Areas that require direct administrative attention."}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OperationLink to="/admin/submissions" title={locale === "ar" ? "طلبات اعتماد الشركات" : "Company approvals"} value={metrics.pendingCompanies} icon={ClipboardCheck} />
            <OperationLink to="/admin/users" title={locale === "ar" ? "إدارة المستخدمين" : "User management"} value={metrics.totalUsers} icon={Users} />
            <OperationLink to="/admin/categories" title={locale === "ar" ? "التصنيفات" : "Categories"} value={metrics.categories} icon={Tags} />
            <OperationLink to="/admin/supplier-feedback" title={locale === "ar" ? "البلاغات والدعم" : "Reports & support"} value={metrics.pendingFeedback} icon={LifeBuoy} />
          </div>
        </DashboardPanel>

        <DashboardPanel title={locale === "ar" ? "آخر الإجراءات الإدارية" : "Recent administrative activity"} description={locale === "ar" ? "سجل حقيقي من Audit Log، دون إنشاء نشاط تجريبي." : "Real Audit Log entries, with no fabricated activity."} actions={<Activity className="h-5 w-5 text-amber" />}>
          {activity.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b border-borderSoft text-xs font-black text-muted"><th className="px-3 py-3 text-start">{locale === "ar" ? "الإجراء" : "Action"}</th><th className="px-3 py-3 text-start">{locale === "ar" ? "النوع" : "Target"}</th><th className="px-3 py-3 text-start">{locale === "ar" ? "المنفذ" : "Actor"}</th><th className="px-3 py-3 text-start">{locale === "ar" ? "الوقت" : "Time"}</th></tr></thead><tbody>{activity.map((item) => <tr className="border-b border-borderSoft/70 last:border-0" key={item.id}><td className="px-3 py-3 font-black text-ink">{item.action}</td><td className="px-3 py-3 font-semibold text-muted">{item.targetType}</td><td className="max-w-48 truncate px-3 py-3 font-semibold text-muted">{item.actorId}</td><td className="px-3 py-3 font-semibold text-muted">{formatDate(item.createdAt, locale)}</td></tr>)}</tbody></table></div>
          ) : <InlineEmptyState title={locale === "ar" ? "لا توجد إجراءات مسجلة" : "No activity recorded"} body={locale === "ar" ? "ستظهر الإجراءات الإدارية هنا عند تنفيذها." : "Administrative actions will appear here when they occur."} />}
        </DashboardPanel>
      </div>
    </div>
  );
}

function OperationLink({ to, title, value, icon: Icon }: { to: string; title: string; value: number; icon: typeof Users }) {
  return <Link className="flex items-center gap-3 rounded-[14px] border border-borderSoft bg-creamLight p-4 transition hover:border-amber hover:bg-cream" to={to}><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-amber shadow-card"><Icon className="h-5 w-5" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-ink">{title}</span><span className="mt-1 block text-2xl font-black text-ink">{value}</span></span></Link>;
}
