import type { TimestampLike } from "./domain";

export interface FavoriteSupplier {
  id: string;
  userId: string;
  supplierId: string;
  supplierName: string;
  governorate?: string;
  categories?: string[];
  createdAt: TimestampLike;
}

export type RfqStatus = "draft" | "published" | "receiving" | "closed" | "cancelled";

export interface RfqRecord {
  id: string;
  buyerId: string;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  unitOther?: string;
  location: string;
  deliveryGovernorate?: string;
  deliveryAddress?: string;
  preferredCurrency?: "IQD" | "USD" | "either";
  paymentTerms?: string;
  paymentTermsOther?: string;
  deliveryTerms?: string;
  deliveryTermsOther?: string;
  referenceLinks?: string[];
  closingDate: string;
  closingAt: TimestampLike;
  categoryId: string;
  recipientIds: string[];
  status: RfqStatus;
  attachmentStatus: "upload_pending_launch";
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface RfqResponse {
  id: string;
  rfqId: string;
  supplierUserId: string;
  supplierProfileId: string;
  message: string;
  price?: number;
  currency?: "IQD" | "USD";
  deliveryDays?: number;
  paymentTerms?: string;
  paymentTermsOther?: string;
  deliveryTerms?: string;
  deliveryTermsOther?: string;
  referenceLinks?: string[];
  status: "submitted" | "withdrawn";
  attachmentStatus: "upload_pending_launch";
  revisionNumber?: number;
  revisionId?: string;
  firstSubmittedAt?: TimestampLike;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type RfqResponseRevisionChangeType = "submitted" | "updated";

export interface RfqResponseRevision {
  id: string;
  responseId: string;
  rfqId: string;
  buyerId: string;
  supplierUserId: string;
  supplierProfileId: string;
  revisionNumber: number;
  changeType: RfqResponseRevisionChangeType;
  message: string;
  price?: number;
  currency?: "IQD" | "USD";
  deliveryDays?: number;
  paymentTerms?: string;
  paymentTermsOther?: string;
  deliveryTerms?: string;
  deliveryTermsOther?: string;
  referenceLinks?: string[];
  responseStatus: RfqResponse["status"];
  createdBy: string;
  createdAt: TimestampLike;
  previousRevisionNumber?: number;
}

export interface WorkspaceNotification {
  id: string;
  userId: string;
  type: "approval" | "rfq" | "message" | "access" | "submission" | "system";
  actorId?: string;
  referenceType?: "rfq" | "conversation" | "submission" | "supplier";
  referenceId?: string;
  eventId?: string;
  responseId?: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  link?: string;
  read: boolean;
  createdAt: TimestampLike;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantLabels: Record<string, string>;
  rfqId?: string;
  supplierId?: string;
  lastMessage?: string;
  lastMessageAt?: TimestampLike;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readBy: string[];
  attachmentStatus: "upload_pending_launch";
  createdAt: TimestampLike;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  ownerUserId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  categoryId: string;
  type: "product" | "service";
  status: "draft" | "active" | "archived";
  mediaStatus: "upload_pending_launch";
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface SupplierDocumentMetadata {
  id: string;
  supplierId: string;
  ownerUserId: string;
  name: string;
  documentType: string;
  description?: string;
  certificateNumber?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: "unverified" | "pending_review" | "verified" | "rejected";
  storageStatus: "metadata_only" | "upload_pending_launch";
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface ContentPageRecord {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  contentAr: string;
  contentEn: string;
  status: "draft" | "published";
  metaTitleAr?: string;
  metaTitleEn?: string;
  metaDescriptionAr?: string;
  metaDescriptionEn?: string;
  order: number;
  updatedBy: string;
  updatedAt: TimestampLike;
}

export interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  introAr: string;
  introEn: string;
  assetUploadStatus: "upload_pending_launch";
  updatedAt?: TimestampLike;
  updatedBy?: string;
}

export interface AdminOperationsSettings {
  reviewNotifications: boolean;
  showIncompleteSuppliers: boolean;
  requireDuplicateReason: boolean;
  dictionarySuggestionMinimum: number;
  updatedAt?: TimestampLike;
  updatedBy?: string;
}

export interface RegistrationSector {
  value: string;
  labelAr: string;
  labelEn: string;
  order: number;
  active: boolean;
}

export interface OperationalReport {
  users: number;
  buyers: number;
  supplierAccounts: number;
  approvedSuppliers: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  accessGrants: number;
  pendingTerms: number;
  reviews: number;
  feedback: number;
}
