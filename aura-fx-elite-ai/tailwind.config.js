/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0B0F1A",
        panel: "#121826",
        edge: "#1E2A3F",
        gold: "#D4AF37",
        skyblue: "#3B82F6"
      }
    }
  },
  plugins: []
};
