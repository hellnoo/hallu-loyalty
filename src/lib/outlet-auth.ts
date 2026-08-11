import { supabase } from './supabase'

// Cek password admin/kasir outlet ini.
// 1) env (ADMIN_PASSWORD / KASIR_PASSWORD) — cara lama, tetap didukung supaya
//    outlet yang belum dimigrasi tidak terganggu sama sekali.
// 2) database (store_settings.admin_password / kasir_password) — cara baru,
//    bisa diatur dari Admin Pusat tanpa buka Vercel.
//    Dipanggil lewat fungsi SECURITY DEFINER `cek_password` yang cuma balikin
//    true/false, jadi kunci publik TIDAK bisa membaca isi passwordnya.
export async function cekPasswordOutlet(peran: 'admin' | 'kasir', password: string): Promise<boolean> {
  if (!password) return false

  const envPw = peran === 'admin' ? process.env.ADMIN_PASSWORD : process.env.KASIR_PASSWORD
  if (envPw && password === envPw) return true

  try {
    const { data, error } = await supabase.rpc('cek_password', { peran, sandi: password })
    if (error) return false
    return data === true
  } catch {
    return false // DB belum dimigrasi / fungsi belum ada → jatuh ke env saja
  }
}
