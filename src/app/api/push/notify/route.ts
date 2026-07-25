import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Jangan panggil setVapidDetails saat build/module-load — deploy tanpa VAPID
// (mis. instance demo) akan gagal build. Set lazily saat request pertama.
const vapidReady = !!(process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
let vapidConfigured = false
function ensureVapid(): boolean {
  if (!vapidReady) return false
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )
    vapidConfigured = true
  }
  return true
}

export async function POST(req: Request) {
  try {
    if (!ensureVapid()) return NextResponse.json({ ok: true, sent: 0, note: 'push nonaktif (VAPID belum diset)' })
    const { type, orderId, title, body, url, tag } = await req.json()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public' } }
    )

    let query = supabase.from('push_subscriptions').select('endpoint, subscription').eq('type', type)
    if (orderId) query = query.eq('order_id', orderId)

    const { data } = await query
    if (!data?.length) return NextResponse.json({ ok: true, sent: 0 })

    const payload = JSON.stringify({ title, body, url: url || '/', tag: tag || type })
    const stale: string[] = []

    await Promise.allSettled(data.map(async row => {
      try {
        await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
      } catch {
        stale.push(row.endpoint)
      }
    }))

    // Hapus subscription yang sudah expired/invalid
    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale)
    }

    return NextResponse.json({ ok: true, sent: data.length - stale.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
