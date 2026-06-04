# StockFlow v2 — Inventory Management System

A production-ready stock management web app built with **Next.js 15**, **PostgreSQL**, and **TypeScript**. Free to host on **Vercel + Neon**.

---

## How the Stock Logic Works

```
Master Stock  ←──── Restock (adds)
     │
     ├──── Platform Sale (Blinkit, Zepto, etc.) → deducts
     ├──── Return from platform                 → adds back
     ├──── Offline Sale                         → deducts
     ├──── Gift / Sample                        → deducts
     └──── Manual Adjustment (+ or -)
```

All movements go through one unified **Transactions** page. Stock always comes from and goes back to the master stock.

---

## Features

| Feature | Details |
|---------|---------|
| **Master Stock** | Single source of truth per product |
| **Platform Sales** | Blinkit, Zepto, Instamart, Flipkart, Amazon, BigBasket + add more |
| **Returns** | Log returns per platform — stock auto-restores |
| **Offline Sales** | Track walk-in / physical store sales |
| **Gifts & Samples** | Track giveaways separately |
| **Manual Adjustment** | Correct stock up or down with reason |
| **Restock** | Add stock with supplier name, cost, date |
| **Reports** | Monthly, date-wise, platform-wise, product-wise |
| **Excel Export** | 5 sheet types: All, Platform, Monthly, Date-wise, Current Stock |
| **Low Stock Alerts** | Dashboard highlights products below threshold |
| **Mobile Friendly** | Full responsive layout, hamburger menu on mobile |

---

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — stats, recent activity, quick actions |
| `/transactions` | Log all stock movements (sale, return, restock, gift, offline, adjust) |
| `/products` | Manage products, set master stock & low-stock threshold |
| `/platforms` | Manage channels (online/offline/other) |
| `/reports` | Analytics + Excel export with date/platform/product filters |

---

## Deploy Free in 10 Minutes

### Step 1 — Get a free PostgreSQL database

Sign up at [neon.tech](https://neon.tech) (free tier: 512 MB, no credit card needed).
Create a project → copy the **connection string** (looks like `postgresql://user:pass@host/db`).

### Step 2 — Push to GitHub

```bash
cd stockflow
npm install
git init
git add .
git commit -m "Initial commit"
# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/stockflow.git
git push -u origin main
```

### Step 3 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo
2. Under **Environment Variables**, add:
   - Key: `DATABASE_URL`
   - Value: your Neon connection string
3. Click **Deploy** — done in ~2 minutes

### Step 4 — Initialize Database

Open your deployed URL. The dashboard shows a **"Initialize Database"** button on first load. Click it once. That's it — tables and default platforms are created automatically.

---

## Local Development

```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL

npm install
npm run dev
# Open http://localhost:3000
# Click "Initialize Database" on first load
```

---

## Project Structure

```
stockflow/
├── app/
│   ├── api/
│   │   ├── init/route.ts           # DB init (run once)
│   │   ├── dashboard/route.ts      # Dashboard stats
│   │   ├── transactions/route.ts   # All stock movements (GET/POST/DELETE)
│   │   ├── products/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── platforms/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── export/route.ts         # Excel download
│   ├── transactions/page.tsx       # Main transaction log + add form
│   ├── products/page.tsx           # Products & master stock
│   ├── platforms/page.tsx          # Sales channels
│   ├── reports/page.tsx            # Reports & Excel export
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Dashboard
├── components/
│   ├── AppShell.tsx                # Layout wrapper (sidebar state)
│   └── Sidebar.tsx                 # Responsive sidebar nav
├── lib/
│   ├── db.ts                       # PostgreSQL pool
│   └── schema.sql                  # DB schema (auto-run via /api/init)
├── types/index.ts
├── .env.example
└── README.md
```

---

## Adding More Channels

Go to **Channels** page → Add Channel. Pick type:
- **Online Platform** — appears in the Platform dropdown when logging sales/returns
- **Offline / Physical** — for walk-in stores
- **Other** — gifts, B2B, bulk orders

---

## Excel Export Sheets

| Sheet | Contents |
|-------|---------|
| All Transactions | Every entry with date, product, channel, type, stock in/out |
| Current Stock | All products with current master stock & status |
| Platform Sales & Returns | Filtered to online platform activity |
| Monthly Summary | Grouped by month + product + channel + type |
| Date-wise Summary | Daily totals: sales, returns, restocks, gifts, offline |
