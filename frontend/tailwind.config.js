/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        ios: {
          /* ← fondo general de la app (crema cálido Ñandé) */
          bg: "#FDF6EE",
          card: "#ffffff",
          border: "rgba(60,60,67,0.12)",
          label: "#3c3c43",
          secondary: "rgba(60,60,67,0.6)",
          tertiary: "rgba(60,60,67,0.3)",
          /* ← naranja principal de la marca */
          blue: "#D4621A",
          green: "#34C759",
          red: "#FF3B30",
          /* ← naranja claro */
          orange: "#D4621A",
          gray5: "#FEF3E8",     /* ← naranja muy claro (reemplaza el gris 5) */
          gray6: "#FDF6EE",     /* ← crema (reemplaza el gris 6) */
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
