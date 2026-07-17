export const DEMO_DATABASE_STORAGE_KEY = "mujahiz-iq-demo-db";
export const DEMO_SESSION_STORAGE_KEY = "mujahiz-iq-demo-session";

export function clearKnownDemoStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_DATABASE_STORAGE_KEY);
  window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
  window.sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
}
