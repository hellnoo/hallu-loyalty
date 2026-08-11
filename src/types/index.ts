// Komponen HPP. `biaya` = biaya per porsi (Rp) — SELALU terisi (sumber total HPP).
// Field opsional di bawah = mode "hitung dari bahan": beli sekemasan lalu kepakai
// sebagian per porsi. biaya = hargaBeli / isi * pakai * (1 + waste%). Kalau field
// itu kosong = mode manual (isi biaya langsung). Backward-compatible dgn data lama.
export type HppComponent = {
  nama: string
  biaya: number
  hargaBeli?: number   // Rp harga beli satu kemasan (mis. 150000 utk 1 kg)
  isi?: number         // isi kemasan dalam satuan pakai (mis. 1000 gram)
  satuan?: string      // satuan pakai: 'g' | 'ml' | 'pcs' | 'sdm' | 'sdt' | 'porsi'
  pakai?: number       // jumlah dipakai per porsi (satuan sama dgn isi)
  waste?: number       // % penyusutan/susut (opsional)
}

// Hitung biaya per porsi sebuah komponen (mode bahan kalau lengkap, else manual).
export function hppCompBiaya(c: HppComponent): number {
  if (c.hargaBeli && c.isi && c.pakai && c.isi > 0) {
    const base = (c.hargaBeli / c.isi) * c.pakai
    return Math.round(base * (1 + (c.waste || 0) / 100))
  }
  return c.biaya || 0
}
export function hppTotal(comps: HppComponent[] | undefined): number {
  return (comps || []).reduce((s, c) => s + hppCompBiaya(c), 0)
}
export const HPP_UNITS = ['g', 'ml', 'pcs', 'sdm', 'sdt', 'porsi'] as const

export type Shift = {
  id: string
  employee_name: string
  started_at: string
  ended_at: string | null
  opening_notes: string | null
  closing_notes: string | null
  handover_to: string | null
}

// Fallback kalau store_settings.employees belum diisi (DB lama / belum migrasi)
export const DEFAULT_EMPLOYEES = ['Amin', 'Rama', 'Ubuy']

export type StoreSettings = {
  id: number
  open_time: string        // "08:00"
  close_time: string       // "22:00"
  open_days: string        // "Senin – Minggu"
  is_manually_closed: boolean
  employees: string[]      // daftar nama kasir/penjaga — diatur per outlet dari Admin → Pengaturan
  // Password outlet — HANYA terisi lewat Admin Pusat (service_role). Kunci
  // publik sengaja tidak diberi izin baca kolom ini, jadi di client biasa
  // nilainya selalu undefined.
  admin_password?: string | null
  kasir_password?: string | null
  // Identitas outlet — diatur dari Admin Pusat, menimpa env NEXT_PUBLIC_BRAND_*
  brand_name?: string | null
  brand_tagline?: string | null
  brand_arabic?: string | null
  brand_city?: string | null
  brand_wa?: string | null
  brand_ig?: string | null
  brand_address?: string | null
  brand_lat?: number | null
  brand_lng?: number | null
  brand_logo?: string | null
  brand_color?: string | null
  brand_accent?: string | null
}

// Kolom store_settings yang boleh dibaca kunci publik (tanpa password).
// Dipakai di semua query client biasa — karena grant per-kolom bikin
// `select('*')` GAGAL setelah migrasi password.
export const STORE_SETTINGS_PUBLIC_COLS =
  'id, open_time, close_time, open_days, is_manually_closed, employees, ' +
  'brand_name, brand_tagline, brand_arabic, brand_city, brand_wa, brand_ig, ' +
  'brand_address, brand_lat, brand_lng, brand_logo, brand_color, brand_accent'

export type MenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  hpp: number
  hpp_components: HppComponent[]
  category: string
  available: boolean
  image_url: string | null
  model_3d_url: string | null
  model_3d_task_id: string | null
  created_at: string
}

export type OrderItem = {
  id: string
  name: string
  price: number
  qty: number
}

export type Order = {
  id: string
  table_number: number
  items: OrderItem[]
  status: 'new' | 'preparing' | 'ready' | 'done' | 'cancelled'
  note: string | null
  customer_name: string | null
  phone: string | null
  payment_method: string | null
  rating: number | null
  created_at: string
}
