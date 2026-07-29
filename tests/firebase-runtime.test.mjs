import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const firebaseSource = fs.readFileSync(new URL("../src/config/firebase.ts", import.meta.url), "utf8");
const envExample = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const featureSource = fs.readFileSync(new URL("../src/config/features.ts", import.meta.url), "utf8");
const aiSource = fs.readFileSync(new URL("../src/services/supplierSearchAI.ts", import.meta.url), "utf8");
const deploySource = fs.readFileSync(new URL("../scripts/deploy-firebase.ps1", import.meta.url), "utf8");

test("Firebase emulators require an explicit development-only flag", () => {
  assert.match(firebaseSource, /resolveFirebaseRuntime/);
  assert.match(firebaseSource, /connectAuthEmulator/);
  assert.match(firebaseSource, /connectFirestoreEmulator/);
  assert.match(firebaseSource, /connectFunctionsEmulator/);
  assert.match(firebaseSource, /runtimeTarget === "emulator"/);
  assert.match(envExample, /VITE_USE_FIREBASE_EMULATORS=false/);
  assert.match(envExample, /VITE_FORCE_DEMO=false/);
});

test("App Check is never initialized for emulator UAT", () => {
  assert.match(firebaseSource, /runtimeTarget === "firebase" && appCheckSiteKey/);
});

test("all security-sensitive feature flags use strict true semantics", () => {
  assert.match(featureSource, /isStrictlyEnabled\(import\.meta\.env\.VITE_FILE_UPLOADS_ENABLED\)/);
  assert.match(featureSource, /isStrictlyEnabled\(import\.meta\.env\.VITE_SUPPLIER_EXCEL_IMPORT_ENABLED\)/);
  assert.match(featureSource, /isStrictlyEnabled\(import\.meta\.env\.VITE_SUPPLIER_PROFILE_CLAIM_ENABLED\)/);
  assert.match(aiSource, /isStrictlyEnabled\(import\.meta\.env\.VITE_FIREBASE_AI_ENABLED\)/);
});

test("deployment errors do not echo Firebase SDK configuration", () => {
  assert.doesNotMatch(deploySource, /Firebase SDK config is incomplete: \$configText/);
  assert.match(deploySource, /VITE_FORCE_DEMO=false/);
  assert.match(deploySource, /VITE_USE_FIREBASE_EMULATORS=false/);
});
