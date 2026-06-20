import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAccessToken, readServiceAccount } from "./google-service-account-auth.mjs";

const serviceAccount = readServiceAccount();
const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;
if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID or service account project_id is required.");
}

const token = await getAccessToken([
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/firebase",
]);
const origin = "https://firebaserules.googleapis.com";
const rulesPath = resolve(process.env.FIRESTORE_RULES_FILE || "firestore.rules");
const content = readFileSync(rulesPath, "utf8");

async function api(path, init = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(`${init.method || "GET"} ${path} failed (${response.status}): ${text}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const ruleset = await api(`/v1/projects/${projectId}/rulesets`, {
  method: "POST",
  body: JSON.stringify({
    source: {
      files: [
        {
          name: "firestore.rules",
          content,
        },
      ],
    },
  }),
});

const releaseName = `projects/${projectId}/releases/cloud.firestore`;
try {
  await api(`/v1/${releaseName}`, {
    method: "PATCH",
    body: JSON.stringify({
      release: {
        name: releaseName,
        rulesetName: ruleset.name,
      },
      updateMask: "rulesetName",
    }),
  });
} catch (error) {
  if (error.status !== 404) {
    throw error;
  }
  await api(`/v1/projects/${projectId}/releases`, {
    method: "POST",
    body: JSON.stringify({
      name: releaseName,
      rulesetName: ruleset.name,
    }),
  });
}

console.log(`PROJECT=${projectId}`);
console.log(`RULESET=${ruleset.name}`);
console.log(`RELEASE=${releaseName}`);
