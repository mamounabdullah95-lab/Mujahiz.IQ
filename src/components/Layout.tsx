import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Gauge,
  History,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import headerLogoUrl from "../assets/brand/mujahiz-iq-header-logo.svg";
import iconLogoUrl from "../assets/brand/mujahiz-iq-icon-final.svg";
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
  { to: "/admin/settings", labelKey: "settings", icon: Settings },
  { to: "/admin/audit-logs", labelKey: "auditLogs", icon: History },
];

function AppNavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Gauge }) {
  return (
    <NavLink
      className={({ isActive }) =>
        `flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
          isActive ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
        }`
      }
      to={to}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button className="text-start" type="button" onClick={() => navigate(appUser ? "/dashboard" : "/")}>
            <img
              className={appUser ? "h-12 w-auto" : "h-11 w-11"}
              src={appUser ? headerLogoUrl : iconLogoUrl}
              alt={t("appName")}
            />
            <div className="sr-only">{t("tagline")}</div>
          </button>
          <div className="flex items-center gap-2">
            {appUser ? (
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 md:hidden"
                type="button"
                aria-label={t(navOpen ? "closeMenu" : "menu")}
                aria-expanded={navOpen}
                onClick={() => setNavOpen((current) => !current)}
              >
                {navOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              </button>
            ) : null}
            <LanguageToggle />
            {appUser ? <NotificationBell /> : null}
            {appUser ? (
              <Button className="px-2 sm:px-4" variant="ghost" onClick={() => void logout()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t("logout")}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {appUser ? (
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 md:grid-cols-[250px_1fr] lg:px-8">
          {navOpen ? (
            <button
              className="fixed inset-0 top-[4.5rem] z-20 bg-ink/25 md:hidden"
              type="button"
              aria-label={t("closeMenu")}
              onClick={() => setNavOpen(false)}
            />
          ) : null}
          <aside
            className={`${
              navOpen
                ? "fixed inset-x-4 top-20 z-30 max-h-[calc(100vh-6rem)] overflow-y-auto"
                : "hidden"
            } md:sticky md:top-20 md:z-auto md:block md:h-[calc(100vh-6rem)] md:max-h-none md:overflow-visible`}
          >
            <nav className="grid gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-soft">
              {navItems.map((item) => (
                <AppNavLink key={item.to} to={item.to} label={t(item.labelKey)} icon={item.icon} />
              ))}
              {isAdmin ? (
                <>
                  <div className="my-2 h-px bg-slate-200" />
                  {adminItems.map((item) => (
                    <AppNavLink key={item.to} to={item.to} label={t(item.labelKey)} icon={item.icon} />
                  ))}
                </>
              ) : null}
            </nav>
          </aside>
          <main className="min-w-0 rounded-md border border-slate-200 bg-white shadow-soft">
            <TrialWelcomeNotice />
            <Outlet />
          </main>
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
    <div className="border-b border-mint/30 bg-mint/10 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex items-start gap-3 text-sm text-ink">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" aria-hidden="true" />
        <p className="flex-1 leading-6">{t("registrationSuccessMessage")}</p>
        <button
          className="rounded-md p-1 text-slate-500 transition hover:bg-white hover:text-ink"
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
