export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Admin-only: checked in middleware for /api/seed
// This runs once to seed the opening May 2025 stock

const MAY_DATE = '2025-05-31';
const CATEGORY = 'Wraps & Foils';

const PRODUCTS = [
  { name: 'EKVEE FOOD WRAP 25 MTR ROLL',        sku: 'EFW-25M',      stock: 60  },
  { name: 'EKVEE FOOD WRAP 12 MTR',             sku: 'EFW-12M',      stock: 66  },
  { name: 'EKVEE FOOD WRAP 50 SHEETS',          sku: 'EFW-50S',      stock: 96  },
  { name: 'EKVEE FOOD WRAP 100 SHEETS',         sku: 'EFW-100S',     stock: 108 },
  { name: 'EKVEE FOOD WRAP 1/2 KG',             sku: 'EFW-HKG',      stock: 81  },
  { name: 'EKVEE FOODWRAP 1 KG SHEET 11X11',    sku: 'EFW-1K-1111',  stock: 35  },
  { name: 'EKVEE FOODWRAP 1 KG SHEET 11X15',    sku: 'EFW-1K-1115',  stock: 42  },
  { name: 'EKVEE FOODWRAP 90 PCS SHEET 11X11',  sku: 'EFW-90S-1111', stock: 368 },
  { name: 'EKVEE FOODWRAP 1/2 KG ROLL IN BOX',  sku: 'EFW-HKG-BOX',  stock: 23  },
  { name: 'EKVEE ECO WRAP 25 MTR',              sku: 'EEW-25M',      stock: 77  },
  { name: 'EKVEE ECOWRAP 10 MTR ROLL',          sku: 'EEW-10M',      stock: 63  },
  { name: 'EKVEE ECO WRAP 1 KG',                sku: 'EEW-1KG',      stock: 44  },
  { name: 'EKVEE ECO WRAP 1/2 KG',              sku: 'EEW-HKG',      stock: 55  },
  { name: 'EKVEE EKOWRAP 1 KG SHEET 11X11',     sku: 'EEW-1K-1111',  stock: 6   },
  { name: 'EKVEE EKOWRAP 1 KG SHEET 11X15',     sku: 'EEW-1K-1115',  stock: 40  },
  { name: 'EKVEE EKOWRAP 90 PCS SHEET 11X11',   sku: 'EEW-90S-1111', stock: 29  },
  { name: 'EKVEE ECOWRAP 1 KG ROLL IN BOX',     sku: 'EEW-1KG-BOX',  stock: 27  },
  { name: 'EKVEE ECOWRAP 1/2 KG ROLL IN BOX',   sku: 'EEW-HKG-BOX',  stock: 45  },
  { name: 'EKVEE ECOPLUSS 20 MTR',              sku: 'EEP-20M',      stock: 83  },
  { name: 'EKVEE ECOPLUSS 25 MTR',              sku: 'EEP-25M',      stock: 82  },
  { name: 'EKVEE EKOPLUSS 1 KG ROLL IN BOX',    sku: 'EEP-1KG-BOX',  stock: 4   },
  { name: 'EKVEE ECOPLUSS 11X11 1 KG SHEETS',   sku: 'EEP-1K-1111',  stock: 16  },
  { name: 'EKVEE ECOPLUSS 11X15 1 KG SHEETS',   sku: 'EEP-1K-1115',  stock: 24  },
  { name: 'EKVEE ECOPLUSS 1/2 KG (400 100)',     sku: 'EEP-HKG',      stock: 47  },
  { name: 'EKVEE ECOPLUSS 1 KG ROLL (900 100)',  sku: 'EEP-1KG-R',    stock: 100 },
  { name: 'EKVEE AEROFOIL 25 MTR ROLL',         sku: 'EAF-25M',      stock: 165 },
  { name: 'EKVEE AEROFOIL 10 MTR ROLL',         sku: 'EAF-10M',      stock: 60  },
  { name: 'EKVEE FOODBAKE 10 MTR ROLL',         sku: 'EFB-10M',      stock: 33  },
  { name: 'EKVEE EKO PRIME 1 KG ROLL',          sku: 'EKP-1KG-R',    stock: 35  },
  { name: 'EKVEE EKO PRIME 1/2 KG ROLL',        sku: 'EKP-HKG-R',    stock: 54  },
  { name: 'EKVEE EKO PRIME 1 KG ROLL IN BOX',   sku: 'EKP-1KG-BOX',  stock: 35  },
  { name: 'EKVEE EKO PRIME 1/2 KG ROLL IN BOX', sku: 'EKP-HKG-BOX',  stock: 17  },
];

export async function POST() {
  try {
    const results: { sku: string; name: string; action: string; stock: number }[] = [];

    for (const p of PRODUCTS) {
      const existing = await query<{ id: number; master_stock: number }>(
        'SELECT id, master_stock FROM products WHERE sku = $1', [p.sku]
      );

      let productId: number;
      let action: string;

      if (existing.length > 0) {
        // Product exists — just update stock and note
        productId = existing[0].id;
        action = 'updated';
        await query(
          `UPDATE products SET master_stock = $1, updated_at = NOW() WHERE id = $2`,
          [p.stock, productId]
        );
      } else {
        // Insert new product
        const [inserted] = await query<{ id: number }>(
          `INSERT INTO products (name, sku, category, unit, low_stock_threshold, master_stock)
           VALUES ($1, $2, $3, 'pcs', 10, $4) RETURNING id`,
          [p.name, p.sku, CATEGORY, p.stock]
        );
        productId = inserted.id;
        action = 'inserted';
      }

      // Insert May opening-stock transaction (idempotent — skip if already exists)
      const txnCheck = await query(
        `SELECT id FROM stock_transactions
         WHERE product_id = $1 AND transaction_date = $2 AND notes = 'Opening stock - May 2025'`,
        [productId, MAY_DATE]
      );

      if (txnCheck.length === 0) {
        await query(
          `INSERT INTO stock_transactions
             (product_id, platform_id, type, quantity, direction, transaction_date, notes, supplier)
           VALUES ($1, NULL, 'restock', $2, 1, $3, 'Opening stock - May 2025', 'Opening Balance')`,
          [productId, p.stock, MAY_DATE]
        );
      }

      results.push({ sku: p.sku, name: p.name, action, stock: p.stock });
    }

    const inserted = results.filter(r => r.action === 'inserted').length;
    const updated  = results.filter(r => r.action === 'updated').length;
    const totalStock = PRODUCTS.reduce((s, p) => s + p.stock, 0);

    return NextResponse.json({
      success: true,
      summary: { inserted, updated, total_products: PRODUCTS.length, total_stock: totalStock },
      products: results,
    });
  } catch (error) {
    console.error('[seed]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
