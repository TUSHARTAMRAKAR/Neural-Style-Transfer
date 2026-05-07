/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",   // enables dark mode via .dark class on <html>
  theme: {
    extend: {
      // ── Wildflowers palette from the user's image ──────────────
      colors: {
        sage:    { DEFAULT: "#A8DCAB", light: "#C8EDCB", dark: "#7BB87E" },
        forest:  { DEFAULT: "#519755", light: "#6DB371", dark: "#3A7040" },
        rose:    { DEFAULT: "#DBAAA7", light: "#EDC8C6", dark: "#C08A87" },
        mauve:   { DEFAULT: "#BE91BE", light: "#D4B0D4", dark: "#9E6F9E" },
      },
      fontFamily: {
        // Claude uses "Styrene B" for headings and "Inter" for body
        // We import both via Google Fonts approximation + system stack
        sans:    ["'Inter'", "system-ui", "-apple-system", "sans-serif"],
        display: ["'Playfair Display'", "Georgia", "serif"],  // closest to Styrene B feel
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      animation: {
        "spin-slow":   "spin 3s linear infinite",
        "pulse-fast":  "pulse 1s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in":     "fadeIn 0.3s ease-in-out",
        "slide-up":    "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { transform: "translateY(8px)", opacity: 0 }, "100%": { transform: "translateY(0)", opacity: 1 } },
      },
    },
  },
  plugins: [],
};
