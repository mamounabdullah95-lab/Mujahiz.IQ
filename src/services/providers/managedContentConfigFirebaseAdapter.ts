import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import type { ContentPageRecord } from "../../types/workspace";

export interface ManagedContentConfigImplementation {
  getPublishedContentPage(slug: string): Promise<ContentPageRecord | null>;
}

export interface FirebaseManagedContentConfigDependencies {
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

function withContentPageId(snapshot: { id: string; data: () => DocumentData }) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as ContentPageRecord;
}

export function createFirebaseManagedContentConfigAdapter({
  db,
  collection,
  where,
  limit,
  query,
  getDocs,
}: FirebaseManagedContentConfigDependencies): ManagedContentConfigImplementation {
  const contentPages = collection(db, "contentPages");

  return {
    async getPublishedContentPage(slug) {
      const snapshot = await getDocs(query(
        contentPages,
        where("slug", "==", slug),
        where("status", "==", "published"),
        limit(1),
      ));
      return snapshot.empty ? null : withContentPageId(snapshot.docs[0]);
    },
  };
}
