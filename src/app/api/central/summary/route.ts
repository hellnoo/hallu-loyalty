import { NextResponse } from 'next/server'
import { buildOutletSummary } from '@/lib/outlet-summary'

export const runtime = 'nodejs'

// Ringkasan lintas outlet untuk tab "Pantau Outlet" di Admin Pusat —
// dijaga ADMIN_PASSWORD pusat (owner tidak perlu password kedua).
// Perhitungan sama persis dengan /api/owner/summary (satu modul bersama).
export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}))
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Password salah' }, { status: 401 })
  }
  const result = await buildOutletSummary()
  if ('empty' in result) {
    return NextResponse.json({ error: 'Belum ada outlet terdaftar' }, { status: 503 })
  }
  return NextResponse.json(result)
}
