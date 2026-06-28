'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Order, OrderItem, Shift } from '@/types'
import { EMPLOYEES } from '@/types'
import { subscribePush, sendPush } from '@/lib/push'

const OWNER_WA = '6281245400031'

// ═══ OFFLINE / PENDING QUEUE ═══════════════════════════════
const PENDING_ORDERS_KEY = 'hallu-kasir-pending-orders'
const MENU_CACHE_KEY = 'hallu-kasir-menu-cache'

type PendingOrder = {
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

function loadPendingOrders(): PendingOrder[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(PENDING_ORDERS_KEY) || '[]') } catch { return [] }
}

function savePendingOrders(orders: PendingOrder[]) {
  localStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(orders))
}

function queuePendingOrder(data: PendingOrder['data']): PendingOrder {
  const pending: PendingOrder = {
    tempId: 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    data, queuedAt: Date.now(), retries: 0,
  }
  const all = loadPendingOrders()
  all.push(pending)
  savePendingOrders(all)
  return pending
}

function cacheMenu(items: MenuItem[]) {
  try { localStorage.setItem(MENU_CACHE_KEY, JSON.stringify({ items, cachedAt: Date.now() })) } catch { /* quota */ }
}
function loadCachedMenu(): MenuItem[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MENU_CACHE_KEY)
    if (!raw) return null
    const { items } = JSON.parse(raw)
    return items as MenuItem[]
  } catch { return null }
}

// Hook online/offline
function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

function formatRp(n: number) { return 'Rp ' + n.toLocaleString('id-ID') }
function formatTime(s: string) { return new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
function orderTotal(items: OrderItem[]) { return items.reduce((s, i) => s + i.price * i.qty, 0) }

function buildDailyReport(orders: Order[], date: string, shifts: Shift[] = []): string {
  const d = new Date(date)
  const tanggal = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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
    const jamStart = new Date(s.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const jamEnd = s.ended_at ? new Date(s.ended_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'masih jaga'
    return `• *${s.employee_name}* (${jamStart}–${jamEnd}) — ${so.length} order, ${formatRp(sr)}`
  })

  const lines = [
    `📊 *LAPORAN HARIAN HALLU*`,
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
    `_Laporan otomatis dari Hallu POS_ 🚀`,
  ].filter(l => l !== undefined)

  return lines.join('\n')
}

async function requestNotifPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission()
}

function showBrowserNotif(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg', tag: 'hallu-order' })
  }
}

function formatPhone(phone: string) {
  const n = phone.replace(/\D/g, '')
  if (n.startsWith('62')) return n
  if (n.startsWith('0')) return '62' + n.slice(1)
  return '62' + n
}

function waLink(phone: string, msg: string) {
  return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(msg)}`
}

function msgSiap(order: Order) {
  const meja = order.table_number > 0 ? `Meja ${order.table_number}` : 'Walk-in'
  const bayar = order.payment_method === 'qris' ? 'QRIS' : order.payment_method === 'transfer' ? 'Transfer' : 'Tunai'
  return `Halo ${order.customer_name || 'Kak'}! 👋\n\nPesananmu di *Hallu Coffee & Sociality* sudah siap diambil. 🔔\n\n🪑 ${meja}\n💳 Pembayaran: ${bayar}\n\nSilakan ke kasir ya! ☕`
}

function msgStruk(order: Order) {
  const meja = order.table_number > 0 ? `Meja ${order.table_number}` : 'Walk-in'
  const bayar = order.payment_method === 'qris' ? 'QRIS' : order.payment_method === 'transfer' ? 'Transfer' : 'Tunai'
  const d = new Date(order.created_at)
  const tanggal = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  const waktu = formatTime(order.created_at)
  const noOrder = order.id.slice(0, 8).toUpperCase()
  const total = orderTotal(order.items)
  const totalQty = order.items.reduce((s, i) => s + i.qty, 0)

  const lines = order.items.map(i =>
    `${i.name}\n   ${i.qty} × ${formatRp(i.price)} = *${formatRp(i.price * i.qty)}*`
  ).join('\n')

  const sep = '━━━━━━━━━━━━━━━'

  return [
    `*HALLU COFFEE & SOCIALITY*`,
    `_Ternate, Indonesia_`,
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
    `Sampai jumpa lagi di Hallu 🤎`,
    ``,
    `_Struk digital — Hallu POS_`,
  ].join('\n')
}

// ── Business Day Logic ─────────────────────────────────────
// Café operate kadang sampai dini hari. "Hari ini" buat rekap = 5 pagi - 5 pagi besok
const DAY_CUTOFF_HOUR = 5

// Tanggal business day "sekarang" — jam <5 pagi = masih hitung kemarin
function getCurrentBusinessDay(): string {
  const now = new Date()
  if (now.getHours() < DAY_CUTOFF_HOUR) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return toLocalDateString(yesterday)
  }
  return toLocalDateString(now)
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Bounds business day untuk tanggal tertentu:
// "2 Juni" = 2 Juni 05:00 sampai 3 Juni 04:59:59
function getBusinessDayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d, DAY_CUTOFF_HOUR, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(end.getMilliseconds() - 1)
  return { start, end }
}

function formatDuration(startIso: string, endIso?: string | null) {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const totalMin = Math.max(0, Math.floor((end - start) / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} mnt`
  return `${h}j ${m}mnt`
}

