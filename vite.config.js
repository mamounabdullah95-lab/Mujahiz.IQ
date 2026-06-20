import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
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
});
