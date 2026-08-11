import type { SupabaseClient } from '@supabase/supabase-js'
import type { StoreSettings } from '@/types'
import { STORE_SETTINGS_PUBLIC_COLS } from '@/types'

// Baca store_settings dengan aman di SEMUA kondisi migrasi:
//  1. Sudah migrasi brand   → kolom lengkap (termasuk brand_*)
//  2. Baru migrasi password → kolom brand belum ada, tapi select('*') diblok
//     grant per-kolom → pakai daftar kolom dasar
//  3. Belum migrasi apa pun → select('*') masih boleh
// Tanpa ini, outlet yang belum dimigrasi langsung error dan halamannya kosong.
const KOLOM_DASAR = 'id, open_time, close_time, open_days, is_manually_closed, employees'

export async function bacaStoreSettings(
  sb: SupabaseClient<any, any>,
): Promise<StoreSettings | null> {
  for (const cols of [STORE_SETTINGS_PUBLIC_COLS, KOLOM_DASAR, '*']) {
    const { data, error } = await sb.from('store_settings').select(cols).eq('id', 1).single()
    if (!error && data) return data as unknown as StoreSettings
  }
  return null
}
