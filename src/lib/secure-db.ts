// Helper client: tulis lewat server route /api/secure (service_role), dengan
// FALLBACK ke anon kalau server belum siap (501) atau error jaringan. Fallback ini
// yang menjamin app tetap jalan saat rollout — sebelum SUPABASE_SERVICE_ROLE_KEY diset.
// Setelah RLS diperketat, jalur anon fallback akan ditolak DB → jalur server yang dipakai.

type FallbackResult = { error: unknown; data?: unknown; count?: number | null }

export type SecureOp = 'insert' | 'update' | 'delete' | 'upsert' | 'deleteOld'

export async function secureWrite(opts: {
  scope: 'admin' | 'kasir'
  table: string
  op: SecureOp
  values?: unknown
  matchId?: string
  cutoff?: string
  statuses?: string[]
  fallback: () => Promise<FallbackResult>
}): Promise<FallbackResult> {
  const pwKey = opts.scope === 'admin' ? 'hallu-admin-pw' : 'hallu-kasir-pw'
  const password = typeof window !== 'undefined' ? localStorage.getItem(pwKey) : null

  // Tidak ada password tersimpan (sesi lama) → coba anon dulu (masih jalan sebelum RLS).
  if (!password) return opts.fallback()

  try {
    const res = await fetch('/api/secure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: opts.scope, password, table: opts.table, op: opts.op,
        values: opts.values, matchId: opts.matchId, cutoff: opts.cutoff, statuses: opts.statuses,
      }),
    })
    if (res.status === 501) return opts.fallback() // service_role belum diset
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: new Error(json.error || 'gagal') }
    return { error: null, data: json.data, count: json.count }
  } catch {
    return opts.fallback() // jaringan gagal → coba anon
  }
}
