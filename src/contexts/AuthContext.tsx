import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../config/firebase";
import { getEmailActionSettings } from "../config/site";
import type { AppUser } from "../types/domain";
import { isFuture } from "../utils/date";
import { getUserProfile, updateUserProfile } from "../services/firestore";
import { demoClearSession, demoGetCurrentUser, demoLogin, demoRegister } from "../services/localDemo";
import { activateVerifiedUser, createUserProfileSafely, type UserProfileInput } from "../services/registration";
import {
  refreshVerifiedEmail,
  resendVerificationEmail,
  synchronizeVerifiedProfile,
  type VerificationResendResult,
} from "../services/emailVerification";
import { isValidEmailAddress, isValidIraqiPhone, normalizeAccountEmail, normalizeIraqiPhone } from "../utils/accountValidation";

export interface RegisterInput extends UserProfileInput {
  email: string;
  password: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  hasActiveAccess: boolean;
  emailVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  completeMissingProfile: (input: UserProfileInput) => Promise<void>;
  sendVerification: () => Promise<VerificationResendResult>;
  refreshEmailVerification: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (patch: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toDemoFirebaseUser(user: AppUser) {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.fullName,
    emailVerified: true,
  } as User;
}

function profileSetupError() {
  const error = new Error("profile_setup_incomplete") as Error & { code?: string };
  error.code = "profile_setup_incomplete";
  return error;
}

function applyAuthLanguage(language?: string) {
  if (!auth) return;
  const stored = typeof window === "undefined" ? "" : localStorage.getItem("mujahiz-iq-locale") || "";
  auth.languageCode = (language || stored).startsWith("ar") ? "ar" : "en";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(!isFirebaseConfigured);

  const loadProfile = useCallback(async (user: User | null) => {
    setFirebaseUser(user);
    if (!user) {
      setVerified(!isFirebaseConfigured);
      setAppUser(null);
      setLoading(false);
      return;
    }

    let profile = await getUserProfile(user.uid);
    let verificationSynchronized = !isFirebaseConfigured || Boolean(user.emailVerified);
    if (user.emailVerified && profile) {
      verificationSynchronized = profile.emailVerified === true;
      if (!verificationSynchronized) {
        try {
          await user.getIdToken(true);
          await synchronizeVerifiedProfile(user.uid, activateVerifiedUser);
          profile = await getUserProfile(user.uid);
          verificationSynchronized = Boolean(profile?.emailVerified);
        } catch {
          // Keep protected routes on the verification screen for an explicit retry.
        }
      }
    }

    setVerified(verificationSynchronized);
    setAppUser(profile);
    if (profile?.language) localStorage.setItem("mujahiz-iq-locale", profile.language);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      let active = true;
      const syncDemoUser = () => {
        void demoGetCurrentUser().then((profile) => {
          if (!active) return;
          setAppUser(profile);
          setFirebaseUser(profile ? toDemoFirebaseUser(profile) : null);
          setVerified(Boolean(profile));
          if (profile?.language) localStorage.setItem("mujahiz-iq-locale", profile.language);
        });
      };
      setLoading(true);
      void demoGetCurrentUser().then((profile) => {
        if (!active) return;
        setAppUser(profile);
        setFirebaseUser(profile ? toDemoFirebaseUser(profile) : null);
        setVerified(Boolean(profile));
        if (profile?.language) localStorage.setItem("mujahiz-iq-locale", profile.language);
      }).finally(() => { if (active) setLoading(false); });
      window.addEventListener("mujahiz-iq-demo-db-updated", syncDemoUser);
      return () => { active = false; window.removeEventListener("mujahiz-iq-demo-db-updated", syncDemoUser); };
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => { void loadProfile(user); });
    return unsubscribe;
  }, [loadProfile]);

