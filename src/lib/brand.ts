// ── White-label brand config ────────────────────────────────
// Default = Hallu. Deploy lain (mis. demo KedaiKu / UMKM lain) cukup
// set env NEXT_PUBLIC_BRAND_* di Vercel — kode tidak perlu diubah.
// NEXT_PUBLIC_* terbaca di client maupun server (route AI).
export const BRAND = {
  name:    process.env.NEXT_PUBLIC_BRAND_NAME    || 'HALLU',
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || 'Coffee & Sociality',
  arabic:  process.env.NEXT_PUBLIC_BRAND_ARABIC ?? 'هالو',   // '' = sembunyikan
  city:    process.env.NEXT_PUBLIC_BRAND_CITY    || 'Ternate',
  wa:      process.env.NEXT_PUBLIC_BRAND_WA      || '6281245400031',
  ig:      process.env.NEXT_PUBLIC_BRAND_IG      || 'hall.ucffe',
  address: process.env.NEXT_PUBLIC_BRAND_ADDRESS || 'Taman Fitness Sunyie Parade, Ternate, Maluku Utara',
  lat:     Number(process.env.NEXT_PUBLIC_BRAND_LAT || 0.7935511),
  lng:     Number(process.env.NEXT_PUBLIC_BRAND_LNG || 127.3855782),
}

// Turunan yang sering dipakai
export const BRAND_NICE = BRAND.name.charAt(0) + BRAND.name.slice(1).toLowerCase() // "Hallu"
export const BRAND_FULL = `${BRAND_NICE} ${BRAND.tagline}` // "Hallu Coffee & Sociality"
export const WA_LINK = `https://wa.me/${BRAND.wa}`
export const WA_DISPLAY = '+62 ' + BRAND.wa.replace(/^62/, '').replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3')
