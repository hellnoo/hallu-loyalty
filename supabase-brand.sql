-- ============================================================
-- HALLU — Identitas outlet (nama, kontak, alamat, warna, logo)
-- disimpan di DATABASE supaya bisa diatur dari Admin Pusat,
-- TANPA perlu buka Vercel. Jalankan di SETIAP DB outlet.
-- Idempotent — aman dijalankan ulang.
-- ============================================================

alter table public.store_settings add column if not exists brand_name    text;
alter table public.store_settings add column if not exists brand_tagline text;
alter table public.store_settings add column if not exists brand_arabic  text;
alter table public.store_settings add column if not exists brand_city    text;
alter table public.store_settings add column if not exists brand_wa      text;
alter table public.store_settings add column if not exists brand_ig      text;
alter table public.store_settings add column if not exists brand_address text;
alter table public.store_settings add column if not exists brand_lat     double precision;
alter table public.store_settings add column if not exists brand_lng     double precision;
alter table public.store_settings add column if not exists brand_logo    text;
alter table public.store_settings add column if not exists brand_color   text;
alter table public.store_settings add column if not exists brand_accent  text;

-- Kunci AI (opsional) — RAHASIA, jadi TIDAK ikut di-grant ke anon di bawah.
-- Hanya server (service_role) yang boleh membacanya.
alter table public.store_settings add column if not exists ai_api_key text;

-- Identitas TIDAK rahasia (memang tampil ke pelanggan) → boleh dibaca publik.
-- Password & kunci AI tetap tidak ikut (lihat supabase-outlet-password.sql).
revoke select on public.store_settings from anon, authenticated;
grant select (
  id, open_time, close_time, open_days, is_manually_closed, employees,
  brand_name, brand_tagline, brand_arabic, brand_city, brand_wa, brand_ig,
  brand_address, brand_lat, brand_lng, brand_logo, brand_color, brand_accent
) on public.store_settings to anon, authenticated;
grant insert, update, delete on public.store_settings to anon, authenticated;
grant select, insert, update, delete on public.store_settings to service_role;
