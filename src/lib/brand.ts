// ── Identitas outlet (white-label) ──────────────────────────
// SUMBER NILAI, urut prioritas:
//   1. Database  (store_settings kolom brand_*) — diatur dari Admin Pusat.
//      Ini jalur utama: pemilik tidak perlu buka Vercel sama sekali.
//   2. Env NEXT_PUBLIC_BRAND_* — cadangan / cara lama, tetap didukung.
//   3. Default Hallu — HANYA untuk deployment tanpa identitas sendiri.
//
// ATURAN: data KONTAK & LOKASI (WA, IG, alamat, koordinat) milik satu tempat,
// TIDAK diwarisi outlet lain. Kalau outlet punya identitas sendiri tapi
// kontaknya belum diisi → kosong, dan UI-nya disembunyikan. Dulu jatuh ke
// nomor WA Hallu, jadi pelanggan outlet lain nyasar chat ke Hallu Pusat.
//
// Export pakai `let` supaya jadi live binding ESM: begitu applyBrand()
// dipanggil (server: sebelum render; client: dari data yang disuntik di
// <head>), semua importer langsung lihat nilai terbaru.

export type BrandData = {
  name: string; tagline: string; arabic: string; city: string
  wa: string; ig: string; address: string
  lat: number; lng: number
  logo: string; color: string; accent: string
}

const envName = (process.env.NEXT_PUBLIC_BRAND_NAME || '').trim()

// Default Hallu — hanya dipakai deployment tanpa identitas sendiri
const HALLU = {
  wa: '6281245400031',
  ig: 'hall.ucffe',
  address: 'Taman Fitness Sunyie Parade, Ternate, Maluku Utara',
  lat: 0.7935511,
  lng: 127.3855782,
  arabic: 'هالو',
}

function dariEnv(): BrandData {
  const punyaIdentitasSendiri = !!envName
  const kontak = (v: string | undefined, defaultHallu: string) => {
    const val = (v || '').trim()
    if (val) return val
    return punyaIdentitasSendiri ? '' : defaultHallu
  }
  const arabicEnv = process.env.NEXT_PUBLIC_BRAND_ARABIC
  return {
    name: envName || 'HALLU',
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Coffee & Sociality',
    arabic: arabicEnv !== undefined
      ? (arabicEnv.trim() === '-' ? '' : arabicEnv)
      : (punyaIdentitasSendiri ? '' : HALLU.arabic),
    city: process.env.NEXT_PUBLIC_BRAND_CITY || 'Ternate',
    wa: kontak(process.env.NEXT_PUBLIC_BRAND_WA, HALLU.wa),
    ig: kontak(process.env.NEXT_PUBLIC_BRAND_IG, HALLU.ig),
    address: kontak(process.env.NEXT_PUBLIC_BRAND_ADDRESS, HALLU.address),
    lat: Number(kontak(process.env.NEXT_PUBLIC_BRAND_LAT, String(HALLU.lat)) || 0),
    lng: Number(kontak(process.env.NEXT_PUBLIC_BRAND_LNG, String(HALLU.lng)) || 0),
    logo: (process.env.NEXT_PUBLIC_BRAND_LOGO || '').trim(),
    color: (process.env.NEXT_PUBLIC_BRAND_COLOR || '').trim(),
    accent: (process.env.NEXT_PUBLIC_BRAND_ACCENT || '').trim(),
  }
}

// ── State + turunannya (live binding) ───────────────────────
export let BRAND: BrandData = dariEnv()

export let BRAND_NICE = ''
export let BRAND_FULL = ''
export let WA_LINK = ''
export let WA_DISPLAY = ''
export let HAS_WA = false
export let HAS_IG = false
export let HAS_ADDRESS = false
export let HAS_MAP = false
export let HAS_LOGO = false
export let BRAND_RGB = { primary: '124 21 21', accent: '212 184 150' }
export let BRAND_RGB_PRIMARY_DARK = '93 15 15'
export let BRAND_HEX = '#7c1515'

const hexKeRgb = (hex: string, fallback: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const gelapkan = (rgb: string, faktor = 0.75) =>
  rgb.split(' ').map(v => Math.max(0, Math.round(Number(v) * faktor))).join(' ')
const rgbKeHex = (rgb: string) =>
  '#' + rgb.split(' ').map(v => Number(v).toString(16).padStart(2, '0')).join('')

function hitungTurunan() {
  BRAND_NICE = BRAND.name.split(' ').filter(Boolean)
    .map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
  BRAND_FULL = `${BRAND_NICE} ${BRAND.tagline}`.trim()
  WA_LINK = BRAND.wa ? `https://wa.me/${BRAND.wa}` : ''
  WA_DISPLAY = BRAND.wa
    ? '+62 ' + BRAND.wa.replace(/^62/, '').replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3')
    : ''
  HAS_WA = !!BRAND.wa
  HAS_IG = !!BRAND.ig
  HAS_ADDRESS = !!BRAND.address
  HAS_MAP = !!(BRAND.lat && BRAND.lng)
  HAS_LOGO = !!BRAND.logo
  BRAND_RGB = {
    primary: hexKeRgb(BRAND.color, '124 21 21'),
    accent: hexKeRgb(BRAND.accent, '212 184 150'),
  }
  BRAND_RGB_PRIMARY_DARK = gelapkan(BRAND_RGB.primary)
  BRAND_HEX = rgbKeHex(BRAND_RGB.primary)
}
hitungTurunan()

// Timpa identitas dengan nilai dari DB. Field kosong/null diabaikan supaya
// tidak menghapus nilai env yang sudah benar.
export function applyBrand(partial: Partial<BrandData> | null | undefined) {
  if (!partial) return
  const next = { ...BRAND }
  ;(Object.keys(partial) as (keyof BrandData)[]).forEach((k) => {
    const v = partial[k]
    if (v === null || v === undefined) return
    if (typeof v === 'string' && !v.trim()) return
    if (typeof v === 'number' && !Number.isFinite(v)) return
    // @ts-expect-error — penugasan per-field bertipe union
    next[k] = v
  })
  BRAND = next
  hitungTurunan()
}

// Nama variabel global tempat identitas disuntik ke browser (lihat layout.tsx)
export const BRAND_GLOBAL = '__BRAND__'

// Di browser: ambil identitas yang disuntik server sebelum bundle jalan.
if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, Partial<BrandData> | undefined>
  applyBrand(w[BRAND_GLOBAL])
}
