// ── Business Day Logic ─────────────────────────────────────
// Café operate kadang sampai dini hari. "Hari ini" buat rekap = 5 pagi - 5 pagi besok
export const DAY_CUTOFF_HOUR = 5

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Tanggal business day "sekarang" — jam <5 pagi = masih hitung kemarin
export function getCurrentBusinessDay(): string {
  const now = new Date()
  if (now.getHours() < DAY_CUTOFF_HOUR) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return toLocalDateString(yesterday)
  }
  return toLocalDateString(now)
}

// Bounds business day untuk tanggal tertentu:
// "2 Juni" = 2 Juni 05:00 sampai 3 Juni 04:59:59
export function getBusinessDayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const start = new Date(y, m - 1, d, DAY_CUTOFF_HOUR, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  end.setMilliseconds(end.getMilliseconds() - 1)
  return { start, end }
}
