const LEGACY_PRODUCTION_HOSTS = new Set([
  "mujahiziq.web.app",
  "mujahiziq.firebaseapp.com",
]);

export interface BrowserLocation {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  href: string;
  replace(url: string): void;
}

export function buildCanonicalRedirectUrl(
  location: Pick<BrowserLocation, "hostname" | "pathname" | "search" | "hash">,
  canonicalOrigin: string,
) {
  if (!LEGACY_PRODUCTION_HOSTS.has(location.hostname.toLowerCase())) {
    return null;
  }

  const pathname = location.pathname.startsWith("/")
    ? location.pathname
    : `/${location.pathname}`;
  const canonicalBase = `${canonicalOrigin.replace(/\/+$/, "")}/`;

  return new URL(`${pathname}${location.search}${location.hash}`, canonicalBase).toString();
}

export function redirectLegacyProductionOrigin(
  location: BrowserLocation,
  canonicalOrigin: string,
) {
  const targetUrl = buildCanonicalRedirectUrl(location, canonicalOrigin);
  if (!targetUrl || targetUrl === location.href) {
    return false;
  }

  location.replace(targetUrl);
  return true;
}
