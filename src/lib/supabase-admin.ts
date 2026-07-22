import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Klien service_role — HANYA server (bypass RLS). Jangan import dari komponen client.
// Butuh env SUPABASE_SERVICE_ROLE_KEY. Kalau belum diset, return null → route balas 501
// dan client fallback ke anon (biar tidak ada downtime saat rollout).
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
