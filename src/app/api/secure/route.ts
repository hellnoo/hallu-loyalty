import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase-admin'
import { cekPasswordOutlet } from '@/lib/outlet-auth'

export const runtime = 'nodejs'

// Operasi tulis yang di-whitelist per scope. Baca (SELECT) tetap lewat anon di client.
// Tujuan: cegah anon key (publik) mengubah menu/harga, setelan toko, pengeluaran,
// dan menghapus/menghapus-masal data. Login tetap password app-level (tidak berubah).
const ALLOWED: Record<string, Record<string, string[]>> = {
  admin: {
    menu_items: ['insert', 'update', 'delete'],
    store_settings: ['upsert'],
    bahan: ['insert', 'update', 'delete'],
    orders: ['deleteOld'],
  },
  kasir: {
    expenses: ['insert', 'delete'],
  },
}

// Pakai pengecek yang SAMA dengan /api/admin-auth & /api/kasir-auth: env ATAU
// database. Dulu di sini cuma cek env — akibatnya kalau password diganti lewat
// Admin Pusat (tersimpan di DB), user bisa LOGIN tapi semua simpan ditolak
// "Password salah / sesi kadaluarsa".
async function checkPassword(scope: string, password: string): Promise<boolean> {
  if (scope === 'admin') return cekPasswordOutlet('admin', password)
  if (scope === 'kasir') {
    if (await cekPasswordOutlet('kasir', password)) return true
    // Sama seperti /api/kasir-auth: kalau password kasir belum diatur,
    // password admin juga diterima.
    const kasirDiaturDiEnv = !!process.env.KASIR_PASSWORD
    return !kasirDiaturDiEnv && cekPasswordOutlet('admin', password)
  }
  return false
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { scope, password, table, op, values, matchId, cutoff, statuses } = body || {}

  if (!scope || !table || !op) return NextResponse.json({ error: 'permintaan tidak lengkap' }, { status: 400 })
  if (!ALLOWED[scope]?.[table]?.includes(op)) return NextResponse.json({ error: 'operasi tidak diizinkan' }, { status: 403 })
  if (!(await checkPassword(scope, password))) return NextResponse.json({ error: 'Password salah / sesi kadaluarsa' }, { status: 401 })

  const sb = getServiceClient()
  // 501: service_role belum diset → client fallback ke anon (jendela transisi, tanpa downtime)
  if (!sb) return NextResponse.json({ error: 'service_role belum dikonfigurasi' }, { status: 501 })

  try {
    if (op === 'insert') {
      const { data, error } = await sb.from(table).insert(values).select('*')
      if (error) throw error
      return NextResponse.json({ data })
    }
    if (op === 'upsert') {
      const { error } = await sb.from(table).upsert(values)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (op === 'update') {
      if (!matchId) return NextResponse.json({ error: 'matchId wajib' }, { status: 400 })
      const { error } = await sb.from(table).update(values).eq('id', matchId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (op === 'delete') {
      if (!matchId) return NextResponse.json({ error: 'matchId wajib' }, { status: 400 })
      const { error } = await sb.from(table).delete().eq('id', matchId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (op === 'deleteOld' && table === 'orders') {
      if (!cutoff) return NextResponse.json({ error: 'cutoff wajib' }, { status: 400 })
      const st = Array.isArray(statuses) && statuses.length ? statuses : ['done', 'cancelled']
      const { count, error } = await sb.from('orders').delete({ count: 'exact' }).in('status', st).lt('created_at', cutoff)
      if (error) throw error
      return NextResponse.json({ count: count ?? 0 })
    }
    return NextResponse.json({ error: 'operasi tidak dikenal' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message
      : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
      : 'gagal'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
