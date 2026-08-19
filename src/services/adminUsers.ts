import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import type { AppUser } from "../types/domain";
import { listUsers } from "./firestore";
import {
  resolveProviderImplementation,
  SHIPPED_PROVIDER_MANIFEST,
  type ProviderImplementationRegistry,
} from "./providers/providerContract";
import {
  createFirebaseUserProfilesAccessAdapter,
  type UserProfilesAccessImplementation,
} from "./providers/userProfilesAccessFirebaseAdapter";

const userProfilesAccessImplementations: ProviderImplementationRegistry<UserProfilesAccessImplementation> = new Map([
  ["user_profiles_access", new Map([
    ["firebase", createFirebaseUserProfilesAccessAdapter({
      db,
      collection,
      getDocs,
      limit,
      orderBy,
      query,
    })],
  ])],
]);

export async function listAdministrativeUsers() {
  if (!isFirebaseConfigured) return listUsers();
  const implementation = resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "user_profiles_access",
    registry: userProfilesAccessImplementations,
  });
  return implementation();
}
