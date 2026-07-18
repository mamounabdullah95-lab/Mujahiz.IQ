import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import { defaultSettings } from "../data/constants";
import type { AccountType, AppUser, Locale } from "../types/domain";
import { addDays } from "../utils/date";
import { normalizeAccountEmail, normalizeIraqiPhone } from "../utils/accountValidation";

export interface UserProfileInput {
  fullName: string;
  phone: string;
  jobTitle: string;
  organization: string;
  governorate: string;
  city?: string;
  sector: string;
  otherSector?: string;
  reasonForJoining?: string;
  accountType: AccountType;
  language?: Locale;
}

export async function createUserProfileSafely(uid: string, email: string, profile: UserProfileInput) {
  if (!isFirebaseConfigured) return;
  const userRef = doc(db, "users", uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) return;
  await setDoc(userRef, {
    uid,
    email: normalizeAccountEmail(email),
    fullName: profile.fullName.trim(),
    phone: normalizeIraqiPhone(profile.phone),
    jobTitle: profile.jobTitle.trim(),
    organization: profile.organization.trim(),
    governorate: profile.governorate,
    city: profile.city?.trim() || "",
    sector: profile.sector,
    otherSector: profile.sector === "other" ? profile.otherSector?.trim() || "" : "",
    reasonForJoining: profile.reasonForJoining?.trim() || "",
    accountType: profile.accountType,
    role: "contributor",
    status: "approved",
    accessStatus: "pending",
    accessExpiresAt: null,
    trialStartedAt: null,
    trialEndsAt: null,
    emailVerified: false,
    emailVerifiedAt: null,
    trustScore: 0,
    points: 5,
    qualityRatio: 0,
    totalSubmissions: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    duplicateSubmissions: 0,
    approvedReviews: 0,
    approvedNewSupplierContributions: 0,
    consumedApprovedSupplierContributions: 0,
    badges: [],
    language: profile.language || "en",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function activateVerifiedUser(uid: string) {
  if (!isFirebaseConfigured) return;
  const userRef = doc(db, "users", uid);
  const verificationAuditRef = doc(db, "auditLogs", `email-verification-${uid}`);
  const trialCreditRef = doc(db, "accessCredits", `trial-${uid}`);
  const trialGrantRef = doc(db, "accessGrants", `trial-${uid}`);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) throw new Error("profile_setup_incomplete");

    const profile = snapshot.data() as AppUser & {
      emailVerified?: boolean;
      trialStartedAt?: unknown;
      trialEndsAt?: unknown;
    };
    if (profile.emailVerified === true) return;

    const existingAudit = await transaction.get(verificationAuditRef);
    const existingGrant = await transaction.get(trialGrantRef);
    const isNewBuyer =
      profile.role === "contributor"
      && profile.accountType === "buyer"
      && profile.accessStatus === "pending"
      && !profile.accessExpiresAt
      && !profile.trialStartedAt
      && !profile.trialEndsAt;
    const trialAlreadyGranted = existingGrant.exists() || existingAudit.exists();

    if (!isNewBuyer || trialAlreadyGranted) {
      transaction.update(userRef, {
        emailVerified: true,
        emailVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (!existingAudit.exists()) {
        transaction.set(verificationAuditRef, {
          actorId: uid,
          action: "user.email_verified",
          targetType: "user",
          targetId: uid,
          details: { trialStarted: false },
          createdAt: serverTimestamp(),
        });
      }
      return;
    }

    const now = new Date();
    const trialEndsAt = addDays(now, defaultSettings.trialAccessDays);
    transaction.update(userRef, {
      emailVerified: true,
      emailVerifiedAt: serverTimestamp(),
      trialStartedAt: serverTimestamp(),
      trialEndsAt,
      accessStatus: "temporary",
      accessExpiresAt: trialEndsAt,
      updatedAt: serverTimestamp(),
    });
    transaction.set(trialCreditRef, {
      userId: uid,
      grantType: "trial_access",
      source: "trial_access",
      approvedSubmissionIds: [],
      approvedSupplierCount: 0,
      daysGranted: defaultSettings.trialAccessDays,
      previousExpiry: null,
      newExpiry: trialEndsAt,
      status: "applied",
      grantedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      appliedAt: serverTimestamp(),
      createdBy: uid,
    });
    transaction.set(trialGrantRef, {
      userId: uid,
      source: "trial_access",
      grantType: "trial_access",
      approvedSubmissionIds: [],
      approvedSupplierCount: 0,
      daysGranted: defaultSettings.trialAccessDays,
      status: "applied",
      grantedAt: serverTimestamp(),
      previousExpiry: null,
      newExpiry: trialEndsAt,
      createdBy: uid,
      auditReference: verificationAuditRef.id,
      createdAt: serverTimestamp(),
    });
    transaction.set(verificationAuditRef, {
      actorId: uid,
      action: "user.email_verified_trial_started",
      targetType: "user",
      targetId: uid,
      details: {
        accountType: "buyer",
        days: defaultSettings.trialAccessDays,
        trialStarted: true,
      },
      createdAt: serverTimestamp(),
    });
  });
}
