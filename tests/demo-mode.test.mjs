import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  hasRequiredFirebaseConfig,
  isStrictlyEnabled,
  resolveFirebaseRuntime,
} from "../src/config/runtimePolicy.ts";
import {
  clearKnownDemoStorage,
  DEMO_DATABASE_STORAGE_KEY,
  DEMO_SESSION_STORAGE_KEY,
} from "../src/config/demoStorage.ts";

const firebase = fs.readFileSync(new URL("../src/config/firebase.ts", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const localDemo = fs.readFileSync(new URL("../src/services/localDemo.ts", import.meta.url), "utf8");

const validConfig = Object.freeze({
  apiKey: "AIzaCI_ONLY_NOT_A_SECRET_1234567890",
  authDomain: "demo-mujahiziq-ci.firebaseapp.com",
  projectId: "demo-mujahiziq-ci",
  storageBucket: "demo-mujahiziq-ci.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
});

const emptyConfig = Object.freeze({
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
});

test("production is fail-closed when Firebase configuration is missing or malformed", () => {
  assert.equal(resolveFirebaseRuntime({
    config: emptyConfig,
    forceDemo: "true",
    isDevelopment: false,
    useFirebaseEmulators: "true",
  }), "configuration_error");
  assert.equal(resolveFirebaseRuntime({
    config: { ...validConfig, apiKey: "replace-me" },
    isDevelopment: false,
  }), "configuration_error");
  assert.equal(hasRequiredFirebaseConfig(validConfig), true);
  for (const field of Object.keys(validConfig)) {
    assert.equal(resolveFirebaseRuntime({
      config: { ...validConfig, [field]: "" },
      isDevelopment: false,
    }), "configuration_error", `missing ${field} must fail closed`);
  }
});

test("production selects Firebase only for a structurally valid configuration", () => {
  assert.equal(resolveFirebaseRuntime({
    config: validConfig,
    forceDemo: "false",
    isDevelopment: false,
    useFirebaseEmulators: "false",
  }), "firebase");
});

test("demo and emulator targets require exact development-only opt-in", () => {
  assert.equal(resolveFirebaseRuntime({
    config: emptyConfig,
    forceDemo: "true",
    isDevelopment: true,
  }), "demo");
  assert.equal(resolveFirebaseRuntime({
    config: emptyConfig,
    forceDemo: "TRUE",
    isDevelopment: true,
  }), "configuration_error");
  assert.equal(resolveFirebaseRuntime({
    config: emptyConfig,
    forceDemo: "true",
    isDevelopment: true,
    useFirebaseEmulators: "true",
  }), "emulator");
  assert.equal(isStrictlyEnabled("1"), false);
});

test("configuration errors render a safe screen without loading the application bootstrap", () => {
  assert.match(main, /firebaseRuntime\.target === "configuration_error"/);
  assert.match(main, /import\("\.\/bootstrap"\)/);
  assert.match(firebase, /runtimeTarget === "firebase"/);
});

test("known demo storage is cleared without touching unrelated keys", () => {
  const removed = [];
  globalThis.window = {
    localStorage: { removeItem: (key) => removed.push(["local", key]) },
    sessionStorage: { removeItem: (key) => removed.push(["session", key]) },
  };
  try {
    clearKnownDemoStorage();
  } finally {
    delete globalThis.window;
  }
  assert.deepEqual(removed, [
    ["local", DEMO_DATABASE_STORAGE_KEY],
    ["local", DEMO_SESSION_STORAGE_KEY],
    ["session", DEMO_SESSION_STORAGE_KEY],
  ]);
});

test("demo credentials are ephemeral and sessions are not persisted in localStorage", () => {
  assert.match(localDemo, /demoCredentials = new Map/);
  assert.match(localDemo, /sessionStorage\.setItem\(sessionKey/);
  assert.doesNotMatch(localDemo, /db\.credentials/);
  assert.doesNotMatch(localDemo, /localStorage\.setItem\(sessionKey/);
});
