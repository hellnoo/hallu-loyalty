# Tambah Outlet Baru (Franchise Hallu)

Satu kode (`hellnoo/hallu-loyalty`), banyak outlet. **Dua model**, pilih sesuai siapa pemilik outletnya:

| Model | Untuk siapa | DB |
|---|---|---|
| **A. Schema di DB pusat** (hemat, tanpa project baru) | Outlet **milik sendiri** (mis. Hallu Brew) | Numpang DB pusat, 1 schema Postgres per outlet |
| **B. DB terpisah** | Outlet **mitra/pihak ketiga** | Project Supabase sendiri (isolasi penuh — mitra tak mungkin sentuh data pusat) |

---

## Model A — Outlet milik sendiri: schema di DB pusat

Data tetap terpisah rapi (schema `public` = pusat, `brew` = Hallu Brew, dst.), tapi **nol project Supabase baru** — bebas dari limit 2 project. Aman karena outletnya milik owner yang sama (anon key dipakai bersama).

1. **SQL Editor DB pusat** → jalankan `supabase-outlet-schema.sql` (contoh konkret schema `brew`; outlet lain: ganti semua kata `brew`). Tanpa seed menu.
2. **Dashboard → Settings → API → "Exposed schemas"** → tambahkan `brew` → Save. (Tanpa ini API menolak schema baru.)
3. **Vercel: Add New Project** → import repo yang sama → env:
   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` = **salin dari project pusat** (DB sama)
   - **`NEXT_PUBLIC_SUPABASE_SCHEMA` = `brew`** ← kunci pemisah datanya
   - `ADMIN_PASSWORD`, `KASIR_PASSWORD` (baru, beda dari pusat)
   - Brand: `NEXT_PUBLIC_BRAND_NAME` dst. (lihat tabel Model B)
   - VAPID boleh salin dari pusat; `SUPABASE_SERVICE_ROLE_KEY` juga (kalau F4a aktif)
4. **Sambungkan ke /owner**: di `OUTLETS_JSON` pusat tambah entri dgn field `"schema":"brew"`:
   `{"name":"Hallu Brew","url":"<url pusat>","anon":"<anon pusat>","schema":"brew"}`

Catatan: bucket foto `menu-images` dipakai bersama (path = uuid item, tak bentrok).

---

## Model B — Outlet mitra: DB terpisah

Tiap outlet mitra = **1 project Supabase (DB sendiri)** + **1 project Vercel (deploy sendiri)** yang nunjuk ke DB itu. Menu, harga, transaksi, pengeluaran semuanya terpisah fisik.

> ⚠️ Limit Supabase gratis = **2 project aktif per AKUN** (bukan per organisasi — sudah dibuktikan: bikin org baru di akun yang sama tetap ditolak). Slot tambahan = akun lain (mis. thatwokz), pause project nganggur, atau upgrade Pro.

---

## Langkah Model B (per-DB)

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

### 4. Sambungkan ke dashboard owner + Admin Pusat (kelola lintas outlet)
- Di project **pusat** (`hallu-loyalty`) → env `OUTLETS_JSON` → tambah entri outlet baru:
  `{"name":"Nama Outlet","url":"https://<ref>.supabase.co","anon":"<anon key outlet>"}`
- Redeploy pusat → `/owner` ikut mantau outlet baru (omzet, transaksi, laba), dan
  outlet itu muncul di dropdown **"Kelola Outlet"** di Admin Pusat (kelola menu/
  HPP/jam/karyawan outlet itu tanpa login terpisah — Item F5).
- **Outlet Model B (DB terpisah, mis. mitra)** butuh field tambahan `serviceRole`
  supaya Admin Pusat bisa TULIS ke sana: `{"name":"...","url":"...","anon":"...",
  "serviceRole":"<service_role key outlet itu>"}` — ambil di project outlet →
  Settings → API Keys → Legacy → **service_role** (SECRET, tempel sendiri).
  Tanpa ini, outlet tetap muncul di dropdown tapi ditandai "belum terhubung"
  (baca-tulis lewat Admin Pusat belum bisa, mitra tetap bisa kelola dari admin
  mereka sendiri seperti biasa).
- **Outlet Model A (schema-based, mis. Hallu Brew)** otomatis writable dari Admin
  Pusat begitu `SUPABASE_SERVICE_ROLE_KEY` pusat diset — tidak perlu `serviceRole`
  terpisah (satu project yang sama).

---

## Yang bisa dibantu Claude vs kamu sendiri
- **Claude bisa:** jalanin `supabase-setup.sql`/hardening di DB baru (via SQL editor), pandu env Vercel, susun `OUTLETS_JSON`.
- **Kamu sendiri (tak bisa Claude):** buat project Supabase & Vercel, tempel anon/service key, set password (kunci & kredensial tidak lewat Claude).
