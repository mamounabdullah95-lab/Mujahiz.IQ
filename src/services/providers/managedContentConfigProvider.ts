import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  createFirebaseManagedContentConfigAdapter,
  type ManagedContentConfigImplementation,
} from "./managedContentConfigFirebaseAdapter";
import {
  resolveProviderImplementation,
  SHIPPED_PROVIDER_MANIFEST,
  type ProviderImplementationRegistry,
} from "./providerContract";

const firebaseManagedContentConfigImplementation = createFirebaseManagedContentConfigAdapter({
  db,
  collection,
  doc,
  where,
  limit,
  query,
  getDocs,
  getDoc,
});

const managedContentConfigImplementations: ProviderImplementationRegistry<ManagedContentConfigImplementation> = new Map([
  ["managed_content_config", new Map([
    ["firebase", firebaseManagedContentConfigImplementation],
  ])],
]);

export function resolveManagedContentConfigImplementation() {
  return resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "managed_content_config",
    registry: managedContentConfigImplementations,
  });
}
