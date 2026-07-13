import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const firebaseSource = fs.readFileSync(new URL("../src/config/firebase.ts", import.meta.url), "utf8");
const envExample = fs.readFileSync(new URL("../.env.example", import.meta.url), "utf8");

test("Firebase emulators require an explicit development-only flag", () => {
  assert.match(firebaseSource, /import\.meta\.env\.DEV && import\.meta\.env\.VITE_USE_FIREBASE_EMULATORS === "true"/);
  assert.match(firebaseSource, /connectAuthEmulator/);
  assert.match(firebaseSource, /connectFirestoreEmulator/);
  assert.match(firebaseSource, /target: useFirebaseEmulators \? "emulator"/);
  assert.match(envExample, /VITE_USE_FIREBASE_EMULATORS=false/);
});

test("App Check is never initialized for emulator UAT", () => {
  assert.match(firebaseSource, /!useFirebaseEmulators && appCheckSiteKey/);
});
