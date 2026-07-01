import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#06284f",
        river: "#0b4778",
        mint: "#16a34a",
        amber: "#ff6b00",
        clay: "#c94f17",
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
        soft: "0 18px 45px -30px rgba(6, 40, 79, 0.36)",
      },
    },
  },
  plugins: [],
} satisfies Config;
