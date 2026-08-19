import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QueryConstraint,
  QueryDocumentSnapshot,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import type { Supplier } from "../../types/domain";

export type SupplierDirectoryCursor = QueryDocumentSnapshot<DocumentData> | number | null;

export interface SupplierDirectoryPage {
  readonly items: Supplier[];
  readonly cursor: QueryDocumentSnapshot<DocumentData> | null;
  readonly hasMore: boolean;
}

export interface SupplierDirectoryImplementation {
  listSuppliers(): Promise<Supplier[]>;
  listSuppliersPage(pageSize: number, cursor: SupplierDirectoryCursor): Promise<SupplierDirectoryPage>;
  listSupplierCandidates(categories: string[]): Promise<Supplier[]>;
  getSupplier(supplierId: string): Promise<Supplier | null>;
}

export interface FirebaseSupplierDirectoryDependencies {
  readonly db: Firestore;
  readonly collection: (firestore: Firestore, path: string) => CollectionReference<DocumentData>;
  readonly doc: (
    collectionReference: CollectionReference<DocumentData>,
    path: string,
  ) => DocumentReference<DocumentData>;
  readonly where: (fieldPath: string, opStr: WhereFilterOp, value: unknown) => QueryConstraint;
  readonly startAfter: (snapshot: QueryDocumentSnapshot<DocumentData>) => QueryConstraint;
  readonly limit: (limit: number) => QueryConstraint;
  readonly query: (
    collectionReference: CollectionReference<DocumentData>,
    ...constraints: QueryConstraint[]
  ) => Query<DocumentData>;
  readonly getDocs: (firestoreQuery: Query<DocumentData>) => Promise<QuerySnapshot<DocumentData>>;
  readonly getDoc: (documentReference: DocumentReference<DocumentData>) => Promise<DocumentSnapshot<DocumentData>>;
}

function withSupplierId(snapshot: { id: string; data: () => DocumentData }) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as Supplier;
}

export function createFirebaseSupplierDirectoryAdapter({
  db,
  collection,
  doc,
  where,
  startAfter,
  limit,
  query,
  getDocs,
  getDoc,
}: FirebaseSupplierDirectoryDependencies): SupplierDirectoryImplementation {
  const suppliers = collection(db, "suppliers");

  return {
    async listSuppliers() {
      const snapshot = await getDocs(query(suppliers, where("status", "==", "approved")));
      return snapshot.docs.map(withSupplierId);
    },

    async listSuppliersPage(pageSize, cursor) {
      const constraints = [
        where("status", "==", "approved"),
        ...(cursor && typeof cursor !== "number" ? [startAfter(cursor)] : []),
        limit(pageSize),
      ];
      const snapshot = await getDocs(query(suppliers, ...constraints));
      return {
        items: snapshot.docs.map(withSupplierId),
        cursor: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === pageSize,
      };
    },

    async listSupplierCandidates(categories) {
      if (!categories.length) return [];
      const snapshot = await getDocs(query(
        suppliers,
        where("categories", "array-contains-any", categories.slice(0, 10)),
        limit(100),
      ));
      return snapshot.docs
        .map(withSupplierId)
        .filter((supplier) => supplier.status === "approved" && supplier.canReceiveRfqs === true);
    },

    async getSupplier(supplierId) {
      const snapshot = await getDoc(doc(suppliers, supplierId));
      return snapshot.exists() ? withSupplierId(snapshot) : null;
    },
  };
}
