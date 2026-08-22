import {
  addDoc,
  collection,
  deleteField,
  deleteDoc,
  documentId,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import { defaultRegistrationSectors } from "../data/registrationSectors";
import type { Supplier } from "../types/domain";
import type {
  AdminOperationsSettings,
  BrandingSettings,
  ContentPageRecord,
  Conversation,
  ConversationMessage,
  FavoriteSupplier,
  OperationalReport,
  RegistrationSector,
  RfqRecord,
  RfqResponse,
  RfqResponseRevision,
  SupplierDocumentMetadata,
  SupplierProduct,
  WorkspaceNotification,
} from "../types/workspace";
import { toDate } from "../utils/date";
import { ReadThroughCache, type CacheReadOptions } from "../utils/readThroughCache";
import { resolveManagedContentConfigImplementation } from "./providers/managedContentConfigProvider";
import {
  BRANDING_SETTINGS_FALLBACK,
  createAdminOperationsSettingsFallback,
} from "./providers/managedContentConfigFirebaseAdapter";
import { resolveSupplierTaxonomyDictionaryImplementation } from "./providers/supplierTaxonomyDictionaryProvider";
import {
  currentRfqRevision,
  hasMaterialRfqResponseChange,
  normalizeRfqCommercialValues,
  RFQ_HISTORY_PAGE_SIZE,
  rfqResponseRevisionId,
  rfqResponseUpdatedEventId,
  rfqResponseUpdatedNotificationId,
  type SupplierRfqLifecycleItem,
} from "../utils/rfqLifecycle";

const favoritesRef = collection(db, "favorites");
const rfqsRef = collection(db, "rfqs");
const rfqResponsesRef = collection(db, "rfqResponses");
const rfqPublishEventsRef = collection(db, "rfqPublishEvents");
const rfqResponseEventsRef = collection(db, "rfqResponseEvents");
const rfqResponseRevisionsRef = collection(db, "rfqResponseRevisions");
const notificationsRef = collection(db, "notifications");
const conversationsRef = collection(db, "conversations");
const messagesRef = collection(db, "messages");
const suppliersRef = collection(db, "suppliers");
const productsRef = collection(db, "supplierProducts");
const documentsRef = collection(db, "supplierDocuments");
const contentPagesRef = collection(db, "contentPages");
const settingsRef = collection(db, "settings");

const localPrefix = "mujahiz-iq-workspace:";

function withId<T>(snapshot: { id: string; data: () => DocumentData }) {
  return { id: snapshot.id, ...snapshot.data() } as T;
}

function sortNewest<T extends { createdAt?: unknown; updatedAt?: unknown }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aDate = toDate((a.updatedAt || a.createdAt) as never)?.getTime() || 0;
    const bDate = toDate((b.updatedAt || b.createdAt) as never)?.getTime() || 0;
    return bDate - aDate;
  });
}

function localRead<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(`${localPrefix}${key}`) || "[]") as T[];
  } catch {
    return [];
  }
}

function localWrite<T>(key: string, items: T[]) {
  localStorage.setItem(`${localPrefix}${key}`, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("mujahiz-iq-workspace-updated"));
}

function localUpsert<T extends { id: string }>(key: string, value: T) {
  const items = localRead<T>(key);
  const index = items.findIndex((item) => item.id === value.id);
  if (index >= 0) items[index] = value;
  else items.push(value);
  localWrite(key, items);
}

