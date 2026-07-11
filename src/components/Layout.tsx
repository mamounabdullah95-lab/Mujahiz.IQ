import {
  BarChart3,
  BookOpen,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Gauge,
  History,
  LogIn,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import logoLockupUrl from "../assets/identity/logo-lockup.png";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { Button } from "./ui";

const navItems = [
  { to: "/dashboard", labelKey: "dashboard", icon: Gauge },
  { to: "/directory", labelKey: "directory", icon: BookOpen },
  { to: "/suppliers/new", labelKey: "addSupplier", icon: FilePlus2 },
  { to: "/my-submissions", labelKey: "mySubmissions", icon: ClipboardCheck },
  { to: "/my-access", labelKey: "myAccess", icon: BarChart3 },
  { to: "/my-reviews", labelKey: "myReviews", icon: Star },
  { to: "/profile", labelKey: "profile", icon: UserRound },
];

const adminItems = [
  { to: "/admin", labelKey: "adminDashboard", icon: ShieldCheck },
  { to: "/admin/users", labelKey: "users", icon: Users },
  { to: "/admin/submissions", labelKey: "reviewQueue", icon: ClipboardCheck },
  { to: "/admin/reviews", labelKey: "reviewModeration", icon: Star },
  { to: "/admin/supplier-feedback", labelKey: "supplierFeedbackAdmin", icon: ClipboardCheck },
  { to: "/admin/suppliers", labelKey: "approvedSuppliers", icon: BookOpen },
  { to: "/admin/categories", labelKey: "categories", icon: Tags },
  { to: "/admin/material-dictionary", labelKey: "materialDictionary", icon: BookMarked },
  { to: "/admin/settings", labelKey: "settings", icon: Settings },
  { to: "/admin/audit-logs", labelKey: "auditLogs", icon: History },
];

const publicLinks = [
  { to: "/", labelKey: "navHome" },
  { to: "/about", labelKey: "navAbout" },
  { to: "/suppliers", labelKey: "navSuppliers" },
  { to: "/buyers", labelKey: "navBuyers" },
  { to: "/how-it-works", labelKey: "navHowItWorks" },
  { to: "/faq", labelKey: "navFaqs" },
  { to: "/contact", labelKey: "navContact" },
];

function AppNavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Gauge }) {
  return (
    <NavLink
      className={({ isActive }) =>
        `relative flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold transition ${
          isActive ? "bg-navy text-white shadow-soft after:absolute after:inset-y-2 after:right-0 after:w-1 after:rounded-full after:bg-amber" : "text-ink/75 hover:bg-cream hover:text-ink"
        }`
      }
      to={to}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { appUser, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-creamLight text-ink">
      <header className="sticky top-0 z-20 border-b border-borderSoft bg-creamLight/94 backdrop-blur">
        {appUser ? (
          <div className="mx-auto grid min-h-[5.5rem] max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button className="text-start" type="button" onClick={() => navigate("/dashboard")}>
              <img className="h-14 w-auto object-contain sm:h-16" src={logoLockupUrl} alt={t("appName")} />
              <div className="sr-only">{t("tagline")}</div>
            </button>
            <div className="hidden justify-center md:flex">
              <label className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  className="h-12 w-full rounded-xl border border-borderSoft bg-white/92 px-11 text-sm font-semibold text-ink outline-none transition placeholder:text-muted focus:border-amber focus:ring-2 focus:ring-amber/15"
                  placeholder={t("appSearchPlaceholder")}
                  type="search"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-cream md:hidden"
                type="button"
                aria-label={t(navOpen ? "closeMenu" : "menu")}
                aria-expanded={navOpen}
                onClick={() => setNavOpen((current) => !current)}
              >
                {navOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              </button>
              <LanguageToggle />
              <NotificationBell />
              <Button className="px-3" variant="ghost" onClick={() => void logout()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("logout")}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid min-h-[4.5rem] max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Link className="flex items-center" to="/">
              <img className="h-12 w-auto object-contain sm:h-14" src={logoLockupUrl} alt={t("appName")} />
            </Link>
            <nav className="hidden justify-center gap-7 text-sm font-bold text-ink lg:flex">
              {publicLinks.map((item, index) => (
                <Link className={index === 0 ? "text-amber" : "hover:text-amber"} to={item.to} key={item.to}>
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="flex items-center justify-end gap-2">
              <Link className="hidden sm:block" to="/register">
                <Button variant="secondary">
                  {t("requestAccess")}
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/login">
                <Button>
                  {t("landingAction")}
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <div className="hidden lg:block">
                <LanguageToggle />
              </div>
            </div>
          </div>
        )}
      </header>

      {appUser ? (
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 md:grid-cols-[1fr_270px] lg:px-8">
          {navOpen ? (
            <button
              className="fixed inset-0 top-[5.5rem] z-20 bg-ink/25 backdrop-blur-[1px] md:hidden"
              type="button"
              aria-label={t("closeMenu")}
              onClick={() => setNavOpen(false)}
            />
          ) : null}
          <main className="min-w-0 overflow-hidden rounded-[22px] border border-borderSoft bg-white/86 shadow-soft md:order-1">
            <TrialWelcomeNotice />
            <Outlet />
          </main>
          <aside
            className={`${
              navOpen ? "fixed inset-x-4 top-24 z-30 max-h-[calc(100vh-7rem)] overflow-y-auto" : "hidden"
            } md:order-2 md:sticky md:top-24 md:z-auto md:block md:h-[calc(100vh-7rem)] md:max-h-none md:overflow-visible`}
          >
            <nav className="grid gap-2 rounded-[22px] border border-borderSoft bg-white/95 p-3 shadow-card">
              {navItems.map((item) => (
                <AppNavLink key={item.to} to={item.to} label={t(item.labelKey)} icon={item.icon} />
              ))}
              {isAdmin ? (
                <>
                  <div className="my-2 h-px bg-borderSoft" />
                  {adminItems.map((item) => (
                    <AppNavLink key={item.to} to={item.to} label={t(item.labelKey)} icon={item.icon} />
                  ))}
                </>
              ) : null}
              <div className="mt-5 rounded-[18px] border border-amber/20 bg-cream p-5 text-center">
                <div className="text-base font-black leading-7 text-amber">{t("homepageSlogan")}</div>
              </div>
            </nav>
          </aside>
        </div>
      ) : (
        <main>
          <Outlet />
        </main>
      )}
    </div>
  );
}

function TrialWelcomeNotice() {
  const { t } = useTranslation();
  const { appUser, isAdmin } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!appUser || isAdmin || appUser.role !== "contributor" || appUser.status !== "approved" || appUser.accessStatus !== "temporary") {
      setVisible(false);
      return;
    }

    const storageKey = `mujahiz-iq-trial-welcome-dismissed-${appUser.uid}`;
    const forcedByRegistration = sessionStorage.getItem("mujahiz-iq-registration-success") === "1";
    if (forcedByRegistration) {
      sessionStorage.removeItem("mujahiz-iq-registration-success");
    }
    setVisible(forcedByRegistration || localStorage.getItem(storageKey) !== "1");
  }, [appUser, isAdmin]);

  if (!appUser || !visible) {
    return null;
  }

  const storageKey = `mujahiz-iq-trial-welcome-dismissed-${appUser.uid}`;

  return (
    <div className="border-b border-mint/30 bg-successBg px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-start gap-3 text-sm text-ink">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" aria-hidden="true" />
        <p className="flex-1 leading-6">{t("registrationSuccessMessage")}</p>
        <button
          className="rounded-xl p-1 text-muted transition hover:bg-white hover:text-ink"
          type="button"
          aria-label={t("dismiss")}
          onClick={() => {
            localStorage.setItem(storageKey, "1");
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}



