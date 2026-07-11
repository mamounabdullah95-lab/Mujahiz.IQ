import { ArrowRight, BookOpen, FileClock, Heart, Search, ShieldCheck, Tags, UserRoundCheck } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DashboardPageHeader, DashboardPanel, InlineEmptyState, MetricCard, ProgressBar } from "../components/DashboardPrimitives";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { labelFor } from "../data/constants";

const copy = {
  ar: {
    eyebrow: "مساحة عمل المشتريات",
    title: "مرحباً، {{name}}",
    description: "ابحث عن المجهزين المعتمدين، استكشف التصنيفات، وابدأ بناء قائمة توريد أوضح لمؤسستك.",
    directory: "استعرض المجهزين",
    quickSearch: "بحث سريع في دليل المجهزين",
    quickSearchBody: "اكتب اسم منتج أو خدمة أو تصنيف. يمكنك الانتقال بعدها إلى البحث الذكي والتصفية المتقدمة.",
    searchPlaceholder: "مثال: أجهزة قياس الضغط التفاضلي",
    searchAction: "ابدأ البحث",
    access: "حالة الوصول",
    favorites: "المجهزون المفضلون",
    rfqs: "طلبات عروض الأسعار",
    profile: "اكتمال الملف الشخصي",
    notMeasured: "غير متاح بعد",
    categories: "التصنيفات الرئيسية",
    categoriesBody: "اختصارات سريعة للوصول إلى المجهزين حسب مجال العمل.",
    saved: "المفضلة",
    savedBody: "احفظ المجهزين الذين تريد العودة إليهم عند تجهيز قائمة المقارنة.",
    savedEmpty: "لا توجد شركات محفوظة بعد",
    savedEmptyBody: "ستظهر الشركات التي تضيفها إلى المفضلة هنا عند تفعيل هذه الوظيفة.",
    recent: "شوهدت مؤخراً",
    recentBody: "آخر ملفات المجهزين التي فتحتها من الدليل.",
    recentEmpty: "لا توجد مشاهدات حديثة",
    recentEmptyBody: "ابدأ من دليل المجهزين، وستظهر آخر الملفات التي زرتها هنا.",
    rfqTitle: "طلبات عروض الأسعار",
    rfqBody: "مسار RFQ قيد التجهيز. لن نعرض طلبات تجريبية على أنها بيانات حقيقية.",
    profileHint: "أكمل بيانات الحساب لتحسين دقة التواصل والإشعارات.",
  },
  en: {
    eyebrow: "Procurement workspace",
    title: "Welcome, {{name}}",
    description: "Discover approved suppliers, browse categories, and build a clearer sourcing shortlist for your organization.",
    directory: "Browse suppliers",
    quickSearch: "Quick supplier directory search",
    quickSearchBody: "Enter a product, service, or category, then continue with smart search and advanced filters.",
    searchPlaceholder: "Example: differential pressure gauges",
    searchAction: "Start search",
    access: "Access status",
    favorites: "Favorite suppliers",
    rfqs: "RFQ requests",
    profile: "Profile completion",
    notMeasured: "Not available yet",
    categories: "Main categories",
    categoriesBody: "Quick paths to suppliers by business category.",
    saved: "Favorites",
    savedBody: "Save suppliers you want to revisit when preparing a comparison shortlist.",
    savedEmpty: "No saved companies yet",
    savedEmptyBody: "Suppliers you favorite will appear here when this feature is activated.",
    recent: "Recently viewed",
    recentBody: "The latest supplier profiles you opened from the directory.",
    recentEmpty: "No recent views",
    recentEmptyBody: "Start in the supplier directory and your latest profile views will appear here.",
    rfqTitle: "Request for quotation",
    rfqBody: "The RFQ workflow is being prepared. Demo requests are not presented as real business data.",
    profileHint: "Complete your account details to improve communication and notifications.",
  },
};

