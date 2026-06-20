import { initializeApp } from "firebase/app";
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

const demoConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  storageBucket: "demo.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:demo",
};

export const app = initializeApp(isFirebaseConfigured ? firebaseConfig : demoConfig);
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || "";
export const appCheck =
  isFirebaseConfigured && appCheckSiteKey && typeof window !== "undefined"
    ? initializeAppCheck(app, {
        isTokenAutoRefreshEnabled: true,
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      })
    : null;
export const auth = isFirebaseConfigured ? getAuth(app) : null;
export const db = getFirestore(app);
