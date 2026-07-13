import { Save } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicAuthShell } from "../components/PublicAuthShell";
import { Button, SelectField, TextField } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useTaxonomy } from "../contexts/TaxonomyContext";
import { labelFor } from "../data/constants";
import { listRegistrationSectors } from "../services/workspace";
import type { RegistrationSector } from "../types/workspace";
import { friendlyAuthError } from "../utils/accountValidation";

export function CompleteProfilePage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, appUser, completeMissingProfile } = useAuth();
  const { taxonomy } = useTaxonomy();
  const navigate = useNavigate();
  const [sectors, setSectors] = useState<RegistrationSector[]>([]);
  const [form, setForm] = useState({ accountType: "buyer" as "buyer" | "supplier", fullName: firebaseUser?.displayName || "", phone: "", jobTitle: "", organization: "", governorate: "", city: "", sector: "", otherSector: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void listRegistrationSectors().then(setSectors); }, []);
  useEffect(() => { if (appUser) navigate("/verify-email", { replace: true }); }, [appUser, navigate]);
  const text = locale === "ar" ? { title: "إكمال إعداد الحساب", description: "حساب تسجيل الدخول موجود، لكن ملف المنصة غير مكتمل. أكمل البيانات مرة واحدة دون إنشاء حساب جديد.", type: "نوع الحساب", buyer: "مشتري", supplier: "مجهز", name: "الاسم الكامل", phone: "رقم الهاتف العراقي", job: "المسمى الوظيفي", organization: "الشركة أو المؤسسة", governorate: "المحافظة", city: "المدينة", sector: "المجال أو القطاع", other: "اكتب القطاع", save: "حفظ وإرسال التفعيل" } : { title: "Complete account setup", description: "The sign-in account exists, but its platform profile is incomplete. Finish these details once without registering again.", type: "Account type", buyer: "Buyer", supplier: "Supplier", name: "Full name", phone: "Iraqi phone number", job: "Job title", organization: "Company or organization", governorate: "Governorate", city: "City", sector: "Field or sector", other: "Enter sector", save: "Save and send verification" };
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await completeMissingProfile({ ...form, language: locale, reasonForJoining: "" }); navigate("/verify-email"); } catch (reason) { setError(friendlyAuthError(reason, locale)); } finally { setBusy(false); } }
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <PublicAuthShell title={text.title} description={text.description} size="wide"><form className="grid gap-4" onSubmit={(event) => void submit(event)}><div className="grid gap-4 sm:grid-cols-2"><SelectField label={text.type} value={form.accountType} onChange={(event) => set("accountType", event.target.value)}><option value="buyer">{text.buyer}</option><option value="supplier">{text.supplier}</option></SelectField><TextField label={text.name} value={form.fullName} onChange={(event) => set("fullName", event.target.value)} required /><TextField label={text.phone} value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="07812345678" required /><TextField label={text.job} value={form.jobTitle} onChange={(event) => set("jobTitle", event.target.value)} required /><TextField label={text.organization} value={form.organization} onChange={(event) => set("organization", event.target.value)} required /><SelectField label={text.governorate} value={form.governorate} onChange={(event) => set("governorate", event.target.value)} required><option value="">—</option>{taxonomy.governorates.map((item) => <option key={item.value} value={item.value}>{labelFor(taxonomy.governorates, item.value, locale)}</option>)}</SelectField><TextField label={text.city} value={form.city} onChange={(event) => set("city", event.target.value)} /><SelectField label={text.sector} value={form.sector} onChange={(event) => set("sector", event.target.value)} required><option value="">—</option>{sectors.map((item) => <option key={item.value} value={item.value}>{locale === "ar" ? item.labelAr : item.labelEn}</option>)}</SelectField>{form.sector === "other" ? <TextField label={text.other} value={form.otherSector} onChange={(event) => set("otherSector", event.target.value)} required /> : null}</div>{error ? <div className="rounded-xl bg-clay/10 p-3 text-sm font-bold text-clay">{error}</div> : null}<Button disabled={busy} type="submit"><Save className="h-4 w-4" />{text.save}</Button></form></PublicAuthShell>;
}
