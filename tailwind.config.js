/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  safelist: [
    'bg-[#1164A3]',
    'bg-purple-900/40',
    'text-white'
  ],
  plugins: [],
}