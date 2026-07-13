import { features } from "../config/features";

export type UploadStatus = "waiting" | "uploading" | "uploaded" | "failed";

export type UploadPurpose =
  | "supplier_document"
  | "company_logo"
  | "product_media"
  | "rfq_attachment"
  | "message_attachment"
  | "support_attachment"
  | "branding_asset"
  | "content_asset"
  | "supplier_import";

export interface PendingUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  purpose: UploadPurpose;
  status: UploadStatus;
}

export const uploadUnavailableMessage = {
  ar: "رفع الملفات والمرفقات غير متاح حالياً، وسيتم تفعيله عند الإطلاق الرسمي للمنصة.",
  en: "File and attachment uploads are currently unavailable and will be enabled at the platform's official launch.",
} as const;

export class FileUploadsDisabledError extends Error {
  readonly code = "file_uploads_disabled";

  constructor(locale: "ar" | "en" = "en") {
    super(uploadUnavailableMessage[locale]);
    this.name = "FileUploadsDisabledError";
  }
}

export const uploadService = {
  isEnabled() {
    return features.fileUploads;
  },

  async upload(_file: File, _purpose: UploadPurpose, locale: "ar" | "en" = "en"): Promise<never> {
    if (!features.fileUploads) {
      throw new FileUploadsDisabledError(locale);
    }

    // No Storage adapter is bundled in this release. Enabling the flag alone must never upload data.
    throw new Error(locale === "ar" ? "خدمة التخزين غير مهيأة بعد." : "The storage service is not configured yet.");
  },
};
