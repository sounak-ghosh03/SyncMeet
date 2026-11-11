import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design tokens — dark-only theme (section 11.2 of the plan)
        // Using CSS variables so they can be read from both Tailwind and raw CSS.
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        danger: 'var(--danger)',
      },
    },
  },
  plugins: [],
} satisfies Config;

