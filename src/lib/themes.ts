// Tema tampilan halaman menu — dipilih per outlet dari Admin, tanpa deploy ulang.
//
// Cara kerjanya sama dengan warna brand: nilai token dikirim sebagai CSS variable
// dari layout.tsx, lalu Tailwind memakainya (lihat tailwind.config.ts). Jadi tidak
// ada layout yang digandakan — satu markup, banyak wajah.
//
// Nilai warna ditulis "R G B" (tanpa koma) supaya modifier opacity Tailwind
// seperti bg-h-card/40 tetap jalan.

export type ThemeKey = 'gelap' | 'kanvas' | 'pasar' | 'daun'

export type ThemeDef = {
  key: ThemeKey
  nama: string
  untuk: string        // ditampilkan di Admin sebagai panduan memilih
  terang: boolean      // dipakai UI Admin buat menandai tema latar terang
  vars: Record<string, string>
}

export const THEMES: ThemeDef[] = [
  {
    key: 'gelap',
    nama: 'Gelap',
    untuk: 'Kafe kopi, resto modern. Foto makanan terlihat paling pekat.',
    terang: false,
    vars: {
      '--surface-bg': '12 10 9',
      '--surface-dark': '20 16 16',
      '--surface-card': '27 22 20',
      '--surface-border': '44 36 34',
      '--surface-muted': '138 128 122',
      '--surface-fg': '255 255 255',
      '--accent-ink': 'var(--brand-accent)',
      '--r-lg': '0.5rem',
      '--r-xl': '0.75rem',
      '--r-2xl': '1rem',
    },
  },
  {
    key: 'kanvas',
    nama: 'Kanvas Putih',
    untuk: 'Specialty coffee, roastery. Paling ringan, tapi deskripsi menu harus digarap.',
    terang: true,
    vars: {
      '--surface-bg': '251 250 247',
      '--surface-dark': '243 241 236',
      '--surface-card': '255 255 255',
      '--surface-border': '226 222 212',
      '--surface-muted': '139 133 122',
      '--surface-fg': '21 19 15',
      '--accent-ink': 'var(--brand-primary)',
      '--r-lg': '0.25rem',
      '--r-xl': '0.375rem',
      '--r-2xl': '0.5rem',
    },
  },
  {
    key: 'pasar',
    nama: 'Papan Pasar',
    untuk: 'Warung, street food. Terbaca jelas walau layar kena matahari.',
    terang: true,
    vars: {
      '--surface-bg': '255 253 242',
      '--surface-dark': '255 246 199',
      '--surface-card': '255 255 255',
      '--surface-border': '19 19 19',
      '--surface-muted': '91 91 91',
      '--surface-fg': '19 19 19',
      '--accent-ink': 'var(--brand-primary)',
      '--r-lg': '0.125rem',
      '--r-xl': '0.125rem',
      '--r-2xl': '0.25rem',
    },
  },
  {
    key: 'daun',
    nama: 'Serat Daun',
    untuk: 'Kafe sehat, ekowisata. Hangat, membulat, cocok untuk cerita asal bahan.',
    terang: true,
    vars: {
      '--surface-bg': '245 241 230',
      '--surface-dark': '236 231 216',
      '--surface-card': '255 253 246',
      '--surface-border': '220 214 196',
      '--surface-muted': '124 125 106',
      '--surface-fg': '42 43 32',
      '--accent-ink': 'var(--brand-primary)',
      '--r-lg': '1rem',
      '--r-xl': '1.25rem',
      '--r-2xl': '1.75rem',
    },
  },
]

export const THEME_DEFAULT: ThemeKey = 'gelap'

export function getTheme(key: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.key === key) || THEMES[0]
}

// Jadi deretan "--surface-bg:12 10 9;--r-xl:0.75rem;..." untuk disisipkan ke :root
export function themeCss(key: string | null | undefined): string {
  return Object.entries(getTheme(key).vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('')
}
