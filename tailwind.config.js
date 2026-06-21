export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                ink: "#061e46",
                river: "#00a7a7",
                mint: "#11c8d3",
                amber: "#e9a227",
                clay: "#b85c38",
            },
            fontFamily: {
                sans: [
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
                soft: "0 16px 40px -28px rgba(20, 33, 61, 0.35)",
            },
        },
    },
    plugins: [],
};
