/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        ios: {
          bg: "#f2f2f7",
          card: "#ffffff",
          border: "rgba(60,60,67,0.12)",
          label: "#3c3c43",
          secondary: "rgba(60,60,67,0.6)",
          tertiary: "rgba(60,60,67,0.3)",
          blue: "#007AFF",
          green: "#34C759",
          red: "#FF3B30",
          orange: "#FF9500",
          gray5: "#e5e5ea",
          gray6: "#f2f2f7",
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
