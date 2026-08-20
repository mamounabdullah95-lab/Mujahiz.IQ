import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import { mergeMaterialTerms } from "../../data/materialTerms.ts";
import type { MaterialTerm } from "../../types/domain";

export interface SupplierTaxonomyDictionaryImplementation {
  listMaterialTerms(): Promise<MaterialTerm[]>;
}

export interface FirebaseSupplierTaxonomyDictionaryDependencies {
  readonly db: Firestore;
  readonly collection: (firestore: Firestore, path: string) => CollectionReference<DocumentData>;
  readonly where: (fieldPath: string, opStr: WhereFilterOp, value: unknown) => QueryConstraint;
  readonly limit: (limit: number) => QueryConstraint;
  readonly query: (
    collectionReference: CollectionReference<DocumentData>,
    ...constraints: QueryConstraint[]
  ) => Query<DocumentData>;
  readonly getDocs: (firestoreQuery: Query<DocumentData>) => Promise<QuerySnapshot<DocumentData>>;
}

function withMaterialTermId(snapshot: { id: string; data: () => DocumentData }) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as MaterialTerm;
}

export function createFirebaseSupplierTaxonomyDictionaryAdapter({
  db,
  collection,
  where,
  limit,
  query,
  getDocs,
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
  };
}
