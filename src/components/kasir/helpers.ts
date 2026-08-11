import { useEffect, useState } from 'react'
import type { Order, OrderItem, MenuItem, Shift } from '@/types'
import { formatRp } from '@/lib/format'
import { BRAND, BRAND_NICE, BRAND_FULL } from '@/lib/brand'
import { fmtWITTime, fmtWITDateLong, fmtWITDateShort } from '@/lib/business-day'

// Dibaca saat dipakai (bukan dibekukan saat import) supaya ikut identitas dari DB
export const ownerWa = () => BRAND.wa

// ═══ OFFLINE / PENDING QUEUE ═══════════════════════════════
const PENDING_ORDERS_KEY = 'hallu-kasir-pending-orders'
const MENU_CACHE_KEY = 'hallu-kasir-menu-cache'

export type PendingOrder = {
  tempId: string
  data: {
    table_number: number
    customer_name: string | null
    items: OrderItem[]
    note: string | null
    status: 'new'
    payment_method: string | null
  }
  queuedAt: number
  retries: number
  lastError?: string
}

export function loadPendingOrders(): PendingOrder[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(PENDING_ORDERS_KEY) || '[]') } catch { return [] }
}

export function savePendingOrders(orders: PendingOrder[]) {
  localStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(orders))
}

export function queuePendingOrder(data: PendingOrder['data']): PendingOrder {
  const pending: PendingOrder = {
    tempId: 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    data, queuedAt: Date.now(), retries: 0,
  }
  const all = loadPendingOrders()
  all.push(pending)
  savePendingOrders(all)
  return pending
}

export function cacheMenu(items: MenuItem[]) {
  try { localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ items, cachedAt: Date.now() })) } catch { /* quota */ }
}
export function loadCachedMenu(): MenuItem[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY)
    if (!raw) return null
    const { items } = JSON.parse(raw)
    return items as MenuItem[]
  } catch { return null }
}

// Hook online/offline
export function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export function formatTime(s: string) { return fmtWITTime(s) }
export function orderTotal(items: OrderItem[]) { return items.reduce((s, i) => s + i.price * i.qty, 0) }

export function buildDailyReport(orders: Order[], date: string, shifts: Shift[] = []): string {
  const tanggal = fmtWITDateLong(date)
  const revenue = orders.reduce((s, o) => s + orderTotal(o.items), 0)
  const avgOrder = orders.length ? Math.round(revenue / orders.length) : 0

  const byMethod: Record<string, { total: number; count: number }> = {}
  orders.forEach(o => {
    const m = o.payment_method || 'lainnya'
    if (!byMethod[m]) byMethod[m] = { total: 0, count: 0 }
    byMethod[m].total += orderTotal(o.items)
    byMethod[m].count++
  })

  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
  orders.forEach(o => o.items.forEach(i => {
    if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 }
    itemMap[i.name].qty += i.qty
    itemMap[i.name].revenue += i.price * i.qty
  }))
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5)

  const ratedOrders = orders.filter(o => o.rating)
  const avgRating = ratedOrders.length
    ? (ratedOrders.reduce((s, o) => s + (o.rating || 0), 0) / ratedOrders.length).toFixed(1)
    : null

  const methodLabels: Record<string, string> = { tunai: '💵 Tunai', qris: '⬛ QRIS', transfer: '🏦 Transfer', lainnya: '💳 Lainnya' }

  // Shift breakdown
  const shiftLines = shifts.map(s => {
    const so = orders.filter(o => {
      const t = new Date(o.created_at).getTime()
      const start = new Date(s.started_at).getTime()
      const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now()
      return t >= start && t <= end
    })
    const sr = so.reduce((sum, o) => sum + orderTotal(o.items), 0)
    const jamStart = fmtWITTime(s.started_at)
    const jamEnd = s.ended_at ? fmtWITTime(s.ended_at) : 'masih jaga'
    return `• *${s.employee_name}* (${jamStart}–${jamEnd}) — ${so.length} order, ${formatRp(sr)}`
  })

  const lines = [
    `📊 *LAPORAN HARIAN ${BRAND.name}*`,
    `📅 ${tanggal}`,
    ``,
    `💰 *Total Pendapatan: ${formatRp(revenue)}*`,
    `🧾 Total Transaksi: ${orders.length} order`,
    orders.length ? `📈 Rata-rata/order: ${formatRp(avgOrder)}` : '',
    ``,
    shiftLines.length ? `👷 *Shift Hari Ini:*` : '',
    ...shiftLines,
    shiftLines.length ? `` : '',
    `💳 *Per Metode Bayar:*`,
    ...Object.entries(byMethod).map(([m, v]) => `${methodLabels[m] || m}: ${formatRp(v.total)} (${v.count} order)`),
    ``,
    topItems.length ? `🏆 *Top Item:*` : '',
    ...topItems.map((item, i) => `${i + 1}. ${item.name} ×${item.qty} — ${formatRp(item.revenue)}`),
    avgRating ? `` : '',
    avgRating ? `⭐ Rata-rata Rating: ${avgRating} (dari ${ratedOrders.length} ulasan)` : '',
    ``,
    `_Laporan otomatis dari ${BRAND_NICE} POS_ 🚀`,
  ].filter(l => l !== undefined)

  return lines.join('\n')
}

