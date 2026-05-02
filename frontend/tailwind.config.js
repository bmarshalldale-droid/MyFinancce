/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cabinet Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        bone: '#F5F4F0',
        surface: '#FFFFFF',
        'surface-alt': '#F0EFEA',
        ink: '#1C1B1A',
        muted: '#7A7873',
        line: '#EAE8E3',
        terracotta: { DEFAULT: '#D1603D', dark: '#B85334' },
        moss: { DEFAULT: '#4A6B5D', dark: '#3C574B' },
        ochre: '#E8A365',
        clay: '#C44D42',
        warning: '#D9943B',
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
