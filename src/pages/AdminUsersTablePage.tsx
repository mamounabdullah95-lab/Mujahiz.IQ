import { Check, ChevronLeft, ChevronRight, Filter, Search, ShieldCheck, UserCog, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardError, DashboardPageHeader, InlineEmptyState } from "../components/DashboardPrimitives";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { approveUser, getPlatformSettings, grantTemporaryAccess, setUserRoleAndStatus } from "../services/firestore";
import { listAdministrativeUsers } from "../services/adminUsers";
import type { AppUser, UserRole, UserStatus } from "../types/domain";
import { formatDate } from "../utils/date";

type Scope = "all" | "admins" | "buyers";
type PendingAction = { user: AppUser; type: "approve" | "grace" | "role" | "status"; value?: string } | null;

export function AdminUsersTablePage({ scope = "all" }: { scope?: Scope }) {
  const { i18n } = useTranslation();
  const { firebaseUser, isOwner } = useAuth();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryText, setQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "name">("newest");
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = 12;

  const load = async () => {
    setLoading(true);
    setError("");
    try { setUsers(await listAdministrativeUsers()); }
    catch { setError(locale === "ar" ? "تعذر تحميل المستخدمين." : "Users could not be loaded."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => setPage(1), [queryText, statusFilter, sort, scope]);

  const filtered = useMemo(() => {
    const normalized = queryText.trim().toLowerCase();
    return users
      .filter((user) => scope === "admins" ? user.role === "admin" : scope === "buyers" ? user.accountType !== "supplier" && user.role !== "admin" && user.role !== "owner" : true)
      .filter((user) => statusFilter === "all" || user.status === statusFilter)
      .filter((user) => !normalized || [user.fullName, user.email, user.organization, user.jobTitle].some((value) => String(value || "").toLowerCase().includes(normalized)))
      .sort((a, b) => sort === "name" ? a.fullName.localeCompare(b.fullName, locale) : String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  }, [locale, queryText, scope, sort, statusFilter, users]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const title = scope === "admins" ? (locale === "ar" ? "حسابات المديرين" : "Admin accounts") : scope === "buyers" ? (locale === "ar" ? "إدارة المشترين" : "Buyer management") : (locale === "ar" ? "إدارة المستخدمين" : "User management");
  const description = scope === "admins" ? (locale === "ar" ? "ترقية أو تعليق حسابات Admin متاحة للحساب الرئيسي فقط." : "Promoting or suspending Admin accounts is limited to the Super Admin.") : (locale === "ar" ? "بحث وتصفية وترتيب حسابات المنصة مع إجراءات محمية حسب الدور." : "Search, filter, and sort platform accounts with role-protected actions.");

  async function executeAction() {
    if (!pendingAction || !firebaseUser) return;
    setBusy(true);
    setError("");
    try {
      if (pendingAction.type === "approve") await approveUser(pendingAction.user.uid, firebaseUser.uid);
      if (pendingAction.type === "grace") { const settings = await getPlatformSettings(); await grantTemporaryAccess(pendingAction.user.uid, firebaseUser.uid, settings.gracePeriodDays); }
      if (pendingAction.type === "role") await setUserRoleAndStatus(pendingAction.user.uid, firebaseUser.uid, pendingAction.value as UserRole, pendingAction.user.status);
      if (pendingAction.type === "status") await setUserRoleAndStatus(pendingAction.user.uid, firebaseUser.uid, pendingAction.user.role, pendingAction.value as UserStatus);
      await load();
      setPendingAction(null);
    } catch {
      setError(locale === "ar" ? "لم ينجح تحديث الحساب. تحقق من صلاحيتك وحاول مجدداً." : "The account update failed. Check your permission and try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
      <DashboardPageHeader eyebrow={locale === "ar" ? "إدارة الوصول" : "Access management"} title={title} description={description} />
      <div className="grid gap-5 p-5 sm:p-7">
        {error ? <DashboardError message={error} retry={() => void load()} /> : null}
        <div className="grid gap-3 rounded-[16px] border border-borderSoft bg-white p-4 shadow-card md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="h-11 w-full rounded-xl border border-borderSoft bg-creamLight ps-10 pe-3 text-sm font-semibold outline-none focus:border-amber focus:ring-2 focus:ring-amber/15" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder={locale === "ar" ? "بحث بالاسم أو البريد أو المؤسسة" : "Search name, email, or organization"} /></label>
          <label className="relative"><Filter className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><select className="h-11 w-full rounded-xl border border-borderSoft bg-white ps-10 pe-3 text-sm font-bold outline-none focus:border-amber" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">{locale === "ar" ? "كل الحالات" : "All statuses"}</option><option value="approved">{locale === "ar" ? "معتمد" : "Approved"}</option><option value="pending_approval">{locale === "ar" ? "بانتظار الموافقة" : "Pending"}</option><option value="suspended">{locale === "ar" ? "معلق" : "Suspended"}</option></select></label>
          <select className="h-11 rounded-xl border border-borderSoft bg-white px-3 text-sm font-bold outline-none focus:border-amber" value={sort} onChange={(event) => setSort(event.target.value as "newest" | "name")}><option value="newest">{locale === "ar" ? "الأحدث أولاً" : "Newest first"}</option><option value="name">{locale === "ar" ? "الاسم" : "Name"}</option></select>
        </div>

        <div className="overflow-hidden rounded-[16px] border border-borderSoft bg-white shadow-card">
          {loading ? <div className="grid gap-3 p-5">{Array.from({ length: 6 }).map((_, index) => <div className="h-16 animate-pulse rounded-xl bg-creamLight" key={index} />)}</div> : visible.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-sm"><thead><tr className="border-b border-borderSoft bg-creamLight text-xs font-black text-muted"><th className="px-4 py-3 text-start">{locale === "ar" ? "المستخدم" : "User"}</th><th className="px-4 py-3 text-start">{locale === "ar" ? "نوع الحساب" : "Account type"}</th><th className="px-4 py-3 text-start">{locale === "ar" ? "الدور" : "Role"}</th><th className="px-4 py-3 text-start">{locale === "ar" ? "الحالة" : "Status"}</th><th className="px-4 py-3 text-start">{locale === "ar" ? "تاريخ التسجيل" : "Created"}</th><th className="px-4 py-3 text-start">{locale === "ar" ? "الإجراءات" : "Actions"}</th></tr></thead><tbody>{visible.map((user) => { const protectedAdmin = user.role === "owner" || (!isOwner && user.role === "admin"); return <tr className="border-b border-borderSoft/70 align-top last:border-0" key={user.uid}><td className="px-4 py-4"><div className="font-black text-ink">{user.fullName}</div><div className="mt-1 max-w-56 truncate text-xs font-semibold text-muted">{user.email}</div><div className="mt-1 max-w-56 truncate text-xs font-semibold text-muted">{user.organization}</div></td><td className="px-4 py-4"><StatusBadge value={user.accountType || "buyer"} /></td><td className="px-4 py-4">{isOwner && user.role !== "owner" ? <select className="h-9 rounded-lg border border-borderSoft bg-white px-2 text-xs font-bold outline-none focus:border-amber" value={user.role} onChange={(event) => setPendingAction({ user, type: "role", value: event.target.value })}><option value="contributor">{locale === "ar" ? "مستخدم" : "User"}</option><option value="viewer">{locale === "ar" ? "مشاهد" : "Viewer"}</option><option value="admin">Admin</option></select> : <StatusBadge value={user.role} />}</td><td className="px-4 py-4"><StatusBadge value={user.status} /></td><td className="px-4 py-4 text-xs font-semibold text-muted">{formatDate(user.createdAt, locale)}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{user.status === "pending_approval" && !protectedAdmin ? <button className="inline-flex h-9 items-center gap-1 rounded-lg bg-navy px-3 text-xs font-black text-white hover:bg-river" type="button" onClick={() => setPendingAction({ user, type: "approve" })}><Check className="h-3.5 w-3.5" />{locale === "ar" ? "موافقة" : "Approve"}</button> : null}{!protectedAdmin ? <button className="inline-flex h-9 items-center rounded-lg border border-borderSoft px-3 text-xs font-black text-ink hover:border-amber" type="button" onClick={() => setPendingAction({ user, type: "grace" })}>{locale === "ar" ? "وصول مؤقت" : "Temporary access"}</button> : null}{!protectedAdmin && user.status !== "suspended" ? <button className="inline-flex h-9 items-center rounded-lg border border-clay/30 px-3 text-xs font-black text-clay hover:bg-clay/5" type="button" onClick={() => setPendingAction({ user, type: "status", value: "suspended" })}>{locale === "ar" ? "تعليق" : "Suspend"}</button> : null}</div></td></tr>; })}</tbody></table></div>
          ) : <div className="p-5"><InlineEmptyState title={locale === "ar" ? "لا توجد نتائج" : "No results"} body={locale === "ar" ? "غيّر كلمات البحث أو عوامل التصفية." : "Adjust the search or filters."} /></div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borderSoft px-4 py-3 text-xs font-bold text-muted"><span>{locale === "ar" ? `${filtered.length} حساب` : `${filtered.length} accounts`}</span><div className="flex items-center gap-2"><button className="grid h-9 w-9 place-items-center rounded-lg border border-borderSoft disabled:opacity-40" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronRight className="h-4 w-4" /></button><span>{page} / {totalPages}</span><button className="grid h-9 w-9 place-items-center rounded-lg border border-borderSoft disabled:opacity-40" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronLeft className="h-4 w-4" /></button></div></div>
        </div>
      </div>

      {pendingAction ? <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/35 p-4 backdrop-blur-[1px]"><div className="w-full max-w-md rounded-[18px] border border-borderSoft bg-white p-6 shadow-soft"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cream text-amber">{pendingAction.type === "role" ? <UserCog className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}</span><button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-cream" type="button" onClick={() => setPendingAction(null)}><X className="h-4 w-4" /></button></div><h3 className="mt-4 text-lg font-black text-ink">{locale === "ar" ? "تأكيد تحديث الحساب" : "Confirm account update"}</h3><p className="mt-2 text-sm font-semibold leading-7 text-muted">{locale === "ar" ? `سيتم تطبيق الإجراء على حساب ${pendingAction.user.fullName}.` : `This action will be applied to ${pendingAction.user.fullName}.`}</p><div className="mt-6 flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setPendingAction(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</Button><Button disabled={busy} onClick={() => void executeAction()}>{busy ? (locale === "ar" ? "جارٍ الحفظ..." : "Saving...") : (locale === "ar" ? "تأكيد" : "Confirm")}</Button></div></div></div> : null}
    </div>
  );
}
