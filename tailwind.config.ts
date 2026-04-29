import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--accent)',

        background: 'var(--bg)',
        foreground: 'var(--text-1)',

        primary: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          border: 'var(--accent-border)',
        },

        muted: 'var(--surface-2)',
        'muted-foreground': 'var(--text-2)',

        card: 'var(--surface)',
        popover: 'var(--surface)',

        destructive: 'var(--red)',
      },
    },
  },
  plugins: [],
}

export default config