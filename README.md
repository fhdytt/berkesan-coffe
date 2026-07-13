
# Berkesan Coffee — POS & Ordering System

Point of Sale and table ordering system for Berkesan Coffee Shop.

**Stack:** Express.js · PostgreSQL · Tailwind CSS · Vanilla JS

🌐 **Live**: [berkesan-coffe.vercel.app](https://berkesan-coffe.vercel.app)

## Features

- JWT authentication with Admin and Kasir roles
- Menu & category management
- Table management with QR code ordering
- Order flow: order → payment → queue → done
- Auto queue numbering
- Dashboard stats, monthly recap & sales reports
- Receipt printing

## Pages & Access

| URL | File | Access |
|-----|------|--------|
| `/` | `index.html` | Public — landing page |
| `/order` | `pages/order.html` | Public — customer orders |
| `/about` | `pages/about.html` | Public |
| `/login` | `pages/login.html` | Public |
| `/admin` | `admin/index.html` | `admin` role only |
| `/kasir` | `kasir/index.html` | `kasir` role only |

## Demo Accounts

| Role  | Username | Password |
|-------|----------|----------|
| Admin | Admin    | admin    |
| Kasir | Kasir    | kasir    |
