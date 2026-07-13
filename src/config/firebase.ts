import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const forceDemo = import.meta.env.VITE_FORCE_DEMO === "true";
const useFirebaseEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const emulatorProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-mujahiziq-integration";
const emulatorConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: emulatorProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${emulatorProjectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:emulator",
};

export const isFirebaseConfigured = useFirebaseEmulators || (!forceDemo && Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
));

const demoConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:demo",
};

const selectedConfig = useFirebaseEmulators ? emulatorConfig : isFirebaseConfigured ? firebaseConfig : demoConfig;
export const app = initializeApp(selectedConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || "";
if (isFirebaseConfigured && !useFirebaseEmulators && appCheckSiteKey && typeof window !== "undefined") {
  void import("firebase/app-check").then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => {
    initializeAppCheck(app, {
      isTokenAutoRefreshEnabled: true,
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    });
  });
}

export const auth = isFirebaseConfigured ? getAuth(app) : null;
export const db = getFirestore(app);

const emulatorState = globalThis as typeof globalThis & { __mujahizFirebaseEmulatorsConnected?: boolean };
if (useFirebaseEmulators && auth && !emulatorState.__mujahizFirebaseEmulatorsConnected) {
  const host = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  const authPort = Number(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT || "9099");
  const firestorePort = Number(import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || "8080");
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, firestorePort);
  emulatorState.__mujahizFirebaseEmulatorsConnected = true;
}

export const firebaseRuntime = Object.freeze({
  projectId: selectedConfig.projectId,
  target: useFirebaseEmulators ? "emulator" : isFirebaseConfigured ? "firebase" : "demo",
});
