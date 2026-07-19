import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../contexts/NotificationContext";

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const [open, setOpen] = useState(false);
  const {
    items,
    unreadCount,
    loading,
    error,
    hasMore,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  return (
    <div className="relative">
      <button
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
        type="button"
        aria-label={t("notifications")}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount || hasMore ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-clay px-1 text-center text-xs font-bold leading-5 text-white">
            {unreadCount > 99 ? "99+" : hasMore ? `${unreadCount}+` : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute end-0 top-12 z-30 w-80 rounded-md border border-slate-200 bg-white p-2 shadow-soft">
          <div className="flex items-center justify-between gap-2 px-2 py-2">
            <span className="text-sm font-bold text-ink">{t("notifications")}</span>
            <div className="flex items-center gap-1">
              {unreadCount ? (
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                  type="button"
                  aria-label={hasMore ? (locale === "ar" ? "تحديد الإشعارات المحملة كمقروءة" : "Mark loaded notifications as read") : (locale === "ar" ? "تحديد الكل كمقروء" : "Mark all as read")}
                  onClick={() => void markAllRead()}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              ) : null}
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                type="button"
                aria-label={locale === "ar" ? "تحديث" : "Refresh"}
                onClick={refresh}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          {error ? (
            <div className="px-3 py-4 text-sm text-clay">
              {locale === "ar" ? "تعذر تحميل الإشعارات." : "Notifications could not be loaded."}
            </div>
          ) : items.length ? (
            <div className="grid gap-1">
              {items.slice(0, 8).map((item) => (
                <Link
                  className={`rounded-md px-3 py-2 text-sm hover:bg-slate-50 ${item.read ? "font-semibold text-slate-600" : "font-bold text-ink"}`}
                  key={item.id}
                  to={item.link || "/notifications"}
                  onClick={() => {
                    if (!item.read) void markRead(item.id);
                    setOpen(false);
                  }}
                >
                  <span>{locale === "ar" ? item.titleAr : item.titleEn}</span>
                  <span className="mt-1 block line-clamp-2 text-xs font-normal text-slate-500">
                    {locale === "ar" ? item.bodyAr : item.bodyEn}
                  </span>
                </Link>
              ))}
              <Link
                className="rounded-md px-3 py-2 text-center text-sm font-bold text-amber hover:bg-slate-50"
                to="/notifications"
                onClick={() => setOpen(false)}
              >
                {locale === "ar" ? "عرض كل الإشعارات" : "View all notifications"}
              </Link>
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-slate-500">
              {loading ? (locale === "ar" ? "جارٍ التحميل..." : "Loading...") : t("noNotifications")}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
