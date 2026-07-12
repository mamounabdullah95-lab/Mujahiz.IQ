import { FileClock, FileUp, LockKeyhole, Trash2 } from "lucide-react";
import type { UploadPurpose } from "../services/uploadService";
import { uploadUnavailableMessage } from "../services/uploadService";

export function DisabledFileUpload({
  locale,
  purpose: _purpose,
  accepted = "PDF, JPG, PNG",
  maximumSize = "5 MB",
  compact = false,
}: {
  locale: "ar" | "en";
  purpose: UploadPurpose;
  accepted?: string;
  maximumSize?: string;
  compact?: boolean;
}) {
  const text = locale === "ar"
    ? {
        title: "رفع الملفات غير مفعّل مؤقتاً",
        choose: "اختيار ملف",
        waiting: "بانتظار التفعيل",
        formats: `الأنواع المقترحة: ${accepted}، والحد الأقصى: ${maximumSize}`,
        remove: "حذف من قائمة الاختيار",
      }
    : {
        title: "File uploads are temporarily disabled",
        choose: "Choose file",
        waiting: "Waiting for launch",
        formats: `Planned formats: ${accepted}; maximum size: ${maximumSize}`,
        remove: "Remove from selection",
      };

  return (
    <div className={`rounded-[14px] border border-dashed border-amber/45 bg-cream/70 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-col items-center justify-center text-center">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-amber shadow-card">
          <FileUp className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="mt-3 text-sm font-black text-ink">{text.title}</div>
        <p className="mt-1 max-w-2xl text-xs font-semibold leading-6 text-muted">{uploadUnavailableMessage[locale]}</p>
        <button className="mt-4 inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-xl border border-borderSoft bg-white px-4 text-sm font-bold text-muted opacity-70" type="button" disabled aria-disabled="true">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          {text.choose}
        </button>
        <div className="mt-3 text-[11px] font-semibold text-muted">{text.formats}</div>
      </div>
      {!compact ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-borderSoft bg-white/80 px-3 py-2 text-xs font-bold text-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-2"><FileClock className="h-4 w-4 text-amber" />{text.waiting}</span>
          <span className="inline-flex items-center gap-1 opacity-50"><Trash2 className="h-4 w-4" />{text.remove}</span>
        </div>
      ) : null}
    </div>
  );
}
