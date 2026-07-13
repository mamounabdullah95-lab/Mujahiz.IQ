import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, LogIn, ShoppingCart, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button, SelectField, TextAreaField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { labelFor } from "../data/constants";
import { defaultRegistrationSectors } from "../data/registrationSectors";
import { listRegistrationSectors } from "../services/workspace";
import type { RegistrationSector } from "../types/workspace";
import { friendlyAuthError, isValidEmailAddress, isValidIraqiPhone } from "../utils/accountValidation";

type AccountTypeChoice = "buyer" | "supplier";

const copy = {
  ar: {
    pageDescription: "اختر نوع الحساب المناسب. المشتري يبحث عن المجهزين ويدير طلبات الشراء، والمجهز يسجل شركته ويستقبل فرص التوريد بعد اعتماد ملفها.",
    buyerTitle: "أنا مشتري", buyerBody: "أبحث عن مجهزين، أقارن الخيارات، وأدير احتياجات الشراء.",
    supplierTitle: "أنا مجهز", supplierBody: "أريد تسجيل شركتي والظهور للمشترين واستقبال طلبات جادة.",
    buyerName: "اسم المستخدم الكامل", supplierName: "اسم الشخص المخول", buyerOrg: "الشركة / المؤسسة", supplierOrg: "اسم الشركة المجهزة", buyerJob: "المسمى الوظيفي", supplierJob: "صفة الشخص المخول", buyerSector: "مجال المشتريات / القطاع", supplierSector: "قطاع عمل الشركة", buyerReason: "سبب الانضمام", supplierReason: "نبذة عن الشركة وسبب الانضمام", otherSector: "اكتب القطاع الآخر", verifyNote: "بعد إنشاء الحساب سنرسل رسالة تفعيل إلى بريدك. تبدأ الأيام الثلاثة المجانية بعد التفعيل.",
  },
  en: {
    pageDescription: "Choose the right account. Buyers discover suppliers and manage procurement needs; suppliers register a company and receive sourcing opportunities after profile approval.",
    buyerTitle: "I am a Buyer", buyerBody: "I discover suppliers, compare options, and manage procurement needs.",
    supplierTitle: "I am a Supplier", supplierBody: "I want to register my company and receive serious sourcing opportunities.",
    buyerName: "Full Name", supplierName: "Authorized Person Name", buyerOrg: "Company / Organization", supplierOrg: "Supplier Company Name", buyerJob: "Job Title", supplierJob: "Authorized Person Role", buyerSector: "Procurement Field / Sector", supplierSector: "Company Business Sector", buyerReason: "Reason for Joining", supplierReason: "Company Summary and Reason for Joining", otherSector: "Enter the other sector", verifyNote: "A verification email will be sent after registration. The three-day free period starts after verification.",
  },
};

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" as const : "en" as const;
  const text = copy[locale];
  const { register } = useAuth();
  const { taxonomy } = useTaxonomy();
  const navigate = useNavigate();
  const [sectors, setSectors] = useState<RegistrationSector[]>(() =>
    defaultRegistrationSectors.filter((item) => item.active).sort((a, b) => a.order - b.order),
  );
  const [form, setForm] = useState({ accountType: "buyer" as AccountTypeChoice, email: "", password: "", fullName: "", phone: "", jobTitle: "", organization: "", governorate: "", city: "", sector: "", otherSector: "", reasonForJoining: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void listRegistrationSectors().then((items) => {
      if (items.length) setSectors(items);
    });
  }, []);
  const isSupplier = form.accountType === "supplier";
  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!isValidEmailAddress(form.email)) { setError(friendlyAuthError(Object.assign(new Error("invalid_email"), { code: "invalid_email" }), locale)); return; }
    if (!isValidIraqiPhone(form.phone)) { setError(friendlyAuthError(Object.assign(new Error("invalid_phone"), { code: "invalid_phone" }), locale)); return; }
    if (form.sector === "other" && !form.otherSector.trim()) { setError(locale === "ar" ? "اكتب اسم القطاع الآخر." : "Enter the other sector."); return; }
    setBusy(true);
    try { await register({ ...form, language: locale }); sessionStorage.setItem("mujahiz-iq-registration-success", "1"); navigate("/verify-email"); }
    catch (reason) { setError(friendlyAuthError(reason, locale)); }
    finally { setBusy(false); }
  }
  const setValue = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <PublicAuthShell title={t("register")} description={text.pageDescription} size="wide"><form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
    <div className="grid gap-3 md:grid-cols-2">{(["buyer", "supplier"] as const).map((type) => { const selected = form.accountType === type; const Icon = type === "buyer" ? ShoppingCart : Building2; return <button className={`rounded-[16px] border p-4 text-start transition ${selected ? "border-amber bg-cream shadow-card" : "border-borderSoft bg-white hover:border-amber/60"}`} type="button" onClick={() => setValue("accountType", type)} key={type}><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white"><Icon className="h-5 w-5" /></span><span className="text-lg font-black text-ink">{type === "buyer" ? text.buyerTitle : text.supplierTitle}</span></div><p className="mt-2 text-sm font-medium leading-7 text-muted">{type === "buyer" ? text.buyerBody : text.supplierBody}</p></button>; })}</div>
    <div className="grid gap-4 md:grid-cols-2">
      <TextField label={isSupplier ? text.supplierName : text.buyerName} value={form.fullName} onChange={(event) => setValue("fullName", event.target.value)} required />
      <TextField label={t("email")} value={form.email} onChange={(event) => setValue("email", event.target.value)} type="email" autoComplete="email" placeholder="name@company.com" required />
      <TextField label={t("password")} value={form.password} onChange={(event) => setValue("password", event.target.value)} type="password" autoComplete="new-password" minLength={8} required />
      <TextField label={t("phone")} value={form.phone} onChange={(event) => setValue("phone", event.target.value)} inputMode="tel" placeholder="07812345678" required />
      <TextField label={isSupplier ? text.supplierOrg : text.buyerOrg} value={form.organization} onChange={(event) => setValue("organization", event.target.value)} required />
      <TextField label={isSupplier ? text.supplierJob : text.buyerJob} value={form.jobTitle} onChange={(event) => setValue("jobTitle", event.target.value)} required />
      <SelectField label={t("governorate")} value={form.governorate} onChange={(event) => setValue("governorate", event.target.value)} required><option value="">{t("governoratePlaceholder")}</option>{taxonomy.governorates.map((item) => <option key={item.value} value={item.value}>{labelFor(taxonomy.governorates, item.value, locale)}</option>)}</SelectField>
      <TextField label={t("city")} value={form.city} onChange={(event) => setValue("city", event.target.value)} />
      <SelectField className="md:col-span-2" label={isSupplier ? text.supplierSector : text.buyerSector} value={form.sector} onChange={(event) => setValue("sector", event.target.value)} required><option value="">{t("sectorPlaceholder")}</option>{sectors.map((item) => <option key={item.value} value={item.value}>{locale === "ar" ? item.labelAr : item.labelEn}</option>)}</SelectField>
      {form.sector === "other" ? <TextField className="md:col-span-2" label={text.otherSector} value={form.otherSector} onChange={(event) => setValue("otherSector", event.target.value)} required /> : null}
      <TextAreaField className="md:col-span-2" label={isSupplier ? text.supplierReason : text.buyerReason} value={form.reasonForJoining} onChange={(event) => setValue("reasonForJoining", event.target.value)} maxLength={1000} />
    </div>
    <div className="rounded-xl border border-amber/30 bg-cream p-3 text-sm font-bold leading-6 text-ink">{text.verifyNote}</div>
    {error ? <div className="rounded-xl border border-clay/30 bg-clay/10 px-3 py-2 text-sm font-bold text-clay" role="alert">{error}</div> : null}
    <div className="flex flex-col gap-3 border-t border-borderSoft pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm font-bold text-muted">{t("alreadyHaveAccount")} <Link className="inline-flex items-center gap-1 text-amber hover:text-ink" to="/login"><LogIn className="h-4 w-4" />{t("login")}</Link></div><Button className="sm:min-w-48" disabled={busy} type="submit"><UserPlus className="h-4 w-4" />{t("createAccount")}</Button></div>
  </form></PublicAuthShell>;
}
