import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Section, SelectField, TextAreaField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { labelFor } from "../data/constants";

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { register } = useAuth();
  const { taxonomy } = useTaxonomy();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    jobTitle: "",
    organization: "",
    governorate: "",
    city: "",
    sector: "",
    reasonForJoining: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({ ...form, language: locale });
      sessionStorage.setItem("mujahiz-iq-registration-success", "1");
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  const setValue = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Section title={t("register")} description={t("pendingApprovalBody")}>
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label={t("email")} value={form.email} onChange={(event) => setValue("email", event.target.value)} type="email" required />
          <TextField label={t("password")} value={form.password} onChange={(event) => setValue("password", event.target.value)} type="password" minLength={8} required />
          <TextField label={t("fullName")} value={form.fullName} onChange={(event) => setValue("fullName", event.target.value)} required />
          <TextField label={t("phone")} value={form.phone} onChange={(event) => setValue("phone", event.target.value)} required />
          <TextField label={t("jobTitle")} value={form.jobTitle} onChange={(event) => setValue("jobTitle", event.target.value)} required />
          <TextField label={t("organization")} value={form.organization} onChange={(event) => setValue("organization", event.target.value)} required />
          <SelectField label={t("governorate")} value={form.governorate} onChange={(event) => setValue("governorate", event.target.value)} required>
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
        {error ? <div className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</div> : null}
        <Button className="w-fit" disabled={busy} type="submit">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {t("createAccount")}
        </Button>
      </form>
    </Section>
  );
}
