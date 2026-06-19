import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const token = process.env.GOOGLE_ACCESS_TOKEN;
if (!token) {
  throw new Error("GOOGLE_ACCESS_TOKEN is required.");
}

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const serviceAccount = serviceAccountPath ? JSON.parse(readFileSync(serviceAccountPath, "utf8")) : {};
const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS with project_id is required.");
}

const siteId = process.env.FIREBASE_SITE_ID || projectId;
const distDir = resolve(process.env.FIREBASE_HOSTING_PUBLIC || "dist");
const hostingOrigin = "https://firebasehosting.googleapis.com/v1beta1";

async function api(path, init = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers || {}),
  };
  const response = await fetch(`${hostingOrigin}${path}`, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const version = await api(`/projects/-/sites/${siteId}/versions`, {
  method: "POST",
  body: JSON.stringify({
    config: {
      rewrites: [{ glob: "**", path: "/index.html" }],
    },
  }),
});

const files = {};
const gzippedByHash = new Map();
for (const filePath of walk(distDir)) {
  const publicPath = `/${relative(distDir, filePath).split(sep).join("/")}`;
  const gzipped = gzipSync(readFileSync(filePath), { level: 9 });
  const hash = createHash("sha256").update(gzipped).digest("hex");
  files[publicPath] = hash;
  gzippedByHash.set(hash, gzipped);
}

const populate = await api(`/${version.name}:populateFiles`, {
  method: "POST",
  body: JSON.stringify({ files }),
});

const uploadUrl = populate.uploadUrl?.replace(/\/$/, "");
const required = populate.uploadRequiredHashes || [];
if (required.length && !uploadUrl) {
  throw new Error("Firebase Hosting did not return an uploadUrl.");
}

for (const hash of required) {
  const response = await fetch(`${uploadUrl}/${hash}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: gzippedByHash.get(hash),
  });
  if (!response.ok) {
    throw new Error(`Upload failed for ${hash} (${response.status}): ${await response.text()}`);
  }
}

await api(`/${version.name}?updateMask=status`, {
  method: "PATCH",
  body: JSON.stringify({ status: "FINALIZED" }),
});

const release = await api(
  `/projects/-/sites/${siteId}/channels/live/releases?versionName=${encodeURIComponent(version.name)}`,
  {
    method: "POST",
    body: JSON.stringify({ message: "Deploy Mujahiz IQ from Codex" }),
  },
);

console.log(`PROJECT=${projectId}`);
console.log(`SITE=${siteId}`);
console.log(`FILES=${Object.keys(files).length}`);
console.log(`UPLOADED=${required.length}`);
console.log(`VERSION=${version.name}`);
console.log(`RELEASE=${release.name}`);
console.log(`HOSTING_URL=https://${siteId}.web.app`);
