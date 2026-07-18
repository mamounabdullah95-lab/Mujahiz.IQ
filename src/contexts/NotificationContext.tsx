import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import {
  listNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  type NotificationCursor,
} from "../services/workspace";
import type { WorkspaceNotification } from "../types/workspace";

interface NotificationContextValue {
  items: WorkspaceNotification[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function notificationTime(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeNotifications(...groups: WorkspaceNotification[][]) {
  const byId = new Map<string, WorkspaceNotification>();
  groups.flat().forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((left, right) => (
    notificationTime(right.createdAt) - notificationTime(left.createdAt)
    || right.id.localeCompare(left.id)
  ));
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();
  const userId = firebaseUser?.uid ?? "";
  const [recent, setRecent] = useState<WorkspaceNotification[]>([]);
  const [older, setOlder] = useState<WorkspaceNotification[]>([]);
  const [cursor, setCursor] = useState<NotificationCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const sessionRef = useRef(0);
  const paginationStartedRef = useRef(false);

  useEffect(() => {
    const session = ++sessionRef.current;
    setRecent([]);
    setOlder([]);
    paginationStartedRef.current = false;
    setCursor(null);
    setHasMore(false);
    setLoadingMore(false);
    setError("");
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeNotifications(
      userId,
      (page) => {
        if (session !== sessionRef.current) return;
        setRecent(page.items);
        if (!paginationStartedRef.current) {
          setCursor(page.cursor);
          setHasMore(page.hasMore);
        }
        setLoading(false);
        setError("");
      },
      (reason) => {
        if (session !== sessionRef.current) return;
        setLoading(false);
        setError(reason instanceof Error ? reason.message : "notifications_load_failed");
      },
    );
    return () => {
      sessionRef.current += 1;
      unsubscribe();
    };
  }, [revision, userId]);

  const items = useMemo(() => mergeNotifications(recent, older), [older, recent]);

  const refresh = useCallback(() => {
    setOlder([]);
    paginationStartedRef.current = false;
    setCursor(null);
    setRevision((value) => value + 1);
  }, []);

  const loadMore = useCallback(async () => {
    if (!userId || !cursor || !hasMore || loadingMore) return;
    const session = sessionRef.current;
    paginationStartedRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listNotificationsPage(userId, cursor);
      if (session !== sessionRef.current) return;
      setOlder((current) => mergeNotifications(current, page.items));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (reason) {
      if (session === sessionRef.current) setError(reason instanceof Error ? reason.message : "notifications_load_failed");
    } finally {
      if (session === sessionRef.current) setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, userId]);

  const markRead = useCallback(async (notificationId: string) => {
    if (!userId) return;
    const previous = items.find((item) => item.id === notificationId);
    const optimistic = (group: WorkspaceNotification[]) => group.map((item) => (
      item.id === notificationId ? { ...item, read: true } : item
    ));
    setRecent(optimistic);
    setOlder(optimistic);
    try {
      await markNotificationRead(notificationId, userId);
    } catch (reason) {
      if (previous) {
        const rollback = (group: WorkspaceNotification[]) => group.map((item) => (
          item.id === notificationId ? previous : item
        ));
        setRecent(rollback);
        setOlder(rollback);
      }
      throw reason;
    }
  }, [items, userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const unreadIds = items.filter((item) => !item.read).map((item) => item.id);
    if (!unreadIds.length) return;
    const unread = new Set(unreadIds);
    const optimistic = (group: WorkspaceNotification[]) => group.map((item) => (
      unread.has(item.id) ? { ...item, read: true } : item
    ));
    setRecent(optimistic);
    setOlder(optimistic);
    try {
      await markAllNotificationsRead(userId, unreadIds);
    } catch (reason) {
      refresh();
      throw reason;
    }
  }, [items, refresh, userId]);

  const value = useMemo<NotificationContextValue>(() => ({
    items,
    unreadCount: items.filter((item) => !item.read).length,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    markRead,
    markAllRead,
  }), [error, hasMore, items, loadMore, loading, loadingMore, markAllRead, markRead, refresh]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used within NotificationProvider");
  return value;
}
