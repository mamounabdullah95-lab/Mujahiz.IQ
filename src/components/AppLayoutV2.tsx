import {
  ChevronDown,
  ChevronLeft,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoLockupUrl from "../assets/identity/logo-lockup.png";
import logoIconUrl from "../assets/brand/mujahiz-iq-brand-icon.png";
import { portalNavigation, portalRoleLabels, type PortalNavItem } from "../config/portalNavigation";
import { useAuth } from "../contexts/AuthContext";
import { portalHome, resolvePortalRole } from "../utils/authorization";
import { AuthLoadingScreen } from "./AuthLoadingScreen";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { Button } from "./ui";

const publicRoutes = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/action",
  "/register",
  "/verify-email",
  "/complete-profile",
  "/about",
  "/suppliers",
  "/buyers",
  "/how-it-works",
  "/supplier-directory",
  "/join",
  "/contact",
  "/faq",
  "/resources",
  "/terms",
  "/privacy",
  "/security",
]);

const publicLinks = [
  { to: "/", ar: "الرئيسية", en: "Home" },
  { to: "/about", ar: "عن مجهز", en: "About Mujahiz" },
  { to: "/suppliers", ar: "المجهزون", en: "Suppliers" },
  { to: "/buyers", ar: "المشترون", en: "Buyers" },
  { to: "/how-it-works", ar: "كيف تعمل المنصة", en: "How It Works" },
  { to: "/faq", ar: "الأسئلة الشائعة", en: "FAQs" },
  { to: "/contact", ar: "تواصل معنا", en: "Contact Us" },
];

export function AppLayoutV2() {
  const { appUser, loading } = useAuth();
  const location = useLocation();
  const isPublicRoute = publicRoutes.has(location.pathname);

  if (loading && !isPublicRoute) return <AuthLoadingScreen />;

  if (isPublicRoute || !appUser) {
    return (
      <div className="min-h-screen bg-creamLight text-ink">
        <PublicHeader />
        <main><Outlet /></main>
      </div>
    );
  }

  return <PortalShell />;
}

function PublicHeader() {
  const { i18n } = useTranslation();
  const { appUser } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-borderSoft bg-creamLight/95 backdrop-blur">
      <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="shrink-0" to="/">
          <img className="h-12 w-auto object-contain sm:h-14" src={logoLockupUrl} alt="Mujahiz IQ" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-bold text-ink lg:flex" aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
          {publicLinks.map((item) => (
            <NavLink className={({ isActive }) => isActive ? "text-amber" : "transition hover:text-amber"} to={item.to} key={item.to} end={item.to === "/"}>
              {item[locale]}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><LanguageToggle /></div>
          {appUser ? (
            <Link to={portalHome(appUser)}><Button>{locale === "ar" ? "لوحة التحكم" : "Dashboard"}</Button></Link>
          ) : (
            <>
              <Link className="hidden md:block" to="/register"><Button variant="secondary"><UserPlus className="h-4 w-4" />{locale === "ar" ? "طلب الانضمام" : "Join Request"}</Button></Link>
              <Link to="/login"><Button><LogIn className="h-4 w-4" />{locale === "ar" ? "دخول المنصة" : "Login"}</Button></Link>
            </>
          )}
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-cream lg:hidden" type="button" aria-label={locale === "ar" ? "فتح القائمة" : "Open menu"} onClick={() => setOpen((value) => !value)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="grid gap-1 border-t border-borderSoft bg-white p-4 lg:hidden">
          {publicLinks.map((item) => <Link className="rounded-xl px-4 py-3 text-sm font-bold hover:bg-cream" to={item.to} key={item.to}>{item[locale]}</Link>)}
          <div className="mt-2 sm:hidden"><LanguageToggle /></div>
        </nav>
      ) : null}
    </header>
  );
}

