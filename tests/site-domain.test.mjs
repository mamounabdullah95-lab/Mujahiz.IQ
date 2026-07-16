import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("public domains have one central source of truth", () => {
  const settings = JSON.parse(read("site.config.json"));
  assert.equal(settings.primaryUrl, "https://mujahiz.com");
  assert.equal(settings.wwwUrl, "https://www.mujahiz.com");
  assert.equal(settings.legacyUrl, "https://mujahiziq.web.app");

  const siteConfig = read("src/config/site.ts");
  assert.match(siteConfig, /VITE_PUBLIC_SITE_URL/);
  assert.match(siteConfig, /siteSettings\.primaryUrl/);
  assert.match(read(".env.example"), /VITE_PUBLIC_SITE_URL=/);
});

test("email verification and password reset use centralized continue URLs", () => {
  const auth = read("src/contexts/AuthContext.tsx");
  const accountSettings = read("src/pages/workspace/BuyerWorkspacePages.tsx");

  assert.match(auth, /getEmailActionSettings\("\/verify-email"\)/);
  assert.doesNotMatch(auth, /window\.location\.origin\}\/verify-email/);
  assert.match(accountSettings, /getEmailActionSettings\("\/login"\)/);
});

test("production build emits domain metadata and preserves the Vite config", () => {
  const viteConfig = read("vite.config.ts");
  const deployScript = read("scripts/deploy-firebase.ps1");

  assert.match(viteConfig, /rel: "canonical"/);
  assert.match(viteConfig, /property: "og:url"/);
  assert.match(viteConfig, /fileName: "sitemap\.xml"/);
  assert.match(viteConfig, /fileName: "robots\.txt"/);
  assert.match(deployScript, /vite build --config vite\.config\.ts/);
  assert.doesNotMatch(deployScript, /sandbox-hidden/);
});
