'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MenuItem, StoreSettings } from '@/types'
import { bacaStoreSettings, simpanStoreSettings } from '@/lib/store-settings'
import { hitungBahanTerpakai, fmtJumlah } from '@/lib/bahan-terpakai'
import { bacaBahan, ringkasBahan, type Bahan, type BahanBaru } from '@/lib/bahan'
import { THEMES, THEME_DEFAULT } from '@/lib/themes'
import { formatRp } from '@/lib/format'
import { isStoreOpen } from '@/lib/store-hours'
import { monthStartWIT, witHour, fmtWITDateTime, fmtWITDateShort, toWITDateString, shiftDay, fmtWITWeekdayDay } from '@/lib/business-day'
import { BRAND } from '@/lib/brand'
import { margin, marginColor, BLANK, compressImage, Toggle, DEFAULT_SETTINGS, exportCsv } from '@/components/admin/helpers'
import type { FormData, AdminTab, OrderRow } from '@/components/admin/helpers'
import { EXPENSE_CATEGORIES, expLabel, expIcon, type Expense } from '@/lib/expenses'
import { secureWrite } from '@/lib/secure-db'
import { HppCalculator } from '@/components/admin/HppCalculator'

const CATEGORIES = ['Kopi', 'Non-Kopi', 'Makanan', 'Lainnya'] as const

// Identitas outlet "diri sendiri" (deployment yang lagi diakses) — url+schema,
// karena outlet schema-based (mis. Hallu Brew) berbagi url project dgn pusat.
const SELF_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SELF_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public'
type OutletOption = { name: string; url: string; schema: string; writable: boolean; sameProject: boolean }
type OutletDaily = { date: string; revenue: number; orders: number }
type OutletSummaryRow =
  | { name: string; ok: true; todayRevenue: number; todayOrders: number; weekRevenue: number; weekOrders: number; daily: OutletDaily[]; topItems: { name: string; qty: number }[]; monthRevenue: number; cogs: number; expTotal: number; netProfit: number }
  | { name: string; ok: false; error: string }
