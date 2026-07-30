import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { clearKnownDemoStorage } from "./demoStorage";
import { resolveFirebaseRuntime } from "./runtimePolicy";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const runtimeTarget = resolveFirebaseRuntime({
  config: firebaseConfig,
  forceDemo: import.meta.env.VITE_FORCE_DEMO,
  isDevelopment: import.meta.env.DEV,
  useFirebaseEmulators: import.meta.env.VITE_USE_FIREBASE_EMULATORS,
});
const useFirebaseEmulators = runtimeTarget === "emulator";

const emulatorProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-mujahiziq-integration";
const emulatorConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: emulatorProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${emulatorProjectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:emulator",
};

const demoConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:demo",
};

const configurationErrorConfig = {
  ...demoConfig,
  projectId: "configuration-error",
  appId: "1:000000000000:web:configuration-error",
};

export const isFirebaseConfigured = runtimeTarget === "firebase" || runtimeTarget === "emulator";
export const isDemoMode = runtimeTarget === "demo";

const selectedConfig = runtimeTarget === "firebase"
  ? firebaseConfig
  : runtimeTarget === "emulator"
    ? emulatorConfig
    : runtimeTarget === "demo"
      ? demoConfig
      : configurationErrorConfig;

if (import.meta.env.PROD && runtimeTarget === "firebase") {
  clearKnownDemoStorage();
}

export const app = initializeApp(selectedConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || "";
if (runtimeTarget === "firebase" && appCheckSiteKey && typeof window !== "undefined") {
  void import("firebase/app-check").then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
    initializeAppCheck(app, {
      isTokenAutoRefreshEnabled: true,
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    });
  });
}

export const auth = isFirebaseConfigured ? getAuth(app) : null;
export const db = getFirestore(app);
export const cloudFunctions = isFirebaseConfigured ? getFunctions(app, "us-central1") : null;

const emulatorState = globalThis as typeof globalThis & { __mujahizFirebaseEmulatorsConnected?: boolean };
if (useFirebaseEmulators && auth && !emulatorState.__mujahizFirebaseEmulatorsConnected) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  const authPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || "9099");
  const firestorePort = Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || "8080");
  const functionsPort = Number(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT || "5001");
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, firestorePort);
  if (cloudFunctions) connectFunctionsEmulator(cloudFunctions, host, functionsPort);
  emulatorState.__mujahizFirebaseEmulatorsConnected = true;
}

export const firebaseRuntime = Object.freeze({
  projectId: selectedConfig.projectId,
  target: runtimeTarget,
});
