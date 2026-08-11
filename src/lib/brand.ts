// ── White-label brand config ────────────────────────────────
// NEXT_PUBLIC_* terbaca di client maupun server (route AI).
//
// ATURAN PENTING:
// Data KONTAK & LOKASI (WA, IG, alamat, koordinat) itu milik satu tempat —
// TIDAK BOLEH diwarisi outlet lain. Kalau `NEXT_PUBLIC_BRAND_NAME` diset
// (artinya deployment ini punya identitas sendiri: Hallu Brew, Basecamp, dst),
// maka kontak yang tidak diisi = KOSONG, bukan jatuh ke data Hallu Pusat.
// Dulu default-nya jatuh ke nomor WA Hallu — pelanggan outlet lain jadi
// nyasar chat ke Hallu Pusat. Itu bug, bukan sekadar setelan belum diisi.
//
// Deployment tanpa BRAND_NAME = Hallu Pusat yang asli → default lama dipakai.

const nameEnv = process.env.NEXT_PUBLIC_BRAND_NAME
const punyaIdentitasSendiri = !!(nameEnv && nameEnv.trim())

// Ambil env; kalau kosong → pakai default Hallu HANYA untuk Hallu Pusat asli
const kontak = (v: string | undefined, defaultHallu: string) => {
  const val = (v || '').trim()
  if (val) return val
  return punyaIdentitasSendiri ? '' : defaultHallu
}

export const BRAND = {
  name:    nameEnv || 'HALLU',
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Coffee & Sociality',
  // '' atau '-' = sembunyikan elemen Arab (Vercel tidak izinkan env kosong, pakai '-')
  arabic:  (() => {
    const a = process.env.NEXT_PUBLIC_BRAND_ARABIC
    if (a !== undefined) return a.trim() === '-' ? '' : a
    return punyaIdentitasSendiri ? '' : 'هالو'   // tulisan Arab = milik Hallu
  })(),
  city:    process.env.NEXT_PUBLIC_BRAND_CITY || 'Ternate',
  wa:      kontak(process.env.NEXT_PUBLIC_BRAND_WA, '6281245400031'),
  ig:      kontak(process.env.NEXT_PUBLIC_BRAND_IG, 'hall.ucffe'),
  address: kontak(process.env.NEXT_PUBLIC_BRAND_ADDRESS, 'Taman Fitness Sunyie Parade, Ternate, Maluku Utara'),
  lat:     Number(kontak(process.env.NEXT_PUBLIC_BRAND_LAT, '0.7935511') || 0),
  lng:     Number(kontak(process.env.NEXT_PUBLIC_BRAND_LNG, '127.3855782') || 0),
  // Logo: URL gambar (opsional). Kosong → pakai tulisan nama seperti biasa.
  logo:    (process.env.NEXT_PUBLIC_BRAND_LOGO || '').trim(),
}

// Apakah data kontak tersedia — dipakai untuk MENYEMBUNYIKAN tombol/section
// daripada menampilkan link yang salah alamat.
export const HAS_WA = !!BRAND.wa
export const HAS_IG = !!BRAND.ig
export const HAS_ADDRESS = !!BRAND.address
export const HAS_MAP = !!(BRAND.lat && BRAND.lng)

// Turunan yang sering dipakai — title-case per kata (dukung nama multi-kata, mis. "HALLU BREW" → "Hallu Brew")
export const BRAND_NICE = BRAND.name.split(' ').filter(Boolean).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
export const BRAND_FULL = `${BRAND_NICE} ${BRAND.tagline}` // "Hallu Coffee & Sociality"
export const WA_LINK = BRAND.wa ? `https://wa.me/${BRAND.wa}` : ''
export const WA_DISPLAY = BRAND.wa
  ? '+62 ' + BRAND.wa.replace(/^62/, '').replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3')
  : ''

// ── Warna brand (bisa beda per outlet) ──────────────────────
// Diset lewat env sebagai hex, mis. NEXT_PUBLIC_BRAND_COLOR=#1B4D3E
// Dipasang sebagai CSS variable di layout, dipakai Tailwind (h-red/h-cream).
const hexKeRgb = (hex: string, fallback: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return fallback
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const gelapkan = (rgb: string, faktor = 0.75) =>
  rgb.split(' ').map(v => Math.max(0, Math.round(Number(v) * faktor))).join(' ')

export const BRAND_RGB = {
  primary:   hexKeRgb(process.env.NEXT_PUBLIC_BRAND_COLOR || '', '124 21 21'),      // maroon Hallu
  accent:    hexKeRgb(process.env.NEXT_PUBLIC_BRAND_ACCENT || '', '212 184 150'),   // cream Hallu
}
export const BRAND_RGB_PRIMARY_DARK = gelapkan(BRAND_RGB.primary)