export async function requestNotifPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission()
}

export function showBrowserNotif(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg', tag: 'hallu-order' })
  }
}

export function formatPhone(phone: string) {
  const n = phone.replace(/\D/g, '')
  if (n.startsWith('62')) return n
  if (n.startsWith('0')) return '62' + n.slice(1)
  return '62' + n
}

export function waLink(phone: string, msg: string) {
  return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(msg)}`
}

export function msgSiap(order: Order) {
  const meja = order.table_number > 0 ? `Meja ${order.table_number}` : 'Walk-in'
  const bayar = order.payment_method === 'qris' ? 'QRIS' : order.payment_method === 'transfer' ? 'Transfer' : 'Tunai'
  return `Halo ${order.customer_name || 'Kak'}! 👋\n\nPesananmu di *${BRAND_FULL}* sudah siap diambil. 🔔\n\n🪑 ${meja}\n💳 Pembayaran: ${bayar}\n\nSilakan ke kasir ya! ☕`
}

export function msgStruk(order: Order) {
  const meja = order.table_number > 0 ? `Meja ${order.table_number}` : 'Walk-in'
  const bayar = order.payment_method === 'qris' ? 'QRIS' : order.payment_method === 'transfer' ? 'Transfer' : 'Tunai'
  const tanggal = fmtWITDateShort(order.created_at)
  const waktu = formatTime(order.created_at)
  const noOrder = order.id.slice(0, 8).toUpperCase()
  const total = orderTotal(order.items)
  const totalQty = order.items.reduce((s, i) => s + i.qty, 0)

  const lines = order.items.map(i =>
    `${i.name}\n   ${i.qty} × ${formatRp(i.price)} = *${formatRp(i.price * i.qty)}*`
  ).join('\n')

  const sep = '━━━━━━━━━━━━━━━'

  return [
    `*${BRAND.name} ${BRAND.tagline.toUpperCase()}*`,
    `_${BRAND.city}, Indonesia_`,
    sep,
    `🧾 No. Order: *${noOrder}*`,
    `📅 ${tanggal}, ${waktu} WIT`,
    `🪑 ${meja}`,
    `👤 ${order.customer_name || 'Customer'}`,
    sep,
    lines,
    sep,
    `Total ${totalQty} item`,
    `💰 *TOTAL: ${formatRp(total)}*`,
    `💳 Bayar: ${bayar} ✓ LUNAS`,
    sep,
    `Terima kasih sudah mampir! ☕`,
    `Sampai jumpa lagi di ${BRAND_NICE} 🤎`,
    ``,
    `_Struk digital — ${BRAND_NICE} POS_`,
  ].join('\n')
}

export function formatDuration(startIso: string, endIso?: string | null) {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const totalMin = Math.max(0, Math.floor((end - start) / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} mnt`
  return `${h}j ${m}mnt`
}

export function playNewOrderSound(volume = 0.25) {
  try {
    const ctx = new AudioContext()
    const notes = [880, 1108, 1320]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.14
      gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc.start(t); osc.stop(t + 0.4)
    })
  } catch { /* blocked */ }
}

export function playAlarmSound() {
  try {
    const ctx = new AudioContext()
    // Nada urgent — turun naik 3x
    const pattern = [1320, 880, 1320, 880, 1320]
    pattern.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'square'; osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.18, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      osc.start(t); osc.stop(t + 0.22)
    })
  } catch { /* blocked */ }
}

export type PayMethod = 'tunai' | 'qris' | 'transfer'
export const PAY_OPTS: { value: PayMethod; label: string; icon: string }[] = [
  { value: 'tunai', label: 'Tunai', icon: '💵' },
  { value: 'qris', label: 'QRIS', icon: '⬛' },
  { value: 'transfer', label: 'Transfer', icon: '🏦' },
]
