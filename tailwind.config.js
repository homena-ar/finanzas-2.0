/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
          '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif',
        ],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#6366f1',
        },
        accent: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          DEFAULT: '#8b5cf6',
        },
      },
      fontSize: {
        'page': ['1.375rem', { lineHeight: '1.75rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        'section': ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '600', letterSpacing: '-0.005em' }],
        'card-title': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        'stat-value': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        'stat-label': ['0.6875rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.03em' }],
      },
    },
  },
  plugins: [],
}
