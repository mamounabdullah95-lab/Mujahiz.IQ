import type {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  QuerySnapshot,
} from "firebase/firestore";
import type { AppUser } from "../../types/domain";

export type UserProfilesAccessImplementation = () => Promise<AppUser[]>;

export interface FirebaseUserProfilesAccessDependencies {
  readonly db: Firestore;
  readonly collection: (firestore: Firestore, path: string) => CollectionReference<DocumentData>;
  readonly orderBy: (fieldPath: string, directionStr?: "desc") => QueryConstraint;
  readonly limit: (limit: number) => QueryConstraint;
  readonly query: (
    collectionReference: CollectionReference<DocumentData>,
    ...constraints: QueryConstraint[]
  ) => Query<DocumentData>;
  readonly getDocs: (firestoreQuery: Query<DocumentData>) => Promise<QuerySnapshot<DocumentData>>;
}

export function createFirebaseUserProfilesAccessAdapter({
  db,
  collection,
  orderBy,
  limit,
  query,
  getDocs,
}: FirebaseUserProfilesAccessDependencies): UserProfilesAccessImplementation {
  return async () => {
    const snapshot = await getDocs(query(
      collection(db, "users"),
      orderBy("createdAt", "desc"),
      limit(500),
    ));
    return snapshot.docs.map((item) => ({ ...item.data(), uid: item.id }) as AppUser);
  };
}
