-- ============================================================
-- HALLU Coffee & Sociality — Supabase Setup (LENGKAP)
-- Aman dijalankan sekali di SQL Editor (idempotent — tidak
-- menimpa data yang sudah ada). Bisa juga dijalankan ulang.
-- ============================================================

-- ── Extension (untuk gen_random_uuid) ──────────────────────
create extension if not exists pgcrypto;

-- ============================================================
-- 1. MENU ITEMS
-- ============================================================
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price int not null default 0,
  category text,
  available boolean default true,
  created_at timestamptz default now()
);
-- Kolom tambahan (untuk DB lama yang belum punya)
alter table menu_items add column if not exists hpp int default 0;
alter table menu_items add column if not exists hpp_components jsonb default '[]'::jsonb;
alter table menu_items add column if not exists image_url text;
alter table menu_items add column if not exists model_3d_url text;
alter table menu_items add column if not exists model_3d_task_id text;

-- ============================================================
-- 2. ORDERS
-- ============================================================
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_number int not null default 0,
  items jsonb not null default '[]'::jsonb,
  status text default 'new',           -- new | preparing | ready | done | cancelled
  note text,
  created_at timestamptz default now()
);
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists phone text;
alter table orders add column if not exists payment_method text;   -- tunai | qris | transfer
alter table orders add column if not exists rating int;

-- Index bantu untuk rekap (query by tanggal + status)
create index if not exists idx_orders_created_at on orders (created_at);
create index if not exists idx_orders_status on orders (status);

-- ============================================================
-- 3. STORE SETTINGS (1 baris — jam buka/tutup)
-- ============================================================
create table if not exists store_settings (
  id int primary key default 1,
  open_time text not null default '08:00',
  close_time text not null default '22:00',
  open_days text not null default 'Senin – Minggu',
  is_manually_closed boolean not null default false
);
insert into store_settings (id) values (1) on conflict (id) do nothing;
-- Daftar karyawan kasir (per outlet, diatur dari Admin → Pengaturan)
alter table store_settings add column if not exists employees jsonb not null default '["Amin","Rama","Ubuy"]'::jsonb;

-- ============================================================
-- 4. SHIFTS (jaga karyawan — fleksibel)
-- ============================================================
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  opening_notes text,
  closing_notes text,
  handover_to text
);
create index if not exists idx_shifts_started_at on shifts (started_at);

-- ============================================================
-- 5. PUSH SUBSCRIPTIONS (Web Push notifikasi)
-- ============================================================
create table if not exists push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  type text,                           -- kasir | customer
  order_id text,
  created_at timestamptz default now()
);

-- ============================================================
-- 5b. EXPENSES (pengeluaran — untuk P&L / laba-rugi)
-- ============================================================
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'operasional', -- bahan | gaji | sewa | listrik | operasional | lain
  description text,
  amount int not null default 0,
  expense_date date not null default ((now() at time zone 'Asia/Jayapura')::date),
  created_at timestamptz default now()
);
create index if not exists idx_expenses_date on expenses (expense_date);

-- ============================================================
-- 6. REALTIME — order masuk instan ke /kasir
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table expenses;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 7. RLS — aktif + policy izinkan akses anon (app pakai anon key,
--    autentikasi admin/kasir di level aplikasi via password)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['menu_items','orders','store_settings','shifts','push_subscriptions','expenses']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "hallu_all_%s" on %I', t, t);
    execute format('create policy "hallu_all_%s" on %I for all using (true) with check (true)', t, t);
    -- GRANT eksplisit: supaya script ini TIDAK bergantung pada setelan
    -- "Automatically expose new tables" di dashboard Supabase. Dengan begini
    -- setelan itu boleh DIMATIKAN (rekomendasi Supabase) — tabel app tetap
    -- jalan, dan tabel sensitif yang dibuat belakangan tidak ikut ter-expose
    -- otomatis. Akses sebenarnya tetap dijaga RLS policy di atas.
    -- service_role WAJIB ikut: dipakai server route /api/secure & /api/central/*
    -- (kelola outlet dari Admin Pusat). Kalau auto-expose OFF dan service_role
    -- tidak di-grant, hasilnya "permission denied for table ..." padahal
    -- kuncinya sudah benar.
    execute format('grant select, insert, update, delete on %I to anon, authenticated, service_role', t);
  end loop;
end $$;

-- ============================================================
-- 8. STORAGE — bucket foto menu (public)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "menu_images_read"   on storage.objects;
drop policy if exists "menu_images_write"  on storage.objects;
drop policy if exists "menu_images_delete" on storage.objects;
create policy "menu_images_read"   on storage.objects for select using (bucket_id = 'menu-images');
create policy "menu_images_write"  on storage.objects for insert with check (bucket_id = 'menu-images');
create policy "menu_images_delete" on storage.objects for delete using (bucket_id = 'menu-images');

-- ============================================================
-- 9. SEED MENU (opsional — jalan hanya kalau menu masih kosong)
-- ============================================================
insert into menu_items (name, description, price, category, available)
select * from (values
  ('Americano',        'Espresso dengan air panas, bold dan bersih',         18000, 'Kopi',     true),
  ('Kopi Susu Aren',   'Espresso dengan gula aren dan susu segar',           20000, 'Kopi',     true),
  ('Latte',            'Espresso dengan susu steamed creamy',                22000, 'Kopi',     true),
  ('Matcha Latte',     'Matcha Jepang premium dengan susu oat',              22000, 'Non-Kopi', true),
  ('Coklat Panas',     'Dark chocolate blend, rich dan tidak terlalu manis', 18000, 'Non-Kopi', true),
  ('Croissant',        'Croissant butter flaky, disajikan hangat',           18000, 'Makanan',  true)
) as v(name, description, price, category, available)
where not exists (select 1 from menu_items);

-- ============================================================
-- SELESAI. Setelah ini set Environment Variables di Vercel:
--   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
--   ADMIN_PASSWORD, KASIR_PASSWORD, ANTHROPIC_API_KEY,
--   MESHY_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
-- ============================================================
