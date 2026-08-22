import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import type { FavoriteSupplier } from "../../types/workspace";

export interface SupplierFavoritesImplementation {
  listFavorites(userId: string): Promise<FavoriteSupplier[]>;
}

export interface FirebaseSupplierFavoritesDependencies {
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

function withFavoriteId(snapshot: { id: string; data: () => DocumentData }) {
  return { id: snapshot.id, ...snapshot.data() } as FavoriteSupplier;
}

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return null;
}

function sortNewest<T extends { createdAt?: unknown; updatedAt?: unknown }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aDate = toDate((a.updatedAt || a.createdAt) as never)?.getTime() || 0;
    const bDate = toDate((b.updatedAt || b.createdAt) as never)?.getTime() || 0;
    return bDate - aDate;
  });
}

export function createFirebaseSupplierFavoritesAdapter({
  db,
  collection,
  where,
  limit,
  query,
  getDocs,
}: FirebaseSupplierFavoritesDependencies): SupplierFavoritesImplementation {
  const favorites = collection(db, "favorites");

  return {
    async listFavorites(userId) {
      const snapshot = await getDocs(query(favorites, where("userId", "==", userId), limit(250)));
      return sortNewest(snapshot.docs.map(withFavoriteId));
    },
  };
}
