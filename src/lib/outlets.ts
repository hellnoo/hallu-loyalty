import { BRAND_NICE } from './brand'

export type OutletCfg = { name: string; url: string; anon: string }

// Config outlet lintas-deployment via env server-only OUTLETS_JSON:
// [{"name":"Hallu Pusat","url":"https://<ref>.supabase.co","anon":"<anon key>"}, ...]
// Fallback: outlet deployment ini sendiri (biar /owner tetap jalan sebelum dikonfigurasi).
export function getOutlets(): OutletCfg[] {
  const raw = process.env.OUTLETS_JSON
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        const valid = arr
          .filter((o) => o && o.url && o.anon)
          .map((o) => ({ name: String(o.name || 'Outlet'), url: String(o.url), anon: String(o.anon) }))
        if (valid.length) return valid
      }
    } catch { /* fall through ke fallback */ }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anon) return [{ name: BRAND_NICE, url, anon }]
  return []
}
