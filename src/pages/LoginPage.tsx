import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Button, Section, TextField } from "../components/ui";

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t("login")} description={t("tagline")}>
      <form className="mx-auto grid max-w-md gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <TextField label={t("email")} value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        <TextField label={t("password")} value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        {error ? <div className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</div> : null}
        <Button disabled={busy} type="submit">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {t("login")}
        </Button>
        <Link className="text-center text-sm font-semibold text-river hover:text-ink" to="/register">
          {t("register")}
        </Link>
      </form>
    </Section>
  );
}
