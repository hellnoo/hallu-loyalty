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

// Simpan setelan pakai kunci publik (jalur cadangan saat service_role belum diset).
//
// WAJIB `update`, JANGAN `upsert`. `upsert` diterjemahkan jadi
// `INSERT ... ON CONFLICT DO UPDATE`, dan Postgres mensyaratkan izin SELECT
// SELURUH TABEL untuk perintah itu — padahal kunci publik sengaja cuma diberi
// izin baca PER-KOLOM supaya password & kunci AI tidak terbaca. Akibatnya upsert
// selalu ditolak "42501 permission denied for table store_settings", walau
// update biasa boleh. Baris id=1 dibuat supabase-setup.sql jadi pasti ada.
export async function simpanStoreSettings(
  sb: SupabaseClient<any, any>,
  values: Record<string, unknown>,
): Promise<{ error: unknown }> {
  const isi = { ...values }
  delete isi.id
  // Pakai count, BUKAN .select() — RLS aktif di store_settings, jadi baris hasil
  // update bisa saja tidak boleh dibaca balik. Itu akan terlihat seperti "gagal"
  // padahal datanya tersimpan. count menghitung baris yang benar-benar berubah.
  const { error, count } = await sb.from('store_settings').update(isi, { count: 'exact' }).eq('id', 1)
  if (error) return { error }
  if (count === 0) {
    return { error: new Error('Baris pengaturan (id=1) tidak ada di database outlet ini — jalankan supabase-setup.sql dulu.') }
  }
  return { error: null }
}
