import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import siteSettings from "./site.config.json";

const publicRoutes = [
  "/",
  "/about",
  "/suppliers",
  "/buyers",
  "/how-it-works",
  "/supplier-directory",
  "/contact",
  "/faq",
  "/resources",
  "/terms",
  "/privacy",
  "/security",
];

const siteTitle = "Mujahiz IQ";
const siteDescription = "Mujahiz IQ is a private supplier intelligence platform for procurement professionals in Iraq.";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function siteMetadataPlugin(primaryUrl: string): Plugin {
  const canonicalUrl = `${primaryUrl}/`;
  return {
    name: "mujahiz-site-metadata",
    transformIndexHtml() {
      return [
        { tag: "link", attrs: { rel: "canonical", href: canonicalUrl }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:type", content: "website" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:site_name", content: siteTitle }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:title", content: siteTitle }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:description", content: siteDescription }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:url", content: canonicalUrl }, injectTo: "head" },
      ];
    },
    generateBundle() {
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...publicRoutes.map((route) => `  <url><loc>${new URL(route, `${primaryUrl}/`).toString()}</loc></url>`),
        "</urlset>",
        "",
      ].join("\n");
      const robots = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /super-admin",
        "Disallow: /buyer",
        "Disallow: /supplier",
        "Disallow: /dashboard",
        "Disallow: /profile",
        "Disallow: /login",
        "Disallow: /register",
        "Disallow: /verify-email",
        "Disallow: /complete-profile",
        `Sitemap: ${primaryUrl}/sitemap.xml`,
        "",
      ].join("\n");
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const primaryUrl = normalizeOrigin(env.VITE_PUBLIC_SITE_URL || siteSettings.primaryUrl);
  return {
    plugins: [react(), siteMetadataPlugin(primaryUrl)],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@firebase/ai") || id.includes("/firebase/ai")) return "firebase-ai";
            if (id.includes("@firebase/app-check") || id.includes("/firebase/app-check")) return "firebase-app-check";
            if (id.includes("@firebase/") || id.includes("/firebase/")) return "firebase";
            if (id.includes("react-router")) return "react-router";
            if (id.includes("react-dom") || id.includes("/react/")) return "react";
            if (id.includes("i18next")) return "i18n";
            if (id.includes("lucide-react")) return "icons";
            return undefined;
          },
        },
      },
    },
    server: {
      watch: {
        ignored: ["**/.runtime/**"],
      },
      allowedHosts: [
        ".trycloudflare.com",
        ".loca.lt",
        "yards-matrix-jack-soft.trycloudflare.com",
      ],
    },
    preview: {
      allowedHosts: [
        ".trycloudflare.com",
        ".loca.lt",
        "yards-matrix-jack-soft.trycloudflare.com",
      ],
    },
  };
});