  const refreshUser = useCallback(async () => {
    if (!isFirebaseConfigured) {
      const profile = await demoGetCurrentUser();
      setAppUser(profile);
      setFirebaseUser(profile ? toDemoFirebaseUser(profile) : null);
      setVerified(Boolean(profile));
      return;
    }
    if (!auth?.currentUser) { setAppUser(null); return; }
    await loadProfile(auth.currentUser);
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = appUser?.role === "owner" || appUser?.role === "admin";
    const isOwner = appUser?.role === "owner";
    const hasActiveAccess = isAdmin || Boolean(appUser?.status === "approved" && (appUser.accessStatus === "active" || appUser.accessStatus === "temporary") && isFuture(appUser.accessExpiresAt));
    return {
      firebaseUser,
      appUser,
      loading,
      isAdmin,
      isOwner,
      hasActiveAccess,
      emailVerified: verified,
      login: async (email, password) => {
        const normalizedEmail = normalizeAccountEmail(email);
        if (!isValidEmailAddress(normalizedEmail)) throw Object.assign(new Error("invalid_email"), { code: "invalid_email" });
        if (!auth || !isFirebaseConfigured) {
          setLoading(true);
          try { const profile = await demoLogin(normalizedEmail, password); setAppUser(profile); setFirebaseUser(toDemoFirebaseUser(profile)); setVerified(true); if (profile.language) localStorage.setItem("mujahiz-iq-locale", profile.language); } finally { setLoading(false); }
          return;
        }
        setLoading(true);
        try { const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password); await loadProfile(credential.user); } finally { setLoading(false); }
      },
      register: async (input) => {
        const email = normalizeAccountEmail(input.email);
        const phone = normalizeIraqiPhone(input.phone);
        if (!isValidEmailAddress(email)) throw Object.assign(new Error("invalid_email"), { code: "invalid_email" });
        if (!isValidIraqiPhone(input.phone)) throw Object.assign(new Error("invalid_phone"), { code: "invalid_phone" });
        if (!auth || !isFirebaseConfigured) {
          setLoading(true);
          try { const profile = await demoRegister(email, input.password, { ...input, phone }); setAppUser(profile); setFirebaseUser(toDemoFirebaseUser(profile)); setVerified(true); if (profile.language) localStorage.setItem("mujahiz-iq-locale", profile.language); } finally { setLoading(false); }
          return;
        }
        setLoading(true);
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, input.password);
          try { await createUserProfileSafely(credential.user.uid, email, { ...input, phone }); } catch { throw profileSetupError(); }
          applyAuthLanguage(input.language);
          await sendEmailVerification(credential.user, getEmailActionSettings("/verify-email"));
          await loadProfile(credential.user);
        } finally { setLoading(false); }
      },
      completeMissingProfile: async (input) => {
        const current = auth?.currentUser;
        if (!current?.email) throw profileSetupError();
        if (!isValidIraqiPhone(input.phone)) throw Object.assign(new Error("invalid_phone"), { code: "invalid_phone" });
        await createUserProfileSafely(current.uid, current.email, { ...input, phone: normalizeIraqiPhone(input.phone) });
        if (!current.emailVerified) {
          applyAuthLanguage(input.language);
          await sendEmailVerification(current, getEmailActionSettings("/verify-email"));
        }
        await loadProfile(current);
      },
      sendVerification: async () => {
        const current = auth?.currentUser;
        if (!current) throw Object.assign(new Error("auth/user-not-found"), { code: "auth/user-not-found" });
        applyAuthLanguage(appUser?.language);
        const result = await resendVerificationEmail({
          user: current,
          getCurrentUser: () => auth?.currentUser || null,
          synchronize: activateVerifiedUser,
          actionSettings: getEmailActionSettings("/verify-email"),
          sendEmail: sendEmailVerification,
        });
        if (result === "already_verified") await loadProfile(auth?.currentUser || current);
        return result;
      },
      refreshEmailVerification: async () => {
        const current = auth?.currentUser;
        if (!current) return false;

        const isVerified = await refreshVerifiedEmail({
          user: current,
          getCurrentUser: () => auth?.currentUser || null,
          synchronize: activateVerifiedUser,
        });
        const refreshed = auth?.currentUser || current;
        if (!isVerified) {
          setFirebaseUser(refreshed);
          setVerified(false);
          return false;
        }

        const profile = await getUserProfile(refreshed.uid);
        const verificationSynchronized = Boolean(profile?.emailVerified);
        setFirebaseUser(refreshed);
        setAppUser(profile);
        setVerified(verificationSynchronized);
        if (profile?.language) localStorage.setItem("mujahiz-iq-locale", profile.language);
        return verificationSynchronized;
      },
      logout: async () => {
        if (!auth || !isFirebaseConfigured) demoClearSession();
        else await signOut(auth);
        setFirebaseUser(null); setAppUser(null); setVerified(false);
      },
      refreshUser,
      updateProfile: async (patch) => {
        if (!firebaseUser) return;
        const allowed = ["fullName", "phone", "jobTitle", "organization", "governorate", "city", "sector", "reasonForJoining", "language"] as const;
        const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.includes(key as typeof allowed[number]))) as Partial<AppUser>;
        if (typeof safePatch.phone === "string") {
          const phone = normalizeIraqiPhone(safePatch.phone);
          if (!phone) throw Object.assign(new Error("invalid_phone"), { code: "invalid_phone" });
          safePatch.phone = phone;
        }
        await updateUserProfile(firebaseUser.uid, safePatch);
        await refreshUser();
      },
    };
  }, [appUser, firebaseUser, loadProfile, loading, refreshUser, verified]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
