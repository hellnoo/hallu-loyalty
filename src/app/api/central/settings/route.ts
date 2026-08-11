import { NextResponse } from 'next/server'
import { getAllOutlets } from '@/lib/outlets-registry'
import { getOutletServiceClient, describeOutletKey } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Kelola store_settings (jam buka/tutup, karyawan, manual-closed) outlet
// MANAPUN dari Admin Pusat, dijaga ADMIN_PASSWORD pusat.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { password, outletUrl, outletSchema, op, values } = body || {}

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }
  if (!outletUrl || !op) return NextResponse.json({ error: 'permintaan tidak lengkap' }, { status: 400 })

  const wantSchema = outletSchema || 'public'
  const outlet = (await getAllOutlets()).find((o) => o.url === outletUrl && (o.schema || 'public') === wantSchema)
  if (!outlet) return NextResponse.json({ error: 'outlet tidak ditemukan' }, { status: 404 })

  const sb = getOutletServiceClient(outlet)
  if (!sb) return NextResponse.json({ error: `Outlet "${outlet.name}" belum terhubung untuk tulis — set serviceRole di OUTLETS_JSON` }, { status: 501 })

  try {
    if (op === 'get') {
      const { data, error } = await sb.from('store_settings').select('*').eq('id', 1).single()
      if (error) throw error
      return NextResponse.json({ data })
    }
    if (op === 'save') {
      const { error } = await sb.from('store_settings').upsert({ id: 1, ...values })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'operasi tidak dikenal' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message
      : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
      : 'gagal'
    const hint = /permission denied/i.test(msg)
      ? ` — ${describeOutletKey(outlet)}. Kalau role-nya "anon", berarti yang ditempel di kolom Service Role Key itu anon key; isi ulang outlet ini dengan service_role key yang benar.`
      : ''
    return NextResponse.json({ error: msg + hint }, { status: 500 })
  }
}
