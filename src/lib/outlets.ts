import { BRAND_NICE } from './brand'

export type OutletCfg = { name: string; url: string; anon: string; schema: string }

// Config outlet lintas-deployment via env server-only OUTLETS_JSON:
// [{"name":"Hallu Pusat","url":"https://<ref>.supabase.co","anon":"<anon key>"},
//  {"name":"Hallu Brew","url":"<url pusat>","anon":"<anon pusat>","schema":"brew"}, ...]
// `schema` opsional (default 'public') — untuk outlet yang numpang DB pusat via
// schema Postgres terpisah. Fallback: outlet deployment ini sendiri.
export function getOutlets(): OutletCfg[] {
  const raw = process.env.OUTLETS_JSON
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        const valid = arr
          .filter((o) => o && o.url && o.anon)
          .map((o) => ({
            name: String(o.name || 'Outlet'), url: String(o.url), anon: String(o.anon),
            schema: String(o.schema || 'public'),
          }))
        if (valid.length) return valid
      }
    } catch { /* fall through ke fallback */ }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public'
  if (url && anon) return [{ name: BRAND_NICE, url, anon, schema }]
  return []
}
