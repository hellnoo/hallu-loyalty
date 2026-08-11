'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { formatRp } from '@/lib/format'
import { BRAND } from '@/lib/brand'

type Daily = { date: string; revenue: number; orders: number }
type OutletOk = {
  name: string; ok: true
  todayRevenue: number; todayOrders: number
  weekRevenue: number; weekOrders: number
  daily: Daily[]; topItems: { name: string; qty: number }[]
  monthRevenue: number; cogs: number; expTotal: number; netProfit: number
}
type OutletErr = { name: string; ok: false; error: string }
type Summary = {
  today: string
  month: string
  outlets: (OutletOk | OutletErr)[]
  aggregate: {
    todayRevenue: number; todayOrders: number; weekRevenue: number; weekOrders: number
    monthRevenue: number; cogs: number; expTotal: number; netProfit: number; outletCount: number
  }
}

const PW_KEY = 'hallu-owner-pw'
// Dibaca di WIT (Asia/Jayapura) supaya label tanggal benar walau device bukan WIT
const fmtDay = (d: string) => new Date(d + 'T06:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Jayapura' })
const fmtMonth = (m: string) => new Date(m + '-02T06:00:00Z').toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })

function Sparkline({ daily }: { daily: Daily[] }) {
  const max = Math.max(...daily.map(d => d.revenue), 1)
  return (
    <div className="flex items-end gap-1 h-12">
      {daily.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="w-full flex items-end" style={{ height: '40px' }}>
            <div className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max(3, Math.round((d.revenue / max) * 40))}px`,
                background: i === daily.length - 1 ? 'var(--brand-primary-hex)' : '#3a2a28',
              }}
              title={`${fmtDay(d.date)}: ${formatRp(d.revenue)}`} />
          </div>
          <div className="text-[7px] text-h-muted">{fmtDay(d.date).split(' ')[1]}</div>
        </div>
      ))}
    </div>
  )
}

export default function OwnerPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Summary | null>(null)

  const load = async (password: string) => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/owner/summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal memuat')
      setData(json); setAuthed(true)
      localStorage.setItem(PW_KEY, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal')
      if (!data) setAuthed(false)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    const saved = localStorage.getItem(PW_KEY)
    if (saved) { setPw(saved); load(saved) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!authed) return (
    <div className="min-h-screen bg-h-bg flex items-center justify-center p-6">
      <div className="bg-h-card border border-h-border rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <div className="font-sans text-2xl font-black text-white tracking-widest uppercase hover:text-h-cream transition-colors">{BRAND.name}</div>
          </a>
          <div className="flex items-center gap-2 justify-center mt-1">
            <div className="h-px w-6 bg-h-red" />
            <div className="text-h-cream text-[0.5rem] tracking-[3px] uppercase font-semibold">Dashboard Owner</div>
            <div className="h-px w-6 bg-h-red" />
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(pw) }} className="space-y-4">
          <div>
            <label className="text-xs text-h-muted font-semibold uppercase tracking-wide block mb-1.5">Password Owner</label>
            <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError('') }}
              className="w-full bg-h-dark border border-h-border rounded-xl px-4 py-3 focus:outline-none focus:border-h-red transition-colors text-sm text-white placeholder-h-muted"
              placeholder="Masukkan password owner" autoFocus />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-h-red hover:bg-h-red-d disabled:opacity-60 text-white py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">
            {loading ? 'Memuat...' : 'Masuk'}
          </button>
        </form>
        <a href="/" className="text-h-muted hover:text-white text-xs mt-5 block text-center transition-colors">← Kembali ke beranda</a>
      </div>
    </div>
  )

  const agg = data?.aggregate
  return (
    <div className="min-h-screen bg-h-bg">
      <header className="bg-h-dark border-b border-h-border">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" title="Kembali ke beranda" className="group">
            <div className="font-sans text-xl font-black text-white tracking-widest uppercase group-hover:text-h-cream transition-colors">{BRAND.name}</div>
            <div className="text-h-cream text-[0.55rem] tracking-[3px] uppercase font-semibold mt-0.5">Dashboard Owner</div>
          </a>
          <div className="flex items-center gap-3">
            <button onClick={() => pw && load(pw)} disabled={loading}
              className="text-xs text-h-muted hover:text-white border border-h-border hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors font-bold">
              {loading ? '...' : '↻ Refresh'}
            </button>
            <button onClick={() => { localStorage.removeItem(PW_KEY); setAuthed(false); setData(null); setPw('') }}
              className="border border-h-border hover:border-white/30 text-h-muted hover:text-white px-4 py-1.5 rounded-full text-sm transition-colors">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">{error}</div>}

        {/* Agregat semua outlet — hari ini */}
        <div>
          <h1 className="font-sans text-lg font-black text-white uppercase tracking-wider mb-1">Ringkasan Hari Ini</h1>
          <p className="text-h-muted text-xs mb-4">{agg?.outletCount} outlet · {data ? fmtDay(data.today) : ''} (jam 05:00–04:59 WIT)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Omzet Hari Ini', value: formatRp(agg?.todayRevenue || 0) },
              { label: 'Transaksi Hari Ini', value: String(agg?.todayOrders || 0) },
              { label: 'Omzet 7 Hari', value: formatRp(agg?.weekRevenue || 0) },
              { label: 'Transaksi 7 Hari', value: String(agg?.weekOrders || 0) },
            ].map((c) => (
              <div key={c.label} className="bg-h-card border border-h-border rounded-2xl p-4">
                <div className="text-[10px] text-h-muted uppercase tracking-wide font-semibold mb-1">{c.label}</div>
                <div className="text-lg font-black text-white leading-tight">{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Agregat Laba-Rugi — bulan berjalan */}
        <div>
          <h2 className="font-sans text-lg font-black text-white uppercase tracking-wider mb-1">Laba-Rugi Bulan Ini</h2>
          <p className="text-h-muted text-xs mb-4">Gabungan semua outlet · {data ? fmtMonth(data.month) : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Omzet Bulan Ini', value: formatRp(agg?.monthRevenue || 0), tone: 'white' },
              { label: 'HPP Terjual', value: formatRp(agg?.cogs || 0), tone: 'muted' },
              { label: 'Pengeluaran', value: formatRp(agg?.expTotal || 0), tone: 'muted' },
              { label: 'Laba Bersih', value: formatRp(agg?.netProfit || 0), tone: (agg?.netProfit ?? 0) >= 0 ? 'green' : 'red' },
            ].map((c) => (
              <div key={c.label} className={`border rounded-2xl p-4 ${c.tone === 'green' ? 'bg-green-500/10 border-green-500/30' : c.tone === 'red' ? 'bg-red-500/10 border-red-500/30' : 'bg-h-card border-h-border'}`}>
                <div className="text-[10px] text-h-muted uppercase tracking-wide font-semibold mb-1">{c.label}</div>
                <div className={`text-lg font-black leading-tight ${c.tone === 'green' ? 'text-green-400' : c.tone === 'red' ? 'text-red-400' : 'text-white'}`}>{c.value}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-h-muted/70 mt-2">Laba bersih = omzet − HPP terjual − pengeluaran. Catat pengeluaran & isi HPP menu di tiap outlet agar akurat.</p>
        </div>

        {/* Per outlet */}
        <div>
          <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-3">Per Outlet</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data?.outlets.map((o) => o.ok ? (
              <div key={o.name} className="bg-h-card border border-h-border rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-white text-base">{o.name}</div>
                    <div className="text-h-muted text-xs">{o.todayOrders} transaksi hari ini</div>
                  </div>
                  <div className="text-right">
                    <div className="text-h-cream font-black text-lg leading-tight">{formatRp(o.todayRevenue)}</div>
                    <div className="text-[10px] text-h-muted">hari ini</div>
                  </div>
                </div>
                <Sparkline daily={o.daily} />
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-h-border">
                  <span className="text-[10px] text-h-muted uppercase tracking-wide">Omzet 7 hari</span>
                  <span className="text-sm font-bold text-white">{formatRp(o.weekRevenue)}</span>
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <span className="text-[10px] text-h-muted uppercase tracking-wide">Laba bersih (bln ini)</span>
                  <span className={`text-sm font-bold ${o.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRp(o.netProfit)}</span>
                </div>
                {o.topItems.length > 0 && (
                  <div className="mt-2 text-xs text-h-muted">
                    <span className="text-h-cream font-bold">Top: </span>
                    {o.topItems.map((t) => `${t.name} (${t.qty}×)`).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div key={o.name} className="bg-h-card border border-red-500/30 rounded-2xl p-5">
                <div className="font-bold text-white text-base">{o.name}</div>
                <div className="text-red-400 text-xs mt-1">⚠️ Tidak bisa dibaca: {o.error}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
