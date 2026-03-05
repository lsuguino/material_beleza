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
        display: ['var(--font-lexend)', 'Lexend', 'system-ui', 'sans-serif'],
        body: ['var(--font-lexend)', 'Lexend', 'system-ui', 'sans-serif'],
        lexend: ['Lexend', 'system-ui', 'sans-serif'],
        material: ['var(--font-material-serif)', 'Georgia', 'serif'],
        sora: ['var(--font-sora)', 'Sora', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#006eff',
        navy: '#0f1823',
        'background-light': '#f5f7f8',
        'background-dark': '#0f1823',
        'surface-dark': '#1E293B',
        'border-dark': '#334155',
        'neutral-cream': '#f7f3f0',
        ink: '#0f0f0f',
        paper: '#F9FAFB',
        accent: '#006eff',
        mute: '#6b6b6b',
        'book-cream': '#f8f6f2',
        'book-blue': '#1e3a5f',
        'book-blue-light': '#2d4a6f',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
