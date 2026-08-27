import type { MenuItem, OrderItem } from '@/types'
import { hppCompBiaya } from '@/types'

// Berapa banyak bahan baku yang BENAR-BENAR terpakai, dihitung dari resep HPP
// tiap menu dikali jumlah yang terjual. Tidak butuh input tambahan dari kasir —
// datanya sudah ada di menu_items.hpp_components (pakai + satuan + waste).
//
// Dipakai buat membandingkan "belanja bahan" (pengeluaran kategori 'bahan')
// dengan "nilai bahan yang terpakai" — selisihnya yang menangkap boros/susut.

export type PemakaianBahan = {
  nama: string    // nama tampil, versi pertama yang ditemui
  satuan: string  // '' = bahan mode manual (tanpa takaran) → jumlah tak terhitung
  jumlah: number  // total terpakai dalam satuan itu, sudah termasuk % susut
  biaya: number   // total rupiah
}

export type RekapBahan = {
  bahan: PemakaianBahan[]
  totalBiaya: number
  qtyTotal: number    // total porsi terjual
  qtyTerinci: number  // porsi yang menunya punya rincian bahan
}

export function hitungBahanTerpakai(
  orders: { items: OrderItem[] }[],
  menu: MenuItem[],
): RekapBahan {
  const byId = new Map<string, MenuItem>()
  const byNama = new Map<string, MenuItem>()
  menu.forEach((m) => {
    byId.set(m.id, m)
    byNama.set((m.name || '').trim().toLowerCase(), m)
  })

  const acc = new Map<string, PemakaianBahan>()
  let totalBiaya = 0
  let qtyTotal = 0
  let qtyTerinci = 0

  orders.forEach((o) =>
    (o.items || []).forEach((it) => {
      qtyTotal += it.qty
      const m = byId.get(it.id) || byNama.get((it.name || '').trim().toLowerCase())
      const comps = m?.hpp_components
      if (!m || !Array.isArray(comps) || comps.length === 0) return
      qtyTerinci += it.qty

      comps.forEach((c) => {
        const nama = (c.nama || '').trim()
        if (!nama) return
        // Bahan mode manual (cuma isi biaya) tidak punya takaran → jumlah tak
        // bisa dihitung, tapi rupiahnya tetap ikut.
        const adaTakaran = !!(c.pakai && c.isi)
        const satuan = adaTakaran ? c.satuan || '' : ''
        const susut = 1 + (c.waste || 0) / 100
        const jumlah = satuan ? (c.pakai || 0) * susut * it.qty : 0
        const biaya = hppCompBiaya(c) * it.qty

        const kunci = nama.toLowerCase() + '|' + satuan
        const row = acc.get(kunci) || { nama, satuan, jumlah: 0, biaya: 0 }
        row.jumlah += jumlah
        row.biaya += biaya
        acc.set(kunci, row)
        totalBiaya += biaya
      })
    }),
  )

  return {
    bahan: [...acc.values()].sort((a, b) => b.biaya - a.biaya),
    totalBiaya,
    qtyTotal,
    qtyTerinci,
  }
}

// 2400 g -> "2,4 kg" ; 18000 ml -> "18 L" ; 12 pcs -> "12 pcs"
export function fmtJumlah(jumlah: number, satuan: string): string {
  if (!satuan) return '—'
  const n = (v: number, d: number) => v.toLocaleString('id-ID', { maximumFractionDigits: d })
  if (satuan === 'g' && jumlah >= 1000) return `${n(jumlah / 1000, 2)} kg`
  if (satuan === 'ml' && jumlah >= 1000) return `${n(jumlah / 1000, 2)} L`
  return `${n(jumlah, jumlah < 10 ? 1 : 0)} ${satuan}`
}
