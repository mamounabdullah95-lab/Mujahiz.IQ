import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  QueryConstraint,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase/firestore";
import type { AdminOperationsSettings, BrandingSettings, ContentPageRecord } from "../../types/workspace";

export const BRANDING_SETTINGS_FALLBACK: BrandingSettings = {
  primaryColor: "#062b4d",
  secondaryColor: "#0b4f76",
  accentColor: "#f37021",
  introAr: "مجهز.. نقطة البداية لتوفير حقيقي.",
  introEn: "Mujahiz.. the starting point for real savings.",
  assetUploadStatus: "upload_pending_launch",
};

export function createAdminOperationsSettingsFallback(): AdminOperationsSettings {
  return {
    reviewNotifications: true,
    showIncompleteSuppliers: false,
    requireDuplicateReason: true,
    dictionarySuggestionMinimum: 2,
  };
}

export interface ManagedContentConfigImplementation {
  getPublishedContentPage(slug: string): Promise<ContentPageRecord | null>;
  getBrandingSettings(): Promise<BrandingSettings>;
  getAdminOperationsSettings(): Promise<AdminOperationsSettings>;
  listContentPages(publishedOnly?: boolean): Promise<ContentPageRecord[]>;
}

export interface FirebaseManagedContentConfigDependencies {
  readonly db: Firestore;
  readonly collection: (firestore: Firestore, path: string) => CollectionReference<DocumentData>;
  readonly doc: (collectionReference: CollectionReference<DocumentData>, path: string) => DocumentReference<DocumentData>;
  readonly where: (fieldPath: string, opStr: WhereFilterOp, value: unknown) => QueryConstraint;
  readonly limit: (limit: number) => QueryConstraint;
  readonly query: (
    collectionReference: CollectionReference<DocumentData>,
    ...constraints: QueryConstraint[]
  ) => Query<DocumentData>;
  readonly getDocs: (firestoreQuery: Query<DocumentData>) => Promise<QuerySnapshot<DocumentData>>;
  readonly getDoc: (documentReference: DocumentReference<DocumentData>) => Promise<DocumentSnapshot<DocumentData>>;
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
  doc,
  where,
  limit,
  query,
  getDocs,
  getDoc,
}: FirebaseManagedContentConfigDependencies): ManagedContentConfigImplementation {
  const contentPages = collection(db, "contentPages");
  const settings = collection(db, "settings");
  const branding = doc(settings, "branding");
  const adminOperations = doc(settings, "adminOperations");

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
    async getBrandingSettings() {
      const snapshot = await getDoc(branding);
      return snapshot.exists()
        ? { ...BRANDING_SETTINGS_FALLBACK, ...snapshot.data() } as BrandingSettings
        : BRANDING_SETTINGS_FALLBACK;
    },
    async getAdminOperationsSettings() {
      const snapshot = await getDoc(adminOperations);
      return snapshot.exists()
        ? { ...createAdminOperationsSettingsFallback(), ...snapshot.data() } as AdminOperationsSettings
        : createAdminOperationsSettingsFallback();
    },
    async listContentPages(publishedOnly = false) {
      const snapshot = await getDocs(publishedOnly
        ? query(contentPages, where("status", "==", "published"), limit(100))
        : query(contentPages, limit(100)));
      return snapshot.docs
        .map((item) => withContentPageId(item))
        .sort((a, b) => a.order - b.order);
    },
  };
}
