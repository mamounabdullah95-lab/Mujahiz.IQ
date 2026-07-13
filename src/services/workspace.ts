import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
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
  SupplierDocumentMetadata,
  SupplierProduct,
  WorkspaceNotification,
} from "../types/workspace";
import { toDate } from "../utils/date";

const favoritesRef = collection(db, "favorites");
const rfqsRef = collection(db, "rfqs");
const rfqResponsesRef = collection(db, "rfqResponses");
const notificationsRef = collection(db, "notifications");
const conversationsRef = collection(db, "conversations");
const messagesRef = collection(db, "messages");
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

export async function createRfq(buyerId: string, input: Omit<RfqRecord, "id" | "buyerId" | "attachmentStatus" | "createdAt" | "updatedAt">) {
  const payload = {
    ...input,
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
  const created = await addDoc(rfqsRef, payload);
  return created.id;
}

export async function listBuyerRfqs(buyerId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<RfqRecord>("rfqs").filter((item) => item.buyerId === buyerId));
  const snapshot = await getDocs(query(rfqsRef, where("buyerId", "==", buyerId), limit(200)));
  return sortNewest(snapshot.docs.map((item) => withId<RfqRecord>(item)));
}

export async function listSupplierRfqs(supplierUserId: string, supplierProfileId?: string) {
  if (!isFirebaseConfigured) {
    return sortNewest(localRead<RfqRecord>("rfqs").filter((item) => item.status !== "draft" && (
      item.recipientIds.includes(supplierUserId) || Boolean(supplierProfileId && item.recipientIds.includes(supplierProfileId))
    )));
  }
  const targets = [supplierUserId, supplierProfileId].filter(Boolean) as string[];
  if (!targets.length) return [];
  const snapshots = await Promise.all(targets.map((target) => getDocs(query(rfqsRef, where("recipientIds", "array-contains", target), limit(100)))));
  const items = new Map<string, RfqRecord>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((item) => items.set(item.id, withId<RfqRecord>(item))));
  return sortNewest([...items.values()].filter((item) => item.status !== "draft"));
}

export async function updateRfqStatus(rfqId: string, status: RfqRecord["status"]) {
  if (!isFirebaseConfigured) {
    const item = localRead<RfqRecord>("rfqs").find((entry) => entry.id === rfqId);
    if (item) localUpsert("rfqs", { ...item, status, updatedAt: nowIso() });
    return;
  }
  await updateDoc(doc(rfqsRef, rfqId), { status, updatedAt: serverTimestamp() });
}

export async function listRfqResponses(rfqId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<RfqResponse>("rfqResponses").filter((item) => item.rfqId === rfqId));
  const snapshot = await getDocs(query(rfqResponsesRef, where("rfqId", "==", rfqId), limit(100)));
  return sortNewest(snapshot.docs.map((item) => withId<RfqResponse>(item)));
}

export async function submitRfqResponse(input: Omit<RfqResponse, "id" | "status" | "attachmentStatus" | "createdAt" | "updatedAt">) {
  const id = `${input.rfqId}_${input.supplierUserId}`;
  const payload = {
    ...input,
    id,
    status: "submitted" as const,
    attachmentStatus: "upload_pending_launch" as const,
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) return localUpsert("rfqResponses", payload as RfqResponse);
  await setDoc(doc(rfqResponsesRef, id), payload, { merge: true });
}

export async function listNotifications(userId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<WorkspaceNotification>("notifications").filter((item) => item.userId === userId));
  const snapshot = await getDocs(query(notificationsRef, where("userId", "==", userId), limit(200)));
  return sortNewest(snapshot.docs.map((item) => withId<WorkspaceNotification>(item)));
}

export async function markNotificationRead(notificationId: string, userId: string) {
  if (!isFirebaseConfigured) {
    const item = localRead<WorkspaceNotification>("notifications").find((entry) => entry.id === notificationId && entry.userId === userId);
    if (item) localUpsert("notifications", { ...item, read: true });
    return;
  }
  await updateDoc(doc(notificationsRef, notificationId), { read: true, readAt: serverTimestamp() });
}

