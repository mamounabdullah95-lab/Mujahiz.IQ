var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import siteSettings from "./site.config.json";
var publicRoutes = [
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
var siteTitle = "Mujahiz IQ";
var siteDescription = "Mujahiz IQ is a private supplier intelligence platform for procurement professionals in Iraq.";
function normalizeOrigin(value) {
    return value.trim().replace(/\/+$/, "");
}
function siteMetadataPlugin(primaryUrl) {
    var canonicalUrl = "".concat(primaryUrl, "/");
    return {
        name: "mujahiz-site-metadata",
        transformIndexHtml: function () {
            return [
                { tag: "link", attrs: { rel: "canonical", href: canonicalUrl }, injectTo: "head" },
                { tag: "meta", attrs: { property: "og:type", content: "website" }, injectTo: "head" },
                { tag: "meta", attrs: { property: "og:site_name", content: siteTitle }, injectTo: "head" },
                { tag: "meta", attrs: { property: "og:title", content: siteTitle }, injectTo: "head" },
                { tag: "meta", attrs: { property: "og:description", content: siteDescription }, injectTo: "head" },
                { tag: "meta", attrs: { property: "og:url", content: canonicalUrl }, injectTo: "head" },
            ];
        },
        generateBundle: function () {
            var sitemap = __spreadArray(__spreadArray([
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            ], publicRoutes.map(function (route) { return "  <url><loc>".concat(new URL(route, "".concat(primaryUrl, "/")).toString(), "</loc></url>"); }), true), [
                "</urlset>",
                "",
            ], false).join("\n");
            var robots = [
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
                "Sitemap: ".concat(primaryUrl, "/sitemap.xml"),
                "",
            ].join("\n");
            this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
            this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
        },
    };
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, ".", "");
    var primaryUrl = normalizeOrigin(env.VITE_PUBLIC_SITE_URL || siteSettings.primaryUrl);
    return {
        plugins: [react(), siteMetadataPlugin(primaryUrl)],
        build: {
            rollupOptions: {
                output: {
                    manualChunks: function (id) {
                        if (!id.includes("node_modules"))
                            return undefined;
                        if (id.includes("@firebase/ai") || id.includes("/firebase/ai"))
                            return "firebase-ai";
                        if (id.includes("@firebase/app-check") || id.includes("/firebase/app-check"))
                            return "firebase-app-check";
                        if (id.includes("@firebase/") || id.includes("/firebase/"))
                            return "firebase";
                        if (id.includes("react-router"))
                            return "react-router";
                        if (id.includes("react-dom") || id.includes("/react/"))
                            return "react";
                        if (id.includes("i18next"))
                            return "i18n";
                        if (id.includes("lucide-react"))
                            return "icons";
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
