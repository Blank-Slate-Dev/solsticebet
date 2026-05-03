// apps/demo-web/tailwind.config.ts

import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        solstice: {
          bg: '#0a0e1a',
          card: '#11172a',
          border: '#1c2438',
          accent: '#38d6e3',
          'accent-deep': '#1e4fbc',
          muted: '#7a8aa3',
          fg: '#e6edf7',
          win: '#34d399',
          loss: '#f87171',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
