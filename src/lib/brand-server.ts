import { createClient } from '@supabase/supabase-js'
import type { BrandData } from './brand'

// Kolom brand_* di store_settings → bentuk BrandData.
// Dipakai layout (server) supaya HTML yang dikirim ke browser SUDAH memakai
// identitas outlet — tidak ada kedipan "Hallu" dulu baru berubah.
export const BRAND_COLS =
  'brand_name, brand_tagline, brand_arabic, brand_city, brand_wa, brand_ig, brand_address, brand_lat, brand_lng, brand_logo, brand_color, brand_accent, brand_theme'

type Row = Record<string, string | number | null>

export function rowKeBrand(row: Row | null | undefined): Partial<BrandData> {
  if (!row) return {}
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  return {
    name: s(row.brand_name), tagline: s(row.brand_tagline), arabic: s(row.brand_arabic),
    city: s(row.brand_city), wa: s(row.brand_wa), ig: s(row.brand_ig),
    address: s(row.brand_address), lat: n(row.brand_lat), lng: n(row.brand_lng),
    logo: s(row.brand_logo), color: s(row.brand_color), accent: s(row.brand_accent),
    theme: s(row.brand_theme),
  }
}

// Cache singkat: identitas jarang berubah, tapi kalau owner mengubahnya dari
// Admin Pusat, perubahan tetap muncul dalam <=30 detik tanpa redeploy.
let cache: { at: number; data: Partial<BrandData> } | null = null
const TTL = 30_000

export async function loadBrandFromDb(): Promise<Partial<BrandData>> {
  if (cache && Date.now() - cache.at < TTL) return cache.data
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return {}
  try {
    const sb = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public' },
    })
    const { data, error } = await sb.from('store_settings').select(BRAND_COLS).eq('id', 1).single()
    // DB belum dimigrasi (kolom belum ada) → pakai env saja, jangan error
    if (error) return {}
    const brand = rowKeBrand(data as Row)
    cache = { at: Date.now(), data: brand }
    return brand
  } catch {
    return {}
  }
}
