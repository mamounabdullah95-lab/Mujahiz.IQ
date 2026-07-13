export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#0B2F4E",
                navy: "#062B4D",
                navy900: "#042542",
                river: "#083A62",
                mint: "#22A35A",
                successBg: "#DDF7E8",
                amber: "#F37021",
                golden: "#FF8A00",
                clay: "#D35400",
                cream: "#FFF6EA",
                creamLight: "#FFF9F1",
                borderSoft: "#EBDCCB",
                muted: "#64748B",
            },
            fontFamily: {
                sans: [
                    "Cairo",
                    "Tajawal",
                    "Inter",
                    "Noto Sans Arabic",
                    "system-ui",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "sans-serif",
                ],
            },
            boxShadow: {
                soft: "0 14px 40px rgba(6, 43, 77, 0.08)",
                card: "0 10px 28px rgba(6, 43, 77, 0.06)",
            },
        },
    },
    plugins: [],
};
