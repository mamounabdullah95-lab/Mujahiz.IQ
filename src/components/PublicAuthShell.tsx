import type { ReactNode } from "react";
import authIntroUrl from "../assets/brand/mujahiz-iq-auth-intro.png";
import brandLogoUrl from "../assets/brand/mujahiz-iq-brand-lockup-horizontal.png";
import heroImageUrl from "../assets/brand/mujahiz-iq-brand-hero.png";

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
  const isWide = size === "wide";
  const panelWidth = isWide ? "max-w-none" : "max-w-lg";

  return (
    <section className="relative isolate overflow-hidden border-b border-orange-100 bg-[#fff7ec]">
      <img className="absolute inset-0 -z-20 h-full w-full object-cover object-left-bottom opacity-90" src={heroImageUrl} alt="" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,247,236,0.92)_0%,rgba(255,247,236,0.82)_42%,rgba(255,250,244,0.96)_100%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(255,107,0,0.12),transparent_58%)] lg:block" />
      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl content-center px-4 py-10 sm:px-6 lg:px-8">
        <div className={`mx-auto grid w-full gap-6 ${isWide ? "max-w-7xl lg:grid-cols-[0.9fr_1.25fr] lg:items-center" : "max-w-4xl"}`}>
          {isWide ? (
            <aside className="hidden rounded-md border border-orange-100 bg-white/78 p-3 shadow-soft backdrop-blur-sm lg:block">
              <img className="h-full max-h-[38rem] w-full rounded-md object-contain" src={authIntroUrl} alt="" />
            </aside>
          ) : null}
          <div className="w-full">
            <div className="mx-auto w-full max-w-4xl text-center">
              <img className="mx-auto h-16 w-auto sm:h-20" src={brandLogoUrl} alt="Mujahiz IQ" />
              <div className="mx-auto mt-5 h-px max-w-sm bg-gradient-to-r from-transparent via-amber/50 to-transparent" />
              <h1 className="mt-6 text-3xl font-black text-ink sm:text-4xl">{title}</h1>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-slate-600">{description}</p>
            </div>
            <div className={`mx-auto mt-8 w-full ${panelWidth} rounded-md border border-orange-100 bg-white/92 p-5 shadow-soft backdrop-blur sm:p-6`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