export async function markAllNotificationsRead(userId: string) {
  const items = await listNotifications(userId);
  if (!isFirebaseConfigured) {
    items.forEach((item) => localUpsert("notifications", { ...item, read: true }));
    return;
  }
  const batch = writeBatch(db);
  items.filter((item) => !item.read).slice(0, 400).forEach((item) => batch.update(doc(notificationsRef, item.id), { read: true, readAt: serverTimestamp() }));
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
  const payload = {
    ...input,
    participantIds,
    id,
    createdAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(),
  };
  if (!isFirebaseConfigured) localUpsert("conversations", payload as Conversation);
  else await setDoc(doc(conversationsRef, id), payload, { merge: true });
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

export async function listSupplierProducts(supplierId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<SupplierProduct>("products").filter((item) => item.supplierId === supplierId));
  const snapshot = await getDocs(query(productsRef, where("supplierId", "==", supplierId), limit(250)));
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

export async function listSupplierDocuments(supplierId: string) {
  if (!isFirebaseConfigured) return sortNewest(localRead<SupplierDocumentMetadata>("documents").filter((item) => item.supplierId === supplierId));
  const snapshot = await getDocs(query(documentsRef, where("supplierId", "==", supplierId), limit(250)));
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
  const snapshot = await getDocs(query(contentPagesRef, where("slug", "==", slug), where("status", "==", "published"), limit(1)));
  return snapshot.empty ? null : withId<ContentPageRecord>(snapshot.docs[0]);
}

export async function saveContentPage(input: Omit<ContentPageRecord, "updatedAt">) {
  const payload = { ...input, updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso() };
  if (!isFirebaseConfigured) return localUpsert("contentPages", payload as ContentPageRecord);
  await setDoc(doc(contentPagesRef, input.id), payload, { merge: true });
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const fallback: BrandingSettings = {
    primaryColor: "#062b4d",
    secondaryColor: "#0b4f76",
    accentColor: "#f37021",
    introAr: "مجهز.. نقطة البداية لتوفير حقيقي.",
    introEn: "Mujahiz.. the starting point for real savings.",
    assetUploadStatus: "upload_pending_launch",
  };
  if (!isFirebaseConfigured) return localRead<BrandingSettings & { id: string }>("branding")[0] || fallback;
  const snapshot = await getDoc(doc(settingsRef, "branding"));
  return snapshot.exists() ? { ...fallback, ...snapshot.data() } as BrandingSettings : fallback;
}

export async function saveBrandingSettings(settings: BrandingSettings, actorId: string) {
  const payload = { ...settings, assetUploadStatus: "upload_pending_launch" as const, updatedAt: isFirebaseConfigured ? serverTimestamp() : nowIso(), updatedBy: actorId };
  if (!isFirebaseConfigured) return localUpsert("branding", { id: "branding", ...payload });
  await setDoc(doc(settingsRef, "branding"), payload, { merge: true });
}

export async function getAdminOperationsSettings(): Promise<AdminOperationsSettings> {
  const fallback: AdminOperationsSettings = { reviewNotifications: true, showIncompleteSuppliers: false, requireDuplicateReason: true, dictionarySuggestionMinimum: 2 };
  if (!isFirebaseConfigured) return localRead<AdminOperationsSettings & { id: string }>("adminOperations")[0] || fallback;
  const snapshot = await getDoc(doc(settingsRef, "adminOperations"));
  return snapshot.exists() ? { ...fallback, ...snapshot.data() } as AdminOperationsSettings : fallback;
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
  try {
    const snapshot = await getDoc(doc(db, "publicConfig", "registration"));
    const configured = snapshot.exists() && Array.isArray(snapshot.data().sectors) ? snapshot.data().sectors as RegistrationSector[] : [];
    const sectors = configured.filter((item) => item.active).sort((a, b) => a.order - b.order);
    return sectors.length ? sectors : fallback();
  } catch {
    return fallback();
  }
}

export async function saveRegistrationSectors(sectors: RegistrationSector[], actorId: string) {
  const sanitized = sectors.map((item, index) => ({ ...item, value: item.value.trim(), labelAr: item.labelAr.trim(), labelEn: item.labelEn.trim(), order: index + 1 }));
  if (!isFirebaseConfigured) return localWrite("registrationSectors", sanitized);
  await setDoc(doc(db, "publicConfig", "registration"), { sectors: sanitized, updatedAt: serverTimestamp(), updatedBy: actorId }, { merge: true });
}

export async function getOperationalReport(): Promise<OperationalReport> {
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
