import type {
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import { mergeMaterialTerms } from "../../data/materialTerms.ts";
import { defaultRegistrationSectors } from "../../data/registrationSectors.ts";
import type { MaterialTerm } from "../../types/domain";
import type { RegistrationSector } from "../../types/workspace";

export interface SupplierTaxonomyDictionaryImplementation {
  listMaterialTerms(): Promise<MaterialTerm[]>;
  listRegistrationSectors(): Promise<RegistrationSector[]>;
}

export interface FirebaseSupplierTaxonomyDictionaryDependencies {
  readonly db: Firestore;
  readonly collection: (firestore: Firestore, path: string) => CollectionReference<DocumentData>;
  readonly doc: (firestore: Firestore, path: string, ...pathSegments: string[]) => DocumentReference<DocumentData>;
  readonly where: (fieldPath: string, opStr: WhereFilterOp, value: unknown) => QueryConstraint;
  readonly limit: (limit: number) => QueryConstraint;
  readonly query: (
    collectionReference: CollectionReference<DocumentData>,
    ...constraints: QueryConstraint[]
  ) => Query<DocumentData>;
  readonly getDocs: (firestoreQuery: Query<DocumentData>) => Promise<QuerySnapshot<DocumentData>>;
  readonly getDoc: (documentReference: DocumentReference<DocumentData>) => Promise<DocumentSnapshot<DocumentData>>;
}

function withMaterialTermId(snapshot: { id: string; data: () => DocumentData }) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as MaterialTerm;
}

function registrationSectorDefaults() {
  return defaultRegistrationSectors
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order);
}

export function createFirebaseSupplierTaxonomyDictionaryAdapter({
  db,
  collection,
  doc,
  where,
  limit,
  query,
  getDocs,
  getDoc,
}: FirebaseSupplierTaxonomyDictionaryDependencies): SupplierTaxonomyDictionaryImplementation {
  const materialTerms = collection(db, "materialTerms");

  return {
    async listMaterialTerms() {
      const snapshot = await getDocs(query(
        materialTerms,
        where("status", "==", "active"),
        limit(500),
      ));
      return mergeMaterialTerms(snapshot.docs.map(withMaterialTermId));
    },
    async listRegistrationSectors() {
      try {
        const snapshot = await getDoc(doc(db, "publicConfig", "registration"));
        const configured = snapshot.exists() && Array.isArray(snapshot.data().sectors)
          ? snapshot.data().sectors as RegistrationSector[]
          : [];
        const sectors = configured
          .filter((item) => item.active)
          .sort((a, b) => a.order - b.order);
        return sectors.length ? sectors : registrationSectorDefaults();
      } catch {
        return registrationSectorDefaults();
      }
    },
  };
}
