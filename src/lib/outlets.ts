import { BRAND_NICE } from './brand'

export type OutletCfg = { name: string; url: string; anon: string; schema: string; serviceRole?: string }

// Config outlet lintas-deployment via env server-only OUTLETS_JSON:
// [{"name":"Hallu Pusat","url":"https://<ref>.supabase.co","anon":"<anon key>"},
//  {"name":"Hallu Brew","url":"<url pusat>","anon":"<anon pusat>","schema":"brew"},
//  {"name":"Outlet Mitra","url":"<url mitra>","anon":"<anon mitra>","serviceRole":"<service_role mitra>"}]
// `schema` opsional (default 'public') — untuk outlet yang numpang DB pusat via
// schema Postgres terpisah (mis. Hallu Brew).
// `serviceRole` opsional — HANYA perlu untuk outlet di project Supabase LAIN
// (mis. hallu-outlet), supaya Admin Pusat bisa TULIS ke sana (kelola menu/
// pengaturan lintas outlet). Outlet yang numpang project pusat (schema-based)
// tidak perlu ini — otomatis pakai SUPABASE_SERVICE_ROLE_KEY milik pusat.
// Fallback (raw kosong): outlet deployment ini sendiri.
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
            serviceRole: o.serviceRole ? String(o.serviceRole) : undefined,
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
