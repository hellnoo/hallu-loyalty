'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Order, MenuItem, Shift } from '@/types'
import { DEFAULT_EMPLOYEES } from '@/types'
import { formatRp } from '@/lib/format'
import type { PayMethod } from './helpers'
import { PAY_OPTS, formatTime, orderTotal, waLink, msgSiap, msgStruk, formatDuration,
  queuePendingOrder, cacheMenu, loadCachedMenu } from './helpers'

export function OrderCard({ order, onDone, onCancel, onReady, onPreparing }: { order: Order; onDone?: (method: PayMethod) => void; onCancel?: () => void; onReady?: () => void; onPreparing?: () => void }) {
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

export function ManualOrderForm({ onSubmitted, isOnline }: { onSubmitted: () => void; isOnline: boolean }) {
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

export function StartShiftModal({ onStart, loading, employees }: {
  onStart: (employee: string, notes?: string) => Promise<void>
  loading: boolean
  employees?: string[]
}) {
  const [selected, setSelected] = useState<string>('')
  const [notes, setNotes] = useState('')
  const staff = employees && employees.length ? employees : DEFAULT_EMPLOYEES

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85">
      <div className="bg-h-card border border-h-border rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-h-border text-center">
          <div className="text-3xl mb-1">👋</div>
          <div className="font-sans font-black text-white uppercase tracking-wider text-sm">Siapa yang Datang?</div>
          <div className="text-xs text-h-muted mt-1.5">Tap nama kamu untuk mulai jaga</div>
        </div>
        <div className="p-5 space-y-4">
          <div className={`grid gap-2 ${staff.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {staff.map(name => (
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

export function HandoverModal({ activeShift, onClose, onHandover, onEndOnly, loading, employees }: {
  activeShift: Shift
  onClose: () => void
  onHandover: (toEmployee: string, notes?: string) => Promise<void>
  onEndOnly: (notes?: string) => Promise<void>
  loading: boolean
  employees?: string[]
}) {
  const [mode, setMode] = useState<'handover' | 'endOnly'>('handover')
  const [nextEmployee, setNextEmployee] = useState<string>('')
  const [notes, setNotes] = useState('')
  const staff = employees && employees.length ? employees : DEFAULT_EMPLOYEES
  const options = staff.filter(e => e !== activeShift.employee_name)

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
