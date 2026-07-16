import siteSettings from "../../site.config.json";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

const configuredPrimaryUrl = normalizeOrigin(
  import.meta.env.VITE_PUBLIC_SITE_URL || siteSettings.primaryUrl,
);

export const siteConfig = Object.freeze({
  primaryUrl: configuredPrimaryUrl,
  wwwUrl: normalizeOrigin(siteSettings.wwwUrl),
  legacyUrl: normalizeOrigin(siteSettings.legacyUrl),
});

export function buildPublicUrl(path = "/") {
  return new URL(normalizePath(path), `${siteConfig.primaryUrl}/`).toString();
}

export function buildEmailActionUrl(path: string) {
  const origin = import.meta.env.DEV && typeof window !== "undefined"
    ? window.location.origin
    : siteConfig.primaryUrl;
  return new URL(normalizePath(path), `${normalizeOrigin(origin)}/`).toString();
}

export function getEmailActionSettings(path: string) {
  return {
    url: buildEmailActionUrl(path),
    handleCodeInApp: false,
  };
}
