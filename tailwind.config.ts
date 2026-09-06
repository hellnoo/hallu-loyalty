import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Sudut membulat ikut tema (Papan Pasar tajam, Serat Daun sangat bulat).
      // Nilainya dari CSS variable — lihat lib/themes.ts & layout.tsx.
      borderRadius: {
        lg:    'var(--r-lg, 0.5rem)',
        xl:    'var(--r-xl, 0.75rem)',
        '2xl': 'var(--r-2xl, 1rem)',
      },
      colors: {
        // Permukaan — dari CSS variable supaya bisa diganti per outlet lewat
        // tema (lib/themes.ts). Nilai bawaan = tema "Gelap", sama persis dengan
        // warna lama, jadi outlet yang belum memilih tema tidak berubah.
        'h-bg':     'rgb(var(--surface-bg)     / <alpha-value>)',
        'h-dark':   'rgb(var(--surface-dark)   / <alpha-value>)',
        'h-card':   'rgb(var(--surface-card)   / <alpha-value>)',
        'h-border': 'rgb(var(--surface-border) / <alpha-value>)',
        // Teks utama: putih di tema gelap, hampir hitam di tema terang.
        'h-fg':     'rgb(var(--surface-fg)     / <alpha-value>)',
        // Teks DI ATAS warna brand (tombol) — selalu terang, tidak ikut tema,
        // karena warna brand selalu pekat. Kalau ini ikut tema, tombol jadi
        // teks gelap di atas latar gelap = tidak terbaca.
        'h-onbrand': '#ffffff',
        // Aksen SEBAGAI TEKS. Di tema gelap = warna aksen (krem). Di tema
        // terang, aksen krem di atas latar putih tidak terbaca, jadi tema
        // terang mengarahkannya ke warna brand yang pekat (lihat themes.ts).
        'h-accent': 'rgb(var(--accent-ink, var(--brand-accent)) / <alpha-value>)',
        // Warna brand — dari CSS variable, diisi per outlet lewat
        // NEXT_PUBLIC_BRAND_COLOR / _ACCENT (lihat layout.tsx & lib/brand.ts).
        // Format "R G B" + <alpha-value> supaya modifier opacity Tailwind
        // (mis. bg-h-red/10, border-h-red/40) tetap jalan.
        'h-red':    'rgb(var(--brand-primary) / <alpha-value>)',
        'h-red-d':  'rgb(var(--brand-primary-dark) / <alpha-value>)',
        'h-cream':  'rgb(var(--brand-accent) / <alpha-value>)',
        'h-muted':  'rgb(var(--surface-muted) / <alpha-value>)',
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