type OutletSummary = {
  today: string; month: string
  outlets: OutletSummaryRow[]
  aggregate: { todayRevenue: number; todayOrders: number; weekRevenue: number; weekOrders: number; monthRevenue: number; cogs: number; expTotal: number; netProfit: number; outletCount: number }
}
const outletKey = (o: { url: string; schema: string }) => `${o.url}::${o.schema}`
const SELF_KEY = outletKey({ url: SELF_URL, schema: SELF_SCHEMA })

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState(''); const [pwError, setPwError] = useState('')
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<AdminTab>('menu')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [monthValue, setMonthValue] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [monthOrders, setMonthOrders] = useState<OrderRow[]>([])
  const [monthPrevOrders, setMonthPrevOrders] = useState<OrderRow[]>([])
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([])
  const [monthLoading, setMonthLoading] = useState(false)
  // Master bahan baku — dipakai ulang saat mengisi HPP menu mana pun
  const [bahanList, setBahanList] = useState<Bahan[]>([])
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [newEmployee, setNewEmployee] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [cleanupDays, setCleanupDays] = useState(60)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const [backupReady, setBackupReady] = useState(false)
  const [preparingBackup, setPreparingBackup] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [aiDescLoading, setAiDescLoading] = useState(false)
  const [aiInsights, setAiInsights] = useState<string | null>(null)
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false)
  const [aiInsightsError, setAiInsightsError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<FormData>(BLANK)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [meshyStatus, setMeshyStatus] = useState<Record<string, { status: string; progress: number; error?: string }>>({})
  const [manualGlbUrl, setManualGlbUrl] = useState('')
  // ── Kelola lintas outlet (dari Admin Pusat) ──
  const [outlets, setOutlets] = useState<OutletOption[]>([])
  const [activeOutletKey, setActiveOutletKey] = useState<string>('') // '' = outlet sendiri
  const [outletError, setOutletError] = useState<string | null>(null)
  const isSelf = !activeOutletKey || activeOutletKey === SELF_KEY
  const activeOutlet = outlets.find(o => outletKey(o) === activeOutletKey) || null
  const adminPw = () => (typeof window !== 'undefined' ? localStorage.getItem('hallu-admin-pw') || '' : '')
  // Tab "Pantau Outlet" — ringkasan lintas outlet (sama data dgn /owner)
  const [summary, setSummary] = useState<OutletSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  // Form "+ Tambah Outlet"
  const [showAddOutlet, setShowAddOutlet] = useState(false)
  const [addOutletSaving, setAddOutletSaving] = useState(false)
  const [addOutletError, setAddOutletError] = useState<string | null>(null)
  const [newOutletModel, setNewOutletModel] = useState<'schema' | 'separate'>('schema')
  const [newOutlet, setNewOutlet] = useState({ name: '', schema: '', url: '', anon: '', serviceRole: '' })
  // Outlet ini sudah menjalankan migrasi password (supabase-outlet-password.sql)?
  const [outletSupportsPassword, setOutletSupportsPassword] = useState(false)
  // Sudah menjalankan migrasi identitas (supabase-brand.sql)? Kalau belum,
  // kolom brand_* tidak boleh ikut dikirim saat simpan (bikin error).
  const [outletSupportsBrand, setOutletSupportsBrand] = useState(false)
  const BRAND_FIELDS = ['brand_name','brand_tagline','brand_arabic','brand_city','brand_wa','brand_ig','brand_address','brand_lat','brand_lng','brand_logo','brand_color','brand_accent','brand_theme','ai_api_key'] as const

  // Sesi lama (login sebelum fitur lintas-outlet ada) cuma simpan flag 'ok'
  // tanpa password — padahal /api/central/* butuh password utk verifikasi.
  // Minta login ulang sekali, dengan pesan yang jelas (bukan "Password salah").
  useEffect(() => {
    if (localStorage.getItem('hallu-admin') !== 'ok') return
    if (localStorage.getItem('hallu-admin-pw')) { setAuthed(true); return }
    localStorage.removeItem('hallu-admin')
    setPwError('Sesi lama — silakan masukkan password sekali lagi untuk mengaktifkan fitur multi-outlet.')
  }, [])
  useEffect(() => { if (authed) { loadItems(); loadSettings() } }, [authed, activeOutletKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed && isSelf) loadBahan() }, [authed, isSelf]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed && isSelf && tab === 'analitik' && orders.length === 0) loadOrders() }, [authed, tab, isSelf]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (authed && isSelf && tab === 'analitik') loadMonth(monthValue) }, [authed, tab, monthValue, isSelf]) // eslint-disable-line react-hooks/exhaustive-deps
  // Daftar outlet buat dropdown "Kelola Outlet" — dijaga password admin pusat
  const loadOutlets = () => {
    fetch('/api/central/outlets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPw() }) })
      .then(r => r.json()).then(json => { if (Array.isArray(json.outlets)) setOutlets(json.outlets) }).catch(() => {})
  }
  useEffect(() => { if (authed) loadOutlets() }, [authed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ringkasan lintas outlet (tab Pantau Outlet) — password admin pusat, data
  // identik dengan halaman /owner (satu modul perhitungan di server)
  const loadSummary = async () => {
    setSummaryLoading(true); setSummaryError(null)
    try {
      const res = await fetch('/api/central/summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPw() }),
      })
      const json = await res.json()
      if (res.status === 401) throw new Error('Sesi tidak valid — klik "Keluar" lalu login lagi dengan password admin.')
      if (!res.ok) throw new Error(json.error || 'Gagal memuat')
      setSummary(json as OutletSummary)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Gagal memuat ringkasan')
    }
    setSummaryLoading(false)
  }
  useEffect(() => { if (authed && tab === 'outlet' && !summary) loadSummary() }, [authed, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const addOutlet = async () => {
    setAddOutletSaving(true); setAddOutletError(null)
    try {
      const outlet = newOutletModel === 'schema'
        ? { name: newOutlet.name.trim(), url: SELF_URL, anon: newOutlet.anon.trim(), schema: newOutlet.schema.trim() }
        : { name: newOutlet.name.trim(), url: newOutlet.url.trim(), anon: newOutlet.anon.trim(), serviceRole: newOutlet.serviceRole.trim() || undefined }
      if (!outlet.name || !outlet.url || !outlet.anon || (newOutletModel === 'schema' && !outlet.schema)) {
        throw new Error('Lengkapi semua field wajib dulu')
      }
      const res = await fetch('/api/central/outlets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPw(), op: 'add', outlet }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'gagal')
      loadOutlets()
      setSummary(null)          // paksa muat ulang data Pantau Outlet
      if (tab === 'outlet') loadSummary()
      setShowAddOutlet(false)
      setNewOutlet({ name: '', schema: '', url: '', anon: '', serviceRole: '' })
    } catch (err) {
      setAddOutletError(err instanceof Error ? err.message : 'Gagal tambah outlet')
    }
    setAddOutletSaving(false)
  }

  // ── Kelola lintas outlet: panggil server /api/central/* kalau bukan outlet
  // sendiri (dijaga password admin pusat, server yang pegang service_role tiap outlet)
  const centralMenu = async (op: string, opts: { values?: unknown; matchId?: string } = {}) => {
    const res = await fetch('/api/central/menu', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPw(), outletUrl: activeOutlet?.url, outletSchema: activeOutlet?.schema, op, ...opts }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'gagal')
    return json
  }
  const centralSettings = async (op: string, values?: unknown) => {
    const res = await fetch('/api/central/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPw(), outletUrl: activeOutlet?.url, outletSchema: activeOutlet?.schema, op, values }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'gagal')
    return json
  }

  const loadSettings = async () => {
    setOutletError(null)
    if (isSelf) {
      // Outlet sendiri pakai kunci publik → kolom password sengaja tidak boleh dibaca
      const data = await bacaStoreSettings(supabase)
      if (data) {
        const s = data as StoreSettings
        if (!Array.isArray(s.employees) || s.employees.length === 0) s.employees = DEFAULT_SETTINGS.employees
        setSettings(s)
        setOutletSupportsBrand(Object.prototype.hasOwnProperty.call(data, 'brand_name'))
      }
      return
    }
    try {
      const json = await centralSettings('get')
      const s = { ...DEFAULT_SETTINGS, ...(json.data as StoreSettings) }
      if (!Array.isArray(s.employees) || s.employees.length === 0) s.employees = DEFAULT_SETTINGS.employees
      setSettings(s)
      setOutletSupportsPassword(!!json.supportsPassword)
      setOutletSupportsBrand(Object.prototype.hasOwnProperty.call(json.data || {}, 'brand_name'))
    } catch (err) {
      setSettings(DEFAULT_SETTINGS)
      setOutletError(err instanceof Error ? err.message : 'Gagal muat pengaturan outlet')
    }
  }

  // ── Master bahan baku: harga & takaran kemasan cukup diisi sekali ──
  // Outlet yang belum menjalankan supabase-bahan.sql dapat daftar kosong —
  // kalkulator HPP tetap jalan seperti sebelumnya, cuma tanpa pilihan cepat.
  const loadBahan = async () => { setBahanList(await bacaBahan(supabase)) }

  const simpanBahan = async (b: BahanBaru): Promise<{ error?: unknown }> => {
    const res = await secureWrite({
      scope: 'admin', table: 'bahan', op: 'insert', values: b,
      fallback: async () => { const r = await supabase.from('bahan').insert(b); return { error: r.error } },
    })
    if (res.error) return { error: new Error(errText(res.error, 'Gagal simpan bahan')) }
    await loadBahan()
    return {}
  }

  const hapusBahan = async (id: string) => {
    const res = await secureWrite({
      scope: 'admin', table: 'bahan', op: 'delete', matchId: id,
      fallback: async () => { const r = await supabase.from('bahan').delete().eq('id', id); return { error: r.error } },
    })
    if (res.error) { setOutletError(errText(res.error, 'Gagal hapus bahan')); return }
    await loadBahan()
  }

  const generateAiDescription = async () => {
    if (!form.name.trim()) return
    setAiDescLoading(true)
    try {
      const res = await fetch('/api/ai/describe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, category: form.category, hppComponents: form.hpp_components }),
      })
      const json = await res.json()
      if (json.description) setForm(f => ({ ...f, description: json.description }))
    } catch { /* silent */ } finally { setAiDescLoading(false) }
  }

  const generateAiInsights = async () => {
    setAiInsightsLoading(true); setAiInsightsError(null); setAiInsights(null)
    try {
      // Build per-item stats from orders (30d) + menu items
      const itemStats: Record<string, { qty: number; revenue: number }> = {}
      orders.filter(o => o.status === 'done').forEach(o => o.items.forEach(i => {
        if (!itemStats[i.id]) itemStats[i.id] = { qty: 0, revenue: 0 }
        itemStats[i.id].qty += i.qty
        itemStats[i.id].revenue += i.price * i.qty
      }))
      const itemsData = items.map(i => ({
        name: i.name, category: i.category, price: i.price, hpp: i.hpp,
        qtySold30d: itemStats[i.id]?.qty || 0,
        revenue30d: itemStats[i.id]?.revenue || 0,
        margin: margin(i.price, i.hpp),
      }))
      const res = await fetch('/api/ai/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsData }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal')
      setAiInsights(json.insights)
    } catch (err) {
      setAiInsightsError(err instanceof Error ? err.message : 'Gagal generate insights')
    } finally { setAiInsightsLoading(false) }
  }

  // Step 1: Backup dulu — download CSV lengkap + kirim ringkasan ke WA owner
  const prepareBackup = async () => {
    setPreparingBackup(true); setCleanupResult(null)
    const cutoff = new Date(Date.now() - cleanupDays * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('orders').select('*')
      .in('status', ['done', 'cancelled'])
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
    const rows = (data as OrderRow[]) || []
    setPreparingBackup(false)
    if (rows.length === 0) {
      setCleanupResult(`ℹ️ Tidak ada data lebih dari ${cleanupDays} hari untuk diarsip.`)
      return
    }
    // Download CSV lengkap (backup detail)
    exportCsv(rows)
    // Ringkasan per bulan untuk WA owner
    const byMonth: Record<string, { rev: number; count: number }> = {}
    let totalRev = 0
    rows.forEach(o => {
      const ym = o.created_at.slice(0, 7)
      const rev = o.items.reduce((a, i) => a + i.price * i.qty, 0)
      totalRev += rev
      if (!byMonth[ym]) byMonth[ym] = { rev: 0, count: 0 }
      byMonth[ym].rev += rev; byMonth[ym].count++
    })
    const waText = [
      `🗄️ *ARSIP DATA ${BRAND.name} (sebelum dihapus)*`,
      `Order sebelum: ${fmtWITDateShort(cutoff)}`,
      `Total: *${rows.length} order · ${formatRp(totalRev)}*`,
      '',
      '*Ringkasan per bulan:*',
      ...Object.entries(byMonth).sort().map(([ym, v]) =>
        `${new Date(ym + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}: ${formatRp(v.rev)} (${v.count} order)`),
      '',
      '📎 File CSV lengkap sudah terdownload di perangkat admin — mohon *simpan / forward file CSV ini* sebagai backup.',
      '',
      '_Setelah backup diterima, data mentah baru akan dihapus dari sistem._',
    ].join('\n')
    window.open(`https://wa.me/${BRAND.wa}?text=${encodeURIComponent(waText)}`, '_blank')
    setBackupReady(true)
    setCleanupResult(`✅ Backup siap: ${rows.length} order. CSV terdownload + ringkasan dikirim ke WA owner. Tombol Hapus sekarang aktif.`)
  }

  // Step 2: Hapus — hanya boleh setelah backup
  const handleCleanup = async () => {
    if (!backupReady) {
      setCleanupResult('⚠️ Backup ke WA owner dulu sebelum menghapus.')
      return
    }
    setCleaning(true); setCleanupResult(null)
    const cutoff = new Date(Date.now() - cleanupDays * 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await secureWrite({
      scope: 'admin', table: 'orders', op: 'deleteOld', cutoff, statuses: ['done', 'cancelled'],
      fallback: async () => {
        const r = await supabase.from('orders').delete({ count: 'exact' }).in('status', ['done', 'cancelled']).lt('created_at', cutoff)
        return { error: r.error, count: r.count }
      },
    })
    setCleaning(false)
    if (error) { setCleanupResult('❌ Gagal: ' + (error instanceof Error ? error.message : String(error))); return }
    setCleanupResult(`✅ ${count ?? 0} order dihapus (>${cleanupDays} hari). Backup sudah ada di WA owner.`)
    setBackupReady(false)
    setOrders([])
  }

  // Buang kolom brand_* kalau DB outlet ini belum menjalankan supabase-brand.sql
  // (kalau dikirim, PostgREST menolak: kolom tidak dikenal)
  const tanpaBrandKalauBelumSiap = (v: Record<string, unknown>) => {
    if (outletSupportsBrand) return v
    const out = { ...v }
    BRAND_FIELDS.forEach(k => delete out[k])
    return out
  }

  const saveSettings = async () => {
    setSettingsSaving(true); setOutletError(null)
    try {
      if (isSelf) {
        const values = tanpaBrandKalauBelumSiap({ ...settings })
        const res = await secureWrite({
          scope: 'admin', table: 'store_settings', op: 'upsert', values,
          fallback: async () => simpanStoreSettings(supabase, values),
        })
        if (res.error) throw res.error
      } else {
        // Password kosong = "jangan diubah" (sesuai keterangan di form),
        // jadi field-nya dibuang supaya tidak menimpa nilai lama jadi kosong.
        const values = tanpaBrandKalauBelumSiap({ ...settings }) as Record<string, unknown>
        if (!String(values.admin_password || '').trim()) delete values.admin_password
        if (!String(values.kasir_password || '').trim()) delete values.kasir_password
        await centralSettings('save', values)
      }
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
      // Identitas/warna ikut berubah → muat ulang supaya tampilannya sinkron
      if (isSelf) setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      setOutletError(errText(err, 'Gagal simpan pengaturan'))
    }
    setSettingsSaving(false)
  }

  const loadOrders = async () => {
    setOrdersLoading(true)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('orders').select('*').gte('created_at', since).order('created_at', { ascending: false })
    if (data) setOrders(data as OrderRow[])
    setOrdersLoading(false)
  }

  // Rekap bulanan — batas hari "business day" jam 05:00 (konsisten dengan kasir)
  const loadMonth = async (ym: string) => {
    setMonthLoading(true)
    const [y, m] = ym.split('-').map(Number)
    // batas bulan jam 05:00 WIT (bukan zona HP/server)
    const mStr = `${y}-${String(m).padStart(2, '0')}`
    const nextY = m === 12 ? y + 1 : y
    const nextM = m === 12 ? 1 : m + 1
    const nextStr = `${nextY}-${String(nextM).padStart(2, '0')}`
    const prevY = m === 1 ? y - 1 : y
    const prevM = m === 1 ? 12 : m - 1
    const prevStr = `${prevY}-${String(prevM).padStart(2, '0')}`
    const start = monthStartWIT(mStr)       // tgl 1 jam 05:00 WIT
    const end = monthStartWIT(nextStr)      // bulan depan tgl 1 jam 05:00 WIT
    const prevStart = monthStartWIT(prevStr) // bulan lalu tgl 1 jam 05:00 WIT
    const [cur, prev, exp] = await Promise.all([
      supabase.from('orders').select('*').eq('status', 'done')
        .gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
        .order('created_at', { ascending: true }),
      supabase.from('orders').select('*').eq('status', 'done')
        .gte('created_at', prevStart.toISOString()).lt('created_at', start.toISOString()),
      supabase.from('expenses').select('*')
        .gte('expense_date', `${mStr}-01`).lt('expense_date', `${nextStr}-01`),
    ])
    setMonthOrders((cur.data as OrderRow[]) || [])
    setMonthPrevOrders((prev.data as OrderRow[]) || [])
    setMonthExpenses((exp.data as Expense[]) || [])
    setMonthLoading(false)
  }

  // Ubah error apa pun jadi teks yang bisa ditampilkan (jangan ditelan diam-diam:
  // dulu kegagalan di outlet sendiri tidak muncul sama sekali, jadi tombol
  // seolah tidak berfungsi tanpa penjelasan)
  const errText = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message
      : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
      : typeof e === 'string' ? e : fallback

  const loadItems = async () => {
    setLoading(true); setOutletError(null)
    if (isSelf) {
      const { data, error } = await supabase.from('menu_items').select('*').order('category').order('name')
      if (error) setOutletError(errText(error, 'Gagal memuat menu'))
      if (data) setItems(data as MenuItem[])
      setLoading(false)
      return
    }
    try {
      const json = await centralMenu('list')
      setItems((json.data as MenuItem[]) || [])
    } catch (err) {
      setItems([])
      setOutletError(err instanceof Error ? err.message : 'Gagal muat menu outlet')
    }
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
    if (res.ok) { localStorage.setItem('hallu-admin', 'ok'); localStorage.setItem('hallu-admin-pw', pw); setAuthed(true) }
    else setPwError('Password salah')
  }

  const openAdd = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setForm({ name: item.name, description: item.description || '', price: item.price, hpp: item.hpp || 0, hpp_components: item.hpp_components || [], category: item.category, available: item.available })
    setShowForm(true)
  }

  // Tulis menu_items lewat server (service_role) + fallback anon (outlet sendiri) —
  // atau lewat /api/central/menu (outlet lain, dipilih dari dropdown Kelola Outlet).
  const menuUpdate = async (id: string, values: Record<string, unknown>) => {
    if (isSelf) {
      const res = await secureWrite({
        scope: 'admin', table: 'menu_items', op: 'update', matchId: id, values,
        fallback: async () => { const r = await supabase.from('menu_items').update(values).eq('id', id); return { error: r.error } },
      })
      if (res.error) setOutletError(errText(res.error, 'Gagal simpan perubahan'))
      return res
    }
    try { await centralMenu('update', { matchId: id, values }); return { error: null } }
    catch (err) { setOutletError(err instanceof Error ? err.message : 'Gagal simpan'); return { error: err } }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setOutletError(null)
    if (editing) {
      await menuUpdate(editing.id, form)
    } else if (isSelf) {
      const res = await secureWrite({
        scope: 'admin', table: 'menu_items', op: 'insert', values: form,
        fallback: async () => { const r = await supabase.from('menu_items').insert(form); return { error: r.error } },
      })
      if (res.error) {
        setOutletError(errText(res.error, 'Gagal tambah item'))
        setSaving(false)
        return // jangan tutup form — biar isian tidak hilang & user lihat pesannya
      }
    } else {
      try { await centralMenu('insert', { values: form }) }
      catch (err) {
        setOutletError(errText(err, 'Gagal tambah item'))
        setSaving(false)
        return
      }
    }
    await loadItems(); setShowForm(false); setSaving(false)
  }

  const handleDelete = async (id: string) => {
    let gagal = false
    if (isSelf) {
      const res = await secureWrite({
        scope: 'admin', table: 'menu_items', op: 'delete', matchId: id,
        fallback: async () => { const r = await supabase.from('menu_items').delete().eq('id', id); return { error: r.error } },
      })
      if (res.error) { setOutletError(errText(res.error, 'Gagal hapus item')); gagal = true }
    } else {
      try { await centralMenu('delete', { matchId: id }) }
      catch (err) { setOutletError(errText(err, 'Gagal hapus item')); gagal = true }
    }
    // Jangan hilangkan dari daftar kalau hapusnya gagal (dulu tetap hilang di
    // layar padahal datanya masih ada — menyesatkan)
    if (!gagal) setItems(prev => prev.filter(i => i.id !== id))
    setConfirmDeleteId(null)
  }

  const handleImageUpload = async (itemId: string, file: File) => {
    setUploadingId(itemId)
    try {
      const compressed = await compressImage(file)
      let publicUrl: string
      if (isSelf || activeOutlet?.sameProject) {
        // Outlet sendiri, atau outlet schema-based (numpang project ini) → bucket sama
        const path = `${itemId}.jpg`
        const { error: upErr } = await supabase.storage.from('menu-images').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
        if (upErr) throw upErr
        publicUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
      } else {
        // Outlet di project Supabase lain → upload lewat server (service_role outlet itu)
        const fd = new FormData()
        fd.append('password', adminPw())
        fd.append('outletUrl', activeOutlet?.url || '')
        fd.append('outletSchema', activeOutlet?.schema || 'public')
        fd.append('itemId', itemId)
        fd.append('file', compressed, `${itemId}.jpg`)
        const res = await fetch('/api/central/menu-image', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'gagal upload')
        publicUrl = json.publicUrl
      }
      await menuUpdate(itemId, { image_url: publicUrl })
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, image_url: publicUrl } : i))
    } catch (err) {
      alert(isSelf ? 'Gagal upload foto. Pastikan bucket menu-images sudah dibuat di Supabase Storage.' : (err instanceof Error ? err.message : 'Gagal upload foto.'))
    }
    setUploadingId(null)
  }

  const generate3DModel = async (item: MenuItem) => {
    if (!item.image_url) { alert('Upload foto produk dulu sebelum generate 3D.'); return }
    setMeshyStatus(s => ({ ...s, [item.id]: { status: 'STARTING', progress: 0 } }))
    try {
      const res = await fetch('/api/meshy/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: item.image_url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal start generate')
      const taskId = json.taskId
      await menuUpdate(item.id, { model_3d_task_id: taskId })
      // Poll status
      pollMeshyTask(item.id, taskId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      setMeshyStatus(s => ({ ...s, [item.id]: { status: 'FAILED', progress: 0, error: msg } }))
    }
  }

  const pollMeshyTask = async (itemId: string, taskId: string) => {
    let tries = 0
    const maxTries = 180 // ~9 menit max (3s interval)
    const interval = setInterval(async () => {
      tries++
      try {
        const res = await fetch(`/api/meshy/status?id=${taskId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setMeshyStatus(s => ({ ...s, [itemId]: { status: json.status, progress: json.progress || 0, error: json.error } }))
        if (json.status === 'SUCCEEDED' && json.glbUrl) {
          clearInterval(interval)
          await menuUpdate(itemId, { model_3d_url: json.glbUrl })
          setItems(prev => prev.map(i => i.id === itemId ? { ...i, model_3d_url: json.glbUrl } : i))
        } else if (json.status === 'FAILED' || tries >= maxTries) {
          clearInterval(interval)
        }
      } catch (err) {
        clearInterval(interval)
        const msg = err instanceof Error ? err.message : 'Polling gagal'
        setMeshyStatus(s => ({ ...s, [itemId]: { status: 'FAILED', progress: 0, error: msg } }))
      }
    }, 3000)
  }

  const saveManualGlb = async (item: MenuItem) => {
    const url = manualGlbUrl.trim()
    if (!url) return
    await menuUpdate(item.id, { model_3d_url: url })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, model_3d_url: url } : i))
    setManualGlbUrl('')
  }

  const remove3DModel = async (item: MenuItem) => {
    await menuUpdate(item.id, { model_3d_url: null, model_3d_task_id: null })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, model_3d_url: null, model_3d_task_id: null } : i))
  }

  const handleImageRemove = async (item: MenuItem) => {
    await menuUpdate(item.id, { image_url: null })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, image_url: null } : i))
  }

  const toggleAvailable = async (item: MenuItem) => {
    const next = !item.available
    await menuUpdate(item.id, { available: next })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: next } : i))
  }

  // HPP stats
  const hppStats = items.map(i => ({
    ...i,
    margin: margin(i.price, i.hpp),
    profit: i.hpp ? i.price - i.hpp : null,
  })).sort((a, b) => (b.margin ?? -1) - (a.margin ?? -1))
  const avgMargin = (() => {
    const withHpp = hppStats.filter(i => i.margin !== null)
    if (!withHpp.length) return null
    return Math.round(withHpp.reduce((s, i) => s + (i.margin ?? 0), 0) / withHpp.length)
  })()

  if (!authed) return (
    <div className="min-h-screen bg-h-bg flex items-center justify-center p-6">
      <div className="bg-h-card border border-h-border rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" title="Kembali ke beranda" className="inline-block">
            <div className="font-sans text-2xl font-black text-white tracking-widest uppercase hover:text-h-cream transition-colors">{BRAND.name}</div>
          </a>
          <div className="flex items-center gap-2 justify-center mt-1">
            <div className="h-px w-6 bg-h-red" />
            <div className="text-h-cream text-[0.5rem] tracking-[3px] uppercase font-semibold">Admin Panel</div>
            <div className="h-px w-6 bg-h-red" />
          </div>
          <a href="/" className="text-h-muted hover:text-white text-xs mt-3 inline-block transition-colors">← Kembali ke beranda</a>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-h-muted font-semibold uppercase tracking-wide block mb-1.5">Password</label>
            <input type="password" value={pw} onChange={e => { setPw(e.target.value); setPwError('') }}
              className="w-full bg-h-dark border border-h-border rounded-xl px-4 py-3 focus:outline-none focus:border-h-red transition-colors text-sm text-white placeholder-h-muted"
              placeholder="Masukkan password admin" autoFocus />
            {pwError && <p className="text-red-400 text-xs mt-1">{pwError}</p>}
          </div>
          <button type="submit" className="w-full bg-h-red hover:bg-h-red-d text-white py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-colors">
            Masuk
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-h-bg">
      <header className="bg-h-dark border-b border-h-border">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="/" title="Kembali ke beranda" className="group">
            <div className="font-sans text-xl font-black text-white tracking-widest uppercase group-hover:text-h-cream transition-colors">{BRAND.name}</div>
            <div className="text-h-cream text-[0.55rem] tracking-[3px] uppercase font-semibold mt-0.5">Admin Panel</div>
          </a>
          <div className="flex items-center gap-4">
            <a href="/" className="text-h-muted hover:text-white text-sm transition-colors">Beranda</a>
            <a href="/admin/qr" className="text-h-muted hover:text-white text-sm transition-colors">QR Generator</a>
            <a href="/kasir" className="text-h-muted hover:text-white text-sm transition-colors">Kasir</a>
            <button onClick={() => { localStorage.removeItem('hallu-admin'); localStorage.removeItem('hallu-admin-pw'); setAuthed(false) }}
              className="border border-h-border hover:border-white/30 text-h-muted hover:text-white px-4 py-1.5 rounded-full text-sm transition-colors">
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-h-dark border-b border-h-border overflow-x-auto">
        <div className="max-w-5xl mx-auto flex min-w-max">
          {([['menu', 'Kelola Menu'], ['hpp', 'HPP & Margin'], ['analitik', 'Analitik'], ['outlet', 'Pantau Outlet'], ['pengaturan', 'Pengaturan']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-3.5 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors border-b-2 ${tab === key ? 'text-h-cream border-h-red' : 'text-h-muted border-transparent hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Kelola Outlet — pilih outlet mana yang mau diatur (khusus tab Menu/HPP/Pengaturan) ── */}
      {isSelf && (
        <div className="bg-h-card border-b border-h-border">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black text-h-muted uppercase tracking-widest whitespace-nowrap">Kelola Outlet</span>
            {outlets.length > 1 && (
              <select
                value={activeOutletKey}
                onChange={e => { setActiveOutletKey(e.target.value); setShowForm(false); setEditing(null); setConfirmDeleteId(null); setOutletError(null) }}
                className="bg-h-dark border border-h-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-h-red transition-colors">
                {outlets.map(o => {
                  const key = outletKey(o)
                  const disabled = key !== SELF_KEY && !o.writable
                  return (
                    <option key={key} value={key} disabled={disabled}>
                      {o.name}{key === SELF_KEY ? ' (outlet ini)' : disabled ? ' — belum terhubung' : ''}
                    </option>
                  )
                })}
              </select>
            )}
            <button onClick={() => { setShowAddOutlet(true); setAddOutletError(null) }}
              className="text-xs font-bold text-h-cream hover:text-white border border-h-red/40 hover:border-h-red px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              + Tambah Outlet
            </button>
          </div>
        </div>
      )}
      {!isSelf && (
        <div className="bg-h-card border-b border-h-border">
          <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-black text-h-muted uppercase tracking-widest whitespace-nowrap">Kelola Outlet</span>
            <select
              value={activeOutletKey}
              onChange={e => { setActiveOutletKey(e.target.value); setShowForm(false); setEditing(null); setConfirmDeleteId(null); setOutletError(null) }}
              className="bg-h-dark border border-h-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-h-red transition-colors">
              {outlets.map(o => {
                const key = outletKey(o)
                const disabled = key !== SELF_KEY && !o.writable
                return (
                  <option key={key} value={key} disabled={disabled}>
                    {o.name}{key === SELF_KEY ? ' (outlet ini)' : disabled ? ' — belum terhubung' : ''}
                  </option>
                )
              })}
            </select>
            <span className="text-[10px] text-h-cream bg-h-red/10 border border-h-red/30 rounded-full px-3 py-1">
              Sedang kelola: <strong>{activeOutlet?.name}</strong> — Analitik & Bersihkan Data tetap punya outlet ini sendiri
            </span>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {outletError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2 mb-4">⚠️ {outletError}</div>
        )}

        {/* ── TAB: Kelola Menu ── */}
        {tab === 'menu' && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h1 className="font-sans text-lg font-black text-white uppercase tracking-wider">Kelola Menu</h1>
              <button onClick={openAdd} className="bg-h-red hover:bg-h-red-d text-white px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors">
                + Tambah Item
              </button>
            </div>
            {loading ? (
              <div className="text-center text-h-muted text-sm pt-10">Memuat data...</div>
            ) : (
              <div className="bg-h-card border border-h-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="border-b border-h-border">
                      <tr>{['Foto', 'Nama', 'Kategori', 'Harga', 'HPP', 'Margin', '3D', 'Status', 'Aksi'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-h-muted uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-h-border">
                      {items.length === 0 ? (
                        <tr><td colSpan={9} className="text-center text-h-muted text-sm py-12">Belum ada item menu.</td></tr>
                      ) : items.map(item => {
                        const m = margin(item.price, item.hpp)
                        const meshy = meshyStatus[item.id]
                        const isGenerating = meshy && !['SUCCEEDED', 'FAILED'].includes(meshy.status)
                        return (
                          <tr key={item.id} className="hover:bg-h-dark/50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                {item.image_url ? (
                                  <div className="relative group">
                                    <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded-lg border border-h-border" />
                                    <button onClick={() => handleImageRemove(item)}
                                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-h-red rounded-full text-white text-[8px] font-black items-center justify-center hidden group-hover:flex leading-none">×</button>
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg border border-dashed border-h-border flex items-center justify-center text-h-muted text-lg">📷</div>
                                )}
                                <label className={`cursor-pointer text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${uploadingId === item.id ? 'border-h-border text-h-muted' : 'border-h-border text-h-muted hover:border-h-red hover:text-h-cream'}`}>
                                  <input type="file" accept="image/*" className="hidden" disabled={uploadingId === item.id}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(item.id, f); e.target.value = '' }} />
                                  {uploadingId === item.id ? '⏳' : item.image_url ? 'Ganti' : 'Upload'}
                                </label>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-sm text-white">{item.name}</div>
                              {item.description && <div className="text-xs text-h-muted mt-0.5 max-w-[180px] truncate">{item.description}</div>}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-h-muted">{item.category}</td>
                            <td className="px-4 py-3.5 text-sm font-bold text-white">{formatRp(item.price)}</td>
                            <td className="px-4 py-3.5 text-sm text-h-muted">{item.hpp ? formatRp(item.hpp) : <span className="text-h-border">—</span>}</td>
                            <td className="px-4 py-3.5">
                              {m !== null
                                ? <span className={`text-sm font-bold ${marginColor(m)}`}>{m}%</span>
                                : <span className="text-h-border text-sm">—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              {item.model_3d_url ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-green-400 font-bold">✓ 3D</span>
                                  <button onClick={() => remove3DModel(item)} title="Hapus model 3D"
                                    className="text-xs text-h-muted hover:text-h-cream">×</button>
                                </div>
                              ) : isGenerating ? (
                                <div className="text-[10px]">
                                  <div className="text-h-cream font-bold">{meshy.status}</div>
                                  <div className="w-16 h-1 bg-h-border rounded mt-1 overflow-hidden">
                                    <div className="h-full bg-h-red transition-all" style={{ width: `${meshy.progress}%` }} />
                                  </div>
                                </div>
                              ) : meshy?.status === 'FAILED' ? (
                                <button onClick={() => generate3DModel(item)} title={meshy.error || 'Gagal, coba lagi'}
                                  className="text-[10px] text-h-cream hover:underline font-bold">↻ Retry</button>
                              ) : (
                                <button onClick={() => generate3DModel(item)} disabled={!item.image_url}
                                  className="text-[10px] font-bold uppercase tracking-wider border border-h-red/40 text-h-cream hover:bg-h-red/10 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded">
                                  ✨ Gen 3D
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <button onClick={() => toggleAvailable(item)}
                                className={`text-xs font-bold px-3 py-1 rounded-full transition-colors uppercase tracking-wide ${item.available ? 'bg-h-red/20 text-h-cream hover:bg-h-red/30' : 'bg-h-border text-h-muted hover:bg-h-border/80'}`}>
                                {item.available ? 'Tersedia' : 'Habis'}
                              </button>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <button onClick={() => openEdit(item)} className="text-xs text-h-cream hover:text-h-cream-d font-bold uppercase">Edit</button>
                                {confirmDeleteId === item.id ? (
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleDelete(item.id)} className="text-xs text-white bg-h-red hover:bg-h-red-d px-2 py-1 rounded font-bold uppercase">Yakin</button>
                                    <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-h-muted hover:text-white font-bold uppercase">Batal</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setConfirmDeleteId(item.id)} className="text-xs text-h-muted hover:text-white font-bold uppercase">Hapus</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB: HPP & Margin ── */}
        {tab === 'hpp' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="font-sans text-lg font-black text-white uppercase tracking-wider">HPP &amp; Margin</h1>
              {avgMargin !== null && (
                <div className="text-sm text-h-muted">Rata-rata margin: <span className={`font-black ${marginColor(avgMargin)}`}>{avgMargin}%</span></div>
              )}
            </div>

            {/* Summary cards */}
            {!loading && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Margin ≥ 60%', value: hppStats.filter(i => (i.margin ?? 0) >= 60).length, color: 'text-green-400' },
                  { label: 'Margin 40–59%', value: hppStats.filter(i => { const m = i.margin ?? 0; return m >= 40 && m < 60 }).length, color: 'text-yellow-400' },
                  { label: 'Margin < 40%', value: hppStats.filter(i => i.margin !== null && (i.margin ?? 0) < 40).length, color: 'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="bg-h-card border border-h-border rounded-2xl p-4">
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-h-muted mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Daftar bahan: harga & takaran cukup diisi sekali, dipakai ulang ── */}
            {isSelf && bahanList.length > 0 && (
              <div className="bg-h-card border border-h-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xs font-black text-h-muted uppercase tracking-widest">Daftar Bahan</h2>
                  <span className="text-xs text-h-muted">{bahanList.length} bahan</span>
                </div>
                <p className="text-[10px] text-h-muted mb-3">
                  Dipakai ulang waktu mengisi HPP menu mana pun — tidak perlu ketik harga &amp; takaran lagi.
                  Menambah bahan dilakukan dari kalkulator HPP (tombol <span className="text-h-cream">+ simpan ke daftar</span>).
                </p>
                <div className="bg-h-dark border border-h-border rounded-xl divide-y divide-h-border text-xs">
                  {bahanList.map(b => (
                    <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-white truncate">{b.nama}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-h-muted tabular-nums">{ringkasBahan(b)}</span>
                        <button type="button" onClick={() => hapusBahan(b.id)}
                          className="text-h-muted hover:text-red-400 text-base leading-none transition-colors" title="Hapus dari daftar">×</button>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-h-muted mt-2">
                  Menghapus bahan di sini <span className="text-white">tidak mengubah HPP menu</span> yang sudah terisi — resep tiap menu disimpan tersendiri.
                </p>
              </div>
            )}

            {/* Per item table */}
            <div className="bg-h-card border border-h-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead className="border-b border-h-border">
                    <tr>{['Item', 'Kategori', 'HPP', 'Harga Jual', 'Profit/unit', 'Margin'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-h-muted uppercase tracking-wider">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-h-border">
                    {loading ? (
                      <tr><td colSpan={6} className="text-center text-h-muted text-sm py-10">Memuat...</td></tr>
                    ) : hppStats.map(item => (
                      <tr key={item.id} className="hover:bg-h-dark/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-sm text-white">{item.name}</div>
                          {!item.hpp && <div className="text-[10px] text-h-border mt-0.5">HPP belum diisi — klik Edit</div>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-h-muted">{item.category}</td>
                        <td className="px-4 py-3.5 text-sm text-h-muted">{item.hpp ? formatRp(item.hpp) : <span className="text-h-border">—</span>}</td>
                        <td className="px-4 py-3.5 text-sm font-bold text-white">{formatRp(item.price)}</td>
                        <td className="px-4 py-3.5 text-sm font-bold text-green-400">{item.profit !== null ? formatRp(item.profit) : <span className="text-h-border">—</span>}</td>
                        <td className="px-4 py-3.5">
                          {item.margin !== null
                            ? (
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-h-border rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${item.margin >= 60 ? 'bg-green-400' : item.margin >= 40 ? 'bg-yellow-400' : 'bg-h-red'}`}
                                    style={{ width: `${Math.min(100, item.margin)}%` }} />
                                </div>
                                <span className={`text-sm font-black ${marginColor(item.margin)}`}>{item.margin}%</span>
                              </div>
                            )
                            : <span className="text-h-border text-sm">—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-h-muted">* Isi HPP per item lewat tab <button onClick={() => { setTab('menu') }} className="text-h-cream hover:underline">Kelola Menu → Edit</button></p>
          </div>
        )}

        {/* ── TAB: Analitik ── */}
        {tab === 'analitik' && !isSelf && (
          <div className="bg-h-card border border-h-border rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-white font-bold text-sm mb-1">Analitik & Laba-Rugi outlet lain</div>
            <div className="text-h-muted text-xs max-w-sm mx-auto">
              Tab ini menampilkan data outlet <strong className="text-white">{outlets.find(o => outletKey(o) === SELF_KEY)?.name || 'ini'}</strong> sendiri.
              Untuk lihat omzet & laba-rugi <strong className="text-h-cream">{activeOutlet?.name}</strong> dan semua outlet sekaligus, buka <a href="/owner" className="text-h-cream hover:underline">Dashboard Owner</a>.
            </div>
          </div>
        )}
        {tab === 'analitik' && isSelf && (() => {
          const doneOrders = orders.filter(o => o.status === 'done')
          const allOrders30 = orders

          // 7-day revenue (7 hari terakhir, done orders) — dikelompokkan per tanggal WIT
          const todayW = toWITDateString(new Date())
          const days7 = Array.from({ length: 7 }, (_, i) => shiftDay(todayW, -(6 - i)))
          const rev7 = days7.map(dayStr => {
            const dayOrders = doneOrders.filter(o => toWITDateString(new Date(o.created_at)) === dayStr)
            const revenue = dayOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.qty, 0), 0)
            return { label: fmtWITWeekdayDay(dayStr), revenue, count: dayOrders.length }
          })
          const maxRev = Math.max(...rev7.map(d => d.revenue), 1)

          // Peak hours (all 30-day orders by hour WIT)
          const hourCounts = Array(24).fill(0)
          allOrders30.forEach(o => { hourCounts[witHour(o.created_at)]++ })
          const maxHour = Math.max(...hourCounts, 1)
          // only show 7:00–23:00
          const hoursDisplay = Array.from({ length: 17 }, (_, i) => i + 7)

          // Top 5 items (done orders, 30 days)
          const itemCount: Record<string, { name: string; qty: number; revenue: number }> = {}
          doneOrders.forEach(o => o.items.forEach(i => {
            if (!itemCount[i.id]) itemCount[i.id] = { name: i.name, qty: 0, revenue: 0 }
            itemCount[i.id].qty += i.qty
            itemCount[i.id].revenue += i.price * i.qty
          }))
          const topItems = Object.values(itemCount).sort((a, b) => b.qty - a.qty).slice(0, 5)
          const maxQty = Math.max(...topItems.map(i => i.qty), 1)

          // Rating stats
          const ratedOrders = doneOrders.filter(o => o.rating)
          const avgRating = ratedOrders.length ? (ratedOrders.reduce((s, o) => s + (o.rating || 0), 0) / ratedOrders.length).toFixed(1) : null
          const ratingDist = [5,4,3,2,1].map(r => ({ r, count: ratedOrders.filter(o => o.rating === r).length }))
          const maxRatingCount = Math.max(...ratingDist.map(r => r.count), 1)

          // Summary totals (30 days)
          const totalRev30 = doneOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.price * i.qty, 0), 0)
          const totalRev7 = rev7.reduce((s, d) => s + d.revenue, 0)

          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="font-sans text-lg font-black text-white uppercase tracking-wider">Analitik</h1>
                <div className="flex items-center gap-3">
                  <button onClick={() => loadOrders()}
                    className="text-xs text-h-muted hover:text-white border border-h-border hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors font-bold">
                    ↻ Refresh
                  </button>
                  <button onClick={() => exportCsv(allOrders30)}
                    className="text-xs font-bold bg-h-red hover:bg-h-red-d text-white px-4 py-1.5 rounded-lg transition-colors uppercase tracking-wider">
                    ⬇ Export CSV
                  </button>
                </div>
              </div>

              {/* ── Rekap Bulanan ── */}
              {(() => {
                const sumRev = (arr: OrderRow[]) => arr.reduce((s, o) => s + o.items.reduce((a, i) => a + i.price * i.qty, 0), 0)
                const mRev = sumRev(monthOrders)
                const mPrevRev = sumRev(monthPrevOrders)
                const mCount = monthOrders.length
                // hari operasional = jumlah tanggal unik (business day, cutoff 05:00)
                // business day (WIT, cutoff 05:00) dari sebuah timestamp
                const bizDay = (iso: string) => toWITDateString(new Date(new Date(iso).getTime() - 5 * 3600 * 1000))
                const activeDays = new Set(monthOrders.map(o => bizDay(o.created_at))).size
                const avgPerDay = activeDays ? Math.round(mRev / activeDays) : 0
                const avgPerTrx = mCount ? Math.round(mRev / mCount) : 0
                const growth = mPrevRev > 0 ? Math.round(((mRev - mPrevRev) / mPrevRev) * 100) : null
                // per metode
                const byMethod: Record<string, number> = {}
                monthOrders.forEach(o => { const m = o.payment_method || 'lainnya'; byMethod[m] = (byMethod[m] || 0) + o.items.reduce((a, i) => a + i.price * i.qty, 0) })
                const methodLabels: Record<string, string> = { tunai: '💵 Tunai', qris: '⬛ QRIS', transfer: '🏦 Transfer', lainnya: '💳 Lainnya' }
                // top items
                const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {}
                monthOrders.forEach(o => o.items.forEach(i => { if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 }; itemMap[i.name].qty += i.qty; itemMap[i.name].revenue += i.price * i.qty }))
                const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5)
                const monthLabel = new Date(monthValue + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

                // ── P&L / Laba-Rugi ──
                // HPP terjual: cocokkan item order ke HPP menu saat ini (by id, fallback nama)
                const hppById: Record<string, number> = {}
                const hppByName: Record<string, number> = {}
                items.forEach(it => { hppById[it.id] = it.hpp || 0; hppByName[it.name] = it.hpp || 0 })
                let cogs = 0, matchedQty = 0, totalQty = 0
                monthOrders.forEach(o => o.items.forEach(i => {
                  totalQty += i.qty
                  const h = hppById[i.id] ?? hppByName[i.name]
                  if (h !== undefined && h > 0) { cogs += h * i.qty; matchedQty += i.qty }
                }))
                const grossProfit = mRev - cogs
                const expByCat: Record<string, number> = {}
                monthExpenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount })
                const expTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
                const netProfit = grossProfit - expTotal
                const netMargin = mRev > 0 ? Math.round((netProfit / mRev) * 100) : null
                const hppCoverage = totalQty > 0 ? Math.round((matchedQty / totalQty) * 100) : 100

                return (
                  <div className="bg-h-card border border-h-border rounded-2xl p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xs font-black text-h-muted uppercase tracking-widest">Rekap Bulanan</h2>
                        <div className="text-white font-bold text-sm mt-0.5">{monthLabel}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="month" value={monthValue} max={new Date().toISOString().slice(0, 7)}
                          onChange={e => setMonthValue(e.target.value)}
                          className="bg-h-dark border border-h-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-h-red" />
                        <button onClick={() => exportCsv(monthOrders)} disabled={monthOrders.length === 0}
                          className="text-xs font-bold bg-h-red hover:bg-h-red-d disabled:opacity-40 text-white px-3.5 py-1.5 rounded-lg transition-colors uppercase tracking-wider whitespace-nowrap">
                          ⬇ CSV
                        </button>
                      </div>
                    </div>

                    {monthLoading ? (
                      <div className="text-center text-h-muted text-sm py-10 animate-pulse">Memuat rekap {monthLabel}...</div>
                    ) : mCount === 0 ? (
                      <div className="text-center text-h-muted text-sm py-10">Belum ada transaksi selesai di {monthLabel}</div>
                    ) : (
                      <>
                        {/* KPI bulanan */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-h-dark border border-h-border rounded-xl p-4">
                            <div className="text-xs text-h-muted mb-1">Total Pendapatan</div>
                            <div className="text-lg font-black text-white leading-tight">{formatRp(mRev)}</div>
                            {growth !== null && (
                              <div className={`text-xs font-bold mt-1 ${growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {growth >= 0 ? '▲' : '▼'} {Math.abs(growth)}% vs bln lalu
                              </div>
                            )}
                          </div>
                          <div className="bg-h-dark border border-h-border rounded-xl p-4">
                            <div className="text-xs text-h-muted mb-1">Transaksi</div>
                            <div className="text-lg font-black text-white leading-tight">{mCount}</div>
                            <div className="text-xs text-h-muted mt-1">{activeDays} hari operasi</div>
                          </div>
                          <div className="bg-h-dark border border-h-border rounded-xl p-4">
                            <div className="text-xs text-h-muted mb-1">Rata-rata / Hari</div>
                            <div className="text-lg font-black text-white leading-tight">{formatRp(avgPerDay)}</div>
                          </div>
                          <div className="bg-h-dark border border-h-border rounded-xl p-4">
                            <div className="text-xs text-h-muted mb-1">Rata-rata / Transaksi</div>
                            <div className="text-lg font-black text-white leading-tight">{formatRp(avgPerTrx)}</div>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          {/* Per metode */}
                          <div>
                            <div className="text-[10px] uppercase tracking-widest font-bold text-h-muted mb-2">Per Metode Bayar</div>
                            <div className="space-y-1.5">
                              {Object.entries(byMethod).sort(([, a], [, b]) => b - a).map(([m, v]) => (
                                <div key={m} className="flex items-center justify-between bg-h-dark border border-h-border rounded-lg px-3 py-2">
                                  <span className="text-xs text-white">{methodLabels[m] || m}</span>
                                  <div className="text-right">
                                    <span className="text-xs font-bold text-white">{formatRp(v)}</span>
                                    <span className="text-[10px] text-h-muted ml-1.5">{Math.round(v / mRev * 100)}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Top item bulan ini */}
                          <div>
                            <div className="text-[10px] uppercase tracking-widest font-bold text-h-muted mb-2">Top Item Bulan Ini</div>
                            <div className="space-y-1.5">
                              {topItems.map((item, i) => (
                                <div key={item.name} className="flex items-center justify-between bg-h-dark border border-h-border rounded-lg px-3 py-2">
                                  <span className="text-xs text-white flex items-center gap-2">
                                    <span className="text-h-cream font-black w-4">#{i + 1}</span>{item.name}
                                  </span>
                                  <span className="text-xs text-h-muted font-bold">{item.qty}×</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* ── Laba-Rugi (P&L) ── */}
                        <div className="border-t border-h-border pt-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-[10px] uppercase tracking-widest font-bold text-h-muted">Laba-Rugi Bulan Ini</div>
                            <a href="/kasir" className="text-[10px] text-h-cream hover:underline">+ catat pengeluaran di Kasir</a>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-3 mb-4">
                            <div className="bg-h-dark border border-h-border rounded-xl p-4">
                              <div className="text-xs text-h-muted mb-1">Laba Kotor</div>
                              <div className="text-lg font-black text-white leading-tight">{formatRp(grossProfit)}</div>
                              <div className="text-[10px] text-h-muted mt-1">Pendapatan − HPP terjual</div>
                            </div>
                            <div className="bg-h-dark border border-h-border rounded-xl p-4">
                              <div className="text-xs text-h-muted mb-1">Total Pengeluaran</div>
                              <div className="text-lg font-black text-white leading-tight">{formatRp(expTotal)}</div>
                              <div className="text-[10px] text-h-muted mt-1">{monthExpenses.length} catatan</div>
                            </div>
                            <div className={`border rounded-xl p-4 ${netProfit >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                              <div className="text-xs text-h-muted mb-1">Laba Bersih</div>
                              <div className={`text-lg font-black leading-tight ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatRp(netProfit)}</div>
                              <div className="text-[10px] text-h-muted mt-1">{netMargin !== null ? `margin ${netMargin}%` : '—'}</div>
                            </div>
                          </div>
                          {/* Rincian */}
                          <div className="bg-h-dark border border-h-border rounded-xl divide-y divide-h-border text-xs">
                            <div className="flex justify-between px-4 py-2.5">
                              <span className="text-white">Pendapatan (omzet)</span>
                              <span className="font-bold text-white">{formatRp(mRev)}</span>
                            </div>
                            <div className="flex justify-between px-4 py-2.5">
                              <span className="text-h-muted">− HPP terjual{hppCoverage < 90 ? <span className="text-yellow-500/80"> (≈{hppCoverage}% item ada HPP)</span> : ''}</span>
                              <span className="font-bold text-h-muted">−{formatRp(cogs)}</span>
                            </div>
                            {EXPENSE_CATEGORIES.filter(c => expByCat[c.value]).map(c => (
                              <div key={c.value} className="flex justify-between px-4 py-2.5">
                                <span className="text-h-muted">− {c.icon} {c.label}</span>
                                <span className="font-bold text-h-muted">−{formatRp(expByCat[c.value])}</span>
                              </div>
                            ))}
                            <div className={`flex justify-between px-4 py-3 ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              <span className="font-black uppercase tracking-wide">Laba Bersih</span>
                              <span className="font-black">{formatRp(netProfit)}</span>
                            </div>
                          </div>
                          {cogs === 0 && (
                            <div className="text-[10px] text-yellow-500/80 mt-2">
                              💡 HPP menu masih 0 — isi HPP di tab &quot;HPP &amp; Margin&quot; supaya laba kotor akurat.
                            </div>
                          )}

                          {/* ── Bahan baku terpakai: dihitung dari resep HPP × qty terjual ── */}
                          {(() => {
                            const rekap = hitungBahanTerpakai(monthOrders, items)
                            if (rekap.bahan.length === 0) return null
                            const belanja = expByCat['bahan'] || 0
                            const terpakai = Math.round(rekap.totalBiaya)
                            const selisih = belanja - terpakai
                            const cakupan = rekap.qtyTotal > 0
                              ? Math.round((rekap.qtyTerinci / rekap.qtyTotal) * 100) : 100
                            return (
                              <div className="mt-6">
                                <h3 className="text-xs font-black text-h-muted uppercase tracking-widest">Bahan Baku Terpakai</h3>
                                <p className="text-[10px] text-h-muted mt-1 mb-2">
                                  Dihitung otomatis dari resep HPP × jumlah terjual — bukan input manual.
                                  {cakupan < 100 && (
                                    <span className="text-yellow-500/80"> Baru ≈{cakupan}% porsi punya rincian bahan, sisanya belum terhitung.</span>
                                  )}
                                </p>
                                <div className="bg-h-dark border border-h-border rounded-xl divide-y divide-h-border text-xs">
                                  {rekap.bahan.map(b => (
                                    <div key={b.nama + '|' + b.satuan} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                      <span className="text-white truncate">{b.nama}</span>
                                      <span className="flex items-center gap-4 shrink-0">
                                        <span className="text-h-cream font-bold tabular-nums">{fmtJumlah(b.jumlah, b.satuan)}</span>
                                        <span className="text-h-muted font-bold tabular-nums w-24 text-right">{formatRp(Math.round(b.biaya))}</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {belanja > 0 && (
                                  <>
                                    <div className="bg-h-dark border border-h-border rounded-xl divide-y divide-h-border text-xs mt-3">
                                      <div className="flex justify-between px-4 py-2.5">
                                        <span className="text-h-muted">📦 Belanja bahan (dicatat kasir)</span>
                                        <span className="font-bold text-white">{formatRp(belanja)}</span>
                                      </div>
                                      <div className="flex justify-between px-4 py-2.5">
                                        <span className="text-h-muted">Nilai bahan terpakai (dari penjualan)</span>
                                        <span className="font-bold text-white">{formatRp(terpakai)}</span>
                                      </div>
                                      <div className={`flex justify-between px-4 py-3 ${selisih > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                        <span className="font-black uppercase tracking-wide">Selisih</span>
                                        <span className="font-black">{formatRp(selisih)}</span>
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-h-muted mt-2">
                                      Selisih bukan otomatis berarti boros: belanja bulan ini bisa jadi stok untuk bulan depan.
                                      Yang perlu dicurigai kalau selisihnya besar dan terus berulang tiap bulan.
                                    </p>
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

              {ordersLoading ? (
                <div className="text-center text-h-muted text-sm py-16">Memuat data analitik...</div>
              ) : (
                <>
                  {/* KPI cards */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: 'Revenue 7 Hari', value: formatRp(totalRev7), sub: `${rev7.reduce((s,d) => s+d.count,0)} transaksi` },
                      { label: 'Revenue 30 Hari', value: formatRp(totalRev30), sub: `${doneOrders.length} transaksi` },
                      { label: 'Total Order', value: allOrders30.length.toString(), sub: '30 hari terakhir' },
                      { label: 'Rata-rata Rating', value: avgRating ? `${avgRating} ⭐` : '—', sub: `dari ${ratedOrders.length} ulasan` },
                    ].map(card => (
                      <div key={card.label} className="bg-h-card border border-h-border rounded-2xl p-4">
                        <div className="text-xs text-h-muted mb-1 uppercase tracking-wide font-semibold">{card.label}</div>
                        <div className="text-xl font-black text-white leading-tight">{card.value}</div>
                        <div className="text-xs text-h-muted mt-1">{card.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Revenue 7 hari bar chart */}
                  <div className="bg-h-card border border-h-border rounded-2xl p-5">
                    <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-4">Revenue 7 Hari Terakhir</h2>
                    <div className="flex items-end gap-2 h-36">
                      {rev7.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                          <div className="text-[9px] text-h-muted font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {d.revenue ? formatRp(d.revenue) : '—'}
                          </div>
                          <div className="w-full flex items-end" style={{ height: '100px' }}>
                            <div
                              className="w-full rounded-t-lg transition-all duration-700"
                              style={{
                                height: `${Math.max(4, Math.round((d.revenue / maxRev) * 100))}px`,
                                background: d.revenue ? 'linear-gradient(180deg, #e63329, #c0271f)' : '#2a2a2a',
                              }}
                            />
                          </div>
                          <div className="text-[9px] text-h-muted text-center">{d.label}</div>
                          {d.count > 0 && <div className="text-[9px] text-h-cream font-bold">{d.count}×</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Peak hours + Top items row */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {/* Peak hours */}
                    <div className="bg-h-card border border-h-border rounded-2xl p-5">
                      <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-4">Jam Ramai (30 Hari)</h2>
                      <div className="space-y-1.5">
                        {hoursDisplay.map(h => (
                          <div key={h} className="flex items-center gap-2">
                            <div className="text-[10px] text-h-muted w-10 text-right flex-shrink-0">{String(h).padStart(2,'0')}:00</div>
                            <div className="flex-1 h-4 bg-h-dark rounded-sm overflow-hidden">
                              <div
                                className="h-full rounded-sm transition-all duration-500"
                                style={{
                                  width: `${Math.round((hourCounts[h] / maxHour) * 100)}%`,
                                  background: hourCounts[h] > maxHour * 0.7
                                    ? 'linear-gradient(90deg,#e63329,#c0271f)'
                                    : hourCounts[h] > maxHour * 0.4
                                    ? 'linear-gradient(90deg,#ca8a04,#a16207)'
                                    : '#3a3a3a',
                                }}
                              />
                            </div>
                            <div className="text-[10px] text-h-muted w-4 text-right flex-shrink-0">{hourCounts[h] || ''}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top items */}
                    <div className="bg-h-card border border-h-border rounded-2xl p-5">
                      <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-4">Top Item (30 Hari)</h2>
                      {topItems.length === 0 ? (
                        <div className="text-h-muted text-xs text-center py-6">Belum ada data penjualan</div>
                      ) : (
                        <div className="space-y-3">
                          {topItems.map((item, i) => (
                            <div key={item.name}>
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-h-cream font-black w-4">#{i+1}</span>
                                  <span className="text-xs text-white font-semibold">{item.name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-white font-bold">{item.qty}×</span>
                                  <span className="text-[10px] text-h-muted ml-1.5">{formatRp(item.revenue)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-h-dark rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-h-red transition-all duration-500"
                                  style={{ width: `${Math.round((item.qty / maxQty) * 100)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rating distribution */}
                  {ratedOrders.length > 0 && (
                    <div className="bg-h-card border border-h-border rounded-2xl p-5">
                      <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-4">Distribusi Rating</h2>
                      <div className="space-y-2">
                        {ratingDist.map(({ r, count }) => (
                          <div key={r} className="flex items-center gap-3">
                            <div className="text-xs text-yellow-400 w-14 flex-shrink-0">{'⭐'.repeat(r)}</div>
                            <div className="flex-1 h-4 bg-h-dark rounded-sm overflow-hidden">
                              <div className="h-full bg-yellow-500/70 rounded-sm transition-all duration-500"
                                style={{ width: `${Math.round((count / maxRatingCount) * 100)}%` }} />
                            </div>
                            <div className="text-xs text-h-muted w-6 text-right">{count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Menu Engineering Insights */}
                  <div className="bg-h-card border border-h-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xs font-black text-h-muted uppercase tracking-widest">🧠 Menu Engineering AI</h2>
                        <p className="text-xs text-h-muted mt-0.5">Analisis Star / Plowhorse / Puzzle / Dog dengan rekomendasi action.</p>
                      </div>
                      {!aiInsightsLoading && (
                        <button onClick={generateAiInsights}
                          className="text-xs font-bold bg-h-red/10 hover:bg-h-red/20 border border-h-red/40 text-h-cream px-3.5 py-1.5 rounded-lg transition-colors uppercase tracking-wider">
                          {aiInsights ? '↻ Refresh' : '✨ Analisis'}
                        </button>
                      )}
                    </div>
                    {aiInsightsLoading && (
                      <div className="text-center text-h-muted text-sm py-8 animate-pulse">🧠 AI sedang menganalisis menu kamu...</div>
                    )}
                    {aiInsightsError && (
                      <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{aiInsightsError}</div>
                    )}
                    {aiInsights && (
                      <div className="bg-h-dark border border-h-border rounded-xl p-4 max-h-96 overflow-y-auto">
                        <pre className="text-xs sm:text-sm text-white/90 whitespace-pre-wrap font-sans leading-relaxed">{aiInsights}</pre>
                      </div>
                    )}
                    {!aiInsights && !aiInsightsLoading && !aiInsightsError && (
                      <div className="text-h-muted text-xs italic">Klik "Analisis" untuk dapat insight Menu Engineering BCG matrix dari data penjualan 30 hari terakhir.</div>
                    )}
                  </div>

                  {/* Rekap order table */}
                  <div className="bg-h-card border border-h-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-h-border flex items-center justify-between">
                      <h2 className="text-xs font-black text-h-muted uppercase tracking-widest">Rekap Order (30 Hari)</h2>
                      <span className="text-xs text-h-muted">{allOrders30.length} order</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px]">
                        <thead className="border-b border-h-border">
                          <tr>{['Waktu', 'Meja', 'Customer', 'Items', 'Total', 'Status', 'Bayar', 'Rating'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-h-muted uppercase tracking-wider">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-h-border">
                          {allOrders30.slice(0, 50).map(o => {
                            const total = o.items.reduce((s, i) => s + i.price * i.qty, 0)
                            const statusColors: Record<string, string> = {
                              new: 'text-white', preparing: 'text-yellow-400',
                              ready: 'text-green-400', done: 'text-h-muted', cancelled: 'text-red-400',
                            }
                            return (
                              <tr key={o.id} className="hover:bg-h-dark/40 transition-colors">
                                <td className="px-4 py-3 text-xs text-h-muted whitespace-nowrap">
                                  {fmtWITDateTime(o.created_at)}
                                </td>
                                <td className="px-4 py-3 text-xs text-white font-bold">{o.table_number}</td>
                                <td className="px-4 py-3 text-xs text-white">{o.customer_name || <span className="text-h-border">—</span>}</td>
                                <td className="px-4 py-3 text-xs text-h-muted max-w-[160px] truncate">
                                  {o.items.map(i => `${i.name} ×${i.qty}`).join(', ')}
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-white">{formatRp(total)}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-bold uppercase ${statusColors[o.status] || 'text-white'}`}>{o.status}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-h-muted">{o.payment_method || '—'}</td>
                                <td className="px-4 py-3 text-xs text-yellow-400">{o.rating ? '⭐'.repeat(o.rating) : <span className="text-h-border">—</span>}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {allOrders30.length > 50 && (
                      <div className="px-5 py-3 border-t border-h-border text-xs text-h-muted text-center">
                        Menampilkan 50 terbaru — Export CSV untuk data lengkap
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* ── TAB: Pantau Outlet — ringkasan semua outlet dari satu layar ── */}
        {tab === 'outlet' && (() => {
          const agg = summary?.aggregate
          const fmtDay = (d: string) => new Date(d + 'T06:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', timeZone: 'Asia/Jayapura' })
          const fmtMonth = (m: string) => new Date(m + '-02T06:00:00Z').toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' })
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-sans text-lg font-black text-white uppercase tracking-wider">Pantau Outlet</h1>
                  <p className="text-h-muted text-xs mt-0.5">
                    {summary ? `${agg?.outletCount} outlet · ${fmtDay(summary.today)} (jam 05:00–04:59 WIT)` : 'Ringkasan semua outlet dalam satu layar'}
                  </p>
                </div>
                <button onClick={loadSummary} disabled={summaryLoading}
                  className="text-xs text-h-muted hover:text-white border border-h-border hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors font-bold">
                  {summaryLoading ? '...' : '↻ Refresh'}
                </button>
              </div>

              {summaryError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">⚠️ {summaryError}</div>
              )}
              {summaryLoading && !summary && (
                <div className="text-center text-h-muted text-sm py-16 animate-pulse">Memuat data semua outlet...</div>
              )}

              {summary && (
                <>
                  {/* Hari ini — gabungan semua outlet */}
                  <div>
                    <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-3">Hari Ini (Semua Outlet)</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Omzet', value: formatRp(agg?.todayRevenue || 0) },
                        { label: 'Transaksi', value: String(agg?.todayOrders || 0) },
                        { label: 'Omzet 7 Hari', value: formatRp(agg?.weekRevenue || 0) },
                        { label: 'Transaksi 7 Hari', value: String(agg?.weekOrders || 0) },
                      ].map(c => (
                        <div key={c.label} className="bg-h-card border border-h-border rounded-2xl p-4">
                          <div className="text-[10px] text-h-muted uppercase tracking-wide font-semibold mb-1">{c.label}</div>
                          <div className="text-lg font-black text-white leading-tight">{c.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Laba-rugi bulan berjalan — gabungan */}
                  <div>
                    <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-1">Laba-Rugi Bulan Ini (Semua Outlet)</h2>
                    <p className="text-h-muted text-[10px] mb-3">{fmtMonth(summary.month)}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Omzet', value: formatRp(agg?.monthRevenue || 0), tone: 'white' },
                        { label: 'HPP Terjual', value: formatRp(agg?.cogs || 0), tone: 'muted' },
                        { label: 'Pengeluaran', value: formatRp(agg?.expTotal || 0), tone: 'muted' },
                        { label: 'Laba Bersih', value: formatRp(agg?.netProfit || 0), tone: (agg?.netProfit ?? 0) >= 0 ? 'green' : 'red' },
                      ].map(c => (
                        <div key={c.label} className={`border rounded-2xl p-4 ${c.tone === 'green' ? 'bg-green-500/10 border-green-500/30' : c.tone === 'red' ? 'bg-red-500/10 border-red-500/30' : 'bg-h-card border-h-border'}`}>
                          <div className="text-[10px] text-h-muted uppercase tracking-wide font-semibold mb-1">{c.label}</div>
                          <div className={`text-lg font-black leading-tight ${c.tone === 'green' ? 'text-green-400' : c.tone === 'red' ? 'text-red-400' : 'text-white'}`}>{c.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rincian per outlet */}
                  <div>
                    <h2 className="text-xs font-black text-h-muted uppercase tracking-widest mb-3">Per Outlet</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {summary.outlets.map(o => o.ok ? (
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
                          {/* Sparkline 7 hari */}
                          <div className="flex items-end gap-1 h-12">
                            {(() => {
                              const max = Math.max(...o.daily.map(d => d.revenue), 1)
                              return o.daily.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                  <div className="w-full flex items-end" style={{ height: '40px' }}>
                                    <div className="w-full rounded-t transition-all"
                                      style={{ height: `${Math.max(3, Math.round((d.revenue / max) * 40))}px`, background: i === o.daily.length - 1 ? 'var(--brand-primary-hex)' : '#3a2a28' }}
                                      title={`${fmtDay(d.date)}: ${formatRp(d.revenue)}`} />
                                  </div>
                                  <div className="text-[7px] text-h-muted">{fmtDay(d.date).split(' ')[1]}</div>
                                </div>
                              ))
                            })()}
                          </div>
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
                              {o.topItems.map(t => `${t.name} (${t.qty}×)`).join(', ')}
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
                </>
              )}
            </div>
          )
        })()}

        {/* ── TAB: Pengaturan ── */}
        {tab === 'pengaturan' && (() => {
          const open = isStoreOpen(settings)
          return (
            <div className="space-y-5 max-w-lg">
              <h1 className="font-sans text-lg font-black text-white uppercase tracking-wider">Pengaturan Toko</h1>

              {/* Status preview */}
              <div className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${open ? 'bg-green-500/10 border-green-500/30' : 'bg-h-red/10 border-h-red/30'}`}>
                <div>
                  <div className="text-xs text-h-muted uppercase tracking-widest font-bold mb-1">Status Sekarang</div>
                  <div className={`text-xl font-black ${open ? 'text-green-400' : 'text-h-cream'}`}>
                    {open ? '🟢 Buka' : '🔴 Tutup'}
                  </div>
                  {!settings.is_manually_closed && (
                    <div className="text-xs text-h-muted mt-1">{settings.open_time} – {settings.close_time} · {settings.open_days}</div>
                  )}
                  {settings.is_manually_closed && (
                    <div className="text-xs text-h-cream mt-1">Ditutup manual oleh admin</div>
                  )}
                </div>
                <div className={`text-5xl ${open ? 'animate-bounce' : ''}`} style={{ animationDuration: '2s' }}>
                  {open ? '☕' : '🚫'}
                </div>
              </div>

              {/* Form settings */}
              <div className="bg-h-card border border-h-border rounded-2xl p-5 space-y-5">
                {/* Tutup sementara toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">Tutup Sementara</div>
                    <div className="text-xs text-h-muted mt-0.5">Paksa status jadi Tutup tanpa peduli jam</div>
                  </div>
                  <Toggle value={settings.is_manually_closed} onChange={v => setSettings(s => ({ ...s, is_manually_closed: v }))} />
                </div>

                <div className="h-px bg-h-border" />

                {/* Hari operasional */}
                <div>
                  <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Hari Operasional</label>
                  <input
                    value={settings.open_days}
                    onChange={e => setSettings(s => ({ ...s, open_days: e.target.value }))}
                    placeholder="Senin – Minggu"
                    className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors"
                  />
                </div>

                {/* Jam buka & tutup */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Jam Buka</label>
                    <input
                      type="time"
                      value={settings.open_time}
                      onChange={e => setSettings(s => ({ ...s, open_time: e.target.value }))}
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Jam Tutup</label>
                    <input
                      type="time"
                      value={settings.close_time}
                      onChange={e => setSettings(s => ({ ...s, close_time: e.target.value }))}
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white transition-colors"
                    />
                  </div>
                </div>

                {/* Karyawan / kasir — nama yang muncul di pilihan shift "Siapa yang Datang?" */}
                <div>
                  <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Karyawan Kasir (Shift)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {settings.employees.map(name => (
                      <span key={name} className="inline-flex items-center gap-1.5 bg-h-dark border border-h-border rounded-full pl-3 pr-1.5 py-1 text-xs text-white">
                        {name}
                        <button type="button" title={`Hapus ${name}`}
                          onClick={() => setSettings(s => ({ ...s, employees: s.employees.filter(e => e !== name) }))}
                          className="w-4.5 h-4.5 rounded-full text-h-muted hover:text-red-400 text-sm leading-none px-1 transition-colors">×</button>
                      </span>
                    ))}
                    {settings.employees.length === 0 && <span className="text-xs text-h-border">Belum ada — tambah minimal 1 nama</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newEmployee}
                      onChange={e => setNewEmployee(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const n = newEmployee.trim(); if (n && !settings.employees.includes(n)) { setSettings(s => ({ ...s, employees: [...s.employees, n] })); setNewEmployee('') } } }}
                      placeholder="Nama karyawan baru"
                      className="flex-1 bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors"
                    />
                    <button type="button"
                      onClick={() => { const n = newEmployee.trim(); if (n && !settings.employees.includes(n)) { setSettings(s => ({ ...s, employees: [...s.employees, n] })); setNewEmployee('') } }}
                      disabled={!newEmployee.trim()}
                      className="bg-h-dark border border-h-red/40 hover:border-h-red disabled:opacity-40 text-h-cream px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap">
                      + Tambah
                    </button>
                  </div>
                  <p className="text-[10px] text-h-muted mt-1.5">Nama-nama ini muncul di kasir saat mulai jaga / ganti shift. Jangan lupa klik Simpan.</p>
                </div>

                {/* ── Identitas outlet — diatur DI SINI, tidak perlu buka Vercel ── */}
                <div className="border-t border-h-border pt-5">
                  <div className="text-xs text-h-muted font-bold uppercase tracking-wide mb-1.5">
                    Identitas {isSelf ? 'Outlet Ini' : activeOutlet?.name}
                  </div>
                  <p className="text-[10px] text-h-muted mb-3">
                    Tampil ke pelanggan di beranda, menu, dan struk. Yang dikosongkan
                    otomatis <strong className="text-white">disembunyikan</strong> —
                    tidak akan menampilkan data outlet lain.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {([
                      ['brand_name', 'Nama Kafe', 'Contoh: BASECAMP'],
                      ['brand_tagline', 'Tagline', 'Contoh: Coffee & Roastery'],
                      ['brand_wa', 'No. WhatsApp', '62812xxxxxxx'],
                      ['brand_ig', 'Instagram (tanpa @)', 'basecamp.kopi'],
                      ['brand_city', 'Kota', 'Ternate'],
                      ['brand_logo', 'URL Logo (opsional)', 'https://...'],
                    ] as const).map(([key, label, ph]) => (
                      <div key={key}>
                        <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1">{label}</label>
                        <input type="text" value={(settings[key] as string) || ''}
                          onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                          placeholder={ph}
                          className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1">Alamat</label>
                    <input type="text" value={settings.brand_address || ''}
                      onChange={e => setSettings(s => ({ ...s, brand_address: e.target.value }))}
                      placeholder="Alamat lengkap outlet ini"
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {([['brand_lat', 'Latitude', '0.7935511'], ['brand_lng', 'Longitude', '127.3855782']] as const).map(([key, label, ph]) => (
                      <div key={key}>
                        <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1">{label}</label>
                        <input type="text" inputMode="decimal" value={settings[key] ?? ''}
                          onChange={e => setSettings(s => ({ ...s, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                          placeholder={ph}
                          className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-h-muted mt-1.5">
                    Koordinat buat peta & petunjuk arah — ambil dari Google Maps (klik kanan lokasi → angka pertama = latitude).
                    Kosongkan kalau belum ada, petanya otomatis disembunyikan.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {([['brand_color', 'Warna Utama', '#7C1515'], ['brand_accent', 'Warna Aksen', '#D4B896']] as const).map(([key, label, ph]) => (
                      <div key={key}>
                        <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1">{label}</label>
                        <div className="flex gap-2">
                          <input type="color" value={(settings[key] as string) || ph}
                            onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                            className="w-11 h-[42px] bg-h-dark border border-h-border rounded-xl cursor-pointer p-1" />
                          <input type="text" value={(settings[key] as string) || ''}
                            onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                            placeholder={ph}
                            className="flex-1 bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-h-muted mt-1.5">
                    Warna berlaku ke seluruh tampilan outlet ini. Perubahan tampil dalam ±30 detik setelah Simpan (tanpa deploy ulang).
                  </p>

                  {/* Tema tampilan halaman menu */}
                  <div className="mt-4">
                    <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1.5">Tema Halaman Menu</label>
                    <div className="grid grid-cols-2 gap-2">
                      {THEMES.map(t => {
                        const aktif = (settings.brand_theme || THEME_DEFAULT) === t.key
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setSettings(s => ({ ...s, brand_theme: t.key }))}
                            className={`text-left rounded-xl border p-3 transition-colors ${aktif ? 'border-h-red bg-h-red/10' : 'border-h-border hover:border-h-red/40'}`}>
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="w-5 h-5 rounded-md border border-white/15 flex-shrink-0"
                                style={{ background: `rgb(${t.vars['--surface-bg']})` }} />
                              <span className="text-xs font-bold text-white">{t.nama}</span>
                              {aktif && <span className="text-[9px] text-h-red font-black ml-auto">DIPAKAI</span>}
                            </div>
                            <p className="text-[10px] text-h-muted mt-1.5 leading-relaxed">{t.untuk}</p>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-h-muted mt-1.5">
                      Tema mengubah warna latar dan bentuk sudut di halaman menu pelanggan. Warna brand di atas tetap dipakai untuk tombol dan aksen.
                    </p>
                  </div>

                  {/* Kunci AI — opsional, mengaktifkan chatbot barista & laporan AI */}
                  <div className="mt-4">
                    <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1">Kunci AI (opsional)</label>
                    <input type="text" value={settings.ai_api_key || ''}
                      onChange={e => setSettings(s => ({ ...s, ai_api_key: e.target.value }))}
                      placeholder="gsk_... (Groq) atau AIza... (Gemini)"
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                    <p className="text-[10px] text-h-muted mt-1.5">
                      Mengaktifkan chatbot barista & laporan AI. Kunci gratis bisa diambil di
                      console.groq.com atau aistudio.google.com. Kosongkan = fitur AI mati.
                    </p>
                  </div>
                </div>

                {/* Password outlet — hanya saat kelola outlet LAIN dari Admin Pusat.
                    Password outlet sendiri tetap di env (bootstrap, biar tidak
                    bisa mengunci diri sendiri). */}
                {!isSelf && !outletSupportsPassword && (
                  <div className="border-t border-h-border pt-5">
                    <div className="text-xs text-h-muted font-bold uppercase tracking-wide mb-1.5">
                      Password {activeOutlet?.name}
                    </div>
                    <div className="bg-h-dark border border-h-border rounded-xl p-3.5 text-[11px] text-h-muted leading-relaxed">
                      Outlet ini belum disiapkan untuk atur password dari sini.
                      Jalankan sekali file <code className="text-h-cream">supabase-outlet-password.sql</code> di
                      SQL Editor database outlet ini, lalu buka ulang halaman.
                      <br />Sementara itu, password outlet ini masih yang diset di Vercel.
                    </div>
                  </div>
                )}
                {!isSelf && outletSupportsPassword && (
                  <div className="border-t border-h-border pt-5">
                    <div className="text-xs text-h-muted font-bold uppercase tracking-wide mb-1.5">
                      Password {activeOutlet?.name}
                    </div>
                    <p className="text-[10px] text-h-muted mb-3">
                      Diisi/diganti dari sini — tidak perlu buka Vercel. Kosongkan kalau tidak mau diubah.
                      Password lama di Vercel tetap berlaku sebagai cadangan.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1">Admin</label>
                        <input type="text" value={settings.admin_password || ''}
                          onChange={e => setSettings(s => ({ ...s, admin_password: e.target.value }))}
                          placeholder="(belum diatur)"
                          className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                      </div>
                      <div>
                        <label className="text-[10px] text-h-muted uppercase tracking-wide block mb-1">Kasir</label>
                        <input type="text" value={settings.kasir_password || ''}
                          onChange={e => setSettings(s => ({ ...s, kasir_password: e.target.value }))}
                          placeholder="(belum diatur)"
                          className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                      </div>
                    </div>
                    <p className="text-[10px] text-yellow-500/80 mt-2">
                      ⚠️ Sengaja ditampilkan terang supaya bisa kamu catat. Halaman ini cuma
                      terbuka dengan password Admin Pusat.
                    </p>
                  </div>
                )}

                <button
                  onClick={saveSettings}
                  disabled={settingsSaving || settings.employees.length === 0}
                  className="w-full bg-h-red hover:bg-h-red-d disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-colors">
                  {settingsSaved ? '✓ Tersimpan!' : settingsSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </div>

              <p className="text-xs text-h-muted">* Status buka/tutup tampil otomatis di halaman menu dan landing page.</p>

              {/* Manajemen data — backup dulu baru boleh hapus. Khusus outlet sendiri
                  (belum diperluas lintas outlet — order lama tiap outlet dikelola dari outletnya sendiri) */}
              {!isSelf && (
                <div className="bg-h-card border border-h-border rounded-2xl p-5 text-center">
                  <div className="text-sm font-bold text-white mb-1">Bersihkan Data Lama</div>
                  <div className="text-xs text-h-muted">Fitur ini masih khusus outlet <strong className="text-white">{outlets.find(o => outletKey(o) === SELF_KEY)?.name}</strong> (yang lagi login). Untuk bersihkan data lama <strong className="text-h-cream">{activeOutlet?.name}</strong>, buka Admin outlet itu langsung.</div>
                </div>
              )}
              {isSelf && (
              <div className="bg-h-card border border-h-border rounded-2xl p-5 space-y-4">
                <div>
                  <div className="text-sm font-black text-white mb-0.5">Bersihkan Data Lama</div>
                  <div className="text-xs text-h-muted">Order lama <strong className="text-white">wajib di-backup ke WA owner dulu</strong> sebelum bisa dihapus. Tombol Hapus terkunci sampai backup selesai.</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-h-muted">Arsip & hapus order lebih dari</span>
                  <input
                    type="number" min={30} max={730} value={cleanupDays}
                    onChange={e => { setCleanupDays(parseInt(e.target.value) || 60); setBackupReady(false) }}
                    className="w-20 bg-h-dark border border-h-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-h-red transition-colors text-center"
                  />
                  <span className="text-xs text-h-muted">hari</span>
                </div>

                {/* Step 1 */}
                <button onClick={prepareBackup} disabled={preparingBackup}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors">
                  {preparingBackup ? 'Menyiapkan backup...' : '1 · Backup ke WA Owner (CSV + ringkasan)'}
                </button>

                {/* Step 2 */}
                <button onClick={handleCleanup} disabled={cleaning || !backupReady}
                  className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${backupReady ? 'bg-h-red hover:bg-h-red-d text-white' : 'bg-h-border text-h-muted cursor-not-allowed'}`}>
                  {cleaning ? 'Menghapus...' : backupReady ? `2 · Hapus Sekarang (${'>'}${cleanupDays} hari)` : '2 · Hapus (backup dulu 🔒)'}
                </button>

                {cleanupResult && (
                  <div className={`text-xs font-bold px-3 py-2 rounded-lg ${cleanupResult.startsWith('✅') ? 'bg-green-500/10 text-green-400' : cleanupResult.startsWith('⚠️') || cleanupResult.startsWith('❌') ? 'bg-red-500/10 text-red-400' : 'bg-h-dark text-h-muted'}`}>
                    {cleanupResult}
                  </div>
                )}
                <div className="text-xs text-h-muted border-t border-h-border pt-3 leading-relaxed">
                  💡 Sebenarnya DB masih sangat lega (muat 3-5 tahun) — hapus data <strong className="text-white">tidak wajib</strong>. Kalau tetap mau bersih-bersih, backup ke WA owner memastikan rekap historis aman. CSV yang terdownload = arsip lengkap, forward file-nya ke owner via WA.
                </div>
              </div>
              )}
            </div>
          )
        })()}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowForm(false)} />
          <div className="relative bg-h-card border border-h-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0 border-b border-h-border">
              <h2 className="font-sans text-base font-black text-white uppercase tracking-wider">{editing ? 'Edit Item' : 'Tambah Item'}</h2>
              <button onClick={() => setShowForm(false)} className="text-h-muted hover:text-white text-2xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1 min-h-0">
              <div>
                <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Nama *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors"
                  placeholder="Nama menu" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-h-muted font-bold uppercase tracking-wide">Deskripsi</label>
                  <button type="button" onClick={generateAiDescription}
                    disabled={!form.name.trim() || aiDescLoading}
                    className="text-[10px] font-bold uppercase tracking-wider text-h-cream hover:text-white disabled:opacity-40 disabled:cursor-not-allowed border border-h-red/40 hover:border-h-red px-2 py-0.5 rounded-md transition-colors">
                    {aiDescLoading ? 'AI nulis...' : '✨ Auto-Generate'}
                  </button>
                </div>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors"
                  rows={2} placeholder="Deskripsi singkat (opsional) — atau klik ✨ untuk generate" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Harga Jual (Rp) *</label>
                  <input required type="number" min={0} step={500} value={form.price || ''}
                    onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white transition-colors"
                    placeholder="25000" />
                </div>
                <div>
                  <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">HPP (Rp)</label>
                  <input type="number" min={0} step={500} value={form.hpp || ''}
                    onChange={e => setForm(f => ({ ...f, hpp: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white transition-colors"
                    placeholder="otomatis dari kalkulator" />
                  {form.hpp > 0 && form.price > 0 && (
                    <div className={`text-xs mt-1 font-bold ${marginColor(margin(form.price, form.hpp)!)}`}>
                      Margin: {margin(form.price, form.hpp)}% · Profit {formatRp(form.price - form.hpp)}/unit
                    </div>
                  )}
                </div>
              </div>
              {/* ── Kalkulator HPP (berbasis bahan) ── */}
              <HppCalculator
                bahanList={isSelf ? bahanList : []}
                onSimpanBahan={isSelf ? simpanBahan : undefined}
                value={form.hpp_components || []}
                onChange={(comps, total) => setForm(f => ({ ...f, hpp_components: comps, hpp: total }))}
              />
              {form.hpp > 0 && form.price > 0 && (
                <p className="text-[11px] text-h-muted -mt-1">
                  Total HPP {formatRp(form.hpp)} → margin{' '}
                  <span className={`font-bold ${marginColor(margin(form.price, form.hpp) ?? 0)}`}>{margin(form.price, form.hpp)}%</span>
                  {' '}· profit {formatRp(form.price - form.hpp)}/porsi
                </p>
              )}

              {/* 3D Model (manual paste GLB URL) */}
              {editing && (
                <div className="bg-h-dark border border-h-border rounded-xl p-4 space-y-2">
                  <label className="text-xs text-h-muted font-bold uppercase tracking-wide block">🪄 3D Model (GLB URL)</label>
                  {editing.model_3d_url ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-400 font-bold flex-1 truncate">✓ {editing.model_3d_url}</span>
                      <button type="button" onClick={() => remove3DModel(editing)}
                        className="text-xs text-h-cream hover:underline">Hapus</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input value={manualGlbUrl} onChange={e => setManualGlbUrl(e.target.value)}
                          placeholder="https://...meshy.ai/.../model.glb"
                          className="flex-1 bg-h-card border border-h-border rounded-lg px-3 py-2 text-xs text-white placeholder-h-muted focus:outline-none focus:border-h-red" />
                        <button type="button" onClick={() => saveManualGlb(editing)}
                          disabled={!manualGlbUrl.trim()}
                          className="text-xs text-h-cream border border-h-red/40 hover:bg-h-red/10 disabled:opacity-40 px-3 py-2 rounded-lg font-bold uppercase tracking-wide">
                          Simpan
                        </button>
                      </div>
                      <p className="text-[10px] text-h-muted">Paste link GLB hasil generate manual di Meshy (klik Export → Download GLB → atau pakai shared URL).</p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Kategori *</label>
                <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white transition-colors">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <Toggle value={form.available} onChange={v => setForm(f => ({ ...f, available: v }))} />
                <span className="text-sm text-h-muted">{form.available ? 'Tersedia' : 'Tidak tersedia / Habis'}</span>
              </div>
              </div>{/* ── akhir area scroll ── */}
              <div className="flex gap-3 px-6 py-4 border-t border-h-border flex-shrink-0 bg-h-card">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-h-border text-h-muted py-3 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-h-red hover:bg-h-red-d disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-colors">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Tambah Outlet ── */}
      {showAddOutlet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowAddOutlet(false)} />
          <div className="relative bg-h-card border border-h-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0 border-b border-h-border">
              <h2 className="font-sans text-base font-black text-white uppercase tracking-wider">Tambah Outlet</h2>
              <button onClick={() => setShowAddOutlet(false)} className="text-h-muted hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1 min-h-0">
              <div>
                <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Nama Outlet *</label>
                <input value={newOutlet.name} onChange={e => setNewOutlet(o => ({ ...o, name: e.target.value }))}
                  placeholder="Contoh: Hallu Corner"
                  className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
              </div>

              <div>
                <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Model Database</label>
                <div className="grid grid-cols-1 gap-2">
                  <button type="button" onClick={() => setNewOutletModel('schema')}
                    className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${newOutletModel === 'schema' ? 'bg-h-red/10 border-h-red text-white' : 'bg-h-dark border-h-border text-h-muted hover:text-white'}`}>
                    <div className="font-bold">Numpang DB Pusat (schema)</div>
                    <div className="text-[10px] mt-0.5 opacity-80">Hemat, tanpa project Supabase baru. Untuk outlet milik sendiri.</div>
                  </button>
                  <button type="button" onClick={() => setNewOutletModel('separate')}
                    className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${newOutletModel === 'separate' ? 'bg-h-red/10 border-h-red text-white' : 'bg-h-dark border-h-border text-h-muted hover:text-white'}`}>
                    <div className="font-bold">Database Terpisah (project sendiri)</div>
                    <div className="text-[10px] mt-0.5 opacity-80">Isolasi penuh. Untuk outlet mitra/franchise.</div>
                  </button>
                </div>
              </div>

              {newOutletModel === 'schema' ? (
                <>
                  <div className="bg-h-dark border border-h-border rounded-xl p-3 text-[10px] text-h-muted leading-relaxed">
                    💡 Sebelum ini: buat schema Postgres baru + role <code className="text-h-cream">&lt;schema&gt;_anon</code> +
                    generate anon key khusus schema itu di SQL Editor pusat (pola sama seperti Hallu Brew).
                    Langkah itu masih manual — minta bantuan kalau perlu.
                  </div>
                  <div>
                    <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Nama Schema *</label>
                    <input value={newOutlet.schema} onChange={e => setNewOutlet(o => ({ ...o, schema: e.target.value.trim() }))}
                      placeholder="Contoh: corner"
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Anon Key (khusus schema ini) *</label>
                    <textarea value={newOutlet.anon} onChange={e => setNewOutlet(o => ({ ...o, anon: e.target.value.trim() }))}
                      placeholder="eyJ..." rows={3}
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-xs font-mono resize-none focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                    <p className="text-[10px] text-yellow-500/80 mt-1.5">
                      ⚠️ Harus kunci <strong>khusus schema ini</strong> (role <code>{newOutlet.schema.trim() || '<schema>'}_anon</code>) — yaitu isi
                      <code> NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di Vercel project outlet itu.
                      Kalau pakai anon key Pusat, hasilnya <em>&quot;permission denied for schema&quot;</em>.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Supabase Project URL *</label>
                    <input value={newOutlet.url} onChange={e => setNewOutlet(o => ({ ...o, url: e.target.value.trim() }))}
                      placeholder="https://xxxxx.supabase.co"
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Anon Key *</label>
                    <textarea value={newOutlet.anon} onChange={e => setNewOutlet(o => ({ ...o, anon: e.target.value.trim() }))}
                      placeholder="eyJ..." rows={3}
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-xs font-mono resize-none focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-h-muted font-bold uppercase tracking-wide block mb-1.5">Service Role Key <span className="text-h-border">(opsional — tanpa ini cuma bisa dipantau di /owner, belum bisa dikelola dari sini)</span></label>
                    <textarea value={newOutlet.serviceRole} onChange={e => setNewOutlet(o => ({ ...o, serviceRole: e.target.value.trim() }))}
                      placeholder="eyJ..." rows={3}
                      className="w-full bg-h-dark border border-h-border rounded-xl px-3.5 py-2.5 text-xs font-mono resize-none focus:outline-none focus:border-h-red text-white placeholder-h-muted transition-colors" />
                  </div>
                </>
              )}

              {addOutletError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">⚠️ {addOutletError}</div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-h-border flex-shrink-0 bg-h-card">
              <button type="button" onClick={() => setShowAddOutlet(false)}
                className="flex-1 border border-h-border text-h-muted py-3 rounded-xl text-sm font-medium hover:border-white/20 hover:text-white transition-colors">
                Batal
              </button>
              <button type="button" onClick={addOutlet} disabled={addOutletSaving}
                className="flex-1 bg-h-red hover:bg-h-red-d disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-colors">
                {addOutletSaving ? 'Menyimpan...' : 'Simpan Outlet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
