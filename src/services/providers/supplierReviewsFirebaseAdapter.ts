import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import type { SupplierReview, TimestampLike } from "../../types/domain";

export interface SupplierReviewsImplementation {
  listSupplierReviews(supplierId: string, includePending?: boolean): Promise<SupplierReview[]>;
  listMyReviews(userId: string): Promise<SupplierReview[]>;
}

export interface FirebaseSupplierReviewsDependencies {
  readonly db: Firestore;
  readonly collection: (firestore: Firestore, path: string) => CollectionReference<DocumentData>;
  readonly where: (fieldPath: string, opStr: WhereFilterOp, value: unknown) => QueryConstraint;
  readonly query: (
    collectionReference: CollectionReference<DocumentData>,
    ...constraints: QueryConstraint[]
  ) => Query<DocumentData>;
  readonly getDocs: (firestoreQuery: Query<DocumentData>) => Promise<QuerySnapshot<DocumentData>>;
  readonly toDate: (value: TimestampLike) => Date | null;
}

function withReviewId(snapshot: { id: string; data: () => DocumentData }) {
  return { id: snapshot.id, ...snapshot.data() } as SupplierReview;
}

function sortByCreatedAtDesc(
  items: SupplierReview[],
  maxItems: number,
  toDate: FirebaseSupplierReviewsDependencies["toDate"],
) {
  return [...items]
    .sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0))
    .slice(0, maxItems);
}

export function createFirebaseSupplierReviewsAdapter({
  db,
  collection,
  where,
  query,
  getDocs,
  toDate,
}: FirebaseSupplierReviewsDependencies): SupplierReviewsImplementation {
  const reviews = collection(db, "reviews");

  return {
    async listSupplierReviews(supplierId, includePending = false) {
      const snapshot = await getDocs(query(
        reviews,
        where("supplierId", "==", supplierId),
        ...(includePending ? [] : [where("status", "==", "approved")]),
      ));
      return sortByCreatedAtDesc(snapshot.docs.map(withReviewId), 50, toDate);
    },
    async listMyReviews(userId) {
      const snapshot = await getDocs(query(reviews, where("reviewedBy", "==", userId)));
      return sortByCreatedAtDesc(snapshot.docs.map(withReviewId), 100, toDate);
    },
  };
}
