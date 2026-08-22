import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  createFirebaseSupplierFavoritesAdapter,
  type SupplierFavoritesImplementation,
} from "./supplierFavoritesFirebaseAdapter";
import {
  resolveProviderImplementation,
  SHIPPED_PROVIDER_MANIFEST,
  type ProviderImplementationRegistry,
} from "./providerContract";

const firebaseSupplierFavoritesImplementation = createFirebaseSupplierFavoritesAdapter({
  db,
  collection,
  where,
  limit,
  query,
  getDocs,
});

const supplierFavoritesImplementations: ProviderImplementationRegistry<SupplierFavoritesImplementation> = new Map([
  ["supplier_favorites", new Map([
    ["firebase", firebaseSupplierFavoritesImplementation],
  ])],
]);

export function resolveSupplierFavoritesImplementation() {
  return resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "supplier_favorites",
    registry: supplierFavoritesImplementations,
  });
}
