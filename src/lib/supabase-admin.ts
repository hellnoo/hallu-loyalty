import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { OutletCfg } from './outlets'

// Klien service_role — HANYA server (bypass RLS). Jangan import dari komponen client.
// Butuh env SUPABASE_SERVICE_ROLE_KEY. Kalau belum diset, return null → route balas 501
// dan client fallback ke anon (biar tidak ada downtime saat rollout).
// Ikut schema outlet (NEXT_PUBLIC_SUPABASE_SCHEMA) — penting untuk outlet yang
// numpang DB pusat via schema terpisah (mis. 'brew').
export function getServiceClient(): SupabaseClient<any, string> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public'
  return createClient(url, key, { auth: { persistSession: false }, db: { schema } })
}

// Klien service_role untuk outlet TERTENTU (dipakai Admin Pusat kelola lintas
// outlet). Dua kasus:
//  - Outlet numpang project pusat (schema-based, mis. Hallu Brew): pakai
//    SUPABASE_SERVICE_ROLE_KEY milik pusat + schema outlet — tanpa secret baru.
//  - Outlet di project Supabase LAIN (mis. hallu-outlet mitra): wajib field
//    `serviceRole` di OUTLETS_JSON milik outlet itu. Tanpa itu → null (302/501
//    di route, UI kasih tahu outlet belum terhubung untuk tulis).
export function getOutletServiceClient(outlet: OutletCfg): SupabaseClient<any, string> | null {
  const pusatUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sameProject = pusatUrl && outlet.url === pusatUrl
  const key = sameProject ? process.env.SUPABASE_SERVICE_ROLE_KEY : outlet.serviceRole
  if (!key) return null
  return createClient(outlet.url, key, { auth: { persistSession: false }, db: { schema: outlet.schema || 'public' } })
}
