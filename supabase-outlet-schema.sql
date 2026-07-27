-- ============================================================
-- HALLU — Outlet milik sendiri NUMPANG DB pusat via schema Postgres
-- Contoh konkret: schema `brew` (Hallu Brew, Salero).
-- Jalankan di SQL Editor DB PUSAT. Idempotent.
--
-- Outlet lain tinggal ganti semua kata `brew` dengan nama schema baru.
-- SETELAH SQL INI: Dashboard → Settings → API → "Exposed schemas"
-- → tambahkan `brew` (tanpa ini PostgREST menolak akses schema).
-- Vercel outlet: NEXT_PUBLIC_SUPABASE_SCHEMA=brew (URL & anon key = punya pusat).
-- ============================================================

create schema if not exists brew;

-- ── Tabel (struktur identik dgn public/pusat, TANPA seed menu) ──
create table if not exists brew.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price int not null default 0,
  category text,
  available boolean default true,
  created_at timestamptz default now(),
  hpp int default 0,
  hpp_components jsonb default '[]'::jsonb,
  image_url text,
  model_3d_url text,
  model_3d_task_id text
);

create table if not exists brew.orders (
  id uuid primary key default gen_random_uuid(),
  table_number int not null default 0,
  items jsonb not null default '[]'::jsonb,
  status text default 'new',
  note text,
  created_at timestamptz default now(),
  customer_name text,
  phone text,
  payment_method text,
  rating int
);
create index if not exists idx_brew_orders_created_at on brew.orders (created_at);
create index if not exists idx_brew_orders_status on brew.orders (status);

create table if not exists brew.store_settings (
  id int primary key default 1,
  open_time text not null default '08:00',
  close_time text not null default '22:00',
  open_days text not null default 'Senin – Minggu',
  is_manually_closed boolean not null default false
);
insert into brew.store_settings (id) values (1) on conflict (id) do nothing;
alter table brew.store_settings add column if not exists employees jsonb not null default '["Amin","Rama","Ubuy"]'::jsonb;

create table if not exists brew.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  opening_notes text,
  closing_notes text,
  handover_to text
);
create index if not exists idx_brew_shifts_started_at on brew.shifts (started_at);

create table if not exists brew.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  type text,
  order_id text,
  created_at timestamptz default now()
);

create table if not exists brew.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'operasional',
  description text,
  amount int not null default 0,
  expense_date date not null default ((now() at time zone 'Asia/Jayapura')::date),
  created_at timestamptz default now()
);
create index if not exists idx_brew_expenses_date on brew.expenses (expense_date);

-- ── RLS (pola sama fase sekarang: anon diizinkan, auth di level app) ──
do $$
declare t text;
begin
  foreach t in array array['menu_items','orders','store_settings','shifts','push_subscriptions','expenses']
  loop
    execute format('alter table brew.%I enable row level security', t);
    execute format('drop policy if exists "brew_all_%s" on brew.%I', t, t);
    execute format('create policy "brew_all_%s" on brew.%I for all using (true) with check (true)', t, t);
  end loop;
end $$;

-- ── Grants untuk role PostgREST (schema baru tidak dapat grant otomatis) ──
grant usage on schema brew to anon, authenticated, service_role;
grant all on all tables in schema brew to anon, authenticated, service_role;
alter default privileges in schema brew grant all on tables to anon, authenticated, service_role;

-- ── Realtime (order masuk instan ke /kasir Hallu Brew) ──
do $$
begin
  alter publication supabase_realtime add table brew.orders;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table brew.expenses;
exception when duplicate_object then null;
end $$;

-- Storage: bucket menu-images DIPAKAI BERSAMA dgn pusat (path = <uuid item>.jpg,
-- tidak bentrok antar outlet) — tidak perlu bucket baru.
