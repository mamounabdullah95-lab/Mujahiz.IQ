import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, LogIn, ShoppingCart, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button, SelectField, TextAreaField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { labelFor } from "../data/constants";

type AccountTypeChoice = "buyer" | "supplier";

const copy = {
  ar: {
    pageDescription: "اختر نوع الحساب المناسب لك. حساب المشتري مخصص لفرق المشتريات والبحث عن المجهزين، وحساب المجهز مخصص للشركات التي تريد إنشاء ملف تجاري والظهور للمشترين.",
    buyerTitle: "أنا مشتري",
    buyerBody: "أبحث عن مجهزين، أقارن الخيارات، وأدير طلبات الشراء.",
    supplierTitle: "أنا مجهز",
    supplierBody: "أريد تسجيل شركتي والظهور للمشترين واستقبال فرص جادة.",
    buyerName: "اسم المستخدم الكامل",
    supplierName: "اسم الشخص المخول",
    buyerOrg: "الشركة / المؤسسة",
    supplierOrg: "اسم الشركة المجهزة",
    buyerJob: "المسمى الوظيفي",
    supplierJob: "صفة الشخص المخول",
    buyerSector: "مجال المشتريات / القطاع",
    supplierSector: "تخصص الشركة / المنتجات والخدمات",
    buyerReason: "سبب الانضمام",
    supplierReason: "نبذة عن الشركة وسبب الانضمام",
    buyerPlaceholder: "مثال: أعمل في المشتريات وأحتاج الوصول إلى مجهزين موثوقين...",
    supplierPlaceholder: "اكتب نبذة مختصرة عن نشاط الشركة، المنتجات أو الخدمات، ومناطق العمل...",
  },
  en: {
    pageDescription: "Choose the account path that fits you. Buyer accounts are for procurement teams searching for suppliers, while supplier accounts are for companies that want a business profile and buyer visibility.",
    buyerTitle: "I am a Buyer",
    buyerBody: "I search for suppliers, compare options, and manage purchasing needs.",
    supplierTitle: "I am a Supplier",
    supplierBody: "I want to register my company, appear to buyers, and receive serious opportunities.",
    buyerName: "Full Name",
    supplierName: "Authorized Person Name",
    buyerOrg: "Company / Organization",
    supplierOrg: "Supplier Company Name",
    buyerJob: "Job Title",
    supplierJob: "Authorized Person Role",
    buyerSector: "Procurement Field / Sector",
    supplierSector: "Company Specialty / Products & Services",
    buyerReason: "Reason for Joining",
    supplierReason: "Company Summary and Reason for Joining",
    buyerPlaceholder: "Example: I work in procurement and need access to trusted suppliers...",
    supplierPlaceholder: "Write a short summary of the company activity, products or services, and coverage areas...",
  },
};

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = copy[locale];
  const { register } = useAuth();
  const { taxonomy } = useTaxonomy();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    accountType: "buyer" as AccountTypeChoice,
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

  const isSupplier = form.accountType === "supplier";

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
  const selectAccountType = (accountType: AccountTypeChoice) => setForm((current) => ({ ...current, accountType }));

  return (
    <PublicAuthShell title={t("register")} description={text.pageDescription} size="wide">
      <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            className={`rounded-[18px] border p-4 text-start transition ${form.accountType === "buyer" ? "border-amber bg-cream shadow-card" : "border-borderSoft bg-white hover:border-amber/60"}`}
            type="button"
            onClick={() => selectAccountType("buyer")}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-white"><ShoppingCart className="h-5 w-5" aria-hidden="true" /></span>
              <span className="text-lg font-black text-ink">{text.buyerTitle}</span>
            </div>
            <p className="mt-2 text-sm font-medium leading-7 text-muted">{text.buyerBody}</p>
          </button>
          <button
            className={`rounded-[18px] border p-4 text-start transition ${form.accountType === "supplier" ? "border-amber bg-cream shadow-card" : "border-borderSoft bg-white hover:border-amber/60"}`}
            type="button"
            onClick={() => selectAccountType("supplier")}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-navy text-white"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
              <span className="text-lg font-black text-ink">{text.supplierTitle}</span>
            </div>
            <p className="mt-2 text-sm font-medium leading-7 text-muted">{text.supplierBody}</p>
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TextField label={isSupplier ? text.supplierName : text.buyerName} value={form.fullName} onChange={(event) => setValue("fullName", event.target.value)} placeholder={t("fullNamePlaceholder")} required />
          <TextField label={t("email")} value={form.email} onChange={(event) => setValue("email", event.target.value)} type="email" placeholder="name@company.com" required />
          <TextField label={t("password")} value={form.password} onChange={(event) => setValue("password", event.target.value)} type="password" minLength={8} placeholder={t("passwordPlaceholder")} required />
          <TextField label={t("phone")} value={form.phone} onChange={(event) => setValue("phone", event.target.value)} placeholder={t("phonePlaceholder")} required />
          <TextField label={isSupplier ? text.supplierOrg : text.buyerOrg} value={form.organization} onChange={(event) => setValue("organization", event.target.value)} placeholder={t("organizationPlaceholder")} required />
          <TextField label={isSupplier ? text.supplierJob : text.buyerJob} value={form.jobTitle} onChange={(event) => setValue("jobTitle", event.target.value)} placeholder={t("jobTitlePlaceholder")} required />
          <SelectField label={t("governorate")} value={form.governorate} onChange={(event) => setValue("governorate", event.target.value)} required>
            <option value="">{t("governoratePlaceholder")}</option>
            {taxonomy.governorates.map((item) => (
              <option key={item.value} value={item.value}>
                {labelFor(taxonomy.governorates, item.value, locale)}
              </option>
            ))}
          </SelectField>
          <TextField label={t("city")} value={form.city} onChange={(event) => setValue("city", event.target.value)} placeholder={t("cityPlaceholder")} />
          <TextField className="md:col-span-2" label={isSupplier ? text.supplierSector : text.buyerSector} value={form.sector} onChange={(event) => setValue("sector", event.target.value)} placeholder={t("sectorPlaceholder")} required />
          <TextAreaField className="md:col-span-2" label={isSupplier ? text.supplierReason : text.buyerReason} value={form.reasonForJoining} onChange={(event) => setValue("reasonForJoining", event.target.value)} placeholder={isSupplier ? text.supplierPlaceholder : text.buyerPlaceholder} />
        </div>
        {error ? <div className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-bold text-clay">{error}</div> : null}
        <div className="flex flex-col gap-3 border-t border-borderSoft pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-bold text-muted">
            {t("alreadyHaveAccount")} {" "}
            <Link className="inline-flex items-center gap-1 text-amber hover:text-ink" to="/login">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {t("login")}
            </Link>
          </div>
          <Button className="sm:min-w-48" disabled={busy} type="submit">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("createAccount")}
          </Button>
        </div>
      </form>
    </PublicAuthShell>
  );
}
