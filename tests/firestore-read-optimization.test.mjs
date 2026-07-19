import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ReadThroughCache } from "../src/utils/readThroughCache.ts";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("read-through cache deduplicates concurrent reads and respects TTL and force refresh", async () => {
  let now = 1_000;
  let calls = 0;
  const cache = new ReadThroughCache(60_000, () => now);
  const loader = async () => {
    calls += 1;
    return calls;
  };

  const [first, concurrent] = await Promise.all([
    cache.read("admin", loader),
    cache.read("admin", loader),
  ]);
  assert.equal(first, 1);
  assert.equal(concurrent, 1);
  assert.equal(calls, 1);

  assert.equal(await cache.read("admin", loader), 1);
  assert.equal(calls, 1);

  assert.equal(await cache.read("admin", loader, { force: true }), 2);
  assert.equal(calls, 2);

  now += 60_001;
  assert.equal(await cache.read("admin", loader), 3);
  assert.equal(calls, 3);
});

test("failed cached reads are retryable and do not poison the cache", async () => {
  const cache = new ReadThroughCache(60_000);
  let calls = 0;
  await assert.rejects(cache.read("report", async () => {
    calls += 1;
    throw new Error("temporary");
  }), /temporary/);
  assert.equal(await cache.read("report", async () => {
    calls += 1;
    return 11;
  }), 11);
  assert.equal(calls, 2);
});

test("notification bell uses one shared bounded source without timers or focus refetches", () => {
  const bell = read("src/components/NotificationBell.tsx");
  const provider = read("src/contexts/NotificationContext.tsx");
  const workspace = read("src/services/workspace.ts");

  assert.match(bell, /useNotifications/);
  assert.doesNotMatch(bell, /setInterval|addEventListener\("focus"|listMySubmissions|listSupplierSubmissions/);
  assert.match(provider, /subscribeNotifications/);
  assert.match(provider, /session !== sessionRef\.current/);
  assert.match(provider, /unsubscribe\(\)/);
  assert.match(provider, /setRecent\(\[\]\)/);
  assert.match(provider, /setOlder\(\[\]\)/);
  assert.match(provider, /loadMoreInFlightRef\.current/);
  assert.match(workspace, /where\("userId", "==", userId\)/);
  assert.match(workspace, /orderBy\("createdAt", "desc"\)/);
  assert.match(workspace, /orderBy\(documentId\(\), "desc"\)/);
  assert.match(workspace, /limit\(pageSize \+ 1\)/);
  assert.match(workspace, /markAllNotificationsRead\(userId: string, notificationIds\?: string\[\]\)/);
});

test("notification updates are optimistic, reversible, and never reload one document at a time", () => {
  const provider = read("src/contexts/NotificationContext.tsx");
  assert.match(provider, /setRecent\(optimistic\)/);
  assert.match(provider, /setOlder\(optimistic\)/);
  assert.match(provider, /const rollback/);
  assert.match(provider, /markAllNotificationsRead\(userId, unreadIds\)/);
  assert.match(provider, /map\(\(item\) => item\.id\)\.slice\(0, 400\)/);
  assert.match(provider, /session !== sessionRef\.current/);
  assert.doesNotMatch(provider, /getDoc|getDocs|Promise\.all\(unreadIds/);
  assert.match(provider, /notifications_update_failed/);
  assert.doesNotMatch(provider, /throw reason/);
});

test("dashboard aggregation budgets are role-scoped, cached, and language independent", () => {
  const service = read("src/services/portalDashboard.ts");
  const admin = read("src/pages/AdminOperationsDashboardPage.tsx");
  const owner = read("src/pages/SuperAdminDashboardPage.tsx");
  const adminSection = service.slice(service.indexOf("async function loadAdminMetrics"), service.indexOf("async function loadOwnerMetrics"));
  const ownerSection = service.slice(service.indexOf("async function loadOwnerMetrics"), service.indexOf("export function getPortalMetrics"));

  assert.equal((adminSection.match(/count\(query\(/g) || []).length, 7);
  assert.equal((ownerSection.match(/count\(query\(/g) || []).length, 5);
  assert.match(service, /new ReadThroughCache<PortalMetrics>\(60_000\)/);
  assert.match(service, /cacheKey = `\$\{scope\}:\$\{categories\}`/);
  assert.match(admin, /getPortalMetrics\("admin", categoryCount, \{ force \}\)/);
  assert.match(owner, /getPortalMetrics\("owner", categoryCount, \{ force \}\)/);
  assert.match(admin, /\}, \[categoryCount\]\);/);
  assert.match(owner, /\}, \[categoryCount\]\);/);
  assert.doesNotMatch(admin, /\}, \[locale\]\);/);
  assert.doesNotMatch(owner, /\}, \[locale\]\);/);
});

