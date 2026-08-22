import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { toDate } from "../../utils/date";
import {
  createFirebaseSupplierReviewsAdapter,
  type SupplierReviewsImplementation,
} from "./supplierReviewsFirebaseAdapter";
import {
  resolveProviderImplementation,
  SHIPPED_PROVIDER_MANIFEST,
  type ProviderImplementationRegistry,
} from "./providerContract";

const firebaseSupplierReviewsImplementation = createFirebaseSupplierReviewsAdapter({
  db,
  collection,
  where,
  query,
  getDocs,
  toDate,
});

const supplierReviewsImplementations: ProviderImplementationRegistry<SupplierReviewsImplementation> = new Map([
  ["supplier_reviews", new Map([
    ["firebase", firebaseSupplierReviewsImplementation],
  ])],
]);

export function resolveSupplierReviewsImplementation() {
  return resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "supplier_reviews",
    registry: supplierReviewsImplementations,
  });
}
