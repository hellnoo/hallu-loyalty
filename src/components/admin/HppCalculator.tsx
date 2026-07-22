'use client'
import { formatRp } from '@/lib/format'
import { type HppComponent, hppCompBiaya, hppTotal, HPP_UNITS } from '@/types'

// Kalkulator HPP berbasis bahan: owner isi "beli sekemasan berapa, kepakai berapa
// per porsi" → biaya per porsi dihitung otomatis. Tetap dukung mode manual (isi Rp
// langsung) untuk data lama / komponen tetap (cup, packaging, gas).

const isBahanMode = (c: HppComponent) =>
  c.hargaBeli !== undefined || c.isi !== undefined || c.pakai !== undefined || c.satuan !== undefined

// preset kemasan umum → set isi (dalam satuan pakai)
const PACK_PRESETS: { label: string; isi: number; satuan: string }[] = [
  { label: '1 kg', isi: 1000, satuan: 'g' },
  { label: '500 g', isi: 500, satuan: 'g' },
  { label: '1 L', isi: 1000, satuan: 'ml' },
  { label: '250 ml', isi: 250, satuan: 'ml' },
]

export function HppCalculator({
  value,
  onChange,
}: {
  value: HppComponent[]
  onChange: (comps: HppComponent[], total: number) => void
}) {
  const comps = value || []

  const push = (next: HppComponent[]) => {
    // sinkronkan biaya tiap komponen = hasil hitung, lalu total
    const synced = next.map((c) => ({ ...c, biaya: hppCompBiaya(c) }))
    onChange(synced, hppTotal(synced))
  }
  const update = (i: number, patch: Partial<HppComponent>) => {
    const next = comps.map((c, j) => (j === i ? { ...c, ...patch } : c))
    push(next)
  }
  const addBahan = () => push([...comps, { nama: '', biaya: 0, satuan: 'g' }])
  const addManual = () => push([...comps, { nama: '', biaya: 0 }])
  const remove = (i: number) => push(comps.filter((_, j) => j !== i))
  const toBahan = (i: number) => update(i, { satuan: comps[i].satuan || 'g' })
  const toManual = (i: number) =>
    update(i, { hargaBeli: undefined, isi: undefined, pakai: undefined, satuan: undefined, waste: undefined })

  const numOr = (v: string): number | undefined => {
    const n = parseFloat(v.replace(',', '.'))
    return isNaN(n) ? undefined : n
  }

  const total = hppTotal(comps)

  return (
    <div className="bg-h-dark border border-h-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-h-muted font-bold uppercase tracking-wide">Kalkulator HPP</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={addBahan}
            className="text-xs text-h-cream hover:text-white font-bold border border-h-red/40 hover:border-h-red px-2.5 py-1 rounded-lg transition-colors">
            + Bahan
          </button>
          <button type="button" onClick={addManual}
            className="text-xs text-h-muted hover:text-white font-bold border border-h-border hover:border-white/30 px-2.5 py-1 rounded-lg transition-colors">
            + Manual
          </button>
        </div>
      </div>

      {comps.length === 0 && (
        <p className="text-xs text-h-border text-center py-2">
          Klik <span className="text-h-cream">+ Bahan</span> — isi harga beli & takaran, biaya per porsi dihitung otomatis.
        </p>
      )}

      <div className="space-y-2.5">
        {comps.map((c, i) => {
          const bahan = isBahanMode(c)
          const biaya = hppCompBiaya(c)
          return (
            <div key={i} className="bg-h-card border border-h-border rounded-lg p-3 space-y-2">
              {/* Nama + hapus */}
              <div className="flex items-center gap-2">
                <input value={c.nama} placeholder={bahan ? 'Nama bahan (mis. Kopi)' : 'Nama (mis. Cup + tutup)'}
                  onChange={(e) => update(i, { nama: e.target.value })}
                  className="flex-1 bg-h-dark border border-h-border rounded-lg px-3 py-2 text-xs text-white placeholder-h-muted focus:outline-none focus:border-h-red transition-colors" />
                <button type="button" onClick={() => remove(i)}
                  className="text-h-muted hover:text-red-400 text-lg leading-none flex-shrink-0 transition-colors" title="Hapus">×</button>
              </div>

              {bahan ? (
                <>
                  {/* Baris beli */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-h-muted">
                    <span>Beli</span>
                    <span className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-h-muted">Rp</span>
                      <input inputMode="numeric" value={c.hargaBeli ?? ''} placeholder="150000"
                        onChange={(e) => update(i, { hargaBeli: numOr(e.target.value) })}
                        className="w-24 bg-h-dark border border-h-border rounded-lg pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-h-red" />
                    </span>
                    <span>untuk</span>
                    <input inputMode="numeric" value={c.isi ?? ''} placeholder="1000"
                      onChange={(e) => update(i, { isi: numOr(e.target.value) })}
                      className="w-16 bg-h-dark border border-h-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-h-red" />
                    <select value={c.satuan || 'g'} onChange={(e) => update(i, { satuan: e.target.value })}
                      className="bg-h-dark border border-h-border rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none focus:border-h-red">
                      {HPP_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {/* Preset kemasan */}
                  <div className="flex flex-wrap gap-1">
                    {PACK_PRESETS.map((p) => (
                      <button type="button" key={p.label} onClick={() => update(i, { isi: p.isi, satuan: p.satuan })}
                        className="text-[10px] text-h-muted hover:text-h-cream border border-h-border hover:border-h-red/40 rounded px-1.5 py-0.5 transition-colors">
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {/* Baris pakai + susut */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-h-muted">
                    <span>Pakai</span>
                    <input inputMode="numeric" value={c.pakai ?? ''} placeholder="18"
                      onChange={(e) => update(i, { pakai: numOr(e.target.value) })}
                      className="w-16 bg-h-dark border border-h-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-h-red" />
                    <span>{c.satuan || 'g'} / porsi</span>
                    <span className="mx-1 text-h-border">·</span>
                    <span>susut</span>
                    <input inputMode="numeric" value={c.waste ?? ''} placeholder="0"
                      onChange={(e) => update(i, { waste: numOr(e.target.value) })}
                      className="w-12 bg-h-dark border border-h-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-h-red" />
                    <span>%</span>
                  </div>
                  {/* Hasil */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-h-border">
                    <button type="button" onClick={() => toManual(i)}
                      className="text-[10px] text-h-muted hover:text-h-cream underline transition-colors">isi Rp manual</button>
                    <div className="text-xs">
                      {c.hargaBeli && c.isi && c.pakai ? (
                        <span className="text-h-cream font-bold">= {formatRp(biaya)} <span className="text-h-muted font-normal">/ porsi</span></span>
                      ) : (
                        <span className="text-h-border">isi harga & takaran…</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => toBahan(i)}
                    className="text-[10px] text-h-muted hover:text-h-cream underline transition-colors whitespace-nowrap">hitung dari bahan</button>
                  <div className="relative flex-shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-h-muted">Rp</span>
                    <input inputMode="numeric" value={c.biaya || ''} placeholder="0"
                      onChange={(e) => update(i, { biaya: numOr(e.target.value) || 0 })}
                      className="w-28 bg-h-dark border border-h-border rounded-lg pl-7 pr-2 py-2 text-xs text-white focus:outline-none focus:border-h-red" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {comps.length > 0 && (
        <div className="flex justify-between items-center pt-2 border-t border-h-border">
          <span className="text-xs text-h-muted font-bold uppercase tracking-wide">Total HPP / porsi</span>
          <span className="text-base font-black text-white">{formatRp(total)}</span>
        </div>
      )}
    </div>
  )
}
