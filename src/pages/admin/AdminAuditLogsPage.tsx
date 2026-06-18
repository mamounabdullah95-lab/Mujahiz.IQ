import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState, Section } from "../../components/ui";
import { listAuditLogs } from "../../services/firestore";
import type { AuditLog } from "../../types/domain";
import { formatDate } from "../../utils/date";

export function AdminAuditLogsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    void listAuditLogs().then(setLogs);
  }, []);

  return (
    <Section title={t("auditLogs")} description={t("adminOnly")}>
      {!logs.length ? <EmptyState title={t("noResults")} /> : null}
      <div className="grid gap-2">
        {logs.map((log) => (
          <div className="rounded-md border border-slate-200 p-3 text-sm" key={log.id}>
            <div className="font-bold text-ink">{t(`audit_${log.action.replaceAll(".", "_")}`, { defaultValue: log.action })}</div>
            <div className="text-slate-500">{t(`target_${log.targetType}`, { defaultValue: log.targetType })}/{log.targetId} · {formatDate(log.createdAt, locale)}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

