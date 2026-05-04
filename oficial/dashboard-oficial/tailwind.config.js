/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mapeo a CSS vars definidas en src/styles/tokens.css.
        'oficial-bg': 'var(--color-bg-page)',
        'oficial-card': 'var(--color-bg-card)',
        'oficial-text': 'var(--color-text-primary)',
        'oficial-text-secondary': 'var(--color-text-secondary)',
        'oficial-border': 'var(--color-border)',
        'oficial-blue': 'var(--color-accent-blue)',
        'oficial-red': 'var(--color-accent-red)',
        'oficial-green': 'var(--color-accent-green)',
        'oficial-yellow': 'var(--color-accent-yellow)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
