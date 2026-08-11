import { NextResponse } from 'next/server'
import { cekPasswordOutlet } from '@/lib/outlet-auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}))
  // Perilaku lama dipertahankan: kalau KASIR_PASSWORD tidak diset, password
  // admin juga diterima untuk kasir.
  const kasirOk = await cekPasswordOutlet('kasir', password)
  const bolehPakaiAdmin = !process.env.KASIR_PASSWORD
  if (kasirOk || (bolehPakaiAdmin && await cekPasswordOutlet('admin', password))) {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Password salah' }, { status: 401 })
}
