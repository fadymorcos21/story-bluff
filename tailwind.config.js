/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"], // 👈 this includes index.jsx
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
