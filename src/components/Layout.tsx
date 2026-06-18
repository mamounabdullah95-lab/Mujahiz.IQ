import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FilePlus2,
  Gauge,
  History,
  LogOut,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  UserRound,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import logoUrl from "../assets/brand/mujahiz-iq-logo-horizontal-transparent.svg";
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button className="text-start" type="button" onClick={() => navigate(appUser ? "/dashboard" : "/")}>
            <img className="h-12 w-auto" src={logoUrl} alt={t("appName")} />
            <div className="sr-only">{t("tagline")}</div>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            {appUser ? <NotificationBell /> : null}
            {appUser ? (
              <Button variant="ghost" onClick={() => void logout()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t("logout")}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {appUser ? (
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 md:grid-cols-[250px_1fr] lg:px-8">
          <aside className="md:sticky md:top-20 md:h-[calc(100vh-6rem)]">
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
