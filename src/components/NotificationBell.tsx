import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { listMySubmissions, listPendingReviews, listSupplierSubmissions } from "../services/firestore";
import { localizedSupplierName } from "../utils/supplierDisplay";

interface NotificationItem {
  id: string;
  label: string;
  to: string;
  tone?: "danger" | "warning" | "neutral";
}

function latestKey(values: string[]) {
  const sorted = [...values].sort();
  return sorted[sorted.length - 1] ?? "";
}

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const storageKey = firebaseUser ? `mujahiz-iq-read-notifications:${firebaseUser.uid}` : "";

  useEffect(() => {
    if (!storageKey) {
      setReadIds(new Set());
      return;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      setReadIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setReadIds(new Set());
    }
  }, [storageKey]);

  const markRead = (nextItems: NotificationItem[]) => {
    if (!storageKey || !nextItems.length) return;
    setReadIds((current) => {
      const next = new Set(current);
      nextItems.forEach((item) => next.add(item.id));
      const limited = Array.from(next).slice(-100);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(limited));
      } catch {
        // Ignore storage failures; the notification panel should still work.
      }
      return new Set(limited);
    });
  };

  useEffect(() => {
    if (!firebaseUser) {
      setItems([]);
      return;
    }

    let cancelled = false;
    const uid = firebaseUser.uid;
    async function load() {
      const nextItems: NotificationItem[] = [];
      const submissions = await listMySubmissions(uid);
      const correction = submissions.filter((item) => item.submissionStatus === "needs_correction");
      const rejected = submissions.filter((item) => item.submissionStatus === "rejected");
      const approved = submissions.filter((item) => item.submissionStatus === "approved");

      correction.slice(0, 3).forEach((item) => {
        nextItems.push({
          id: `submission:${item.id}:${item.submissionStatus}:${String(item.reviewedAt ?? item.createdAt ?? "")}`,
          label: `${t("needsCorrection")}: ${localizedSupplierName(item.supplierData, locale)}`,
          to: `/suppliers/submissions/${item.id}/edit`,
          tone: "danger",
        });
      });
      if (rejected.length) {
        const latest = latestKey(rejected.map((item) => String(item.reviewedAt ?? item.createdAt ?? "")));
        nextItems.push({
          id: `submissions:rejected:${rejected.length}:${latest}`,
          label: t("notificationRejectedSubmissions", { count: rejected.length }),
          to: "/my-submissions",
          tone: "warning",
        });
      }
      if (approved.length) {
        const latest = latestKey(approved.map((item) => String(item.reviewedAt ?? item.createdAt ?? "")));
        nextItems.push({
          id: `submissions:approved:${approved.length}:${latest}`,
          label: t("notificationApprovedSubmissions", { count: approved.length }),
          to: "/my-submissions",
        });
      }

      if (isAdmin) {
        const [pendingSubmissions, pendingReviews] = await Promise.all([listSupplierSubmissions(), listPendingReviews()]);
        if (pendingSubmissions.length) {
          const latest = latestKey(pendingSubmissions.map((item) => String(item.createdAt ?? "")));
          nextItems.push({
            id: `admin:supplier-submissions:${pendingSubmissions.length}:${latest}`,
            label: t("notificationPendingSuppliers", { count: pendingSubmissions.length }),
            to: "/admin/submissions",
            tone: "warning",
          });
        }
        if (pendingReviews.length) {
          const latest = latestKey(pendingReviews.map((item) => String(item.createdAt ?? "")));
          nextItems.push({
            id: `admin:reviews:${pendingReviews.length}:${latest}`,
            label: t("notificationPendingReviews", { count: pendingReviews.length }),
            to: "/admin/reviews",
            tone: "warning",
          });
        }
      }

      if (!cancelled) {
        setItems(nextItems);
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const listener = () => void load();
    window.addEventListener("mujahiz-iq-demo-db-updated", listener);
    window.addEventListener("focus", listener);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("mujahiz-iq-demo-db-updated", listener);
      window.removeEventListener("focus", listener);
    };
  }, [firebaseUser, isAdmin, locale, t]);

  const count = useMemo(() => items.filter((item) => !readIds.has(item.id)).length, [items, readIds]);

  return (
    <div className="relative">
      <button
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100"
        type="button"
        aria-label={t("notifications")}
        onClick={() => {
          if (!open) markRead(items);
          setOpen((current) => !current);
        }}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-clay px-1 text-center text-xs font-bold leading-5 text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute end-0 top-12 z-30 w-80 rounded-md border border-slate-200 bg-white p-2 shadow-soft">
          <div className="px-2 py-2 text-sm font-bold text-ink">{t("notifications")}</div>
          {items.length ? (
            <div className="grid gap-1">
              {items.map((item, index) => (
                <Link
                  className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  key={`${item.to}-${index}`}
                  to={item.to}
                  onClick={() => {
                    markRead([item]);
                    setOpen(false);
                  }}
                >
                  <span className={item.tone === "danger" ? "text-clay" : item.tone === "warning" ? "text-amber" : "text-ink"}>
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-slate-500">{t("noNotifications")}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
