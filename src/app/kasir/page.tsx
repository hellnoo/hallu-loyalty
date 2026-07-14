'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, Order, Shift } from '@/types'
import { EMPLOYEES } from '@/types'
import { subscribePush, sendPush } from '@/lib/push'
import { formatRp } from '@/lib/format'
import { BRAND, BRAND_NICE } from '@/lib/brand'
import { getCurrentBusinessDay, getBusinessDayBounds, toLocalDateString } from '@/lib/business-day'
import type { PayMethod, PendingOrder } from '@/components/kasir/helpers'
import {
  OWNER_WA, orderTotal, buildDailyReport, PAY_OPTS, msgStruk, waLink,
  playNewOrderSound, playAlarmSound, showBrowserNotif, useOnlineStatus,
  loadPendingOrders, savePendingOrders, queuePendingOrder, formatDuration,
} from '@/components/kasir/helpers'
import { OrderCard, ManualOrderForm, StartShiftModal, HandoverModal } from '@/components/kasir/components'

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
    document.title = count > 0 ? `(${count}) Order Baru | ${BRAND_NICE} Kasir` : `${BRAND_NICE} Kasir`
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
          <a href="/" title="Kembali ke beranda" className="inline-block">
            <div className="font-sans text-2xl font-black text-white tracking-widest uppercase hover:text-h-cream transition-colors">{BRAND.name}</div>
          </a>
          <div className="flex items-center gap-2 justify-center mt-1">
            <div className="h-px w-6 bg-h-red" />
            <div className="text-h-cream text-[0.5rem] tracking-[3px] uppercase font-semibold">Dashboard Kasir</div>
            <div className="h-px w-6 bg-h-red" />
          </div>
          <a href="/" className="text-h-muted hover:text-white text-xs mt-3 inline-block transition-colors">← Kembali ke beranda</a>
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
            {BRAND.arabic && <div className="font-serif text-7xl mb-2" style={{ color: '#D4B896', fontFamily: 'var(--font-playfair)', letterSpacing: '0.05em' }}>
              {BRAND.arabic}
            </div>}
            <div className="font-sans font-black text-3xl tracking-[0.3em] uppercase mb-1" style={{ color: '#D4B896' }}>
              {BRAND.name}
            </div>
            <div className="text-xs tracking-[0.25em] uppercase" style={{ color: '#B8967A' }}>
              {BRAND.tagline}
            </div>
          </div>
          <div className="absolute bottom-10 text-xs tracking-widest uppercase opacity-40" style={{ color: '#D4B896' }}>
            Ketuk untuk melanjutkan
          </div>
        </div>
      )}
      <header className="bg-h-dark border-b border-h-border">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" title="Kembali ke beranda" className="group">
            <div className="font-sans text-xl font-black text-white tracking-widest uppercase group-hover:text-h-cream transition-colors">{BRAND.name}</div>
            <div className="text-h-cream text-[0.55rem] tracking-[3px] uppercase font-semibold mt-0.5">Dashboard Kasir</div>
          </a>
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
                    <div className="font-black text-sm tracking-wider">{BRAND.name}</div>
                    <div className="text-[9px] tracking-widest text-gray-500">{BRAND.tagline.toUpperCase()}</div>
                    <div className="text-[9px] text-gray-400">{BRAND.city}, Indonesia</div>
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