function playNewOrderSound(volume = 0.25) {
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

function playAlarmSound() {
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

type PayMethod = 'tunai' | 'qris' | 'transfer'
const PAY_OPTS: { value: PayMethod; label: string; icon: string }[] = [
  { value: 'tunai', label: 'Tunai', icon: '💵' },
  { value: 'qris', label: 'QRIS', icon: '⬛' },
  { value: 'transfer', label: 'Transfer', icon: '🏦' },
]

function OrderCard({ order, onDone, onCancel, onReady, onPreparing }: { order: Order; onDone?: (method: PayMethod) => void; onCancel?: () => void; onReady?: () => void; onPreparing?: () => void }) {
  const [paying, setPaying] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const total = orderTotal(order.items)
  const isPreparing = order.status === 'preparing'
  const isReady = order.status === 'ready'
  const isActive = order.status === 'new' || isPreparing || isReady
  const payOpt = PAY_OPTS.find(p => p.value === order.payment_method)

  return (
    <div className={`bg-h-card rounded-2xl overflow-hidden border-l-4 ${isReady ? 'border-green-500' : isPreparing ? 'border-yellow-500' : isActive ? 'border-h-red' : 'border-h-border'}`}>
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-h-border">
        <div>
          <div className="font-sans font-black text-white text-lg uppercase tracking-wider">
            {order.table_number > 0 ? `Meja ${order.table_number}` : 'Walk-in'}
          </div>
          {order.customer_name && <div className="text-xs text-h-muted mt-0.5">a/n {order.customer_name}</div>}
        </div>
        <div className="text-right">
          <div className="text-xs text-h-muted">{formatTime(order.created_at)}</div>
          {payOpt && <div className="text-xs text-h-cream font-bold mt-0.5">{payOpt.icon} {payOpt.label}</div>}
        </div>
      </div>
      <div className="px-4 py-3 space-y-1.5 border-b border-h-border">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-white/80">{item.name} <span className="text-h-muted">×{item.qty}</span></span>
            <span className="text-h-muted">{formatRp(item.price * item.qty)}</span>
          </div>
        ))}
      </div>
      {order.note && <div className="px-4 py-2 border-b border-h-border"><span className="text-xs text-yellow-400">📝 {order.note}</span></div>}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-h-muted">Total</div>
            <div className="font-black text-white">{formatRp(total)}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isReady && onDone && !paying && (
              <span className="text-xs text-green-400 font-bold animate-pulse">● Siap diambil</span>
            )}
            {isPreparing && !isReady && !paying && (
              <span className="text-xs text-yellow-400 font-bold">⏳ Disiapkan</span>
            )}
            {onCancel && !paying && !isReady && !isPreparing && (
              confirmCancel ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-h-muted">Batalkan?</span>
                  <button onClick={onCancel} className="text-xs text-white bg-h-border hover:bg-white/20 px-2.5 py-1 rounded-lg font-bold transition-colors">Ya</button>
                  <button onClick={() => setConfirmCancel(false)} className="text-xs text-h-muted hover:text-white font-bold">Tidak</button>
                </div>
              ) : (
                <button onClick={() => setConfirmCancel(true)} className="text-xs text-h-muted hover:text-white border border-h-border hover:border-white/30 px-3 py-1.5 rounded-full transition-colors">
                  Batalkan
                </button>
              )
            )}
            {onPreparing && !isPreparing && !isReady && !paying && (
              <button onClick={onPreparing} className="bg-h-dark border border-h-border hover:border-white/40 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors">
                Proses →
              </button>
            )}
            {onReady && isPreparing && !isReady && !paying && (
              <button onClick={onReady} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors">
                Siap →
              </button>
            )}
            {isReady && onDone && !paying && (
              <button
                onClick={() => order.payment_method ? onDone(order.payment_method as PayMethod) : setPaying(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors">
                Selesai ✓
              </button>
            )}
            {!onDone && <span className="text-xs text-h-muted bg-h-border px-3 py-1.5 rounded-full">Selesai</span>}
            {/* WA notif siap */}
            {isReady && order.phone && (
              <a href={waLink(order.phone, msgSiap(order))} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors">
                📱 WA Siap
              </a>
            )}
            {/* WA struk */}
            {!onDone && order.phone && (
              <a href={waLink(order.phone, msgStruk(order))} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 border border-h-border hover:border-white/30 text-h-muted hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors">
                📄 Struk WA
              </a>
            )}
          </div>
        </div>
        {paying && onDone && (
          <div className="mt-3">
            <div className="text-xs text-h-muted mb-2">Metode bayar:</div>
            <div className="flex gap-2">
              {PAY_OPTS.map(opt => (
                <button key={opt.value} onClick={() => onDone(opt.value)}
                  className="flex-1 bg-h-dark border border-h-border hover:border-h-red text-white py-2 rounded-xl text-xs font-bold transition-colors">
                  {opt.icon}<br />{opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const CATEGORIES = ['Kopi', 'Non-Kopi', 'Makanan', 'Lainnya']

function ManualOrderForm({ onSubmitted, isOnline }: { onSubmitted: () => void; isOnline: boolean }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [table, setTable] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Tampilkan cache dulu (kalau ada) → fetch online → update kalau berhasil
    const cached = loadCachedMenu()
    if (cached) setMenuItems(cached)
    ;(async () => {
      try {
        const { data } = await supabase.from('menu_items').select('*').eq('available', true).order('category').order('name')
        if (data && data.length) {
          setMenuItems(data as MenuItem[])
          cacheMenu(data as MenuItem[])
        }
      } catch { /* offline / network error → tetap pakai cached */ }
    })()
  }, [])

  const add = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const remove = (id: string) => setCart(c => {
    const next = (c[id] || 0) - 1
    if (next <= 0) { const { [id]: _, ...rest } = c; return rest } // eslint-disable-line
    return { ...c, [id]: next }
  })

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0)
  const totalPrice = menuItems.filter(i => cart[i.id]).reduce((s, i) => s + i.price * cart[i.id], 0)

  const handleSubmit = async () => {
    if (totalItems === 0) return setError('Pilih minimal 1 item')
    if (!name.trim()) return setError('Isi nama pemesan')
    if (!payMethod) return setError('Pilih metode bayar')
    setSubmitting(true); setError('')

    const orderItems = menuItems.filter(i => cart[i.id]).map(i => ({
      id: i.id, name: i.name, price: i.price, qty: cart[i.id]
    }))
    const orderData = {
      table_number: parseInt(table) || 0,
      customer_name: name.trim(),
      items: orderItems,
      note: null,
      status: 'new' as const,
      payment_method: payMethod,
    }

    // Kalau offline → queue ke localStorage
    if (!isOnline) {
      queuePendingOrder(orderData)
      setCart({}); setName(''); setTable(''); setPayMethod(null)
      setSubmitting(false)
      onSubmitted()
      return
    }

    try {
      const { error: err } = await supabase.from('orders').insert(orderData)
      if (err) throw err
      setCart({}); setName(''); setTable(''); setPayMethod(null)
      onSubmitted()
    } catch {
      // Server error → tetap queue, bukan error kerasi ke user
      queuePendingOrder(orderData)
      setCart({}); setName(''); setTable(''); setPayMethod(null)
      onSubmitted()
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-5 pb-10">
      {CATEGORIES.map(cat => {
        const catItems = menuItems.filter(i => i.category === cat)
        if (!catItems.length) return null
        return (
          <div key={cat}>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-1 h-3.5 bg-h-red rounded-full inline-block" />{cat}
            </h3>
            <div className="bg-h-card border border-h-border rounded-2xl divide-y divide-h-border">
              {catItems.map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white font-medium">{item.name}</div>
                    <div className="text-xs text-h-cream font-bold">{formatRp(item.price)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cart[item.id] > 0 && (
                      <>
                        <button onClick={() => remove(item.id)} className="w-7 h-7 rounded-full border border-h-border flex items-center justify-center text-white font-bold text-lg leading-none">−</button>
                        <span className="w-5 text-center font-bold text-white text-sm">{cart[item.id]}</span>
                      </>
                    )}
                    <button onClick={() => add(item.id)} className="w-7 h-7 rounded-full bg-h-red hover:bg-h-red-d flex items-center justify-center text-white font-bold text-lg leading-none transition-colors">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {totalItems > 0 && (
        <div className="bg-h-card border border-h-border rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-h-border">
            <span className="text-h-muted text-sm">{totalItems} item</span>
            <span className="font-black text-white text-xl">{formatRp(totalPrice)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-h-muted block mb-1.5">Nama Pemesan *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama customer"
                className="w-full bg-h-dark border border-h-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-h-red transition-colors placeholder-h-muted" />
            </div>
            <div>
              <label className="text-xs text-h-muted block mb-1.5">No. Meja (opsional)</label>
              <input value={table} onChange={e => setTable(e.target.value)} placeholder="Misal: 5"
                className="w-full bg-h-dark border border-h-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-h-red transition-colors placeholder-h-muted" />
            </div>
          </div>
          <div>
            <label className="text-xs text-h-muted block mb-2">Metode Bayar *</label>
            <div className="flex gap-2">
              {PAY_OPTS.map(opt => (
                <button key={opt.value} onClick={() => setPayMethod(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors border ${payMethod === opt.value ? 'bg-h-red border-h-red text-white' : 'bg-h-dark border-h-border text-h-muted hover:text-white'}`}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-h-red hover:bg-h-red-d disabled:opacity-60 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">
            {submitting ? 'Menyimpan...' : 'Proses Order'}
          </button>
        </div>
      )}
    </div>
  )
}

type Tab = 'new' | 'manual' | 'history' | 'rekap'

export default function KasirPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState(''); const [pwError, setPwError] = useState('')
  const [newOrders, setNewOrders] = useState<Order[]>([])
  const [doneOrders, setDoneOrders] = useState<Order[]>([])
  const [tab, setTab] = useState<Tab>('new')
  const [loading, setLoading] = useState(true)
  const [rekapDate, setRekapDate] = useState(() => getCurrentBusinessDay())
  const [isIdle, setIsIdle] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [closeReportOrders, setCloseReportOrders] = useState<Order[]>([])
  const [closeReportShifts, setCloseReportShifts] = useState<Shift[]>([])
  const [closeReportLoading, setCloseReportLoading] = useState(false)
  const [aiReport, setAiReport] = useState<string | null>(null)
  const [aiReportLoading, setAiReportLoading] = useState(false)
  const [aiReportError, setAiReportError] = useState<string | null>(null)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [strukOrder, setStrukOrder] = useState<Order | null>(null)
  const [strukPhone, setStrukPhone] = useState('')
  // ── Shift state ──────────────────────────────────────────
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [showStartShift, setShowStartShift] = useState(false)
  const [showHandover, setShowHandover] = useState(false)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [shiftTick, setShiftTick] = useState(0) // re-render tiap 60s untuk update durasi
  const initialized = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    setIsIdle(false)
    idleTimer.current = setTimeout(() => setIsIdle(true), 30000)
  }

  useEffect(() => {
    if (!authed) return
    const events = ['mousemove', 'click', 'keypress', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetIdle))
    resetIdle()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdle))
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [authed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Jangan idle kalau ada order aktif
  useEffect(() => {
    if (newOrders.length > 0) { setIsIdle(false); resetIdle() }
  }, [newOrders]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (localStorage.getItem('hallu-kasir') === 'ok') setAuthed(true) }, [])

  const loadNew = async () => {
    const { data } = await supabase.from('orders').select('*').in('status', ['new', 'preparing', 'ready']).order('created_at', { ascending: true })
    if (data) setNewOrders(data as Order[])
    setLoading(false)
  }

  const loadDone = async (date?: string) => {
    const { start, end } = getBusinessDayBounds(date || rekapDate)
    const { data } = await supabase.from('orders').select('*').eq('status', 'done').gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at', { ascending: false })
    if (data) setDoneOrders(data as Order[])
  }

  useEffect(() => {
    if (!authed) return
    loadNew().then(() => { initialized.current = true })
  }, [authed])

  useEffect(() => {
    if (!authed) return
    const ch = supabase.channel('kasir-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const order = payload.new as Order
        setNewOrders(prev => {
          if (prev.find(o => o.id === order.id)) return prev
          return [...prev, order].sort((a, b) => a.created_at.localeCompare(b.created_at))
        })
        if (initialized.current) {
          playNewOrderSound()
          const meja = order.table_number > 0 ? `Meja ${order.table_number}` : 'Walk-in'
          const nama = order.customer_name ? ` — ${order.customer_name}` : ''
          showBrowserNotif('🔔 Order Baru!', `${meja}${nama}`)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const updated = payload.new as Order
        if (updated.status === 'done') {
          setNewOrders(prev => prev.filter(o => o.id !== updated.id))
          setDoneOrders(prev => prev.find(o => o.id === updated.id) ? prev : [updated, ...prev])
        } else if (updated.status === 'preparing' || updated.status === 'ready') {
          setNewOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
        } else if (updated.status === 'cancelled') {
          setNewOrders(prev => prev.filter(o => o.id !== updated.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [authed])

  useEffect(() => {
    const count = newOrders.length
    document.title = count > 0 ? `(${count}) Order Baru | Hallu Kasir` : 'Hallu Kasir'
  }, [newOrders])

  // Fix: reload orders saat tab kembali aktif (Realtime kadang disconnect saat tab lama tidak aktif)
  useEffect(() => {
    if (!authed) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadNew()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [authed]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SHIFT MANAGEMENT ─────────────────────────────────────
  // Load shift aktif dari Supabase saat login
  useEffect(() => {
    if (!authed) return
    supabase.from('shifts').select('*').is('ended_at', null)
      .order('started_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data) setActiveShift(data as Shift)
        else setShowStartShift(true) // belum ada shift → tampilkan dialog start
      })
  }, [authed])

  // Tick timer — re-render tiap 60s untuk update durasi shift
  useEffect(() => {
    if (!activeShift) return
    const t = setInterval(() => setShiftTick(x => x + 1), 60000)
    return () => clearInterval(t)
  }, [activeShift])

  const startShift = async (employee: string, openingNotes?: string) => {
    setShiftLoading(true)
    const { data } = await supabase.from('shifts')
      .insert({ employee_name: employee, opening_notes: openingNotes || null })
      .select('*').single()
    if (data) {
      setActiveShift(data as Shift)
      setShowStartShift(false)
    }
    setShiftLoading(false)
  }

  const endShift = async (closingNotes?: string, handoverTo?: string) => {
    if (!activeShift) return null
    setShiftLoading(true)
    const { data } = await supabase.from('shifts').update({
      ended_at: new Date().toISOString(),
      closing_notes: closingNotes || null,
      handover_to: handoverTo || null,
    }).eq('id', activeShift.id).select('*').single()
    setShiftLoading(false)
    return data as Shift | null
  }

  const handoverShift = async (toEmployee: string, notes?: string) => {
    const closed = await endShift(notes, toEmployee)
    if (closed) {
      // langsung mulai shift baru untuk karyawan berikutnya
      await startShift(toEmployee, `Lanjutan shift dari ${closed.employee_name}`)
      setShowHandover(false)
    }
  }

  // Suppress unused warning untuk shiftTick (dipakai untuk re-render)
  void shiftTick

  // ── Wake Lock: cegah layar tablet mati ──────────────────
  const acquireWakeLock = async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen')
      setWakeLockActive(true)
      wakeLockRef.current.addEventListener('release', () => setWakeLockActive(false))
    } catch { /* tidak didukung / user deny */ }
  }

  useEffect(() => {
    if (!authed) return
    acquireWakeLock()
    // Re-acquire saat tab aktif kembali (wake lock lepas saat background)
    const onVisible = () => { if (document.visibilityState === 'visible') acquireWakeLock() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      wakeLockRef.current?.release()
    }
  }, [authed]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Offline queue auto-sync ─────────────────────────────
  const syncPendingOrders = async () => {
    if (syncing) return
    const pending = loadPendingOrders()
    if (pending.length === 0) { setPendingCount(0); return }
    setSyncing(true)
    const stillPending: PendingOrder[] = []
    for (const p of pending) {
      try {
        const { error } = await supabase.from('orders').insert(p.data)
        if (error) throw error
        // sukses → tidak masukin ke stillPending
      } catch (err) {
        p.retries++
        p.lastError = err instanceof Error ? err.message : 'sync error'
        if (p.retries < 10) stillPending.push(p)
        // > 10 retry: drop biar gak loop forever; user bisa cek di console kalau perlu
      }
    }
    savePendingOrders(stillPending)
    setPendingCount(stillPending.length)
    setSyncing(false)
  }

  // Hitung pending saat mount + listen perubahan
  useEffect(() => {
    if (!authed) return
    setPendingCount(loadPendingOrders().length)
    const handler = () => setPendingCount(loadPendingOrders().length)
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [authed])

  // Auto-sync saat online kembali
  useEffect(() => {
    if (!authed) return
    if (isOnline && pendingCount > 0) {
      syncPendingOrders()
    }
  }, [isOnline, authed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync ringan tiap 30 detik kalau ada pending (untuk kasus Supabase down tapi navigator.onLine = true)
  useEffect(() => {
    if (!authed || !isOnline || pendingCount === 0) return
    const t = setInterval(() => syncPendingOrders(), 30000)
    return () => clearInterval(t)
  }, [authed, isOnline, pendingCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Repeating alarm: bunyi tiap 30 detik kalau ada order baru ──
  useEffect(() => {
    if (alarmRef.current) clearInterval(alarmRef.current)
    if (newOrders.length > 0) {
      alarmRef.current = setInterval(() => {
        // Hanya bunyi kalau tab visible (user di depan layar tapi tidak lihat)
        if (document.visibilityState === 'visible') playAlarmSound()
      }, 30000)
    }
    return () => { if (alarmRef.current) clearInterval(alarmRef.current) }
  }, [newOrders.length])

  const markDone = async (id: string, method: PayMethod) => {
    const order = newOrders.find(o => o.id === id)
    setNewOrders(prev => prev.filter(o => o.id !== id))
    await supabase.from('orders').update({ status: 'done', payment_method: method }).eq('id', id)
    // Munculkan modal struk digital
    if (order) {
      const doneOrder = { ...order, status: 'done' as const, payment_method: method }
      setStrukOrder(doneOrder)
      setStrukPhone(order.phone || '')
    }
  }

  const markPreparing = async (id: string) => {
    setNewOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'preparing' } : o))
    await supabase.from('orders').update({ status: 'preparing' }).eq('id', id)
  }

  const markReady = async (id: string) => {
    const order = newOrders.find(o => o.id === id)
    setNewOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'ready' } : o))
    await supabase.from('orders').update({ status: 'ready' }).eq('id', id)
    // Push ke customer kalau ada subscription
    if (order) {
      const meja = order.table_number > 0 ? `Meja ${order.table_number}` : 'Walk-in'
      sendPush('customer', {
        title: '🔔 Pesanan Siap!',
        body: `${meja} — silakan ke kasir untuk ambil & bayar.`,
        url: '/menu',
        tag: 'order-ready'
      }, id)
    }
  }

  const cancelOrder = async (id: string) => {
    setNewOrders(prev => prev.filter(o => o.id !== id))
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
  }

  const openCloseModal = async () => {
    setShowCloseModal(true)
    setCloseReportLoading(true)
    setAiReport(null); setAiReportError(null)
    const today = getCurrentBusinessDay()
    const { start, end } = getBusinessDayBounds(today)
    const [ordersRes, shiftsRes] = await Promise.all([
      supabase.from('orders').select('*')
        .eq('status', 'done')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),
      supabase.from('shifts').select('*')
        .gte('started_at', start.toISOString())
        .lte('started_at', end.toISOString())
        .order('started_at', { ascending: true }),
    ])
    setCloseReportOrders((ordersRes.data as Order[]) || [])
    setCloseReportShifts((shiftsRes.data as Shift[]) || [])
    setCloseReportLoading(false)
  }

  const generateAiReport = async () => {
    setAiReportLoading(true); setAiReportError(null)
    try {
      const todayStr = getCurrentBusinessDay()
      // Bounds business day kemarin
      const yesterdayDateObj = new Date(todayStr); yesterdayDateObj.setDate(yesterdayDateObj.getDate() - 1)
      const yesterdayStr = toLocalDateString(yesterdayDateObj)
      const yBounds = getBusinessDayBounds(yesterdayStr)
      // Last 7 business days (start from 7 hari lalu jam 5 pagi)
      const weekStartObj = new Date(todayStr); weekStartObj.setDate(weekStartObj.getDate() - 7)
      const weekStart = getBusinessDayBounds(toLocalDateString(weekStartObj)).start
      const todayBounds = getBusinessDayBounds(todayStr)

      // Yesterday + last 7 days
      const { data: weekData } = await supabase.from('orders').select('*')
        .eq('status', 'done')
        .gte('created_at', weekStart.toISOString())

      const allWeek = (weekData as Order[]) || []
      const yesterday = allWeek.filter(o => {
        const d = new Date(o.created_at)
        return d >= yBounds.start && d <= yBounds.end
      })

      const todayRevenue = closeReportOrders.reduce((s, o) => s + orderTotal(o.items), 0)
      const yesterdayRevenue = yesterday.reduce((s, o) => s + orderTotal(o.items), 0)
      // 7-day avg excludes today (pakai business day bounds — exclude orders di today bounds)
      const last7NotToday = allWeek.filter(o => {
        const d = new Date(o.created_at)
        return d < todayBounds.start || d > todayBounds.end
      })
      const sevenDayRevenue = last7NotToday.reduce((s, o) => s + orderTotal(o.items), 0)
      const weekAvgRevenue = Math.round(sevenDayRevenue / 7)

      // Per method
      const todayByMethod: Record<string, { total: number; count: number }> = {}
      closeReportOrders.forEach(o => {
        const m = o.payment_method || 'lainnya'
        if (!todayByMethod[m]) todayByMethod[m] = { total: 0, count: 0 }
        todayByMethod[m].total += orderTotal(o.items)
        todayByMethod[m].count++
      })

      // Top items
      const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
      closeReportOrders.forEach(o => o.items.forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 }
        itemMap[i.name].qty += i.qty
        itemMap[i.name].revenue += i.price * i.qty
      }))
      const todayTopItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty)

      // Rating
      const ratedOrders = closeReportOrders.filter(o => o.rating)
      const todayAvgRating = ratedOrders.length
        ? Math.round((ratedOrders.reduce((s, o) => s + (o.rating || 0), 0) / ratedOrders.length) * 10) / 10
        : null

      // Peak hour
      const hourCounts: Record<number, number> = {}
      closeReportOrders.forEach(o => {
        const h = new Date(o.created_at).getHours()
        hourCounts[h] = (hourCounts[h] || 0) + 1
      })
      const todayPeakHour = Object.entries(hourCounts).sort(([,a], [,b]) => b - a)[0]?.[0]
        ? parseInt(Object.entries(hourCounts).sort(([,a], [,b]) => b - a)[0][0])
        : null

      const res = await fetch('/api/ai/daily-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: todayStr,
          todayRevenue, todayOrders: closeReportOrders.length,
          todayByMethod, todayTopItems, todayAvgRating, todayPeakHour,
          yesterdayRevenue, yesterdayOrders: yesterday.length, weekAvgRevenue,
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal generate laporan')
      setAiReport(json.report)
    } catch (err) {
      setAiReportError(err instanceof Error ? err.message : 'Gagal generate laporan')
    } finally {
      setAiReportLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/kasir-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
    if (res.ok) {
      localStorage.setItem('hallu-kasir', 'ok')
      setAuthed(true)
      subscribePush('kasir') // daftar push notification kasir
    }
    else setPwError('Password salah')
  }

  const rekap = useMemo(() => {
    const revenue = doneOrders.reduce((s, o) => s + orderTotal(o.items), 0)
    const byMethod: Record<string, number> = {}
    doneOrders.forEach(o => {
      const m = o.payment_method || 'lainnya'
      byMethod[m] = (byMethod[m] || 0) + orderTotal(o.items)
    })
    const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    doneOrders.forEach(o => o.items.forEach(item => {
      if (!itemMap[item.name]) itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 }
      itemMap[item.name].qty += item.qty
      itemMap[item.name].revenue += item.price * item.qty
    }))
    return { revenue, byMethod, orderCount: doneOrders.length, topItems: Object.values(itemMap).sort((a, b) => b.qty - a.qty) }
  }, [doneOrders])

  if (!authed) return (
    <div className="min-h-screen bg-h-bg flex items-center justify-center p-6">
      <div className="bg-h-card border border-h-border rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-sans text-2xl font-black text-white tracking-widest uppercase">HALLU</div>
          <div className="flex items-center gap-2 justify-center mt-1">
            <div className="h-px w-6 bg-h-red" />
            <div className="text-h-cream text-[0.5rem] tracking-[3px] uppercase font-semibold">Dashboard Kasir</div>
            <div className="h-px w-6 bg-h-red" />
          </div>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-h-muted font-semibold uppercase tracking-wide block mb-1.5">Password</label>
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwError('') }}
              className="w-full bg-h-dark border border-h-border rounded-xl px-4 py-3 focus:outline-none focus:border-h-red transition-colors text-sm text-white placeholder-h-muted"
              placeholder="Masukkan password kasir" autoFocus />
            {pwError && <p className="text-red-400 text-xs mt-1">{pwError}</p>}
          </div>
          <button type="submit" className="w-full bg-h-red hover:bg-h-red-d text-white py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">Masuk</button>
        </form>
      </div>
    </div>
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: 'new', label: `Order Masuk${newOrders.length > 0 ? ` (${newOrders.length})` : ''}` },
    { key: 'manual', label: 'Input Manual' },
    { key: 'history', label: 'Riwayat' },
    { key: 'rekap', label: 'Rekap' },
  ]

  return (
    <div className="min-h-screen bg-h-bg" onClick={resetIdle}>
      {/* Screensaver */}
      {isIdle && (
        <div
          onClick={() => setIsIdle(false)}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center cursor-pointer select-none"
          style={{ backgroundColor: '#7C1515' }}
        >
          <div className="text-center animate-pulse" style={{ animationDuration: '3s' }}>
            <div className="font-serif text-7xl mb-2" style={{ color: '#D4B896', fontFamily: 'var(--font-playfair)', letterSpacing: '0.05em' }}>
              هالو
            </div>
            <div className="font-sans font-black text-3xl tracking-[0.3em] uppercase mb-1" style={{ color: '#D4B896' }}>
              HALLU
            </div>
            <div className="text-xs tracking-[0.25em] uppercase" style={{ color: '#B8967A' }}>
              Coffee &amp; Sociality
            </div>
          </div>
          <div className="absolute bottom-10 text-xs tracking-widest uppercase opacity-40" style={{ color: '#D4B896' }}>
            Ketuk untuk melanjutkan
          </div>
        </div>
      )}
      <header className="bg-h-dark border-b border-h-border">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <div className="font-sans text-xl font-black text-white tracking-widest uppercase">HALLU</div>
            <div className="text-h-cream text-[0.55rem] tracking-[3px] uppercase font-semibold mt-0.5">Dashboard Kasir</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Active Shift badge */}
            {activeShift && (
              <button onClick={() => setShowHandover(true)}
                className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
                title="Klik kalau ada yang datang gantiin / mau tutup">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Jaga: {activeShift.employee_name}
                <span className="text-blue-300/70 font-normal">· {formatDuration(activeShift.started_at)}</span>
              </button>
            )}
            {newOrders.length > 0 && (
              <span className="bg-h-red text-white text-xs font-black px-3 py-1 rounded uppercase tracking-wide animate-pulse">
                {newOrders.length} baru
              </span>
            )}
            {/* Connection status */}
            <button
              onClick={() => isOnline && pendingCount > 0 && syncPendingOrders()}
              title={isOnline ? (pendingCount > 0 ? `${pendingCount} order menunggu sync — klik untuk sync sekarang` : 'Terhubung ke server') : 'Offline — order disimpan lokal, auto-sync saat online'}
              className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors flex items-center gap-1.5 ${
                !isOnline
                  ? 'bg-h-red/15 text-h-cream border border-h-red/40 animate-pulse'
                  : pendingCount > 0
                    ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/25 cursor-pointer'
                    : 'bg-green-500/15 text-green-400 border border-green-500/30'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${!isOnline ? 'bg-h-red' : pendingCount > 0 ? 'bg-yellow-400' : 'bg-green-400'}`} />
              {!isOnline
                ? `🔴 Offline${pendingCount > 0 ? ` · ${pendingCount} antri` : ''}`
                : pendingCount > 0
                  ? `${syncing ? '⏳' : '🔄'} Sync ${pendingCount}`
                  : '🟢 Online'}
            </button>

            {/* Wake Lock indicator */}
            <span title={wakeLockActive ? 'Layar tidak akan mati' : 'Wake lock tidak aktif'}
              className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors ${wakeLockActive ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-h-border text-h-muted border border-h-border'}`}>
              {wakeLockActive ? '🔆 Layar Aktif' : '💤 Layar Bisa Mati'}
            </span>
            <button onClick={openCloseModal}
              className="bg-h-red/10 hover:bg-h-red/20 border border-h-red/40 text-h-cream px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors">
              Tutup Kasir
            </button>
            <button onClick={() => { localStorage.removeItem('hallu-kasir'); setAuthed(false) }}
              className="border border-h-border hover:border-white/30 text-h-muted hover:text-white px-4 py-1.5 rounded-full text-sm transition-colors">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <div className="bg-h-dark border-b border-h-border sticky top-0 z-30 overflow-x-auto">
        <div className="max-w-4xl mx-auto flex min-w-max">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => { setTab(key); if (key === 'history' || key === 'rekap') loadDone(rekapDate) }}
              className={`px-5 py-3.5 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors border-b-2 ${tab === key ? 'text-h-cream border-h-red' : 'text-h-muted border-transparent hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-5">
        {tab === 'manual' ? (
          <ManualOrderForm isOnline={isOnline} onSubmitted={() => { setTab('new'); setPendingCount(loadPendingOrders().length) }} />
        ) : loading ? (
          <div className="text-center text-h-muted text-sm pt-16">Memuat pesanan...</div>
        ) : tab === 'new' ? (
          newOrders.length === 0 ? (
            <div className="text-center pt-20">
              <div className="text-5xl mb-4">☕</div>
              <div className="text-h-muted text-sm">Belum ada pesanan baru</div>
              <button onClick={() => setTab('manual')} className="mt-4 text-h-cream text-xs font-bold hover:underline">+ Input Manual</button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {newOrders.map(order => <OrderCard key={order.id} order={order} onDone={(m) => markDone(order.id, m)} onCancel={() => cancelOrder(order.id)} onPreparing={() => markPreparing(order.id)} onReady={() => markReady(order.id)} />)}
            </div>
          )
        ) : tab === 'history' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="date" value={rekapDate} onChange={e => { setRekapDate(e.target.value); loadDone(e.target.value) }}
                className="bg-h-card border border-h-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-h-red transition-colors" />
              <span className="text-xs text-h-muted">{doneOrders.length} order</span>
              <span className="text-[10px] text-h-muted/60 ml-auto">jam 05:00 – 04:59 hari ini</span>
            </div>
            {doneOrders.length === 0 ? (
              <div className="text-center pt-16"><div className="text-5xl mb-4">📋</div><div className="text-h-muted text-sm">Tidak ada riwayat di tanggal ini</div></div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {doneOrders.map(order => <OrderCard key={order.id} order={order} />)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="date" value={rekapDate} onChange={e => { setRekapDate(e.target.value); loadDone(e.target.value) }}
                className="bg-h-card border border-h-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-h-red transition-colors" />
              <span className="text-xs text-h-muted">{doneOrders.length > 0 ? `${doneOrders.length} transaksi` : 'Tidak ada data'}</span>
              <span className="text-[10px] text-h-muted/60 ml-auto">jam 05:00 – 04:59 hari ini</span>
            </div>
          {doneOrders.length === 0 ? (
            <div className="text-center pt-10"><div className="text-5xl mb-4">📊</div><div className="text-h-muted text-sm">Tidak ada transaksi di tanggal ini</div></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-h-card border border-h-border rounded-2xl p-5">
                  <div className="text-xs text-h-muted uppercase tracking-wider mb-1">Total Pendapatan</div>
                  <div className="font-black text-white text-2xl">{formatRp(rekap.revenue)}</div>
                </div>
                <div className="bg-h-card border border-h-border rounded-2xl p-5">
                  <div className="text-xs text-h-muted uppercase tracking-wider mb-1">Order Selesai</div>
                  <div className="font-black text-white text-2xl">{rekap.orderCount}</div>
                  <div className="text-xs text-h-muted mt-1">Rata-rata {formatRp(Math.round(rekap.revenue / rekap.orderCount))}</div>
                </div>
              </div>
              <div className="bg-h-card border border-h-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-h-border">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Per Metode Bayar</div>
                </div>
                <div className="divide-y divide-h-border">
                  {PAY_OPTS.map(opt => rekap.byMethod[opt.value] ? (
                    <div key={opt.value} className="px-5 py-3 flex justify-between items-center">
                      <span className="text-sm text-white">{opt.icon} {opt.label}</span>
                      <span className="font-bold text-white">{formatRp(rekap.byMethod[opt.value])}</span>
                    </div>
                  ) : null)}
                </div>
              </div>
              <div className="bg-h-card border border-h-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-h-border">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Item Terlaris</div>
                </div>
                <div className="divide-y divide-h-border">
                  {rekap.topItems.map((item, i) => (
                    <div key={item.name} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-h-muted w-5">{i + 1}</span>
                        <div>
                          <div className="text-sm font-semibold text-white">{item.name}</div>
                          <div className="text-xs text-h-muted">{item.qty}x terjual</div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-white">{formatRp(item.revenue)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
        )}
      </main>

      {/* ── Modal Start Shift ── */}
      {showStartShift && !activeShift && (
        <StartShiftModal onStart={startShift} loading={shiftLoading} />
      )}

      {/* ── Modal Serah Terima Shift ── */}
      {showHandover && activeShift && (
        <HandoverModal
          activeShift={activeShift}
          onClose={() => setShowHandover(false)}
          onHandover={handoverShift}
          onEndOnly={async (notes) => {
            await endShift(notes)
            setActiveShift(null)
            setShowHandover(false)
            setShowStartShift(true) // langsung tampilkan dialog start lagi
          }}
          loading={shiftLoading}
        />
      )}

      {/* ── Modal Struk Digital ── */}
      {strukOrder && (() => {
        const total = orderTotal(strukOrder.items)
        const totalQty = strukOrder.items.reduce((s, i) => s + i.qty, 0)
        const bayar = strukOrder.payment_method === 'qris' ? 'QRIS' : strukOrder.payment_method === 'transfer' ? 'Transfer' : 'Tunai'
        const noOrder = strukOrder.id.slice(0, 8).toUpperCase()
        const phoneValid = strukPhone.replace(/\D/g, '').length >= 9
        const waUrl = phoneValid ? waLink(strukPhone, msgStruk(strukOrder)) : '#'

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setStrukOrder(null)} />
            <div className="relative bg-h-card border border-h-border rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-h-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-lg">✓</span>
                  <span className="font-sans font-black text-white uppercase tracking-wider text-sm">Order Selesai</span>
                </div>
                <button onClick={() => setStrukOrder(null)} className="text-h-muted hover:text-white text-2xl leading-none">×</button>
              </div>

              {/* Struk preview — receipt style */}
              <div className="overflow-y-auto flex-1 p-5">
                <div className="bg-white text-black rounded-lg p-5 font-mono text-xs leading-relaxed shadow-lg">
                  <div className="text-center mb-2">
                    <div className="font-black text-sm tracking-wider">HALLU</div>
                    <div className="text-[9px] tracking-widest text-gray-500">COFFEE &amp; SOCIALITY</div>
                    <div className="text-[9px] text-gray-400">Ternate, Indonesia</div>
                  </div>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <div className="flex justify-between text-[10px]"><span>No. Order</span><span className="font-bold">{noOrder}</span></div>
                  <div className="flex justify-between text-[10px]"><span>Waktu</span><span>{new Date(strukOrder.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                  <div className="flex justify-between text-[10px]"><span>Meja</span><span>{strukOrder.table_number > 0 ? strukOrder.table_number : 'Walk-in'}</span></div>
                  <div className="flex justify-between text-[10px]"><span>Nama</span><span>{strukOrder.customer_name || 'Customer'}</span></div>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  {strukOrder.items.map((i, idx) => (
                    <div key={idx} className="mb-1">
                      <div className="font-bold">{i.name}</div>
                      <div className="flex justify-between text-gray-600">
                        <span>{i.qty} × {formatRp(i.price)}</span>
                        <span className="font-bold text-black">{formatRp(i.price * i.qty)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <div className="flex justify-between text-[10px] text-gray-500"><span>{totalQty} item</span></div>
                  <div className="flex justify-between font-black text-sm"><span>TOTAL</span><span>{formatRp(total)}</span></div>
                  <div className="flex justify-between text-[10px] mt-1"><span>Bayar: {bayar}</span><span className="text-green-600 font-bold">✓ LUNAS</span></div>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <div className="text-center text-[9px] text-gray-500">Terima kasih sudah mampir! ☕</div>
                </div>
              </div>

              {/* Kirim WA */}
              <div className="p-5 border-t border-h-border space-y-3">
                <div>
                  <label className="text-xs text-h-muted block mb-1.5">No. WhatsApp Customer</label>
                  <input
                    type="tel" value={strukPhone} onChange={e => setStrukPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-h-muted focus:outline-none focus:border-h-red transition-colors" />
                </div>
                <a
                  href={waUrl}
                  target="_blank" rel="noreferrer"
                  onClick={e => { if (!phoneValid) { e.preventDefault() } }}
                  className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors ${phoneValid ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-h-border text-h-muted cursor-not-allowed'}`}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {phoneValid ? 'Kirim Struk ke WA' : 'Isi no. WA dulu'}
                </a>
                <button onClick={() => setStrukOrder(null)}
                  className="w-full text-h-muted hover:text-white text-xs font-bold uppercase tracking-wider py-2 transition-colors">
                  Lewati / Tutup
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal Tutup Kasir & Laporan ── */}
      {showCloseModal && (() => {
        const today = new Date().toISOString().slice(0, 10)
        const revenue = closeReportOrders.reduce((s, o) => s + orderTotal(o.items), 0)
        const byMethod: Record<string, { total: number; count: number }> = {}
        closeReportOrders.forEach(o => {
          const m = o.payment_method || 'lainnya'
          if (!byMethod[m]) byMethod[m] = { total: 0, count: 0 }
          byMethod[m].total += orderTotal(o.items)
          byMethod[m].count++
        })
        const itemMap: Record<string, { name: string; qty: number }> = {}
        closeReportOrders.forEach(o => o.items.forEach(i => {
          if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0 }
          itemMap[i.name].qty += i.qty
        }))
        const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5)
        const ratedOrders = closeReportOrders.filter(o => o.rating)
        const avgRating = ratedOrders.length
          ? (ratedOrders.reduce((s, o) => s + (o.rating || 0), 0) / ratedOrders.length).toFixed(1)
          : null
        const methodLabels: Record<string, string> = { tunai: '💵 Tunai', qris: '⬛ QRIS', transfer: '🏦 Transfer', lainnya: '💳 Lainnya' }
        const waText = aiReport || buildDailyReport(closeReportOrders, today, closeReportShifts)
        const waUrl = `https://wa.me/${OWNER_WA}?text=${encodeURIComponent(waText)}`

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setShowCloseModal(false)} />
            <div className="relative bg-h-card border border-h-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-h-border flex items-center justify-between">
                <div>
                  <div className="font-sans font-black text-white uppercase tracking-wider">Tutup Kasir</div>
                  <div className="text-xs text-h-muted mt-0.5">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => setShowCloseModal(false)} className="text-h-muted hover:text-white text-2xl leading-none">×</button>
              </div>

              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {closeReportLoading ? (
                  <div className="text-center py-10 text-h-muted text-sm animate-pulse">Memuat laporan...</div>
                ) : closeReportOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">📋</div>
                    <div className="text-h-muted text-sm">Tidak ada transaksi hari ini</div>
                  </div>
                ) : (
                  <>
                    {/* KPI */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-h-dark border border-h-border rounded-xl p-4">
                        <div className="text-xs text-h-muted mb-1">Total Pendapatan</div>
                        <div className="font-black text-white text-xl">{formatRp(revenue)}</div>
                      </div>
                      <div className="bg-h-dark border border-h-border rounded-xl p-4">
                        <div className="text-xs text-h-muted mb-1">Transaksi</div>
                        <div className="font-black text-white text-xl">{closeReportOrders.length}</div>
                        {avgRating && <div className="text-xs text-yellow-400 mt-0.5">⭐ {avgRating} rata-rata</div>}
                      </div>
                    </div>

                    {/* Per metode */}
                    <div className="bg-h-dark border border-h-border rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-h-border text-xs font-bold text-h-muted uppercase tracking-wider">Per Metode Bayar</div>
                      {Object.entries(byMethod).map(([m, v]) => (
                        <div key={m} className="px-4 py-2.5 flex justify-between items-center border-b border-h-border last:border-0">
                          <span className="text-sm text-white">{methodLabels[m] || m}</span>
                          <div className="text-right">
                            <div className="text-sm font-bold text-white">{formatRp(v.total)}</div>
                            <div className="text-xs text-h-muted">{v.count} order</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Shifts hari ini */}
                    {closeReportShifts.length > 0 && (
                      <div className="bg-h-dark border border-h-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-h-border text-xs font-bold text-h-muted uppercase tracking-wider">👷 Shift Hari Ini</div>
                        {closeReportShifts.map(s => {
                          const shiftOrders = closeReportOrders.filter(o => {
                            const t = new Date(o.created_at).getTime()
                            const start = new Date(s.started_at).getTime()
                            const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now()
                            return t >= start && t <= end
                          })
                          const shiftRev = shiftOrders.reduce((sum, o) => sum + orderTotal(o.items), 0)
                          return (
                            <div key={s.id} className="px-4 py-2.5 border-b border-h-border last:border-0">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-sm text-white font-bold">{s.employee_name}</div>
                                  <div className="text-[10px] text-h-muted">
                                    {new Date(s.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                    {' – '}
                                    {s.ended_at ? new Date(s.ended_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'sedang jaga'}
                                    {' · '}{formatDuration(s.started_at, s.ended_at)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-white font-bold">{formatRp(shiftRev)}</div>
                                  <div className="text-[10px] text-h-muted">{shiftOrders.length} order</div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Top items */}
                    {topItems.length > 0 && (
                      <div className="bg-h-dark border border-h-border rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-h-border text-xs font-bold text-h-muted uppercase tracking-wider">Top Item</div>
                        {topItems.map((item, i) => (
                          <div key={item.name} className="px-4 py-2.5 flex justify-between items-center border-b border-h-border last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-h-cream font-black w-4">#{i+1}</span>
                              <span className="text-sm text-white">{item.name}</span>
                            </div>
                            <span className="text-xs text-h-muted font-bold">{item.qty}×</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-5 border-t border-h-border space-y-3">
                {/* AI Smart Report */}
                {closeReportOrders.length > 0 && !aiReport && (
                  <button onClick={generateAiReport} disabled={aiReportLoading}
                    className="w-full flex items-center justify-center gap-2 border border-h-red/40 bg-h-red/10 hover:bg-h-red/20 disabled:opacity-60 text-h-cream py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">
                    {aiReportLoading ? '🧠 AI lagi nyusun insight...' : '✨ Generate Smart Report (AI)'}
                  </button>
                )}
                {aiReportError && (
                  <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {aiReportError}
                  </div>
                )}
                {aiReport && (
                  <div className="bg-h-dark border border-h-red/30 rounded-xl p-4 max-h-60 overflow-y-auto">
                    <div className="text-[10px] uppercase tracking-widest font-black text-h-cream mb-2">✨ AI Insight (akan dikirim)</div>
                    <pre className="text-xs text-white/90 whitespace-pre-wrap font-sans leading-relaxed">{aiReport}</pre>
                    <button onClick={() => setAiReport(null)} className="text-[10px] text-h-muted hover:text-white mt-2 uppercase tracking-wider font-bold">
                      ↺ Pakai format biasa
                    </button>
                  </div>
                )}
                <a href={waUrl} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Kirim Laporan ke WA Owner
                </a>
                <button onClick={() => setShowCloseModal(false)}
                  className="w-full border border-h-border text-h-muted hover:text-white py-3 rounded-xl text-sm font-medium transition-colors">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SHIFT MODALS
// ═══════════════════════════════════════════════════════════

function StartShiftModal({ onStart, loading }: {
  onStart: (employee: string, notes?: string) => Promise<void>
  loading: boolean
}) {
  const [selected, setSelected] = useState<string>('')
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-h-card border border-h-border rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-h-border text-center">
          <div className="text-3xl mb-1">👋</div>
          <div className="font-sans font-black text-white uppercase tracking-wider text-sm">Siapa yang Datang?</div>
          <div className="text-xs text-h-muted mt-1.5">Tap nama kamu untuk mulai jaga</div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {EMPLOYEES.map(name => (
              <button key={name} type="button" onClick={() => setSelected(name)}
                className={`py-5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${
                  selected === name
                    ? 'bg-h-red border-2 border-h-red text-white scale-105'
                    : 'bg-h-dark border-2 border-h-border text-h-muted hover:text-white hover:border-white/40'
                }`}>
                {name}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-h-muted block mb-1.5">Catatan Awal (opsional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: kas awal Rp 200rb"
              className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-h-muted focus:outline-none focus:border-h-red" />
          </div>
          <button onClick={() => selected && onStart(selected, notes)}
            disabled={!selected || loading}
            className="w-full bg-h-red hover:bg-h-red-d disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">
            {loading ? 'Memulai...' : selected ? `Saya ${selected} · Mulai Jaga ✓` : 'Pilih nama dulu'}
          </button>
          <p className="text-[10px] text-h-muted text-center leading-relaxed">
            💡 Tidak ada jadwal tetap — siapapun yang datang duluan, dia klik. Fleksibel sesuai kondisi.
          </p>
        </div>
      </div>
    </div>
  )
}

function HandoverModal({ activeShift, onClose, onHandover, onEndOnly, loading }: {
  activeShift: Shift
  onClose: () => void
  onHandover: (toEmployee: string, notes?: string) => Promise<void>
  onEndOnly: (notes?: string) => Promise<void>
  loading: boolean
}) {
  const [mode, setMode] = useState<'handover' | 'endOnly'>('handover')
  const [nextEmployee, setNextEmployee] = useState<string>('')
  const [notes, setNotes] = useState('')
  const options = EMPLOYEES.filter(e => e !== activeShift.employee_name)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-h-card border border-h-border rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-h-border flex items-center justify-between">
          <div>
            <div className="font-sans font-black text-white uppercase tracking-wider text-sm">Ganti Penjaga</div>
            <div className="text-xs text-h-muted mt-0.5">
              Sekarang: <span className="text-blue-400 font-bold">{activeShift.employee_name}</span> · {formatDuration(activeShift.started_at)}
            </div>
          </div>
          <button onClick={onClose} className="text-h-muted hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Toggle mode */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('handover')}
              className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'handover' ? 'bg-blue-500/15 border border-blue-500/40 text-blue-400' : 'bg-h-dark border border-h-border text-h-muted'}`}>
              👤 Ada yang Lanjut
            </button>
            <button onClick={() => setMode('endOnly')}
              className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'endOnly' ? 'bg-h-red/15 border border-h-red/40 text-h-cream' : 'bg-h-dark border border-h-border text-h-muted'}`}>
              ⛔ Tutup Aja
            </button>
          </div>

          {mode === 'handover' && (
            <>
              <div className="text-xs text-blue-300/80 text-center -mt-1">
                Yang baru datang, tap nama-mu di bawah 👇
              </div>
              <div className="grid grid-cols-2 gap-2">
                {options.map(name => (
                  <button key={name} onClick={() => setNextEmployee(name)}
                    className={`py-4 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${
                      nextEmployee === name
                        ? 'bg-blue-500/20 border-2 border-blue-500 text-blue-300 scale-105'
                        : 'bg-h-dark border-2 border-h-border text-h-muted hover:text-white'
                    }`}>
                    {name}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-h-muted text-center leading-relaxed">
                💡 Fleksibel — siapapun bisa gantiin. Kalau Amin ijin, Rama/Ubuy bisa langsung ambil alih.
              </p>
            </>
          )}

          <div>
            <label className="text-xs text-h-muted block mb-1.5">Catatan {mode === 'handover' ? 'Serah Terima' : 'Penutupan'} (opsional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={mode === 'handover' ? 'Contoh: kas Rp 1.2jt, stok kopi tinggal 200gr' : 'Contoh: kas akhir Rp 1.5jt'}
              rows={2}
              className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-h-muted focus:outline-none focus:border-h-red resize-none" />
          </div>

          {mode === 'handover' ? (
            <button onClick={() => nextEmployee && onHandover(nextEmployee, notes)}
              disabled={!nextEmployee || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">
              {loading ? 'Memproses...' : nextEmployee ? `Saya ${nextEmployee} · Lanjut Jaga ✓` : 'Pilih nama dulu'}
            </button>
          ) : (
            <button onClick={() => onEndOnly(notes)} disabled={loading}
              className="w-full bg-h-red hover:bg-h-red-d disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">
              {loading ? 'Menutup...' : 'Tutup Shift ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
