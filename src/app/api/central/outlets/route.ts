import { NextResponse } from 'next/server'
import { getAllOutlets, addOutletToDb, removeOutletFromDb } from '@/lib/outlets-registry'
import { getOutletServiceClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Kelola daftar outlet (dropdown "ganti outlet" + tombol "+ Tambah Outlet")
// di Admin Pusat. Dijaga ADMIN_PASSWORD pusat.
// op 'list'   → balikin name/url/schema/writable/sameProject saja, TIDAK
//                PERNAH anon/serviceRole ke client.
// op 'add'    → simpan outlet baru ke tabel public.outlets (DB pusat).
// op 'remove' → hapus dari tabel public.outlets (outlet dari OUTLETS_JSON
//                env tidak bisa dihapus lewat sini — itu memang dikunci di Vercel).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { password, op, outlet, url, schema } = body || {}

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }

  try {
    if (!op || op === 'list') {
      const outlets = (await getAllOutlets()).map((o) => ({
        name: o.name,
        url: o.url,
        schema: o.schema || 'public',
        writable: !!getOutletServiceClient(o),
        sameProject: o.url === process.env.NEXT_PUBLIC_SUPABASE_URL,
      }))
      return NextResponse.json({ outlets })
    }
    if (op === 'add') {
      if (!outlet?.name || !outlet?.url || !outlet?.anon) {
        return NextResponse.json({ error: 'Nama, URL, dan anon key wajib diisi' }, { status: 400 })
      }
      await addOutletToDb(outlet)
      return NextResponse.json({ ok: true })
    }
    if (op === 'remove') {
      if (!url) return NextResponse.json({ error: 'url wajib diisi' }, { status: 400 })
      await removeOutletFromDb(url, schema || 'public')
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
