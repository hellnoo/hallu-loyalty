import { NextResponse } from 'next/server'
import { cekPasswordOutlet } from '@/lib/outlet-auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}))
  if (await cekPasswordOutlet('admin', password)) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Password salah' }, { status: 401 })
}