function newId(prefix: string) {
  return `${prefix}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function nowIso() {
  return new Date().toISOString();
}

export async function listFavorites(userId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<FavoriteSupplier>("favorites").filter((item) => item.userId === userId));
  const snapshot = await getDocs(query(favoritesRef, where("userId", "==", userId), limit(250)));
  return sortNewest(snapshot.docs.map((item) => withId<FavoriteSupplier>(item)));
}

export async function saveFavorite(userId: string, supplier: Pick<Supplier, "id" | "displayName" | "nameOriginal" | "governorate" | "categories">) {
  const id = `${userId}_${supplier.id}`;
  const payload = {
    id,
    userId,
    supplierId: supplier.id,
    supplierName: supplier.displayName || supplier.nameOriginal,
    governorate: supplier.governorate || "",
    categories: supplier.categories || [],
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) return localUpsert("favorites", payload as FavoriteSupplier);
  await setDoc(doc(favoritesRef, id), payload);
}

export async function removeFavorite(userId: string, supplierId: string) {
  const id = `${userId}_${supplierId}`;
  if (!isFirebaseConfigured) {
    localWrite("favorites", localRead<FavoriteSupplier>("favorites").filter((item) => item.id !== id));
    return;
  }
  await deleteDoc(doc(favoritesRef, id));
}

type RfqInput = Omit<RfqRecord, "id" | "buyerId" | "attachmentStatus" | "closingAt" | "createdAt" | "updatedAt">;

const MAX_RFQ_REFERENCE_LINKS = 5;

function normalizeReferenceLinks(values: string[] | undefined) {
  if (!values) return [];
  if (!Array.isArray(values) || values.length > MAX_RFQ_REFERENCE_LINKS) throw new Error("invalid_reference_link");
  const links = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  for (const link of links) {
    if (link.length > 500) throw new Error("invalid_reference_link");
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      throw new Error("invalid_reference_link");
    }
    if (parsed.protocol !== "https:") throw new Error("invalid_reference_link");
  }
  return links;
}

function validOtherOption(value: string, otherValue: string) {
  return value !== "other" || (otherValue.length > 0 && otherValue.length <= 120);
}

export function isRfqAcceptingResponses(item: Pick<RfqRecord, "status" | "closingDate" | "closingAt">) {
  if (!["published", "receiving"].includes(item.status)) return false;
  const closingAt = toDate(item.closingAt as never)?.getTime() || Date.parse(item.closingDate + "T23:59:59");
  return Number.isFinite(closingAt) && closingAt >= Date.now();
}

function normalizeRfqInput(input: RfqInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const unit = input.unit.trim();
  const unitOther = input.unitOther?.trim() || "";
  const deliveryGovernorate = input.deliveryGovernorate?.trim() || "";
  const deliveryAddress = input.deliveryAddress?.trim() || "";
  const preferredCurrency = input.preferredCurrency || "either";
  const paymentTerms = input.paymentTerms?.trim() || "";
  const paymentTermsOther = input.paymentTermsOther?.trim() || "";
  const deliveryTerms = input.deliveryTerms?.trim() || "";
  const deliveryTermsOther = input.deliveryTermsOther?.trim() || "";
  const location = input.location.trim() || [deliveryGovernorate, deliveryAddress].filter(Boolean).join(" - ");
  const referenceLinks = normalizeReferenceLinks(input.referenceLinks);
  const recipientIds = [...new Set(input.recipientIds.map((item) => item.trim()).filter(Boolean))].slice(0, 50);
  const quantity = Math.max(1, Math.trunc(Number(input.quantity) || 0));

  if (
    !title
    || title.length > 120
    || !description
    || description.length > 2000
    || !unit
    || unit.length > 40
    || unitOther.length > 120
    || deliveryGovernorate.length > 40
    || deliveryAddress.length > 300
    || !["IQD", "USD", "either"].includes(preferredCurrency)
    || paymentTerms.length > 40
    || deliveryTerms.length > 40
    || !validOtherOption(unit, unitOther)
    || !validOtherOption(paymentTerms, paymentTermsOther)
    || !validOtherOption(deliveryTerms, deliveryTermsOther)
  ) throw new Error("invalid_rfq_fields");

  const closingAtDate = new Date(input.closingDate + "T23:59:59");
  if (!input.categoryId || !input.closingDate || !Number.isFinite(closingAtDate.getTime())) throw new Error("invalid_rfq_fields");
  if (input.status === "published" && recipientIds.length === 0) throw new Error("rfq_recipient_required");

  return {
    ...input,
    title,
    description,
    unit,
    unitOther,
    location,
    deliveryGovernorate,
    deliveryAddress,
    preferredCurrency,
    paymentTerms,
    paymentTermsOther,
    deliveryTerms,
    deliveryTermsOther,
    referenceLinks,
    quantity,
    recipientIds,
    closingAt: isFirebaseConfigured ? Timestamp.fromDate(closingAtDate) : closingAtDate.toISOString(),
  };
}

async function recipientOwnerIds(recipientIds: string[]) {
  const snapshots = await Promise.all(recipientIds.map((supplierId) => getDoc(doc(suppliersRef, supplierId))));
  return [...new Set(snapshots.map((snapshot) => snapshot.data()?.accountOwnerId).filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function publishedRfqNotificationId(rfqId: string, userId: string) {
  return `rfq-published_${rfqId}_${userId}`;
}

function responseNotificationId(responseId: string) {
  return `rfq-response_${responseId}`;
}

function responseUpdatedNotification(
  buyerId: string,
  supplierUserId: string,
  rfqId: string,
  responseId: string,
  revisionNumber: number,
) {
  return {
    userId: buyerId,
    actorId: supplierUserId,
    type: "rfq" as const,
    referenceType: "rfq" as const,
    referenceId: rfqId,
    eventId: rfqResponseUpdatedEventId(responseId, revisionNumber),
    responseId,
    revisionNumber,
    titleAr: "تم تحديث عرض سعر",
    titleEn: "Quotation updated",
    bodyAr: "قام أحد المجهزين بتحديث عرضه على طلب عرض الأسعار الخاص بك.",
    bodyEn: "A Supplier updated its quotation for your RFQ.",
    link: "/buyer/rfqs",
    read: false,
    createdAt: serverTimestamp(),
  };
}

function rfqNotification(
  userId: string,
  actorId: string,
  rfqId: string,
  direction: "buyer_to_supplier" | "supplier_to_buyer",
  responseId?: string,
) {
  const toSupplier = direction === "buyer_to_supplier";
  const eventId = toSupplier ? rfqId : responseId;
  if (!eventId) throw new Error("rfq_response_event_required");
  return {
    userId,
    actorId,
    type: "rfq" as const,
    referenceType: "rfq" as const,
    referenceId: rfqId,
    eventId,
    ...(toSupplier ? {} : { responseId }),
    titleAr: toSupplier ? "طلب عرض سعر جديد" : "تم استلام عرض سعر",
    titleEn: toSupplier ? "New RFQ request" : "New quotation received",
    bodyAr: toSupplier ? "وصل طلب عرض سعر جديد إلى شركتك." : "استلم طلبك عرض سعر جديداً من أحد المجهزين.",
    bodyEn: toSupplier ? "A new RFQ has been addressed to your company." : "A supplier submitted a quotation for your RFQ.",
    link: toSupplier ? "/supplier/rfqs" : "/buyer/rfqs",
    read: false,
    createdAt: serverTimestamp(),
  };
}

async function createPublishedRfqNotifications(rfqId: string, buyerId: string, ownerIds: string[]) {
  await Promise.allSettled(ownerIds.map((userId) => setDoc(
    doc(notificationsRef, publishedRfqNotificationId(rfqId, userId)),
    rfqNotification(userId, buyerId, rfqId, "buyer_to_supplier"),
  )));
}

async function createResponseNotification(rfqId: string, responseId: string, buyerId: string, supplierUserId: string) {
  await Promise.allSettled([
    setDoc(
      doc(notificationsRef, responseNotificationId(responseId)),
      rfqNotification(buyerId, supplierUserId, rfqId, "supplier_to_buyer", responseId),
    ),
  ]);
}

export async function createRfq(buyerId: string, input: RfqInput) {
  const normalized = normalizeRfqInput(input);
  const payload = {
    ...normalized,
    buyerId,
    attachmentStatus: "upload_pending_launch" as const,
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) {
    const item = { id: newId("rfq"), ...payload } as RfqRecord;
    localUpsert("rfqs", item);
    return item.id;
  }
  const rfqRef = doc(rfqsRef);
  const owners = normalized.status === "published" ? await recipientOwnerIds(normalized.recipientIds) : [];
  const batch = writeBatch(db);
  batch.set(rfqRef, payload);
  if (normalized.status === "published") {
    batch.set(doc(rfqPublishEventsRef, rfqRef.id), {
      type: "rfq_published",
      actorId: buyerId,
      buyerId,
      rfqId: rfqRef.id,
      recipientIds: normalized.recipientIds,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  if (normalized.status === "published") await createPublishedRfqNotifications(rfqRef.id, buyerId, owners);
  return rfqRef.id;
}

export async function listBuyerRfqs(buyerId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<RfqRecord>("rfqs").filter((item) => item.buyerId === buyerId));
  const snapshot = await getDocs(query(rfqsRef, where("buyerId", "==", buyerId), limit(200)));
  return sortNewest(snapshot.docs.map((item) => withId<RfqRecord>(item)));
}

export interface SupplierRfqLifecycleCursor {
  activeClosingAt?: unknown;
  activeId?: string;
  activeComplete: boolean;
  responseUpdatedAt?: unknown;
  responseId?: string;
  responseComplete: boolean;
}

export interface SupplierRfqLifecyclePage {
  items: SupplierRfqLifecycleItem[];
  cursor: SupplierRfqLifecycleCursor | null;
  hasMore: boolean;
}

function mergeSupplierRfqLifecycleItems(
  rfqs: RfqRecord[],
  responses: RfqResponse[],
) {
  const responseByRfq = new Map(responses.map((item) => [item.rfqId, item]));
  const items = new Map<string, SupplierRfqLifecycleItem>();
  rfqs.forEach((rfq) => items.set(rfq.id, { rfq, response: responseByRfq.get(rfq.id) || null }));
  return [...items.values()];
}

export async function listSupplierRfqLifecyclePage(
  supplierUserId: string,
  supplierProfileId: string,
  cursor: SupplierRfqLifecycleCursor | null = null,
  pageSize = RFQ_HISTORY_PAGE_SIZE,
): Promise<SupplierRfqLifecyclePage> {
  if (!supplierUserId.trim() || !supplierProfileId.trim()) return { items: [], cursor: null, hasMore: false };
  const boundedPageSize = Math.min(50, Math.max(1, Math.trunc(pageSize)));
  const activeComplete = cursor?.activeComplete || false;
  const responseComplete = cursor?.responseComplete || false;

  if (!isFirebaseConfigured) {
    const active = sortNewest(localRead<RfqRecord>("rfqs").filter((item) => (
      item.recipientIds.includes(supplierProfileId) && isRfqAcceptingResponses(item)
    )));
    const responses = sortNewest(localRead<RfqResponse>("rfqResponses").filter((item) => (
      item.supplierUserId === supplierUserId && item.supplierProfileId === supplierProfileId
    )));
    const activeStart = cursor?.activeId ? Math.max(0, active.findIndex((item) => item.id === cursor.activeId) + 1) : 0;
    const responseStart = cursor?.responseId ? Math.max(0, responses.findIndex((item) => item.id === cursor.responseId) + 1) : 0;
    const activePage = activeComplete ? [] : active.slice(activeStart, activeStart + boundedPageSize);
    const responsePage = responseComplete ? [] : responses.slice(responseStart, responseStart + boundedPageSize);
    const referencedRfqs = localRead<RfqRecord>("rfqs").filter((item) => responsePage.some((response) => response.rfqId === item.id));
    const nextActiveComplete = activeComplete || activeStart + activePage.length >= active.length;
    const nextResponseComplete = responseComplete || responseStart + responsePage.length >= responses.length;
    const nextCursor = nextActiveComplete && nextResponseComplete ? null : {
      activeId: activePage[activePage.length - 1]?.id || cursor?.activeId,
      activeComplete: nextActiveComplete,
      responseId: responsePage[responsePage.length - 1]?.id || cursor?.responseId,
      responseComplete: nextResponseComplete,
    };
    return {
      items: mergeSupplierRfqLifecycleItems([...activePage, ...referencedRfqs], responsePage),
      cursor: nextCursor,
      hasMore: Boolean(nextCursor),
    };
  }

  const activeConstraints: QueryConstraint[] = [
    where("recipientIds", "array-contains", supplierProfileId),
    where("status", "in", ["published", "receiving"]),
    where("closingAt", ">=", Timestamp.now()),
    orderBy("closingAt", "asc"),
    orderBy(documentId(), "asc"),
    limit(boundedPageSize + 1),
  ];
  if (cursor?.activeClosingAt && cursor.activeId) {
    activeConstraints.splice(-1, 0, startAfter(cursor.activeClosingAt, cursor.activeId));
  }
  const responseConstraints: QueryConstraint[] = [
    where("supplierUserId", "==", supplierUserId),
    where("supplierProfileId", "==", supplierProfileId),
    orderBy("updatedAt", "desc"),
    orderBy(documentId(), "desc"),
    limit(boundedPageSize + 1),
  ];
  if (cursor?.responseUpdatedAt && cursor.responseId) {
    responseConstraints.splice(-1, 0, startAfter(cursor.responseUpdatedAt, cursor.responseId));
  }

  const [activeSnapshot, responseSnapshot] = await Promise.all([
    activeComplete ? null : getDocs(query(rfqsRef, ...activeConstraints)),
    responseComplete ? null : getDocs(query(rfqResponsesRef, ...responseConstraints)),
  ]);
  const activeDocs = activeSnapshot?.docs || [];
  const responseDocs = responseSnapshot?.docs || [];
  const activeHasMore = activeDocs.length > boundedPageSize;
  const responseHasMore = responseDocs.length > boundedPageSize;
  const activePageDocs = activeDocs.slice(0, boundedPageSize);
  const responsePageDocs = responseDocs.slice(0, boundedPageSize);
  const activeRfqs = activePageDocs.map((item) => withId<RfqRecord>(item)).filter(isRfqAcceptingResponses);
  const responses = responsePageDocs.map((item) => withId<RfqResponse>(item));
  const activeIds = new Set(activeRfqs.map((item) => item.id));
  const referencedIds = [...new Set(responses.map((item) => item.rfqId).filter((id) => !activeIds.has(id)))];
  const referencedSnapshots = await Promise.all(referencedIds.map((id) => getDoc(doc(rfqsRef, id))));
  const referencedRfqs = referencedSnapshots.filter((item) => item.exists()).map((item) => withId<RfqRecord>(item));
  const nextActiveComplete = activeComplete || !activeHasMore;
  const nextResponseComplete = responseComplete || !responseHasMore;
  const lastActive = activePageDocs[activePageDocs.length - 1];
  const lastResponse = responsePageDocs[responsePageDocs.length - 1];
  const nextCursor = nextActiveComplete && nextResponseComplete ? null : {
    activeClosingAt: lastActive?.get("closingAt") || cursor?.activeClosingAt,
    activeId: lastActive?.id || cursor?.activeId,
    activeComplete: nextActiveComplete,
    responseUpdatedAt: lastResponse?.get("updatedAt") || cursor?.responseUpdatedAt,
    responseId: lastResponse?.id || cursor?.responseId,
    responseComplete: nextResponseComplete,
  };
  return {
    items: mergeSupplierRfqLifecycleItems([...activeRfqs, ...referencedRfqs], responses),
    cursor: nextCursor,
    hasMore: Boolean(nextCursor),
  };
}

export async function listSupplierRfqs(supplierUserId: string, supplierProfileId?: string) {
  if (!supplierProfileId) return [];
  const page = await listSupplierRfqLifecyclePage(supplierUserId, supplierProfileId);
  return page.items.filter(({ rfq }) => isRfqAcceptingResponses(rfq)).map(({ rfq }) => rfq);
}

export async function updateRfqStatus(rfqId: string, status: RfqRecord["status"]) {
  if (!isFirebaseConfigured) {
    const item = localRead<RfqRecord>("rfqs").find((entry) => entry.id === rfqId);
    if (!item) throw new Error("rfq_not_found");
    if (status === "published" && item.recipientIds.length === 0) throw new Error("rfq_recipient_required");
    localUpsert("rfqs", { ...item, status, updatedAt: nowIso() });
    return;
  }
  const rfqRef = doc(rfqsRef, rfqId);
  const snapshot = await getDoc(rfqRef);
  if (!snapshot.exists()) throw new Error("rfq_not_found");
  const item = withId<RfqRecord>(snapshot);
  if (status === "published" && item.recipientIds.length === 0) throw new Error("rfq_recipient_required");
  const isPublishingDraft = status === "published" && item.status === "draft";
  const owners = isPublishingDraft ? await recipientOwnerIds(item.recipientIds) : [];
  const batch = writeBatch(db);
  batch.update(rfqRef, { status, updatedAt: serverTimestamp() });
  if (isPublishingDraft) {
    batch.set(doc(rfqPublishEventsRef, rfqId), {
      type: "rfq_published",
      actorId: item.buyerId,
      buyerId: item.buyerId,
      rfqId,
      recipientIds: item.recipientIds,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  if (isPublishingDraft) await createPublishedRfqNotifications(rfqId, item.buyerId, owners);
}

export async function listRfqResponses(rfqId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<RfqResponse>("rfqResponses").filter((item) => item.rfqId === rfqId));
  const snapshot = await getDocs(query(rfqResponsesRef, where("rfqId", "==", rfqId), limit(100)));
  return sortNewest(snapshot.docs.map((item) => withId<RfqResponse>(item)));
}

export type RfqResponseRevisionViewerScope =
  | {
    viewer: "supplier";
    buyerId: string;
    supplierUserId: string;
    supplierProfileId: string;
  }
  | {
    viewer: "buyer";
    buyerId: string;
  };

export type RfqResponseRevisionScope = RfqResponseRevisionViewerScope & { responseId: string };

export async function listRfqResponseRevisions(scope: RfqResponseRevisionScope, pageSize = RFQ_HISTORY_PAGE_SIZE) {
  const boundedPageSize = Math.min(50, Math.max(1, Math.trunc(pageSize)));
  const responseId = scope.responseId.trim();
  const buyerId = scope.buyerId.trim();
  if (!responseId || !buyerId) throw new Error("invalid_rfq_revision_scope");
  if (scope.viewer === "supplier" && (!scope.supplierUserId.trim() || !scope.supplierProfileId.trim())) {
    throw new Error("invalid_rfq_revision_scope");
  }
  if (!isFirebaseConfigured) {
    return localRead<RfqResponseRevision>("rfqResponseRevisions")
      .filter((item) => item.responseId === responseId
        && item.buyerId === buyerId
        && (scope.viewer === "buyer"
          || (item.supplierUserId === scope.supplierUserId.trim()
            && item.supplierProfileId === scope.supplierProfileId.trim())))
      .sort((a, b) => b.revisionNumber - a.revisionNumber)
      .slice(0, boundedPageSize);
  }
  const ownershipConstraints = scope.viewer === "supplier"
    ? [
      where("supplierUserId", "==", scope.supplierUserId.trim()),
      where("supplierProfileId", "==", scope.supplierProfileId.trim()),
    ]
    : [where("buyerId", "==", buyerId)];
  const snapshot = await getDocs(query(
    rfqResponseRevisionsRef,
    where("responseId", "==", responseId),
    ...ownershipConstraints,
    orderBy("revisionNumber", "desc"),
    limit(boundedPageSize),
  ));
  return snapshot.docs.map((item) => withId<RfqResponseRevision>(item));
}

interface SupplierRfqResponseScope {
  rfqId: string;
  supplierUserId: string;
  supplierProfileId: string;
  responseId: string;
}

function normalizeSupplierRfqResponseScope(rfqId: string, supplierUserId: string, supplierProfileId: string): SupplierRfqResponseScope {
  const normalizedRfqId = rfqId.trim();
  const normalizedSupplierUserId = supplierUserId.trim();
  const normalizedSupplierProfileId = supplierProfileId.trim();
  if (!normalizedRfqId || !normalizedSupplierUserId || !normalizedSupplierProfileId) {
    throw new Error("invalid_rfq_response_scope");
  }
  return {
    rfqId: normalizedRfqId,
    supplierUserId: normalizedSupplierUserId,
    supplierProfileId: normalizedSupplierProfileId,
    responseId: `${normalizedRfqId}_${normalizedSupplierUserId}`,
  };
}

function validateScopedSupplierRfqResponse(item: RfqResponse, scope: SupplierRfqResponseScope) {
  if (
    item.id !== scope.responseId
    || item.rfqId !== scope.rfqId
    || item.supplierUserId !== scope.supplierUserId
    || item.supplierProfileId !== scope.supplierProfileId
  ) {
    throw new Error("rfq_response_integrity_error");
  }
  return item;
}

async function findScopedSupplierRfqResponse(rfqId: string, supplierUserId: string, supplierProfileId: string) {
  const scope = normalizeSupplierRfqResponseScope(rfqId, supplierUserId, supplierProfileId);
  const matches = !isFirebaseConfigured
    ? localRead<RfqResponse>("rfqResponses").filter((item) => (
      item.rfqId === scope.rfqId
      && item.supplierUserId === scope.supplierUserId
      && item.supplierProfileId === scope.supplierProfileId
    )).slice(0, 2)
    : (await getDocs(query(
      rfqResponsesRef,
      where("rfqId", "==", scope.rfqId),
      where("supplierUserId", "==", scope.supplierUserId),
      where("supplierProfileId", "==", scope.supplierProfileId),
      limit(2),
    ))).docs.map((snapshot) => withId<RfqResponse>(snapshot));

  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new Error("rfq_response_integrity_error");
  return validateScopedSupplierRfqResponse(matches[0], scope);
}

export async function getSupplierRfqResponse(rfqId: string, supplierUserId: string, supplierProfileId: string) {
  return findScopedSupplierRfqResponse(rfqId, supplierUserId, supplierProfileId);
}

function rfqCommercialPayload(values: ReturnType<typeof normalizeRfqCommercialValues>) {
  return {
    message: values.message,
    currency: values.currency,
    paymentTerms: values.paymentTerms,
    paymentTermsOther: values.paymentTermsOther,
    deliveryTerms: values.deliveryTerms,
    deliveryTermsOther: values.deliveryTermsOther,
    referenceLinks: values.referenceLinks,
    ...(values.price === undefined ? {} : { price: values.price }),
    ...(values.deliveryDays === undefined ? {} : { deliveryDays: values.deliveryDays }),
  };
}

function rfqRevisionPayload(
  response: Pick<RfqResponse, "id" | "rfqId" | "supplierUserId" | "supplierProfileId"> & Partial<RfqResponse>,
  buyerId: string,
  revisionNumber: number,
  changeType: RfqResponseRevision["changeType"],
  createdAt: unknown,
  previousRevisionNumber?: number,
) {
  const commercial = normalizeRfqCommercialValues(response);
  return {
    id: rfqResponseRevisionId(response.id, revisionNumber),
    responseId: response.id,
    rfqId: response.rfqId,
    buyerId,
    supplierUserId: response.supplierUserId,
    supplierProfileId: response.supplierProfileId,
    revisionNumber,
    changeType,
    ...rfqCommercialPayload(commercial),
    responseStatus: response.status || "submitted",
    createdBy: response.supplierUserId,
    createdAt,
    ...(previousRevisionNumber === undefined ? {} : { previousRevisionNumber }),
  };
}

export async function submitRfqResponse(input: Omit<RfqResponse, "id" | "status" | "attachmentStatus" | "createdAt" | "updatedAt">) {
  const scope = normalizeSupplierRfqResponseScope(input.rfqId, input.supplierUserId, input.supplierProfileId);
  const commercial = normalizeRfqCommercialValues({
    ...input,
    referenceLinks: normalizeReferenceLinks(input.referenceLinks),
  });

  if (
    !commercial.message
    || commercial.message.length > 2000
    || (commercial.price !== undefined && (!Number.isFinite(commercial.price) || commercial.price < 0))
    || (commercial.deliveryDays !== undefined && (!Number.isFinite(commercial.deliveryDays) || commercial.deliveryDays < 1))
    || (commercial.paymentTerms || "").length > 40
    || (commercial.deliveryTerms || "").length > 40
    || !validOtherOption(commercial.paymentTerms || "", commercial.paymentTermsOther || "")
    || !validOtherOption(commercial.deliveryTerms || "", commercial.deliveryTermsOther || "")
  ) throw new Error("invalid_rfq_response");

  const id = scope.responseId;
  const values = {
    ...rfqCommercialPayload(commercial),
    rfqId: scope.rfqId,
    supplierUserId: scope.supplierUserId,
    supplierProfileId: scope.supplierProfileId,
  };

  if (!isFirebaseConfigured) {
    const rfq = localRead<RfqRecord>("rfqs").find((item) => item.id === scope.rfqId);
    if (!rfq) throw new Error("rfq_not_found");
    if (!isRfqAcceptingResponses(rfq)) throw new Error("rfq_closed");
    const existing = await findScopedSupplierRfqResponse(scope.rfqId, scope.supplierUserId, scope.supplierProfileId);
    if (existing && !hasMaterialRfqResponseChange(existing, commercial)) return id;
    const timestamp = nowIso();
    const revisionNumber = existing ? currentRfqRevision(existing) + 1 : 1;
    if (existing && !existing.revisionNumber) {
      localUpsert("rfqResponseRevisions", rfqRevisionPayload(existing, rfq.buyerId, 1, "submitted", existing.createdAt) as RfqResponseRevision);
    }
    const current = {
      ...existing,
      ...values,
      id,
      status: "submitted" as const,
      attachmentStatus: "upload_pending_launch" as const,
      revisionNumber,
      revisionId: rfqResponseRevisionId(id, revisionNumber),
      firstSubmittedAt: existing?.firstSubmittedAt || existing?.createdAt || timestamp,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    } as RfqResponse;
    localUpsert("rfqResponses", current);
    localUpsert("rfqResponseRevisions", rfqRevisionPayload(
      current,
      rfq.buyerId,
      revisionNumber,
      existing ? "updated" : "submitted",
      timestamp,
      existing ? revisionNumber - 1 : undefined,
    ) as RfqResponseRevision);
    const eventId = existing ? rfqResponseUpdatedEventId(id, revisionNumber) : id;
    localUpsert("rfqResponseEvents", {
      id: eventId,
      type: existing ? "rfq_response_updated" : "rfq_response_submitted",
      actorId: scope.supplierUserId,
      buyerId: rfq.buyerId,
      rfqId: scope.rfqId,
      responseId: id,
      supplierProfileId: scope.supplierProfileId,
      revisionNumber,
      ...(existing ? { previousRevisionNumber: revisionNumber - 1 } : {}),
      createdAt: timestamp,
    });
    localUpsert("notifications", {
      id: existing ? rfqResponseUpdatedNotificationId(id, revisionNumber) : responseNotificationId(id),
      ...(existing
        ? responseUpdatedNotification(rfq.buyerId, scope.supplierUserId, scope.rfqId, id, revisionNumber)
        : rfqNotification(rfq.buyerId, scope.supplierUserId, scope.rfqId, "supplier_to_buyer", id)),
      createdAt: timestamp,
    } as WorkspaceNotification);
    return id;
  }

  const responseRef = doc(rfqResponsesRef, id);
  const rfqRef = doc(rfqsRef, scope.rfqId);
  const preexisting = await findScopedSupplierRfqResponse(
    scope.rfqId,
    scope.supplierUserId,
    scope.supplierProfileId,
  );

  if (!preexisting) {
    const rfqSnapshot = await getDoc(rfqRef);
    if (!rfqSnapshot.exists()) throw new Error("rfq_not_found");
    const rfq = withId<RfqRecord>(rfqSnapshot);
    if (!isRfqAcceptingResponses(rfq)) throw new Error("rfq_closed");
    const created = {
      ...values,
      id,
      status: "submitted" as const,
      attachmentStatus: "upload_pending_launch" as const,
      revisionNumber: 1,
      revisionId: rfqResponseRevisionId(id, 1),
      firstSubmittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(responseRef, created);
    batch.set(doc(rfqResponseRevisionsRef, created.revisionId), rfqRevisionPayload(
      { ...created, createdAt: undefined, updatedAt: undefined },
      rfq.buyerId,
      1,
      "submitted",
      serverTimestamp(),
    ));
    batch.set(doc(rfqResponseEventsRef, id), {
      type: "rfq_response_submitted",
      actorId: scope.supplierUserId,
      buyerId: rfq.buyerId,
      rfqId: scope.rfqId,
      responseId: id,
      supplierProfileId: scope.supplierProfileId,
      revisionNumber: 1,
      createdAt: serverTimestamp(),
    });
    batch.set(
      doc(notificationsRef, responseNotificationId(id)),
      rfqNotification(rfq.buyerId, scope.supplierUserId, scope.rfqId, "supplier_to_buyer", id),
    );
    try {
      await batch.commit();
    } catch (error) {
      const settled = await findScopedSupplierRfqResponse(
        scope.rfqId,
        scope.supplierUserId,
        scope.supplierProfileId,
      ).catch(() => null);
      if (settled && !hasMaterialRfqResponseChange(settled, commercial)) return id;
      throw error;
    }
    return id;
  }

  try {
    await runTransaction(db, async (transaction) => {
    const [rfqSnapshot, responseSnapshot] = await Promise.all([
      transaction.get(rfqRef),
      transaction.get(responseRef),
    ]);
    if (!rfqSnapshot.exists()) throw new Error("rfq_not_found");
    const rfq = withId<RfqRecord>(rfqSnapshot);
    if (!isRfqAcceptingResponses(rfq)) throw new Error("rfq_closed");
    if (!responseSnapshot.exists()) throw new Error("rfq_response_integrity_error");
    const existing = validateScopedSupplierRfqResponse(withId<RfqResponse>(responseSnapshot), scope);
    if (!hasMaterialRfqResponseChange(existing, commercial)) return;

    const previousRevisionNumber = currentRfqRevision(existing);
    const revisionNumber = previousRevisionNumber + 1;
    if (!existing.revisionNumber) {
      transaction.set(doc(rfqResponseRevisionsRef, rfqResponseRevisionId(id, 1)), rfqRevisionPayload(
        existing,
        rfq.buyerId,
        1,
        "submitted",
        existing.createdAt,
      ));
    }
    transaction.update(responseRef, {
      message: commercial.message,
      currency: commercial.currency,
      price: commercial.price === undefined ? deleteField() : commercial.price,
      deliveryDays: commercial.deliveryDays === undefined ? deleteField() : commercial.deliveryDays,
      paymentTerms: commercial.paymentTerms || deleteField(),
      paymentTermsOther: commercial.paymentTermsOther || deleteField(),
      deliveryTerms: commercial.deliveryTerms || deleteField(),
      deliveryTermsOther: commercial.deliveryTermsOther || deleteField(),
      referenceLinks: commercial.referenceLinks,
      status: "submitted",
      revisionNumber,
      revisionId: rfqResponseRevisionId(id, revisionNumber),
      firstSubmittedAt: existing.firstSubmittedAt || existing.createdAt,
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(rfqResponseRevisionsRef, rfqResponseRevisionId(id, revisionNumber)), rfqRevisionPayload(
      { ...existing, ...values, revisionNumber, status: "submitted" },
      rfq.buyerId,
      revisionNumber,
      "updated",
      serverTimestamp(),
      previousRevisionNumber,
    ));
    transaction.set(doc(rfqResponseEventsRef, rfqResponseUpdatedEventId(id, revisionNumber)), {
      type: "rfq_response_updated",
      actorId: scope.supplierUserId,
      buyerId: rfq.buyerId,
      rfqId: scope.rfqId,
      responseId: id,
      supplierProfileId: scope.supplierProfileId,
      revisionNumber,
      previousRevisionNumber,
      createdAt: serverTimestamp(),
    });
    transaction.set(
      doc(notificationsRef, rfqResponseUpdatedNotificationId(id, revisionNumber)),
      responseUpdatedNotification(rfq.buyerId, scope.supplierUserId, scope.rfqId, id, revisionNumber),
    );
    });
  } catch (error) {
    const settled = await findScopedSupplierRfqResponse(
      scope.rfqId,
      scope.supplierUserId,
      scope.supplierProfileId,
    ).catch(() => null);
    if (settled && !hasMaterialRfqResponseChange(settled, commercial)) return id;
    throw error;
  }
  return id;
}

export interface NotificationCursor {
  createdAt: unknown;
  id: string;
}

export interface NotificationPage {
  items: WorkspaceNotification[];
  cursor: NotificationCursor | null;
  hasMore: boolean;
}

const notificationPageSize = 25;

function sortNotifications(items: WorkspaceNotification[]) {
  return [...items].sort((left, right) => {
    const leftTime = toDate(left.createdAt as never)?.getTime() || 0;
    const rightTime = toDate(right.createdAt as never)?.getTime() || 0;
    return rightTime - leftTime || right.id.localeCompare(left.id);
  });
}

function notificationPage(items: WorkspaceNotification[], pageSize: number): NotificationPage {
  const visible = items.slice(0, pageSize);
  const last = visible[visible.length - 1];
  return {
    items: visible,
    cursor: last ? { createdAt: last.createdAt, id: last.id } : null,
    hasMore: items.length > pageSize,
  };
}

function notificationQuery(userId: string, cursor: NotificationCursor | null, pageSize: number) {
  const constraints: QueryConstraint[] = [
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    orderBy(documentId(), "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor.createdAt, cursor.id));
  constraints.push(limit(pageSize + 1));
  return query(notificationsRef, ...constraints);
}

export async function listNotificationsPage(
  userId: string,
  cursor: NotificationCursor | null = null,
  pageSize = notificationPageSize,
) {
  if (!isFirebaseConfigured) {
    const all = sortNotifications(localRead<WorkspaceNotification>("notifications").filter((item) => item.userId === userId));
    const offset = cursor ? Math.max(0, all.findIndex((item) => item.id === cursor.id) + 1) : 0;
    return notificationPage(all.slice(offset, offset + pageSize + 1), pageSize);
  }
  const snapshot = await getDocs(notificationQuery(userId, cursor, pageSize));
  return notificationPage(snapshot.docs.map((item) => withId<WorkspaceNotification>(item)), pageSize);
}

export async function listNotifications(userId: string) {
  return (await listNotificationsPage(userId, null, 50)).items;
}

export function subscribeNotifications(
  userId: string,
  onNext: (page: NotificationPage) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    let active = true;
    const emit = () => void listNotificationsPage(userId).then((page) => {
      if (active) onNext(page);
    }).catch(onError);
    emit();
    window.addEventListener("mujahiz-iq-workspace-updated", emit);
    return () => {
      active = false;
      window.removeEventListener("mujahiz-iq-workspace-updated", emit);
    };
  }
  return onSnapshot(
    notificationQuery(userId, null, notificationPageSize),
    (snapshot) => onNext(notificationPage(snapshot.docs.map((item) => withId<WorkspaceNotification>(item)), notificationPageSize)),
    onError,
  );
}

export async function markNotificationRead(notificationId: string, userId: string) {
  if (!isFirebaseConfigured) {
    const item = localRead<WorkspaceNotification>("notifications").find((entry) => entry.id === notificationId && entry.userId === userId);
    if (item) localUpsert("notifications", { ...item, read: true });
    return;
  }
  await updateDoc(doc(notificationsRef, notificationId), { read: true, readAt: serverTimestamp() });
}

export async function markAllNotificationsRead(userId: string, notificationIds?: string[]) {
  const requestedIds = notificationIds ? new Set(notificationIds) : null;
  const items = requestedIds && !isFirebaseConfigured
    ? localRead<WorkspaceNotification>("notifications").filter((item) => item.userId === userId && requestedIds.has(item.id))
    : requestedIds
      ? [...requestedIds].map((id) => ({ id, userId, read: false } as WorkspaceNotification))
      : await listNotifications(userId);
  if (!isFirebaseConfigured) {
    items.forEach((item) => localUpsert("notifications", { ...item, read: true }));
    return;
  }
  const unread = items.filter((item) => !item.read).slice(0, 400);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((item) => batch.update(doc(notificationsRef, item.id), { read: true, readAt: serverTimestamp() }));
  await batch.commit();
}

export async function createNotification(input: Omit<WorkspaceNotification, "id" | "read" | "createdAt">) {
  const payload = { ...input, read: false, createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso() };
  if (!isFirebaseConfigured) return localUpsert("notifications", { id: newId("notification"), ...payload } as WorkspaceNotification);
  await addDoc(notificationsRef, payload);
}

export async function listConversations(userId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<Conversation>("conversations").filter((item) => item.participantIds.includes(userId)));
  const snapshot = await getDocs(query(conversationsRef, where("participantIds", "array-contains", userId), limit(100)));
  return sortNewest(snapshot.docs.map((item) => withId<Conversation>(item)));
}

export async function ensureConversation(input: Pick<Conversation, "participantIds" | "participantLabels" | "rfqId" | "supplierId">) {
  const participantIds = [...new Set(input.participantIds)].sort();
  const id = `${participantIds.join("_")}${input.rfqId ? `_${input.rfqId}` : ""}`;
  if (!isFirebaseConfigured) {
    const existing = localRead<Conversation>("conversations").find((item) => item.id === id);
    if (existing) return id;
  } else {
    const existing = await getDoc(doc(conversationsRef, id));
    if (existing.exists()) return id;
  }
  const payload = {
    ...input,
    participantIds,
    id,
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) localUpsert("conversations", payload as Conversation);
  else await setDoc(doc(conversationsRef, id), payload);
  return id;
}

export async function listConversationMessages(conversationId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<ConversationMessage>("messages").filter((item) => item.conversationId === conversationId)).reverse();
  const snapshot = await getDocs(query(messagesRef, where("conversationId", "==", conversationId), limit(250)));
  return sortNewest(snapshot.docs.map((item) => withId<ConversationMessage>(item))).reverse();
}

export async function sendConversationMessage(conversationId: string, senderId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 2000) throw new Error("invalid_message");
  const payload = {
    conversationId,
    senderId,
    body: trimmed,
    readBy: [senderId],
    attachmentStatus: "upload_pending_launch" as const,
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) {
    localUpsert("messages", { id: newId("message"), ...payload } as ConversationMessage);
    const conversation = localRead<Conversation>("conversations").find((item) => item.id === conversationId);
    if (conversation) localUpsert("conversations", { ...conversation, lastMessage: trimmed, lastMessageAt: nowIso(), updatedAt: nowIso() });
    return;
  }
  const batch = writeBatch(db);
  batch.set(doc(messagesRef), payload);
  batch.update(doc(conversationsRef, conversationId), { lastMessage: trimmed, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function listSupplierProducts(supplierId: string, ownerUserId: string) {
  const normalizedSupplierId = supplierId.trim();
  const normalizedOwnerUserId = ownerUserId.trim();
  if (!normalizedSupplierId || !normalizedOwnerUserId) return [];
  if (!isFirebaseConfigured) return sortNewest(localRead<SupplierProduct>("products").filter((item) => item.supplierId === normalizedSupplierId && item.ownerUserId === normalizedOwnerUserId));
  const snapshot = await getDocs(query(
    productsRef,
    where("supplierId", "==", normalizedSupplierId),
    where("ownerUserId", "==", normalizedOwnerUserId),
    limit(250),
  ));
  return sortNewest(snapshot.docs.map((item) => withId<SupplierProduct>(item)));
}

export async function saveSupplierProduct(input: Omit<SupplierProduct, "id" | "mediaStatus" | "createdAt" | "updatedAt"> & { id?: string }) {
  const id = input.id || newId("product");
  const payload = {
    ...input,
    id,
    mediaStatus: "upload_pending_launch" as const,
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) return localUpsert("products", payload as SupplierProduct);
  await setDoc(doc(productsRef, id), payload, { merge: true });
}

export async function deleteSupplierProduct(productId: string) {
  if (!isFirebaseConfigured) return localWrite("products", localRead<SupplierProduct>("products").filter((item) => item.id !== productId));
  await deleteDoc(doc(productsRef, productId));
}

export async function listSupplierDocuments(supplierId: string, ownerUserId: string) {
  const normalizedSupplierId = supplierId.trim();
  const normalizedOwnerUserId = ownerUserId.trim();
  if (!normalizedSupplierId || !normalizedOwnerUserId) return [];
  if (!isFirebaseConfigured) return sortNewest(localRead<SupplierDocumentMetadata>("documents").filter((item) => item.supplierId === normalizedSupplierId && item.ownerUserId === normalizedOwnerUserId));
  const snapshot = await getDocs(query(
    documentsRef,
    where("supplierId", "==", normalizedSupplierId),
    where("ownerUserId", "==", normalizedOwnerUserId),
    limit(250),
  ));
  return sortNewest(snapshot.docs.map((item) => withId<SupplierDocumentMetadata>(item)));
}

export async function saveSupplierDocumentMetadata(input: Omit<SupplierDocumentMetadata, "id" | "storageStatus" | "verificationStatus" | "createdAt" | "updatedAt"> & { id?: string }) {
  const id = input.id || newId("document");
  const payload = {
    ...input,
    id,
    verificationStatus: "unverified" as const,
    storageStatus: "metadata_only" as const,
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) return localUpsert("documents", payload as SupplierDocumentMetadata);
  await setDoc(doc(documentsRef, id), payload, { merge: true });
}

export async function deleteSupplierDocumentMetadata(documentId: string) {
  if (!isFirebaseConfigured) return localWrite("documents", localRead<SupplierDocumentMetadata>("documents").filter((item) => item.id !== documentId));
  await deleteDoc(doc(documentsRef, documentId));
}

export async function listContentPages(publishedOnly = false) {
  if (!isFirebaseConfigured) return localRead<ContentPageRecord>("contentPages").filter((item) => !publishedOnly || item.status === "published");
  const snapshot = await getDocs(publishedOnly ? query(contentPagesRef, where("status", "==", "published"), limit(100)) : query(contentPagesRef, limit(100)));
  return snapshot.docs.map((item) => withId<ContentPageRecord>(item)).sort((a, b) => a.order - b.order);
}

export async function getPublishedContentPage(slug: string) {
  if (!isFirebaseConfigured) return localRead<ContentPageRecord>("contentPages").find((item) => item.slug === slug && item.status === "published") || null;
  return resolveManagedContentConfigImplementation().getPublishedContentPage(slug);
}

export async function saveContentPage(input: Omit<ContentPageRecord, "updatedAt">) {
  const payload = { ...input, updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso() };
  if (!isFirebaseConfigured) return localUpsert("contentPages", payload as ContentPageRecord);
  await setDoc(doc(contentPagesRef, input.id), payload, { merge: true });
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  if (!isFirebaseConfigured) return localRead<BrandingSettings & { id: string }>("branding")[0] || BRANDING_SETTINGS_FALLBACK;
  return resolveManagedContentConfigImplementation().getBrandingSettings();
}

export async function saveBrandingSettings(settings: BrandingSettings, actorId: string) {
  const payload = { ...settings, assetUploadStatus: "upload_pending_launch" as const, updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(), updatedBy: actorId };
  if (!isFirebaseConfigured) return localUpsert("branding", { id: "branding", ...payload });
  await setDoc(doc(settingsRef, "branding"), payload, { merge: true });
}

export async function getAdminOperationsSettings(): Promise<AdminOperationsSettings> {
  if (!isFirebaseConfigured) return localRead<AdminOperationsSettings & { id: string }>("adminOperations")[0] || createAdminOperationsSettingsFallback();
  return resolveManagedContentConfigImplementation().getAdminOperationsSettings();
}

export async function saveAdminOperationsSettings(settings: AdminOperationsSettings, actorId: string) {
  const payload = { ...settings, updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(), updatedBy: actorId };
  if (!isFirebaseConfigured) return localUpsert("adminOperations", { id: "adminOperations", ...payload });
  await setDoc(doc(settingsRef, "adminOperations"), payload, { merge: true });
}

export async function listRegistrationSectors() {
  const fallback = () => defaultRegistrationSectors.filter((item) => item.active).sort((a, b) => a.order - b.order);
  if (!isFirebaseConfigured) {
    const configured = localRead<RegistrationSector>("registrationSectors");
    const sectors = configured.filter((item) => item.active).sort((a, b) => a.order - b.order);
    return sectors.length ? sectors : fallback();
  }
  return resolveSupplierTaxonomyDictionaryImplementation().listRegistrationSectors();
}

export async function saveRegistrationSectors(sectors: RegistrationSector[], actorId: string) {
  const sanitized = sectors.map((item, index) => ({ ...item, value: item.value.trim(), labelAr: item.labelAr.trim(), labelEn: item.labelEn.trim(), order: index + 1 }));
  if (!isFirebaseConfigured) return localWrite("registrationSectors", sanitized);
  await setDoc(doc(db, "publicConfig", "registration"), { sectors: sanitized, updatedAt: serverTimestamp(), updatedBy: actorId }, { merge: true });
}

async function loadOperationalReport(): Promise<OperationalReport> {
  if (!isFirebaseConfigured) {
    const users = JSON.parse(localStorage.getItem("mujahiz-iq-demo-users") || "[]") as Array<{ accountType?: string }>;
    const submissions = JSON.parse(localStorage.getItem("mujahiz-iq-demo-submissions") || "[]") as Array<{ submissionStatus?: string }>;
    return {
      users: users.length,
      buyers: users.filter((item) => item.accountType === "buyer").length,
      supplierAccounts: users.filter((item) => item.accountType === "supplier").length,
      approvedSuppliers: 0,
      pendingSubmissions: submissions.filter((item) => ["pending_review", "possible_duplicate"].includes(item.submissionStatus || "")).length,
      approvedSubmissions: submissions.filter((item) => item.submissionStatus === "approved").length,
      rejectedSubmissions: submissions.filter((item) => item.submissionStatus === "rejected").length,
      accessGrants: 0,
      pendingTerms: 0,
      reviews: 0,
      feedback: 0,
    };
  }
  const count = async (name: string, field?: string, value?: string | string[]) => {
    const ref = collection(db, name);
    const target = field && value !== undefined
      ? query(ref, Array.isArray(value) ? where(field, "in", value) : where(field, "==", value))
      : query(ref);
    return (await getCountFromServer(target)).data().count;
  };
  const [users, buyers, supplierAccounts, approvedSuppliers, pendingSubmissions, approvedSubmissions, rejectedSubmissions, accessGrants, pendingTerms, reviews, feedback] = await Promise.all([
    count("users"),
    count("users", "accountType", "buyer"),
    count("users", "accountType", "supplier"),
    count("suppliers", "status", "approved"),
    count("supplierSubmissions", "submissionStatus", ["pending_review", "possible_duplicate"]),
    count("supplierSubmissions", "submissionStatus", "approved"),
    count("supplierSubmissions", "submissionStatus", "rejected"),
    count("accessGrants"),
    count("termSuggestions", "status", "pending"),
    count("reviews"),
    count("supplierFeedback"),
  ]);
  return { users, buyers, supplierAccounts, approvedSuppliers, pendingSubmissions, approvedSubmissions, rejectedSubmissions, accessGrants, pendingTerms, reviews, feedback };
}

const operationalReportCache = new ReadThroughCache<OperationalReport>(60_000);

export function getOperationalReport(options: CacheReadOptions = {}) {
  return operationalReportCache.read("global", loadOperationalReport, options);
}