function PortalShell() {
  const { appUser, logout } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const isRtl = locale === "ar";
  const role = resolvePortalRole(appUser);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = role ? portalNavigation[role] : [];
  const activeItem = useMemo(
    () => [...items].sort((a, b) => b.to.length - a.to.length).find((item) => item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)),
    [items, location.pathname],
  );

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  if (!appUser || !role) return <AuthLoadingScreen />;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (role === "buyer") navigate(`/directory?q=${encodeURIComponent(value)}`);
    else if (role === "admin" || role === "super_admin") navigate(`/admin/suppliers?q=${encodeURIComponent(value)}`);
  }

  const initials = appUser.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "M";
  const pageTitle = activeItem?.label[locale] || portalRoleLabels[role][locale];

  return (
    <div className="min-h-screen bg-[#fbf8f3] text-ink">
      <header className="sticky top-0 z-40 border-b border-borderSoft bg-white/95 backdrop-blur">
        <div className="flex min-h-[4.75rem] items-center gap-3 px-4 sm:px-6">
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-borderSoft text-ink lg:hidden" type="button" aria-label={isRtl ? "فتح القائمة" : "Open menu"} onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold text-muted">
              <Link className="hover:text-amber" to={portalHome(role)}>{isRtl ? "لوحة التحكم" : "Dashboard"}</Link>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate text-ink">{pageTitle}</span>
            </div>
            <h1 className="mt-1 truncate text-lg font-black text-ink sm:text-xl">{pageTitle}</h1>
          </div>
          {role !== "supplier" ? (
            <form className="relative hidden w-full max-w-sm md:block" onSubmit={submitSearch}>
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input className="h-11 w-full rounded-xl border border-borderSoft bg-creamLight ps-10 pe-3 text-sm font-semibold outline-none transition focus:border-amber focus:ring-2 focus:ring-amber/15" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isRtl ? "بحث سريع..." : "Quick search..."} />
            </form>
          ) : null}
          <LanguageToggle />
          <NotificationBell />
          <div className="relative">
            <button className="flex min-h-11 items-center gap-2 rounded-xl border border-borderSoft bg-white px-2.5 text-start transition hover:border-amber/50" type="button" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((value) => !value)}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-xs font-black text-white">{initials}</span>
              <span className="hidden max-w-36 sm:block"><span className="block truncate text-xs font-black text-ink">{appUser.fullName}</span><span className="block truncate text-[11px] font-bold text-muted">{portalRoleLabels[role][locale]}</span></span>
              <ChevronDown className="hidden h-4 w-4 text-muted sm:block" />
            </button>
            {userMenuOpen ? (
              <div className="absolute end-0 top-[3.25rem] z-50 w-64 rounded-[14px] border border-borderSoft bg-white p-2 shadow-soft">
                <div className="border-b border-borderSoft px-3 py-3"><div className="truncate text-sm font-black">{appUser.fullName}</div><div className="truncate text-xs font-semibold text-muted">{appUser.email}</div></div>
                <Link className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-cream" to="/profile"><UserRound className="h-4 w-4" />{isRtl ? "الملف الشخصي" : "Profile"}</Link>
                <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-clay hover:bg-clay/5" type="button" onClick={() => void logout()}><LogOut className="h-4 w-4" />{isRtl ? "تسجيل الخروج" : "Logout"}</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={`mx-auto flex max-w-[1600px] gap-0 lg:gap-5 lg:px-5 lg:py-5 ${isRtl ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
        <aside className={`hidden shrink-0 overflow-hidden rounded-[18px] border border-borderSoft bg-white shadow-card transition-[width] lg:sticky lg:top-[6rem] lg:block lg:h-[calc(100vh-7.25rem)] ${collapsed ? "w-[5.25rem]" : "w-[17rem]"}`}>
          <Sidebar role={role} items={items} locale={locale} collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} />
        </aside>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]" type="button" aria-label={isRtl ? "إغلاق القائمة" : "Close menu"} onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 end-0 w-[min(88vw,20rem)] overflow-y-auto border-s border-borderSoft bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-borderSoft p-4"><img className="h-12 w-auto" src={logoLockupUrl} alt="Mujahiz IQ" /><button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-cream" type="button" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button></div>
            <Sidebar role={role} items={items} locale={locale} collapsed={false} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({ role, items, locale, collapsed, onCollapse }: { role: NonNullable<ReturnType<typeof resolvePortalRole>>; items: PortalNavItem[]; locale: "ar" | "en"; collapsed: boolean; onCollapse?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className={`flex min-h-[5.25rem] items-center border-b border-borderSoft p-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Link to={portalHome(role)}><img className={collapsed ? "h-10 w-10 object-contain" : "h-14 w-auto object-contain"} src={collapsed ? logoIconUrl : logoLockupUrl} alt="Mujahiz IQ" /></Link>
        {onCollapse && !collapsed ? <button className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-cream hover:text-ink" type="button" aria-label={locale === "ar" ? "طي القائمة" : "Collapse sidebar"} onClick={onCollapse}><PanelLeftClose className="h-4 w-4" /></button> : null}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={portalRoleLabels[role][locale]}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink className={({ isActive }) => `relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${isActive ? "bg-navy text-white shadow-card after:absolute after:inset-y-2 after:end-0 after:w-1 after:rounded-full after:bg-amber" : "text-ink/75 hover:bg-cream hover:text-ink"} ${collapsed ? "justify-center" : ""}`} end={item.end} to={item.to} key={item.to} title={collapsed ? item.label[locale] : undefined}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!collapsed ? <span className="truncate">{item.label[locale]}</span> : <span className="sr-only">{item.label[locale]}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-borderSoft p-3">
        {collapsed && onCollapse ? <button className="grid h-11 w-full place-items-center rounded-xl text-muted hover:bg-cream hover:text-ink" type="button" aria-label={locale === "ar" ? "توسيع القائمة" : "Expand sidebar"} onClick={onCollapse}><PanelLeftOpen className="h-5 w-5" /></button> : <div className="rounded-xl bg-cream p-3 text-center text-xs font-black leading-6 text-amber">{locale === "ar" ? "مجهز.. نقطة البداية لتوفير حقيقي." : "Mujahiz.. the starting point for real savings."}</div>}
      </div>
    </div>
  );
}
