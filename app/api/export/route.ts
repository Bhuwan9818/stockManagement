export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

// Fixed product display order matching the official product list
const PRODUCT_ORDER: string[] = [
  'EFW-25M',
  'EFW-12M',
  'EFW-50S',
  'EFW-100S',
  'EFW-HKG',
  'EFW-1K-1111',
  'EFW-1K-1115',
  'EFW-90S-1111',
  'EFW-HKG-BOX',
  'EEW-25M',
  'EEW-10M',
  'EEW-1KG',
  'EEW-HKG',
  'EEW-1K-1111',
  'EEW-1K-1115',
  'EEW-90S-1111',
  'EEW-1KG-BOX',
  'EEW-HKG-BOX',
  'EEP-20M',
  'EEP-25M',
  'EEP-1KG-BOX',
  'EEP-1K-1111',
  'EEP-1K-1115',
  'EEP-HKG',
  'EEP-1KG-R',
  'EAF-25M',
  'EAF-10M',
  'EFB-10M',
  'EKP-1KG-R',
  'EKP-HKG-R',
  'EKP-1KG-BOX',
  'EKP-HKG-BOX',
];

// Sort any row array by SKU using the fixed order above.
// Rows without a matching SKU go to the end (preserving relative order).
function sortByProductOrder<T extends Record<string, unknown>>(
  rows: T[],
  skuKey = 'SKU'
): T[] {
  const orderMap = new Map(PRODUCT_ORDER.map((sku, i) => [sku, i]));
  return [...rows].sort((a, b) => {
    const ia = orderMap.get(a[skuKey] as string) ?? 9999;
    const ib = orderMap.get(b[skuKey] as string) ?? 9999;
    return ia - ib;
  });
}

// Apply column widths and basic styling to a worksheet
function styleSheet(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const colCount = range.e.c + 1;

  // Auto-size columns (min 12, max 40)
  const colWidths: { wch: number }[] = [];
  for (let c = 0; c <= range.e.c; c++) {
    let maxLen = 10;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    colWidths.push({ wch: Math.min(Math.max(maxLen + 2, 12), 45) });
  }
  ws['!cols'] = colWidths;

  // Freeze first row (header)
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  return ws;
}

