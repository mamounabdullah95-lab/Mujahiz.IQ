import { FormEvent, useState } from "react";
import { Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Section, SelectField, TextAreaField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { labelFor } from "../data/constants";

export function ProfileSettingsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { appUser, updateProfile } = useAuth();
  const { taxonomy } = useTaxonomy();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    fullName: appUser?.fullName || "",
    phone: appUser?.phone || "",
    jobTitle: appUser?.jobTitle || "",
    organization: appUser?.organization || "",
    governorate: appUser?.governorate || "",
    city: appUser?.city || "",
    sector: appUser?.sector || "",
    reasonForJoining: appUser?.reasonForJoining || "",
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await updateProfile(form);
    setMessage(t("saved"));
  }

  const setValue = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Section title={t("profile")} description={t("completeProfile")}>
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label={t("fullName")} value={form.fullName} onChange={(event) => setValue("fullName", event.target.value)} required />
          <TextField label={t("phone")} value={form.phone} onChange={(event) => setValue("phone", event.target.value)} required />
          <TextField label={t("jobTitle")} value={form.jobTitle} onChange={(event) => setValue("jobTitle", event.target.value)} required />
          <TextField label={t("organization")} value={form.organization} onChange={(event) => setValue("organization", event.target.value)} required />
          <SelectField label={t("governorate")} value={form.governorate} onChange={(event) => setValue("governorate", event.target.value)}>
            <option value=""></option>
            {taxonomy.governorates.map((item) => (
              <option key={item.value} value={item.value}>
                {labelFor(taxonomy.governorates, item.value, locale)}
              </option>
            ))}
          </SelectField>
          <TextField label={t("city")} value={form.city} onChange={(event) => setValue("city", event.target.value)} />
          <TextField label={t("sector")} value={form.sector} onChange={(event) => setValue("sector", event.target.value)} required />
          <TextAreaField label={t("reasonForJoining")} value={form.reasonForJoining} onChange={(event) => setValue("reasonForJoining", event.target.value)} />
        </div>
        {message ? <div className="text-sm font-semibold text-mint">{message}</div> : null}
        <Button className="w-fit" type="submit">
          <Save className="h-4 w-4" aria-hidden="true" />
          {t("save")}
        </Button>
      </form>
    </Section>
  );
}
