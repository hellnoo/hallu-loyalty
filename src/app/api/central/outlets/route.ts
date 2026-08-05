import { NextResponse } from 'next/server'
import { getOutlets } from '@/lib/outlets'
import { getOutletServiceClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Daftar outlet buat dropdown "ganti outlet" di Admin Pusat. Dijaga
// ADMIN_PASSWORD pusat — cuma balikin name/url/writable, TIDAK PERNAH anon/
// serviceRole ke client.
export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}))
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }
  const outlets = getOutlets().map((o) => ({
    name: o.name,
    url: o.url,
    schema: o.schema || 'public',
    writable: !!getOutletServiceClient(o),
    sameProject: o.url === process.env.NEXT_PUBLIC_SUPABASE_URL,
  }))
  return NextResponse.json({ outlets })
}
