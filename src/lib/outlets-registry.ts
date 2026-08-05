import { createClient } from '@supabase/supabase-js'
import { getOutlets, type OutletCfg } from './outlets'

// Gabungkan outlet dari OUTLETS_JSON (env, cara lama) + tabel public.outlets
// (DB, diisi lewat tombol "+ Tambah Outlet" di Admin Pusat). Satu sumber
// kebenaran gabungan dipakai semua route /api/central/* dan /api/owner/summary.
// Env menang kalau ada duplikat (url+schema sama) — biar konfigurasi manual
// tetap diutamakan.
export async function getAllOutlets(): Promise<OutletCfg[]> {
  const fromEnv = getOutlets()
  const fromDb = await getOutletsFromDb()
  const seen = new Set(fromEnv.map((o) => `${o.url}::${o.schema}`))
  return [...fromEnv, ...fromDb.filter((o) => !seen.has(`${o.url}::${o.schema}`))]
}

function pusatClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  // Tabel outlets selalu di schema public milik pusat, apa pun NEXT_PUBLIC_SUPABASE_SCHEMA
  return createClient(url, key, { auth: { persistSession: false }, db: { schema: 'public' } })
}

async function getOutletsFromDb(): Promise<OutletCfg[]> {
  const sb = pusatClient()
  if (!sb) return []
  try {
    const { data, error } = await sb.from('outlets').select('name, url, anon, schema, service_role')
    if (error || !data) return []
    return (data as { name: string; url: string; anon: string; schema: string; service_role: string | null }[]).map((o) => ({
      name: o.name, url: o.url, anon: o.anon,
      schema: o.schema || 'public',
      serviceRole: o.service_role || undefined,
    }))
  } catch { return [] }
}

export async function addOutletToDb(outlet: { name: string; url: string; anon: string; schema?: string; serviceRole?: string }) {
  const sb = pusatClient()
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel pusat')
  const { error } = await sb.from('outlets').insert({
    name: outlet.name, url: outlet.url, anon: outlet.anon,
    schema: outlet.schema || 'public', service_role: outlet.serviceRole || null,
  })
  if (error) throw error
}

export async function removeOutletFromDb(url: string, schema: string) {
  const sb = pusatClient()
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel pusat')
  const { error } = await sb.from('outlets').delete().eq('url', url).eq('schema', schema)
  if (error) throw error
}