export function BuyerDashboardPage() {
  const { i18n } = useTranslation();
  const { appUser, hasActiveAccess } = useAuth();
  const { taxonomy } = useTaxonomy();
  const navigate = useNavigate();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = copy[locale];
  const [query, setQuery] = useState("");
  const profileCompletion = useMemo(() => {
    if (!appUser) return 0;
    const fields = [appUser.fullName, appUser.phone, appUser.jobTitle, appUser.organization, appUser.governorate, appUser.city, appUser.sector, appUser.reasonForJoining];
    return Math.round((fields.filter((value) => String(value || "").trim()).length / fields.length) * 100);
  }, [appUser]);

  if (!appUser) return null;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/directory?q=${encodeURIComponent(value)}` : "/directory");
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-borderSoft bg-creamLight shadow-card">
      <DashboardPageHeader
        eyebrow={text.eyebrow}
        title={text.title.replace("{{name}}", appUser.fullName.split(/\s+/)[0] || appUser.fullName)}
        description={text.description}
        actions={<Link to="/directory"><Button><BookOpen className="h-4 w-4" />{text.directory}</Button></Link>}
      />
      <div className="grid gap-5 p-5 sm:p-7">
        <DashboardPanel title={text.quickSearch} description={text.quickSearchBody}>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input className="h-12 w-full rounded-xl border border-borderSoft bg-creamLight ps-12 pe-4 text-sm font-bold outline-none transition placeholder:text-muted focus:border-amber focus:ring-2 focus:ring-amber/15" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.searchPlaceholder} maxLength={180} />
            </label>
            <Button type="submit"><Search className="h-4 w-4" />{text.searchAction}</Button>
          </form>
        </DashboardPanel>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={text.access} value={<StatusBadge value={hasActiveAccess ? "active" : appUser.accessStatus} />} icon={ShieldCheck} tone={hasActiveAccess ? "good" : "warning"} />
          <MetricCard label={text.favorites} value="—" helper={text.notMeasured} icon={Heart} />
          <MetricCard label={text.rfqs} value="—" helper={text.notMeasured} icon={FileClock} />
          <MetricCard label={text.profile} value={`${profileCompletion}%`} helper={text.profileHint} icon={UserRoundCheck} tone={profileCompletion === 100 ? "good" : "warning"} />
        </div>

        <DashboardPanel title={text.categories} description={text.categoriesBody} actions={<Tags className="h-5 w-5 text-amber" />}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {taxonomy.supplierCategories.slice(0, 8).map((item) => (
              <Link className="flex min-h-14 items-center justify-between gap-3 rounded-[14px] border border-borderSoft bg-creamLight px-4 py-3 text-sm font-black text-ink transition hover:border-amber hover:bg-cream" to={`/directory?category=${encodeURIComponent(item.value)}`} key={item.value}>
                <span>{labelFor(taxonomy.supplierCategories, item.value, locale)}</span><ArrowRight className="h-4 w-4 shrink-0 text-amber" />
              </Link>
            ))}
          </div>
        </DashboardPanel>

        <div className="grid gap-5 xl:grid-cols-2">
          <DashboardPanel title={text.saved} description={text.savedBody}><InlineEmptyState compact title={text.savedEmpty} body={text.savedEmptyBody} /></DashboardPanel>
          <DashboardPanel title={text.recent} description={text.recentBody}><InlineEmptyState compact title={text.recentEmpty} body={text.recentEmptyBody} /></DashboardPanel>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <DashboardPanel title={text.rfqTitle} description={text.rfqBody}><InlineEmptyState title={locale === "ar" ? "مسار RFQ سيُفعّل في المرحلة التالية" : "The RFQ workflow will be enabled next"} body={text.rfqBody} /></DashboardPanel>
          <DashboardPanel title={text.profile} description={text.profileHint}><ProgressBar value={profileCompletion} label={text.profile} /><Link className="mt-5 inline-flex items-center gap-2 text-sm font-black text-amber hover:text-ink" to="/profile">{locale === "ar" ? "تحديث الملف الشخصي" : "Update profile"}<ArrowRight className="h-4 w-4" /></Link></DashboardPanel>
        </div>
      </div>
    </div>
  );
}
