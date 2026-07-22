import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOutlets } from '@/lib/outlets'

export const runtime = 'nodejs'

// ── Business day WIT (UTC+9), dihitung server-side sebagai instant UTC ──
const WIT = 9 * 60 * 60 * 1000
const pad = (n: number) => String(n).padStart(2, '0')

function currentBizDay(): string {
  const w = new Date(Date.now() + WIT) // UTC-fields = wall-clock WIT
  let y = w.getUTCFullYear(), m = w.getUTCMonth(), d = w.getUTCDate()
  if (w.getUTCHours() < 5) {
    const p = new Date(Date.UTC(y, m, d) - 86400000)
    y = p.getUTCFullYear(); m = p.getUTCMonth(); d = p.getUTCDate()
  }
  return `${y}-${pad(m + 1)}-${pad(d)}`
}
function prevDay(dateStr: string, k: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) - k * 86400000)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}
// 05:00 WIT pada tanggal = instant UTC
function bizStart(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0, 0) - WIT)
}
function bizEnd(dateStr: string): Date {
  return new Date(bizStart(dateStr).getTime() + 86400000 - 1)
}

type Item = { id?: string; name: string; price: number; qty: number }
type OrderRow = { items: Item[]; created_at: string; payment_method: string | null }
const orderTotal = (r: OrderRow) => (r.items || []).reduce((s, i) => s + i.price * i.qty, 0)

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}))
  if (!process.env.OWNER_PASSWORD || password !== process.env.OWNER_PASSWORD) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }
  const outlets = getOutlets()
  if (!outlets.length) return NextResponse.json({ error: 'OUTLETS_JSON belum diset' }, { status: 503 })

  const today = currentBizDay()
  const tStart = bizStart(today), tEnd = bizEnd(today)
  const days7 = Array.from({ length: 7 }, (_, i) => prevDay(today, 6 - i)) // lama → hari ini
  const weekStart = bizStart(days7[0])

  const month = today.slice(0, 7)                 // "YYYY-MM"
  const monthFirst = `${month}-01`
  const [my, mm] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))]
  const nextMonthFirst = `${mm === 12 ? my + 1 : my}-${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}-01`
  const monthStart = bizStart(monthFirst)
  // ambil order sejak awal (mana yang lebih dulu: awal minggu vs awal bulan)
  const fetchStart = new Date(Math.min(weekStart.getTime(), monthStart.getTime()))

  const outletData = await Promise.all(outlets.map(async (o) => {
    try {
      const sb = createClient(o.url, o.anon, { auth: { persistSession: false } })
      const [ordersRes, menuRes, expRes] = await Promise.all([
        sb.from('orders').select('items, created_at, payment_method').eq('status', 'done').gte('created_at', fetchStart.toISOString()),
        sb.from('menu_items').select('id, name, hpp'),
        sb.from('expenses').select('category, amount, expense_date').gte('expense_date', monthFirst).lt('expense_date', nextMonthFirst),
      ])
      if (ordersRes.error) throw ordersRes.error
      const rows = (ordersRes.data as OrderRow[]) || []

      const todayRows = rows.filter((r) => { const t = new Date(r.created_at); return t >= tStart && t <= tEnd })
      const todayRevenue = todayRows.reduce((s, r) => s + orderTotal(r), 0)
      const weekRows = rows.filter((r) => { const t = new Date(r.created_at); return t >= weekStart })
      const weekRevenue = weekRows.reduce((s, r) => s + orderTotal(r), 0)

      // per-hari 7 hari
      const daily = days7.map((ds) => {
        const s = bizStart(ds), e = bizEnd(ds)
        const dr = rows.filter((r) => { const t = new Date(r.created_at); return t >= s && t <= e })
        return { date: ds, revenue: dr.reduce((a, r) => a + orderTotal(r), 0), orders: dr.length }
      })

      // top item hari ini
      const im: Record<string, { name: string; qty: number }> = {}
      todayRows.forEach((r) => (r.items || []).forEach((i) => {
        if (!im[i.name]) im[i.name] = { name: i.name, qty: 0 }
        im[i.name].qty += i.qty
      }))
      const topItems = Object.values(im).sort((a, b) => b.qty - a.qty).slice(0, 3)

      // ── P&L bulan berjalan ──
      const menu = (menuRes.data as { id: string; name: string; hpp: number }[]) || []
      const hppById: Record<string, number> = {}, hppByName: Record<string, number> = {}
      menu.forEach((it) => { hppById[it.id] = it.hpp || 0; hppByName[it.name] = it.hpp || 0 })
      const monthRows = rows.filter((r) => { const t = new Date(r.created_at); return t >= monthStart })
      let monthRevenue = 0, cogs = 0
      monthRows.forEach((r) => (r.items || []).forEach((i) => {
        monthRevenue += i.price * i.qty
        const h = (i.id ? hppById[i.id] : undefined) ?? hppByName[i.name]
        if (h && h > 0) cogs += h * i.qty
      }))
      const expenses = (expRes.data as { category: string; amount: number }[]) || []
      const expTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0)
      const netProfit = monthRevenue - cogs - expTotal

      return {
        name: o.name, ok: true as const,
        todayRevenue, todayOrders: todayRows.length,
        weekRevenue, weekOrders: weekRows.length,
        daily, topItems,
        monthRevenue, cogs, expTotal, netProfit,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
        : typeof err === 'string' ? err : 'gagal terhubung'
      return { name: o.name, ok: false as const, error: msg }
    }
  }))

  const okOutlets = outletData.filter((o) => o.ok) as Extract<typeof outletData[number], { ok: true }>[]
  const aggregate = {
    todayRevenue: okOutlets.reduce((s, o) => s + o.todayRevenue, 0),
    todayOrders: okOutlets.reduce((s, o) => s + o.todayOrders, 0),
    weekRevenue: okOutlets.reduce((s, o) => s + o.weekRevenue, 0),
    weekOrders: okOutlets.reduce((s, o) => s + o.weekOrders, 0),
    monthRevenue: okOutlets.reduce((s, o) => s + o.monthRevenue, 0),
    cogs: okOutlets.reduce((s, o) => s + o.cogs, 0),
    expTotal: okOutlets.reduce((s, o) => s + o.expTotal, 0),
    netProfit: okOutlets.reduce((s, o) => s + o.netProfit, 0),
    outletCount: outlets.length,
  }

  return NextResponse.json({ today, month, outlets: outletData, aggregate })
}