// Add a totals row for numeric columns
function addTotalsRow(
  rows: Record<string, unknown>[],
  numericCols: string[],
  labelCol: string,
  labelValue = 'TOTAL'
): Record<string, unknown>[] {
  if (rows.length === 0) return rows;
  const totals: Record<string, unknown> = {};
  const firstRow = rows[0];
  for (const key of Object.keys(firstRow)) {
    if (key === labelCol) totals[key] = labelValue;
    else if (numericCols.includes(key)) {
      totals[key] = rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    } else {
      totals[key] = '';
    }
  }
  return [...rows, totals];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type       = searchParams.get('type') || 'all';
    const start      = searchParams.get('start');
    const end        = searchParams.get('end');
    const platformId = searchParams.get('platform_id');
    const productId  = searchParams.get('product_id');

    const wb = XLSX.utils.book_new();

    // Base filters
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (start)      { conditions.push(`t.transaction_date >= $${idx++}`); values.push(start); }
    if (end)        { conditions.push(`t.transaction_date <= $${idx++}`); values.push(end); }
    if (platformId) { conditions.push(`t.platform_id = $${idx++}`);       values.push(parseInt(platformId)); }
    if (productId)  { conditions.push(`t.product_id = $${idx++}`);        values.push(parseInt(productId)); }
    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    // ── Sheet 1: Current Stock ─────────────────────────────────────────────
    if (type === 'all' || type === 'stock') {
      const rawRows = await query(
        `SELECT p.sku AS "SKU", p.name AS "Product", p.category AS "Category",
                p.unit AS "Unit", p.master_stock AS "Current Stock",
                p.low_stock_threshold AS "Low Stock Alert",
                CASE WHEN p.master_stock = 0         THEN 'Out of Stock'
                     WHEN p.master_stock <= p.low_stock_threshold THEN 'Low Stock'
                     ELSE 'OK' END AS "Status"
         FROM products p`
      ) as Record<string, unknown>[];

      const sorted = sortByProductOrder(rawRows);
      const withTotal = addTotalsRow(sorted, ['Current Stock'], 'Product');
      const ws = styleSheet(XLSX.utils.json_to_sheet(withTotal));
      XLSX.utils.book_append_sheet(wb, ws, 'Current Stock');
    }

    // ── Sheet 2: All Transactions ──────────────────────────────────────────
    if (type === 'all' || type === 'transactions') {
      const rawRows = await query(
        `SELECT t.transaction_date AS "Date",
                p.sku  AS "SKU", p.name AS "Product",
                COALESCE(pl.name, '—') AS "Channel / Platform",
                t.type AS "Type",
                CASE WHEN t.direction = 1 THEN t.quantity ELSE 0 END AS "Stock In",
                CASE WHEN t.direction =-1 THEN t.quantity ELSE 0 END AS "Stock Out",
                t.notes AS "Notes", t.supplier AS "Supplier",
                t.cost_per_unit AS "Cost/Unit (₹)"
         FROM stock_transactions t
         JOIN products p  ON t.product_id  = p.id
         LEFT JOIN platforms pl ON t.platform_id = pl.id
         WHERE 1=1 ${where}
         ORDER BY t.transaction_date DESC, p.name ASC`, values
      ) as Record<string, unknown>[];

      const ws = styleSheet(XLSX.utils.json_to_sheet(rawRows));
      XLSX.utils.book_append_sheet(wb, ws, 'All Transactions');
    }

    // ── Sheet 3: Platform Sales & Returns ─────────────────────────────────
    if (type === 'all' || type === 'platform') {
      const rawRows = await query(
        `SELECT t.transaction_date AS "Date",
                pl.name AS "Platform",
                p.sku   AS "SKU", p.name AS "Product",
                t.type  AS "Type",
                t.quantity AS "Quantity",
                t.notes AS "Notes"
         FROM stock_transactions t
         JOIN products  p  ON t.product_id  = p.id
         JOIN platforms pl ON t.platform_id = pl.id
         WHERE t.type IN ('sale','return') ${where}
         ORDER BY t.transaction_date DESC, pl.name ASC, p.name ASC`, values
      ) as Record<string, unknown>[];

      const ws = styleSheet(XLSX.utils.json_to_sheet(rawRows));
      XLSX.utils.book_append_sheet(wb, ws, 'Platform Sales & Returns');
    }

    // ── Sheet 4: Monthly Summary (product-order rows) ──────────────────────
    if (type === 'all' || type === 'monthly') {
      // Fetch all products in fixed order
      const products = await query(
        `SELECT id, sku, name FROM products`
      ) as Record<string, unknown>[];
      const sortedProducts = sortByProductOrder(products, 'sku');

      // Fetch months present in data
      const monthRows = await query(
        `SELECT DISTINCT TO_CHAR(t.transaction_date,'YYYY-MM') AS month
         FROM stock_transactions t WHERE 1=1 ${where}
         ORDER BY month DESC`, values
      ) as Record<string, unknown>[];
      const months = monthRows.map(r => r.month as string);

      if (months.length === 0) {
        const ws = styleSheet(XLSX.utils.json_to_sheet([{ Note: 'No data for selected period' }]));
        XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary');
      } else {
        // For each product row, compute sales/returns/restock per month
        const txns = await query(
          `SELECT p.sku, TO_CHAR(t.transaction_date,'YYYY-MM') AS month,
                  t.type, SUM(t.quantity) AS qty
           FROM stock_transactions t
           JOIN products p ON t.product_id = p.id
           WHERE 1=1 ${where}
           GROUP BY p.sku, TO_CHAR(t.transaction_date,'YYYY-MM'), t.type`, values
        ) as { sku: string; month: string; type: string; qty: number }[];

        // Index txns: sku → month → type → qty
        const index: Record<string, Record<string, Record<string, number>>> = {};
        for (const t of txns) {
          if (!index[t.sku]) index[t.sku] = {};
          if (!index[t.sku][t.month]) index[t.sku][t.month] = {};
          index[t.sku][t.month][t.type] = Number(t.qty);
        }

        const sheetRows: Record<string, unknown>[] = [];
        for (const prod of sortedProducts) {
          const sku = prod.sku as string;
          const row: Record<string, unknown> = {
            'SKU': sku,
            'Product': prod.name,
          };
          for (const month of months) {
            const d = index[sku]?.[month] || {};
            const label = new Date(month + '-02').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            row[`${label} - Sales`]    = d['sale']         || 0;
            row[`${label} - Returns`]  = d['return']       || 0;
            row[`${label} - Offline`]  = d['offline_sale'] || 0;
            row[`${label} - Gifts`]    = d['gift']         || 0;
            row[`${label} - Restock`]  = d['restock']      || 0;
          }
          sheetRows.push(row);
        }

        // Totals row
        const totalRow: Record<string, unknown> = { 'SKU': '', 'Product': 'TOTAL' };
        const numCols = Object.keys(sheetRows[0] || {}).filter(k => k !== 'SKU' && k !== 'Product');
        for (const col of numCols) {
          totalRow[col] = sheetRows.reduce((s, r) => s + (Number(r[col]) || 0), 0);
        }
        sheetRows.push(totalRow);

        const ws = styleSheet(XLSX.utils.json_to_sheet(sheetRows));
        XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary');
      }
    }

    // ── Sheet 5: Date-wise Summary ─────────────────────────────────────────
    if (type === 'all' || type === 'datewise') {
      const rawRows = await query(
        `SELECT t.transaction_date AS "Date",
                SUM(CASE WHEN t.direction = 1           THEN t.quantity ELSE 0 END) AS "Total In",
                SUM(CASE WHEN t.direction =-1           THEN t.quantity ELSE 0 END) AS "Total Out",
                SUM(CASE WHEN t.type='sale'             THEN t.quantity ELSE 0 END) AS "Platform Sales",
                SUM(CASE WHEN t.type='return'           THEN t.quantity ELSE 0 END) AS "Returns",
                SUM(CASE WHEN t.type='offline_sale'     THEN t.quantity ELSE 0 END) AS "Offline Sales",
                SUM(CASE WHEN t.type='gift'             THEN t.quantity ELSE 0 END) AS "Gifts / Samples",
                SUM(CASE WHEN t.type='restock'          THEN t.quantity ELSE 0 END) AS "Restocked",
                SUM(CASE WHEN t.type='adjustment' AND t.direction= 1 THEN t.quantity ELSE 0 END) AS "Adj (+)",
                SUM(CASE WHEN t.type='adjustment' AND t.direction=-1 THEN t.quantity ELSE 0 END) AS "Adj (-)"
         FROM stock_transactions t
         WHERE 1=1 ${where}
         GROUP BY t.transaction_date
         ORDER BY t.transaction_date DESC`, values
      ) as Record<string, unknown>[];

      const withTotal = addTotalsRow(rawRows,
        ['Total In','Total Out','Platform Sales','Returns','Offline Sales','Gifts / Samples','Restocked','Adj (+)','Adj (-)'],
        'Date', 'TOTAL'
      );
      const ws = styleSheet(XLSX.utils.json_to_sheet(withTotal));
      XLSX.utils.book_append_sheet(wb, ws, 'Date-wise Summary');
    }

    // ── Sheet 6: Product-wise Summary ─────────────────────────────────────
    if (type === 'all' || type === 'product') {
      const rawRows = await query(
        `SELECT p.sku AS "SKU", p.name AS "Product",
                p.master_stock AS "Current Stock",
                COALESCE(SUM(CASE WHEN t.type='restock'      THEN t.quantity END), 0) AS "Total Restocked",
                COALESCE(SUM(CASE WHEN t.type='sale'         THEN t.quantity END), 0) AS "Platform Sales",
                COALESCE(SUM(CASE WHEN t.type='return'       THEN t.quantity END), 0) AS "Returns",
                COALESCE(SUM(CASE WHEN t.type='offline_sale' THEN t.quantity END), 0) AS "Offline Sales",
                COALESCE(SUM(CASE WHEN t.type='gift'         THEN t.quantity END), 0) AS "Gifts",
                COALESCE(SUM(CASE WHEN t.direction=-1        THEN t.quantity END), 0) AS "Total Out"
         FROM products p
         LEFT JOIN stock_transactions t ON t.product_id = p.id
           AND (1=1 ${where.replace(/t\./g, 't.')})
         GROUP BY p.id, p.sku, p.name, p.master_stock`, values
      ) as Record<string, unknown>[];

      const sorted = sortByProductOrder(rawRows);
      const withTotal = addTotalsRow(sorted,
        ['Current Stock','Total Restocked','Platform Sales','Returns','Offline Sales','Gifts','Total Out'],
        'Product'
      );
      const ws = styleSheet(XLSX.utils.json_to_sheet(withTotal));
      XLSX.utils.book_append_sheet(wb, ws, 'Product Summary');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const dateStr = new Date().toISOString().split('T')[0];
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stockflow-${type}-${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[export]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
