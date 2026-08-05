import { NextResponse } from 'next/server'
import { getAllOutlets } from '@/lib/outlets-registry'
import { getOutletServiceClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Kelola menu_items outlet MANAPUN dari Admin Pusat, dijaga ADMIN_PASSWORD pusat.
// Server yang pegang service_role tiap outlet — client tidak pernah lihat kredensial.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { password, outletUrl, outletSchema, op, values, matchId } = body || {}

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }
  if (!outletUrl || !op) return NextResponse.json({ error: 'permintaan tidak lengkap' }, { status: 400 })

  // Cocokkan url + schema — Pusat & outlet schema-based (mis. Hallu Brew) berbagi url yang sama.
  const wantSchema = outletSchema || 'public'
  const outlet = (await getAllOutlets()).find((o) => o.url === outletUrl && (o.schema || 'public') === wantSchema)
  if (!outlet) return NextResponse.json({ error: 'outlet tidak ditemukan' }, { status: 404 })

  const sb = getOutletServiceClient(outlet)
  if (!sb) return NextResponse.json({ error: `Outlet "${outlet.name}" belum terhubung untuk tulis — set serviceRole di OUTLETS_JSON` }, { status: 501 })

  try {
    if (op === 'list') {
      const { data, error } = await sb.from('menu_items').select('*').order('category').order('name')
      if (error) throw error
      return NextResponse.json({ data })
    }
    if (op === 'insert') {
      const { data, error } = await sb.from('menu_items').insert(values).select('*')
      if (error) throw error
      return NextResponse.json({ data })
    }
    if (op === 'update') {
      if (!matchId) return NextResponse.json({ error: 'matchId wajib' }, { status: 400 })
      const { error } = await sb.from('menu_items').update(values).eq('id', matchId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    if (op === 'delete') {
      if (!matchId) return NextResponse.json({ error: 'matchId wajib' }, { status: 400 })
      const { error } = await sb.from('menu_items').delete().eq('id', matchId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'operasi tidak dikenal' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message
      : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
      : 'gagal'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
