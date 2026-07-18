import { Activity, DatabaseBackup, RefreshCw, Settings, ShieldCheck, SlidersHorizontal, UserCog, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { DashboardError, DashboardPageHeader, DashboardPanel, DashboardSkeleton, MetricCard } from "../components/DashboardPrimitives";
import { Button } from "../components/ui";
import { listAuditLogs } from "../services/firestore";
import { getPortalMetrics, type PortalMetrics } from "../services/portalDashboard";
import type { AuditLog } from "../types/domain";
import { formatDate } from "../utils/date";

const emptyMetrics: PortalMetrics = { totalUsers: 0, buyerAccounts: 0, supplierAccounts: 0, admins: 0, superAdmins: 0, pendingUsers: 0, approvedSuppliers: 0, pendingCompanies: 0, rejectedCompanies: 0, pendingReviews: 0, pendingFeedback: 0, pendingTerms: 0, categories: 0 };

export function SuperAdminDashboardPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { taxonomy } = useTaxonomy();
  const categoryCount = taxonomy.supplierCategories.length;
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const [nextMetrics, nextLogs] = await Promise.all([getPortalMetrics("owner", categoryCount, { force }), listAuditLogs(10)]);
      setMetrics(nextMetrics);
      setLogs(nextLogs.slice(0, 10));
    } catch {
      setError("metrics_load_failed");
    } finally {
      setLoading(false);
    }
  }, [categoryCount]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <DashboardSkeleton />;

  const management = [
    { to: "/super-admin/admins", icon: UserCog, ar: "إدارة حسابات المديرين", en: "Manage admin accounts", bodyAr: "ترقية المستخدمين أو تعليق حسابات Admin.", bodyEn: "Promote users or suspend admin accounts." },
    { to: "/super-admin/roles", icon: SlidersHorizontal, ar: "الأدوار والصلاحيات", en: "Roles and permissions", bodyAr: "مراجعة حدود الوصول بين الأدوار.", bodyEn: "Review access boundaries between roles." },
    { to: "/super-admin/audit-logs", icon: Activity, ar: "سجل الإجراءات", en: "Audit log", bodyAr: "تتبع العمليات الإدارية الحساسة.", bodyEn: "Trace sensitive administrative actions." },
    { to: "/super-admin/settings", icon: Settings, ar: "إعدادات المنصة", en: "Platform settings", bodyAr: "إعدادات التشغيل العامة ودورة الوصول.", bodyEn: "General operating and access settings." },
    { to: "/super-admin/integrations", icon: ShieldCheck, ar: "التكاملات والخدمات", en: "Integrations", bodyAr: "إدارة الخدمات الخارجية عند تفعيلها.", bodyEn: "Manage external services when enabled." },
    { to: "/super-admin/backups", icon: DatabaseBackup, ar: "النسخ الاحتياطي", en: "Backups", bodyAr: "إعدادات الحفظ والاستعادة عند دعم البنية لها.", bodyEn: "Backup and recovery settings when supported." },
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
      <DashboardPageHeader eyebrow={locale === "ar" ? "صلاحيات النظام العليا" : "Highest system privileges"} title={locale === "ar" ? "لوحة الحساب الرئيسي" : "Super Admin dashboard"} description={locale === "ar" ? "إدارة المدراء والأدوار والإعدادات العامة وسجل النظام من مساحة محمية مستقلة." : "Manage administrators, roles, global settings, and the system audit trail from a separate protected workspace."} actions={<Button variant="secondary" onClick={() => void load(true)}><RefreshCw className="h-4 w-4" />{locale === "ar" ? "تحديث" : "Refresh"}</Button>} />
      <div className="grid gap-5 p-5 sm:p-7">
        {error ? <DashboardError message={locale === "ar" ? "تعذر تحميل مؤشرات الحساب الرئيسي." : "Super-admin metrics could not be loaded."} retry={() => void load(true)} /> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard label={locale === "ar" ? "إجمالي المستخدمين" : "Total users"} value={metrics.totalUsers} icon={Users} to="/super-admin/users" />
          <MetricCard label={locale === "ar" ? "المديرون" : "Admins"} value={metrics.admins} icon={UserCog} tone="warning" to="/super-admin/admins" />
          <MetricCard label={locale === "ar" ? "الحسابات الرئيسية" : "Super admins"} value={metrics.superAdmins} icon={ShieldCheck} tone="good" to="/super-admin/users" />
          <MetricCard label={locale === "ar" ? "المجهزون المعتمدون" : "Approved suppliers"} value={metrics.approvedSuppliers} icon={ShieldCheck} tone="good" to="/admin/suppliers" />
          <MetricCard label={locale === "ar" ? "طلبات الشركات المعلقة" : "Pending company requests"} value={metrics.pendingCompanies} icon={Activity} tone={metrics.pendingCompanies ? "warning" : "neutral"} to="/admin/submissions" />
          <MetricCard label={locale === "ar" ? "التصنيفات" : "Categories"} value={metrics.categories} icon={SlidersHorizontal} to="/super-admin/categories" />
        </div>

        <DashboardPanel title={locale === "ar" ? "إدارة النظام" : "System management"} description={locale === "ar" ? "وظائف الحساب الرئيسي منفصلة عن صلاحيات مدير النظام العادي." : "Super-admin functions are isolated from regular administrator access."}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{management.map((item) => { const Icon = item.icon; return <Link className="rounded-[14px] border border-borderSoft bg-creamLight p-4 transition hover:border-amber hover:bg-cream" to={item.to} key={item.to}><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-amber shadow-card"><Icon className="h-5 w-5" /></span><h4 className="mt-4 text-sm font-black text-ink">{locale === "ar" ? item.ar : item.en}</h4><p className="mt-1 text-xs font-semibold leading-6 text-muted">{locale === "ar" ? item.bodyAr : item.bodyEn}</p></Link>; })}</div>
        </DashboardPanel>

        <DashboardPanel title={locale === "ar" ? "آخر أحداث النظام" : "Latest system activity"} description={locale === "ar" ? "قراءة مباشرة من سجل الإجراءات غير القابل للتعديل من الواجهة." : "Read directly from the append-only audit log."}>
          <div className="grid gap-2">{logs.length ? logs.map((item) => <div className="grid gap-2 rounded-[14px] border border-borderSoft bg-white px-4 py-3 text-sm sm:grid-cols-[1.2fr_1fr_auto] sm:items-center" key={item.id}><div className="font-black text-ink">{item.action}</div><div className="truncate font-semibold text-muted">{item.targetType}: {item.targetId}</div><div className="text-xs font-bold text-muted">{formatDate(item.createdAt, locale)}</div></div>) : <div className="rounded-[14px] border border-dashed border-borderSoft p-6 text-center text-sm font-bold text-muted">{locale === "ar" ? "لا توجد أحداث مسجلة" : "No events recorded"}</div>}</div>
        </DashboardPanel>
      </div>
    </div>
  );
}
