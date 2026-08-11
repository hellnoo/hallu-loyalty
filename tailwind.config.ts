import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm dark base — netral, dipakai semua brand
        'h-bg':     '#0c0a09',
        'h-dark':   '#141010',
        'h-card':   '#1b1614',
        'h-border': '#2c2422',
        // Warna brand — dari CSS variable, diisi per outlet lewat
        // NEXT_PUBLIC_BRAND_COLOR / _ACCENT (lihat layout.tsx & lib/brand.ts).
        // Format "R G B" + <alpha-value> supaya modifier opacity Tailwind
        // (mis. bg-h-red/10, border-h-red/40) tetap jalan.
        'h-red':    'rgb(var(--brand-primary) / <alpha-value>)',
        'h-red-d':  'rgb(var(--brand-primary-dark) / <alpha-value>)',
        'h-cream':  'rgb(var(--brand-accent) / <alpha-value>)',
        'h-muted':  '#8a807a',
      },
      fontFamily: {
        sans:  ['var(--font-dm-sans)', 'sans-serif'],
        serif: ['var(--font-playfair)', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
