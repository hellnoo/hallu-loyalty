import { createClient } from '@supabase/supabase-js'
import { setAiKey } from './ai'

// Ambil kunci AI dari database (kolom store_settings.ai_api_key) — diatur dari
// Admin Pusat, jadi pemilik tidak perlu buka Vercel.
// Kolom ini SENGAJA tidak diberikan ke anon, jadi pembacaannya wajib memakai
// service_role di sisi server. Kalau service_role belum diset, jatuh ke env
// AI_API_KEY seperti sebelumnya (tidak ada yang rusak).
let cache: { at: number } | null = null
const TTL = 30_000

export async function muatKunciAi(): Promise<void> {
  if (cache && Date.now() - cache.at < TTL) return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    const sb = createClient(url, key, {
      auth: { persistSession: false },
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public' },
    })
    const { data, error } = await sb.from('store_settings').select('ai_api_key').eq('id', 1).single()
    if (error) return // kolom belum ada (DB belum dimigrasi) → pakai env
    setAiKey((data as { ai_api_key?: string | null })?.ai_api_key)
    cache = { at: Date.now() }
  } catch { /* diamkan — AI opsional */ }
}
