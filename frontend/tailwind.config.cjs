// frontend/tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        border: 'var(--border)',
        surface: 'var(--surface)',
        'surface-foreground': 'var(--surface-foreground)',
        'surface-muted': 'var(--surface-muted)',
        'surface-card': 'var(--surface-card)',
        'surface-border': 'var(--surface-border)',
      },
      fontFamily: {
        heading: ['var(--font-oswald)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}