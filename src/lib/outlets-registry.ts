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

// Simpan outlet. Kalau url+schema sudah terdaftar → TIMPA (bukan bikin ganda),
// supaya salah tempel kunci bisa diperbaiki cukup dgn isi ulang form yang sama.
// Balikin 'updated' | 'created' biar UI bisa kasih tahu apa yang terjadi.
export async function addOutletToDb(outlet: { name: string; url: string; anon: string; schema?: string; serviceRole?: string }): Promise<'updated' | 'created'> {
  const sb = pusatClient()
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel pusat')
  const schema = outlet.schema || 'public'
  const row = {
    name: outlet.name, url: outlet.url, anon: outlet.anon,
    schema, service_role: outlet.serviceRole || null,
  }
  const { data: existing } = await sb.from('outlets').select('id').eq('url', outlet.url).eq('schema', schema).maybeSingle()
  if (existing) {
    const { error } = await sb.from('outlets').update(row).eq('url', outlet.url).eq('schema', schema)
    if (error) throw error
    return 'updated'
  }
  const { error } = await sb.from('outlets').insert(row)
  if (error) throw error
  return 'created'
}

export async function removeOutletFromDb(url: string, schema: string) {
  const sb = pusatClient()
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel pusat')
  const { error } = await sb.from('outlets').delete().eq('url', url).eq('schema', schema)
  if (error) throw error
}
