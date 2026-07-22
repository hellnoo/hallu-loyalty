// ── Business Day Logic (WIT / UTC+9, Ternate) ──────────────
// Kedai di Ternate = WIT. Semua perhitungan waktu dihitung EKSPLISIT di WIT,
// tidak ikut zona waktu HP/server (Vercel jalan UTC). Jadi hasilnya sama walau
// kasir pakai HP yang ke-set WIB, atau owner buka dari Jakarta.
export const DAY_CUTOFF_HOUR = 5
export const WIT_TZ = 'Asia/Jayapura'      // = WIT (UTC+9)
const WIT_OFFSET_MS = 9 * 60 * 60 * 1000

// Wall-clock WIT "sekarang", disajikan sebagai field UTC (device-independent)
function witNow(): Date {
  return new Date(Date.now() + WIT_OFFSET_MS)
}

// YYYY-MM-DD dari sebuah instant, dibaca di zona WIT
export function toWITDateString(d: Date): string {
  const w = new Date(d.getTime() + WIT_OFFSET_MS)
  const y = w.getUTCFullYear()
  const m = String(w.getUTCMonth() + 1).padStart(2, '0')
  const day = String(w.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// Alias lama (dulu pakai zona lokal) — sekarang selalu WIT
export const toLocalDateString = toWITDateString

// Tanggal business day "sekarang" (WIT) — jam <5 pagi WIT = masih hitung kemarin
export function getCurrentBusinessDay(): string {
  const w = witNow()
  const base = w.getUTCHours() < DAY_CUTOFF_HOUR ? new Date(w.getTime() - 86400000) : w
  const y = base.getUTCFullYear()
  const m = String(base.getUTCMonth() + 1).padStart(2, '0')
  const day = String(base.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Geser sebuah tanggal (YYYY-MM-DD) sekian hari — murni string, bebas zona waktu
export function shiftDay(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + delta * 86400000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// Bounds business day (sebagai instant UTC yang benar untuk query created_at):
// "2 Juni" = 2 Juni 05:00 WIT sampai 3 Juni 04:59:59.999 WIT
export function getBusinessDayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number)
  // 05:00 WIT = instant UTC (05:00 dikurangi offset 9 jam)
  const start = new Date(Date.UTC(y, m - 1, d, DAY_CUTOFF_HOUR, 0, 0, 0) - WIT_OFFSET_MS)
  const end = new Date(start.getTime() + 86400000 - 1)
  return { start, end }
}

// Awal bulan (YYYY-MM) jam 05:00 WIT sebagai instant UTC
export function monthStartWIT(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1, DAY_CUTOFF_HOUR, 0, 0, 0) - WIT_OFFSET_MS)
}

// Jam (0-23) sebuah instant, dibaca di WIT — untuk histogram "jam ramai"
export function witHour(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d
  return new Date(date.getTime() + WIT_OFFSET_MS).getUTCHours()
}

// ── Formatter tampilan (selalu WIT) ────────────────────────
export const fmtWITTime = (s: string | Date) =>
  new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: WIT_TZ })
export const fmtWITDateTime = (s: string | Date) =>
  new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: WIT_TZ })
export const fmtWITDateLong = (s: string | Date) =>
  new Date(s).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: WIT_TZ })
export const fmtWITDateShort = (s: string | Date) =>
  new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: WIT_TZ })
// Label "Sen 22" dari string tanggal YYYY-MM-DD (dibaca aman di WIT)
export const fmtWITWeekdayDay = (dateStr: string) =>
  new Date(dateStr + 'T06:00:00Z').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', timeZone: WIT_TZ })
