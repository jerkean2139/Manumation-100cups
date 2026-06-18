/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // A calm, intelligent palette — not a dashboard.
        ink: "#1c1a17",
        canvas: "#f7f5f0",
        paper: "#ffffff",
        sand: "#ebe7df",
        clay: "#c2603f",
        sage: "#5b7159",
        muted: "#8a857b",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 3px rgba(28,26,23,0.06), 0 8px 24px rgba(28,26,23,0.04)",
      },
    },
  },
  plugins: [],
};
