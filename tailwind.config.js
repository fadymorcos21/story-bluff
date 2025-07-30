/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"], // ✅ Good
  presets: [require("nativewind/preset")],
  darkMode: "class", // ✅ Add this line to fix the crash
  theme: {
    extend: {},
  },
  plugins: [],
};
