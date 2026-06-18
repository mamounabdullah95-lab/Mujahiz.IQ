import { Link } from "react-router-dom";
import { ClipboardPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Section } from "../components/ui";

export function PendingApprovalPage() {
  const { t } = useTranslation();
  return (
    <Section title={t("pendingApprovalTitle")} description={t("pendingApprovalBody")}>
      <div className="flex flex-wrap gap-3">
        <Link to="/suppliers/new">
          <Button>
            <ClipboardPlus className="h-4 w-4" aria-hidden="true" />
            {t("addSupplier")}
          </Button>
        </Link>
        <Link to="/my-submissions">
          <Button variant="secondary">{t("mySubmissions")}</Button>
        </Link>
      </div>
    </Section>
  );
}
