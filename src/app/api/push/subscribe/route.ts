import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { subscription, type, orderId } = await req.json()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { db: { schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public' } }
    )
    await supabase.from('push_subscriptions').upsert({
      endpoint: subscription.endpoint,
      subscription,
      type,
      order_id: orderId || null,
    }, { onConflict: 'endpoint' })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
