import type { ReactNode } from "react";
import brandLogoUrl from "../assets/brand/mujahiz-iq-logo-horizontal-final.svg";
import heroImageUrl from "../assets/brand/mujahiz-iq-login-hero-1920x1080.png";

export function PublicAuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200 bg-[#f7fbfc]">
      <img className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25" src={heroImageUrl} alt="" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(247,251,252,0.98)_0%,rgba(247,251,252,0.9)_46%,rgba(255,255,255,0.68)_100%)]" />
      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl content-center gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,480px)] lg:items-center">
          <div className="max-w-xl">
            <img className="h-20 w-auto sm:h-24" src={brandLogoUrl} alt="Mujahiz IQ" />
            <h1 className="mt-8 text-3xl font-black text-ink sm:text-4xl">{title}</h1>
            <p className="mt-4 text-base leading-8 text-slate-600">{description}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white/95 p-5 shadow-soft backdrop-blur sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
