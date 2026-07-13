import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const firebase = fs.readFileSync(new URL("../src/config/firebase.ts", import.meta.url), "utf8");

test("demo mode is explicit opt-in and Firebase remains the default", () => {
  assert.match(firebase, /VITE_FORCE_DEMO === "true"/);
  assert.match(firebase, /isFirebaseConfigured = useFirebaseEmulators \|\| \(!forceDemo && Boolean/);
});
