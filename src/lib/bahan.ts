import type { SupabaseClient } from '@supabase/supabase-js'

// Master bahan baku: harga beli + takaran kemasan diisi SEKALI, lalu dipakai
// ulang saat mengisi HPP menu mana pun (lihat supabase-bahan.sql).
export type Bahan = {
  id: string
  nama: string
  harga_beli: number
  isi: number
  satuan: string
  created_at?: string
}

export type BahanBaru = Omit<Bahan, 'id' | 'created_at'>

export const BAHAN_COLS = 'id, nama, harga_beli, isi, satuan, created_at'

// Outlet yang BELUM menjalankan supabase-bahan.sql tidak boleh ikut rusak:
// kalau tabelnya belum ada, kembalikan daftar kosong (fitur lama tetap jalan).
export async function bacaBahan(sb: SupabaseClient<any, any>): Promise<Bahan[]> {
  const { data, error } = await sb.from('bahan').select(BAHAN_COLS).order('nama')
  if (error || !data) return []
  return data as unknown as Bahan[]
}

export const kunciBahan = (nama: string) => (nama || '').trim().toLowerCase()

export function sudahAdaDiDaftar(daftar: Bahan[], nama: string): boolean {
  const k = kunciBahan(nama)
  return !!k && daftar.some((b) => kunciBahan(b.nama) === k)
}

// "Rp 150.000 / 1000 g" — ringkasan buat dropdown
export function ringkasBahan(b: Bahan): string {
  const rp = (b.harga_beli || 0).toLocaleString('id-ID')
  return `Rp ${rp} / ${(b.isi || 0).toLocaleString('id-ID')} ${b.satuan}`
}
