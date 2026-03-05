import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Lexend', 'system-ui', 'sans-serif'],
        body: ['var(--font-display)', 'Lexend', 'system-ui', 'sans-serif'],
        material: ['var(--font-material-serif)', 'Georgia', 'serif'],
        sora: ['var(--font-sora)', 'Sora', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#135bec',
        'background-light': '#F9FAFB',
        'background-dark': '#0F172A',
        'surface-dark': '#1E293B',
        'border-dark': '#334155',
        'neutral-cream': '#f7f3f0',
        ink: '#0f0f0f',
        paper: '#F9FAFB',
        accent: '#135bec',
        mute: '#6b6b6b',
        /* Diagramação de livro (referência) */
        'book-cream': '#f8f6f2',
        'book-blue': '#1e3a5f',
        'book-blue-light': '#2d4a6f',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.5rem',
        xl: '1rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
