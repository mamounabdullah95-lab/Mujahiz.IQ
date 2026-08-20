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
  createFirebaseSupplierTaxonomyDictionaryAdapter,
  type SupplierTaxonomyDictionaryImplementation,
} from "./supplierTaxonomyDictionaryFirebaseAdapter";
import {
  resolveProviderImplementation,
  SHIPPED_PROVIDER_MANIFEST,
  type ProviderImplementationRegistry,
} from "./providerContract";

const firebaseSupplierTaxonomyDictionaryImplementation = createFirebaseSupplierTaxonomyDictionaryAdapter({
  db,
  collection,
  doc,
  where,
  limit,
  query,
  getDocs,
  getDoc,
});

const supplierTaxonomyDictionaryImplementations: ProviderImplementationRegistry<SupplierTaxonomyDictionaryImplementation> = new Map([
  ["supplier_taxonomy_dictionary", new Map([
    ["firebase", firebaseSupplierTaxonomyDictionaryImplementation],
  ])],
]);

export function resolveSupplierTaxonomyDictionaryImplementation() {
  return resolveProviderImplementation({
    manifest: SHIPPED_PROVIDER_MANIFEST,
    feature: "supplier_taxonomy_dictionary",
    registry: supplierTaxonomyDictionaryImplementations,
  });
}
