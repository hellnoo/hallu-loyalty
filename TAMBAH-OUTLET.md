# Tambah Outlet Baru (Franchise Hallu)

Satu kode (`hellnoo/hallu-loyalty`), banyak outlet. Tiap outlet = **1 project Supabase (DB sendiri)** + **1 project Vercel (deploy sendiri)** yang nunjuk ke DB itu. Menu, harga, transaksi, pengeluaran semuanya terpisah per outlet.

---

## ⚠️ Cek dulu: batas Supabase gratis
Free tier Supabase = **2 project aktif per organisasi**. Sekarang org `hellnoo` sudah punya 2 aktif: **hallu-loyalty (pusat)** + **hallu-outlet**. Untuk outlet ke-3 dst, pilih salah satu:
- **Pause** project lain yang nganggur (mis. kedaiku-demo) untuk membebaskan slot, **atau**
- Buat **organisasi/akun Supabase baru** (tiap org gratis dapat 2 project lagi), **atau**
- **Upgrade** Supabase (Pro) untuk banyak project dalam 1 org.

> Kalau outlet mau banyak (>3-4), pertimbangkan pindah ke **1 DB multi-tenant** (semua outlet di 1 project + kolom `outlet_id` + RLS per outlet). Lebih hemat & skalabel, tapi butuh kerjaan Auth/RLS (Item F4b). Untuk sekarang model per-DB paling gampang.

---

## Langkah (model per-DB, yang dipakai sekarang)

### 1. Buat DB Supabase baru
- supabase.com → New project (region **Singapore**). Catat password DB.
- **SQL Editor** → tempel & jalankan **`supabase-setup.sql`** (skema lengkap: menu, orders, store_settings, shifts, push, **expenses**, RLS, storage bucket, realtime).
- (Opsional, kalau hardening F4a dinyalain) jalankan juga **`supabase-rls-harden.sql`**.
- Settings → API Keys → catat **Project URL** + **anon public key** (legacy JWT). service_role key (rahasia) kalau pakai F4a.

### 2. Buat project Vercel baru
- vercel.com → **Add New → Project** → import repo **`hellnoo/hallu-loyalty`** → Deploy.
- Set Environment Variables (Production + Preview):

**Wajib**
| Env | Isi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL DB baru |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key DB baru |
| `ADMIN_PASSWORD` | password admin outlet |
| `KASIR_PASSWORD` | password kasir outlet |
| `NEXT_PUBLIC_BASE_URL` | URL vercel outlet ini |

**Brand (kalau beda dari Hallu)** — `NEXT_PUBLIC_BRAND_NAME`, `_TAGLINE`, `_CITY`, `_WA`, `_IG`, `_ADDRESS`, `_LAT`, `_LNG`, `_ARABIC` (isi `-` untuk sembunyikan tulisan Arab). Kalau dikosongkan → default Hallu.

**Push notif (disarankan)** — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` (boleh pakai keypair yang sama dgn outlet lain).

**Opsional** — `AI_API_KEY` (Groq/Gemini/OpenRouter) untuk fitur AI · `SUPABASE_SERVICE_ROLE_KEY` (kalau F4a hardening dinyalain).

> **JANGAN** set `OWNER_PASSWORD` / `OUTLETS_JSON` di project outlet — itu **hanya di pusat**, biar dashboard owner tetap milik kamu.

### 3. Isi & rapikan
- Ganti password default → login `/admin` outlet, atur menu (mitra isi sendiri, atau salin dari pusat).
- Cek `/menu` tampil benar & status buka/tutup sesuai (waktu sudah WIT).

### 4. Sambungkan ke dashboard owner
- Di project **pusat** (`hallu-loyalty`) → env `OUTLETS_JSON` → tambah entri outlet baru:
  `{"name":"Nama Outlet","url":"https://<ref>.supabase.co","anon":"<anon key outlet>"}`
- Redeploy pusat → `/owner` ikut mantau outlet baru (omzet, transaksi, laba).

---

## Yang bisa dibantu Claude vs kamu sendiri
- **Claude bisa:** jalanin `supabase-setup.sql`/hardening di DB baru (via SQL editor), pandu env Vercel, susun `OUTLETS_JSON`.
- **Kamu sendiri (tak bisa Claude):** buat project Supabase & Vercel, tempel anon/service key, set password (kunci & kredensial tidak lewat Claude).
