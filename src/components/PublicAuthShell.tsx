import type { ReactNode } from "react";
import brandLogoUrl from "../assets/brand/mujahiz-iq-logo-horizontal-final.svg";
import heroImageUrl from "../assets/brand/mujahiz-iq-login-hero-1920x1080.png";

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
  const panelWidth = size === "wide" ? "max-w-4xl" : "max-w-lg";

  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200 bg-[#f7fbfc]">
      <img className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25" src={heroImageUrl} alt="" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(247,251,252,0.98)_0%,rgba(247,251,252,0.9)_46%,rgba(255,255,255,0.68)_100%)]" />
      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl content-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl text-center">
          <img className="mx-auto h-20 w-auto sm:h-24" src={brandLogoUrl} alt="Mujahiz IQ" />
          <h1 className="mt-6 text-3xl font-black text-ink sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-slate-600">{description}</p>
        </div>
        <div className={`mx-auto mt-8 w-full ${panelWidth} rounded-md border border-slate-200 bg-white/95 p-5 shadow-soft backdrop-blur sm:p-6`}>
          {children}
        </div>
      </div>
    </section>
  );
}
