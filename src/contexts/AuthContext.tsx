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
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "../config/firebase";
import type { AppUser } from "../types/domain";
import { isFuture } from "../utils/date";
import { createUserProfile, getUserProfile, updateUserProfile } from "../services/firestore";
import { demoClearSession, demoGetCurrentUser, demoLogin, demoRegister } from "../services/localDemo";

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  jobTitle: string;
  organization: string;
  governorate: string;
  city?: string;
  sector: string;
  reasonForJoining?: string;
  language?: "en" | "ar";
}

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  hasActiveAccess: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
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
  } as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (user: User | null) => {
    setFirebaseUser(user);
    if (!user) {
      setAppUser(null);
      setLoading(false);
      return;
    }
    const profile = await getUserProfile(user.uid);
    setAppUser(profile);
    if (profile?.language) {
      localStorage.setItem("mujahiz-iq-locale", profile.language);
    }
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
          if (profile?.language) {
            localStorage.setItem("mujahiz-iq-locale", profile.language);
          }
        });
      };
      setLoading(true);
      void demoGetCurrentUser()
        .then((profile) => {
          if (!active) return;
          setAppUser(profile);
          setFirebaseUser(profile ? toDemoFirebaseUser(profile) : null);
          if (profile?.language) {
            localStorage.setItem("mujahiz-iq-locale", profile.language);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
      window.addEventListener("mujahiz-iq-demo-db-updated", syncDemoUser);
      return () => {
        active = false;
        window.removeEventListener("mujahiz-iq-demo-db-updated", syncDemoUser);
      };
    }
    if (!auth) {
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void loadProfile(user);
    });
    return unsubscribe;
  }, [loadProfile]);

  const refreshUser = useCallback(async () => {
    if (!isFirebaseConfigured) {
      const profile = await demoGetCurrentUser();
      setAppUser(profile);
      setFirebaseUser(profile ? toDemoFirebaseUser(profile) : null);
      return;
    }
    if (!auth?.currentUser) {
      setAppUser(null);
      return;
    }
    const profile = await getUserProfile(auth.currentUser.uid);
    setAppUser(profile);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = appUser?.role === "owner" || appUser?.role === "admin";
    const isOwner = appUser?.role === "owner";
    const hasActiveAccess =
      isAdmin ||
      Boolean(
        appUser?.status === "approved" &&
          (appUser.accessStatus === "active" || appUser.accessStatus === "temporary") &&
          isFuture(appUser.accessExpiresAt),
      );

    return {
      firebaseUser,
      appUser,
      loading,
      isAdmin,
      isOwner,
      hasActiveAccess,
      login: async (email, password) => {
        if (!auth || !isFirebaseConfigured) {
          setLoading(true);
          try {
            const profile = await demoLogin(email, password);
            setAppUser(profile);
            setFirebaseUser(toDemoFirebaseUser(profile));
            if (profile.language) {
              localStorage.setItem("mujahiz-iq-locale", profile.language);
            }
          } finally {
            setLoading(false);
          }
          return;
        }
        setLoading(true);
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await loadProfile(credential.user);
      },
      register: async (input) => {
        if (!auth || !isFirebaseConfigured) {
          setLoading(true);
          try {
            const profile = await demoRegister(input.email, input.password, {
              fullName: input.fullName,
              phone: input.phone,
              jobTitle: input.jobTitle,
              organization: input.organization,
              governorate: input.governorate,
              city: input.city,
              sector: input.sector,
              reasonForJoining: input.reasonForJoining,
              language: input.language,
            });
            setAppUser(profile);
            setFirebaseUser(toDemoFirebaseUser(profile));
            if (profile.language) {
              localStorage.setItem("mujahiz-iq-locale", profile.language);
            }
          } finally {
            setLoading(false);
          }
          return;
        }
        setLoading(true);
        const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
        await createUserProfile(credential.user.uid, input.email, {
          fullName: input.fullName,
          phone: input.phone,
          jobTitle: input.jobTitle,
          organization: input.organization,
          governorate: input.governorate,
          city: input.city,
          sector: input.sector,
          reasonForJoining: input.reasonForJoining,
          language: input.language,
        });
        await loadProfile(credential.user);
      },
      logout: async () => {
        if (!auth || !isFirebaseConfigured) {
          demoClearSession();
          setFirebaseUser(null);
          setAppUser(null);
          return;
        }
        await signOut(auth);
        setFirebaseUser(null);
        setAppUser(null);
      },
      refreshUser,
      updateProfile: async (patch) => {
        if (!firebaseUser) {
          return;
        }
        await updateUserProfile(firebaseUser.uid, patch);
        await refreshUser();
      },
    };
  }, [appUser, firebaseUser, loadProfile, loading, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
