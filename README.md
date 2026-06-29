# Berkesan Coffee

Web interface for the **Berkesan Coffee** cashier & ordering app. Built with vanilla HTML, CSS, and JavaScript.

🌐 **Live**: [berkesan-coffe.vercel.app](https://berkesan-coffe.vercel.app)

## Tech Stack

- **HTML / CSS / JavaScript**
- **API**: Node.js/Express backend via ngrok tunnel

## Pages & Access

| URL | File | Access |
|-----|------|--------|
| `/` | `index.html` | Public — landing page |
| `/order` | `public/pages/order.html` | Public — customer orders |
| `/about` | `public/pages/about.html` | Public |
| `/login` | `public/pages/login.html` | Public |
| `/admin` | `admin/index.html` | `admin` role only |
| `/kasir` | `kasir/index.html` | `kasir` role only |

## Backend Configuration

Edit **`public/js/api.config.js`** and set `BACKEND_URL` to the active ngrok URL:

```js
const BACKEND_URL = "https://xxxx.ngrok-free.dev"; // update on every ngrok restart
```

> ⚠️ The ngrok URL changes every time it restarts. After updating this file, push to GitHub — Vercel will redeploy automatically.

```bash
git add public/js/api.config.js
git commit -m "update ngrok url"
git push
```

## Local Setup

No build step needed. Open the HTML files directly in a browser, or use a live server:

```bash
npx serve .
```

## Usage Flow

```
Customer → /order → select menu → submit order
                                       ↓
                             Backend (ngrok) ↔ MySQL
                                       ↓
Cashier → /kasir → receive & process payment
Admin   → /admin → manage menu & view sales report
```
