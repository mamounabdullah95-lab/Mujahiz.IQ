import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import logoLockupUrl from "../assets/identity/logo-lockup.png";

export function PublicAuthShell({
  title,
  description,
  children,
  size = "narrow",
}: {
  title: string;
  description: string;
  children: ReactNode;
  size?: "narrow" | "wide";
}) {
  const { t } = useTranslation();
  const isWide = size === "wide";
  const panelWidth = isWide ? "max-w-4xl" : "max-w-2xl";

  return (
    <section className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden border-b border-borderSoft bg-creamLight">
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_18%_12%,rgba(243,112,33,0.08),transparent_24rem),radial-gradient(circle_at_82%_32%,rgba(6,43,77,0.035),transparent_28rem),linear-gradient(180deg,#fff9f1_0%,#fff6ea_100%)]" />
      <div className="absolute left-12 top-24 -z-20 hidden h-72 w-72 rounded-full border border-amber/10 lg:block" />
      <div className="absolute bottom-10 right-16 -z-20 hidden h-56 w-56 rounded-full border border-borderSoft/70 lg:block" />

      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl content-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl text-center">
          <img className="mx-auto h-24 w-auto object-contain sm:h-28" src={logoLockupUrl} alt={t("appName")} />
          <p className="mt-4 text-2xl font-black text-amber sm:text-3xl">{t("homepageSlogan")}</p>
          <h1 className="mt-7 text-3xl font-black text-ink sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-3xl text-base font-medium leading-8 text-ink/72">{description}</p>
        </div>

        <div className={`mx-auto mt-7 w-full ${panelWidth} rounded-[24px] border border-borderSoft bg-white/92 p-5 shadow-soft backdrop-blur sm:p-7`}>
          {children}
        </div>
      </div>
    </section>
  );
}
