import { createClient } from '@supabase/supabase-js'

// Multi-outlet dalam 1 DB: tiap outlet punya schema Postgres sendiri.
// Default 'public' (= pusat / deploy DB-terpisah). Outlet milik sendiri yang
// numpang DB pusat cukup set NEXT_PUBLIC_SUPABASE_SCHEMA (mis. 'brew').
export const DB_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'public'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  { db: { schema: DB_SCHEMA } }
)
