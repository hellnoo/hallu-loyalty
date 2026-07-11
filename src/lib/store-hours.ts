import type { StoreSettings } from '@/types'

// Status buka/tutup. Menangani jam tutup yang lewat tengah malam.
export function isStoreOpen(s: StoreSettings): boolean {
  if (s.is_manually_closed) return false
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = s.open_time.split(':').map(Number)
  const [ch, cm] = s.close_time.split(':').map(Number)
  const openM = oh * 60 + om, closeM = ch * 60 + cm
  if (openM === closeM) return true                       // 24 jam
  if (closeM > openM) return cur >= openM && cur < closeM // tutup di hari yang sama
  return cur >= openM || cur < closeM                     // tutup lewat tengah malam
}

// Alias — beberapa halaman pakai nama calcIsOpen
export const calcIsOpen = isStoreOpen
