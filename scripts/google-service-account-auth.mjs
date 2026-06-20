import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function readServiceAccount() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is required.");
  }
  return JSON.parse(readFileSync(serviceAccountPath, "utf8"));
}

export async function getAccessToken(scopes = ["https://www.googleapis.com/auth/cloud-platform"]) {
  const serviceAccount = readServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const unsignedJwt = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer
    .sign(serviceAccount.private_key, "base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${signature}`,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Google OAuth token request failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