test("operational reports remain lazy and use manual-refresh-aware cache", () => {
  const service = read("src/services/workspace.ts");
  const page = read("src/pages/workspace/AdminWorkspacePages.tsx");
  assert.match(service, /new ReadThroughCache<OperationalReport>\(60_000\)/);
  assert.match(service, /operationalReportCache\.read\("global", loadOperationalReport, options\)/);
  assert.match(page, /getOperationalReport\(\{ force \}\)/);
  assert.match(page, /onClick=\{\(\) => void load\(true\)\}/);
});

test("bounded status lists order and limit on the server", () => {
  const service = read("src/services/firestore.ts");
  assert.match(service, /where\("submittedBy", "==", userId\), orderBy\("createdAt", "desc"\), limit\(100\)/);
  assert.match(service, /where\("submissionStatus", "in", statuses\), orderBy\("createdAt", "desc"\), limit\(100\)/);
  assert.match(service, /where\("status", "==", "pending_review"\), orderBy\("createdAt", "desc"\), limit\(100\)/);
  assert.match(service, /new ReadThroughCache<AuditLog\[\]>\(30_000\)/);
});

test("minimal indexes cover notification and feedback pagination", () => {
  const indexes = JSON.parse(read("firestore.indexes.json")).indexes;
  const keys = indexes.map((entry) => `${entry.collectionGroup}:${entry.fields.map((field) => field.fieldPath).join(",")}`);
  assert.ok(keys.includes("notifications:userId,createdAt"));
  assert.ok(keys.includes("supplierFeedback:submittedBy,createdAt"));
  assert.ok(keys.includes("supplierFeedback:status,createdAt"));
});

test("documented read budgets cover all required lifecycle scenarios", () => {
  const budget = read("docs/firestore-read-budget.md");
  for (const scenario of [
    "Initial authenticated shell",
    "Admin dashboard",
    "Buyer dashboard",
    "Supplier dashboard",
    "Bell open and reopen",
    "Browser focus",
    "Idle for 60 seconds",
    "Route away and back",
    "Operational report",
  ]) assert.match(budget, new RegExp(scenario));
});

test("bounded unread state never presents a lifetime-exact count", () => {
  const bell = read("src/components/NotificationBell.tsx");
  const page = read("src/pages/workspace/BuyerWorkspacePages.tsx");
  const budget = read("docs/firestore-read-budget.md");

  assert.match(bell, /unreadCount \|\| hasMore/);
  assert.match(bell, /hasMore \? `\$\{unreadCount\}\+` : unreadCount/);
  assert.match(bell, /Mark loaded notifications as read/);
  assert.match(page, /hasMore \? text\.allLoaded : text\.all/);
  assert.match(budget, /lower bound \(`N\+`\)/);
  assert.match(budget, /Mark-all updates only the loaded bounded window/);
});

test("one shell provider owns notification lifecycle and UI states", () => {
  const bootstrap = read("src/bootstrap.tsx");
  const app = read("src/AppV2.tsx");
  const provider = read("src/contexts/NotificationContext.tsx");
  const bell = read("src/components/NotificationBell.tsx");
  const page = read("src/pages/workspace/BuyerWorkspacePages.tsx");

  assert.equal((bootstrap.match(/<NotificationProvider>/g) || []).length, 1);
  assert.doesNotMatch(app, /NotificationProvider/);
  assert.equal((provider.match(/subscribeNotifications\(/g) || []).length, 1);
  assert.match(provider, /new Map<string, WorkspaceNotification>/);
  assert.match(provider, /sessionRef\.current \+= 1/);
  assert.match(provider, /paginationStartedRef\.current = false/);
  assert.match(bell, /Notifications could not be loaded/);
  assert.match(bell, /جارٍ التحميل/);
  assert.match(page, /Load more/);
  assert.match(page, /لا توجد إشعارات/);
});

