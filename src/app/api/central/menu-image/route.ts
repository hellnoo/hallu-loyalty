import { NextResponse } from 'next/server'
import { getOutlets } from '@/lib/outlets'
import { getOutletServiceClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Upload foto menu ke bucket 'menu-images' outlet di PROJECT SUPABASE LAIN
// (mis. hallu-outlet mitra). Outlet yang numpang project pusat (schema-based,
// mis. Hallu Brew) TIDAK perlu route ini — bucket-nya sudah satu project
// dengan pusat, upload langsung lewat storage client biasa di client.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'form tidak valid' }, { status: 400 })

  const password = String(form.get('password') || '')
  const outletUrl = String(form.get('outletUrl') || '')
  const outletSchema = String(form.get('outletSchema') || 'public')
  const itemId = String(form.get('itemId') || '')
  const file = form.get('file') as File | null

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }
  if (!outletUrl || !itemId || !file) return NextResponse.json({ error: 'permintaan tidak lengkap' }, { status: 400 })

  const outlet = getOutlets().find((o) => o.url === outletUrl && (o.schema || 'public') === outletSchema)
  if (!outlet) return NextResponse.json({ error: 'outlet tidak ditemukan' }, { status: 404 })

  const sb = getOutletServiceClient(outlet)
  if (!sb) return NextResponse.json({ error: `Outlet "${outlet.name}" belum terhubung untuk tulis` }, { status: 501 })

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const path = `${itemId}.jpg`
    const { error: upErr } = await sb.storage.from('menu-images').upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) throw upErr
    const { data } = sb.storage.from('menu-images').getPublicUrl(path)
    return NextResponse.json({ publicUrl: data.publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message
      : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
      : 'gagal upload'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
