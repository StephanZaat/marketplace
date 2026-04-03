/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          50:  "#eef5fc",
          100: "#d5e8f8",
          200: "#aad1f1",
          300: "#7ab8e8",
          400: "#5aa1e3",
          500: "#418FDE",
          600: "#2d7ac8",
          700: "#2363a3",
          800: "#1b4d7e",
          900: "#133a5e",
        },
        sand: {
          50:  "#fffde6",
          100: "#fff8c0",
          200: "#fff085",
          300: "#FFD200",
          400: "#FFD200",
          500: "#FFD200",
          600: "#ccaa00",
          700: "#997f00",
          800: "#665500",
          900: "#332a00",
        },
        aruba: {
          red: "#C8102E",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
