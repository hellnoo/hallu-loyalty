-- ============================================================
-- HALLU — Perketat RLS (Fase 1: tanpa ganti login)
-- ============================================================
-- Tujuan: anon key (publik, ada di bundle) TIDAK BISA lagi:
--   • ubah menu/harga        (menu_items: baca saja)
--   • ubah setelan toko       (store_settings: baca saja)
--   • tulis/hapus pengeluaran (expenses: baca saja)
--   • hapus/masal order       (orders: tanpa DELETE)
-- Operasi tulis itu dipindah ke server route /api/secure (service_role,
-- dijaga password admin/kasir). Baca tetap anon (dibutuhkan app + /owner).
--
-- ⚠️ URUTAN WAJIB — jalankan HANYA SETELAH:
--   1) env SUPABASE_SERVICE_ROLE_KEY sudah diset di Vercel (pusat + outlet), dan
--   2) deploy terbaru sudah live, dan
--   3) admin & kasir sudah LOGIN ULANG sekali (biar password tersimpan utk /api/secure).
-- Kalau dijalankan sebelum itu, tombol simpan menu/pengeluaran akan gagal.
--
-- Jalankan di SQL Editor tiap DB outlet (pusat + hallu-outlet). Idempotent.
-- Yang TIDAK disentuh: shifts & push_subscriptions (tetap seperti sekarang).
-- ============================================================

-- MENU_ITEMS — baca saja untuk anon
alter table menu_items enable row level security;
drop policy if exists "hallu_all_menu_items" on menu_items;
drop policy if exists "menu_items_anon_select" on menu_items;
create policy "menu_items_anon_select" on menu_items for select using (true);

-- STORE_SETTINGS — baca saja untuk anon
alter table store_settings enable row level security;
drop policy if exists "hallu_all_store_settings" on store_settings;
drop policy if exists "store_settings_anon_select" on store_settings;
create policy "store_settings_anon_select" on store_settings for select using (true);

-- EXPENSES — baca saja untuk anon (tulis/hapus lewat server)
alter table expenses enable row level security;
drop policy if exists "hallu_all_expenses" on expenses;
drop policy if exists "expenses_anon_select" on expenses;
create policy "expenses_anon_select" on expenses for select using (true);

-- ORDERS — anon boleh baca + buat + ubah (kasir/pelanggan), TAPI tidak boleh hapus
alter table orders enable row level security;
drop policy if exists "hallu_all_orders" on orders;
drop policy if exists "orders_anon_select" on orders;
drop policy if exists "orders_anon_insert" on orders;
drop policy if exists "orders_anon_update" on orders;
create policy "orders_anon_select" on orders for select using (true);
create policy "orders_anon_insert" on orders for insert with check (true);
create policy "orders_anon_update" on orders for update using (true) with check (true);
-- sengaja TIDAK ada policy DELETE untuk anon → hapus order hanya via server (service_role)

-- Verifikasi cepat (opsional): lihat policy yang aktif
-- select tablename, policyname, cmd from pg_policies
-- where tablename in ('menu_items','store_settings','expenses','orders') order by tablename;
