# Berkesan Frontend

Antarmuka web untuk aplikasi kasir & pemesanan **Kopi Berkesan**. Dibangun dengan HTML, CSS, dan JavaScript murni (vanilla) — tanpa framework. Di-deploy di **Vercel**.

🌐 **Live**: [berkesan-coffe.vercel.app](https://berkesan-coffe.vercel.app)

## Tech Stack

- **HTML / CSS / JavaScript** (vanilla, tanpa framework)
- **Hosting**: Vercel (static site)
- **API**: Terhubung ke backend via ngrok

## Struktur Folder

```
berkesan-frontend/
├── index.html              # Halaman utama (landing page)
├── vercel.json             # Konfigurasi routing Vercel
├── public/
│   ├── pages/
│   │   ├── order.html      # Halaman pemesanan pelanggan
│   │   ├── about.html      # Halaman tentang kami
│   │   └── login.html      # Halaman login
│   ├── js/
│   │   ├── api.config.js   # ⚠️ Konfigurasi URL backend
│   │   ├── index.js        # Script landing page
│   │   ├── order.js        # Script halaman order
│   │   ├── login.js        # Script login
│   │   ├── about.js        # Script halaman about
│   │   ├── kasir.js        # Script dashboard kasir
│   │   └── dashboardAdmin.js # Script dashboard admin
│   └── assets/
│       ├── img/            # Gambar & aset visual
│       └── css/            # Stylesheet
├── admin/
│   └── index.html          # Dashboard admin
└── kasir/
    └── index.html          # Dashboard kasir
```

## Halaman & Akses

| URL | File | Akses |
|-----|------|-------|
| `/` | `index.html` | Publik — landing page |
| `/order` | `public/pages/order.html` | Publik — pelanggan pesan |
| `/about` | `public/pages/about.html` | Publik |
| `/login` | `public/pages/login.html` | Publik |
| `/admin` | `admin/index.html` | Login sebagai `admin` |
| `/kasir` | `kasir/index.html` | Login sebagai `kasir` |

## Konfigurasi Backend URL

File penting: **`public/js/api.config.js`**

```js
const BACKEND_URL = "https://xxxx.ngrok-free.app"; // URL ngrok backend
```

> ⚠️ **Setiap kali ngrok dijalankan ulang**, URL berubah. Wajib update file ini dan push ke GitHub agar Vercel otomatis redeploy.

## Setup Lokal

Tidak perlu build step. Cukup buka file HTML langsung di browser, atau gunakan live server:

```bash
# Dengan VS Code Live Server extension, atau:
npx serve .
```

Pastikan `api.config.js` sudah mengarah ke URL backend yang aktif.

## Deploy ke Vercel

### Pertama kali

1. Push repo ke GitHub
2. Buka [vercel.com](https://vercel.com) → Import project dari GitHub
3. Framework preset: **Other** (static site)
4. Root directory: `/` (root folder)
5. Klik Deploy

### Update setelah perubahan

```bash
git add .
git commit -m "pesan commit"
git push
```

Vercel otomatis redeploy setiap ada push ke branch utama.

### Update URL ngrok

```bash
# Edit api.config.js dengan URL ngrok terbaru
# Lalu:
git add public/js/api.config.js
git commit -m "update ngrok url"
git push
```

## Alur Penggunaan

```
Pelanggan → /order → pilih menu → submit order
                                        ↓
                              Backend (ngrok) → MySQL
                                        ↓
Kasir → /kasir → lihat order masuk → proses pembayaran
Admin → /admin → dashboard penjualan, kelola menu
```
