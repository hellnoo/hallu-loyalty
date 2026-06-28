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
        // Warm dark base — terinspirasi logo maroon + cream
        'h-bg':     '#0c0a09',
        'h-dark':   '#141010',
        'h-card':   '#1b1614',
        'h-border': '#2c2422',
        // Brand maroon (fill: tombol, border, blok) — sesuai logo
        'h-red':    '#7C1515',
        'h-red-d':  '#5E0F0F',
        // Cream/gold accent (teks aksen, detail premium) — sesuai logo
        'h-cream':  '#D4B896',
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
