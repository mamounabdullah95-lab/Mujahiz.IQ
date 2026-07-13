import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const registerPage = readFileSync(new URL("../src/pages/RegisterPage.tsx", import.meta.url), "utf8");
const workspaceService = readFileSync(new URL("../src/services/workspace.ts", import.meta.url), "utf8");

test("registration starts with built-in sectors before Firestore responds", () => {
  assert.match(registerPage, /useState<RegistrationSector\[\]>\(\(\) =>\s*defaultRegistrationSectors/);
  assert.match(registerPage, /if \(items\.length\) setSectors\(items\)/);
});

test("registration sector service falls back to a non-empty local list", () => {
  assert.match(workspaceService, /const fallback = \(\) => defaultRegistrationSectors/);
  assert.match(workspaceService, /return sectors\.length \? sectors : fallback\(\)/);
  assert.match(workspaceService, /catch \{\s*return fallback\(\);\s*\}/);
});
