export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

const PRODUCT_ORDER: string[] = [
  'EFW-25M','EFW-12M','EFW-50S','EFW-100S','EFW-HKG','EFW-1K-1111','EFW-1K-1115',
  'EFW-90S-1111','EFW-HKG-BOX','EEW-25M','EEW-10M','EEW-1KG','EEW-HKG',
  'EEW-1K-1111','EEW-1K-1115','EEW-90S-1111','EEW-1KG-BOX','EEW-HKG-BOX',
  'EEP-20M','EEP-25M','EEP-1KG-BOX','EEP-1K-1111','EEP-1K-1115','EEP-HKG',
  'EEP-1KG-R','EAF-25M','EAF-10M','EFB-10M','EKP-1KG-R','EKP-HKG-R',
  'EKP-1KG-BOX','EKP-HKG-BOX',
];

function sortByProductOrder<T extends Record<string, unknown>>(rows: T[], skuKey = 'SKU'): T[] {
  const orderMap = new Map(PRODUCT_ORDER.map((sku, i) => [sku, i]));
  return [...rows].sort((a, b) => {
    const ia = orderMap.get(a[skuKey] as string) ?? 9999;
    const ib = orderMap.get(b[skuKey] as string) ?? 9999;
    return ia - ib;
  });
}

function styleSheet(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
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
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

function addTotalsRow(
  rows: Record<string, unknown>[],
  numericCols: string[],
  labelCol: string,
  labelValue = 'TOTAL'
): Record<string, unknown>[] {
  if (rows.length === 0) return rows;
  const totals: Record<string, unknown> = {};
  for (const key of Object.keys(rows[0])) {
    if (key === labelCol) totals[key] = labelValue;
    else if (numericCols.includes(key)) totals[key] = rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    else totals[key] = '';
  }
  return [...rows, totals];
}

// ── Complete Report Sheet ──────────────────────────────────────────────────────
//
// Column layout (single period — one flat set of columns, no month grouping):
//
//   Product | Prev Closing Stock | This Period Restock | Total Stock |
//   <Platform1> | <Platform2> | … | Gift | Offline Sale | Cancel | Return |
//   Closing Stock
//
// Logic:
//   Prev Closing Stock  = stock at end of day BEFORE startDate
//                         (computed by walking all transactions before startDate)
//   This Period Restock = all restock transactions within [startDate, endDate]
//   Total Stock         = Prev Closing Stock + This Period Restock
//   <PlatformX>         = platform sales within period (0 if none — ALL platforms shown)
//   Gift / Offline / Cancel / Return = within period
//   Closing Stock       = Total Stock − (all platform sales + Gift + Offline + Cancel) + Return
//
// If no date range selected → uses ALL transactions; Prev Closing = 0 (initial stock).
//
async function buildCompleteReportSheet(
  wb: XLSX.WorkBook,
  startDate: string | null,
  endDate: string | null
) {
  // 1. All products
  const products = await query(
    `SELECT id, sku, name, master_stock FROM products ORDER BY name`
  ) as { id: number; sku: string; name: string; master_stock: number }[];
  const sortedProducts = sortByProductOrder(products, 'sku');

  // 2. Online platforms only — exclude 'offline' and 'other' types (Gift, Offline Sale)
  //    because those already have their own dedicated columns in the report.
  const allPlatforms = await query(
    `SELECT id, name FROM platforms WHERE type = 'online' ORDER BY name`
  ) as { id: number; name: string }[];
  const allPlatformNames = allPlatforms.map(p => p.name);

  // 3. Compute "previous closing stock" per product
  //    = stock state just before startDate
  //    = walk all transactions strictly before startDate from the very beginning
  //
  //    We derive "initial stock" (before any transaction ever) as:
  //      master_stock − SUM(direction * quantity) over ALL transactions
  //    Then add back all transactions before startDate.

  const netAllRows = await query(
    `SELECT product_id, SUM(direction * quantity) AS net FROM stock_transactions GROUP BY product_id`
  ) as { product_id: number; net: number }[];
  const netAllMap: Record<number, number> = {};
  for (const r of netAllRows) netAllMap[r.product_id] = Number(r.net);

  // initial stock (before any transactions ever recorded)
  const initialStock: Record<number, number> = {};
  for (const p of products) {
    initialStock[p.id] = p.master_stock - (netAllMap[p.id] ?? 0);
  }

  // Net change of all transactions BEFORE startDate
  let prevNetRows: { product_id: number; net: number }[] = [];
  if (startDate) {
    prevNetRows = await query(
      `SELECT product_id, SUM(direction * quantity) AS net
       FROM stock_transactions
       WHERE transaction_date < $1
       GROUP BY product_id`,
      [startDate]
    ) as { product_id: number; net: number }[];
  }
  const prevNetMap: Record<number, number> = {};
  for (const r of prevNetRows) prevNetMap[r.product_id] = Number(r.net);

  // prevClosing per product
  const prevClosing: Record<number, number> = {};
  for (const p of products) {
    prevClosing[p.id] = initialStock[p.id] + (prevNetMap[p.id] ?? 0);
  }

  // 4. Transactions within [startDate, endDate]
  // Build a single reusable WHERE clause + values array for period filtering.
  // We use a helper that appends the type condition directly into SQL (not as a param)
  // so the $1/$2 placeholders always correspond to startDate/endDate only.
  const periodValues: unknown[] = [];
  let pidx = 1;
  const dateConds: string[] = [];
  if (startDate) { dateConds.push(`transaction_date >= $${pidx++}`); periodValues.push(startDate); }
  if (endDate)   { dateConds.push(`transaction_date <= $${pidx++}`); periodValues.push(endDate); }

  // Returns "WHERE <date conds> [AND <extra>]" or "WHERE <extra>" or ""
  const pw = (extra?: string): string => {
    const all = [...dateConds, ...(extra ? [extra] : [])];
    return all.length ? `WHERE ${all.join(' AND ')}` : '';
  };
  // Same but for queries that use table alias "t." on date columns
  const pwt = (extra?: string): string => {
    const tDateConds = dateConds.map(c => c.replace(/transaction_date/g, 't.transaction_date'));
    const all = [...tDateConds, ...(extra ? [extra] : [])];
    return all.length ? `WHERE ${all.join(' AND ')}` : '';
  };

  const restockData = await query(
    `SELECT product_id, COALESCE(SUM(quantity), 0) AS qty
     FROM stock_transactions
     ${pw("type = 'restock'")}
     GROUP BY product_id`,
    periodValues
  ) as { product_id: number; qty: number }[];
  const restockMap: Record<number, number> = {};
  for (const r of restockData) restockMap[r.product_id] = Number(r.qty);

  // Per-platform sales per product in period
  const salesData = await query(
    `SELECT t.product_id, pl.name AS platform_name, SUM(t.quantity) AS qty
     FROM stock_transactions t
     JOIN platforms pl ON t.platform_id = pl.id
     ${pwt("t.type = 'sale'")}
     GROUP BY t.product_id, pl.name`,
    periodValues
  ) as { product_id: number; platform_name: string; qty: number }[];
  // platSalesMap: platform_name → product_id → qty
  const platSalesMap: Record<string, Record<number, number>> = {};
  for (const r of salesData) {
    if (!platSalesMap[r.platform_name]) platSalesMap[r.platform_name] = {};
    platSalesMap[r.platform_name][r.product_id] = Number(r.qty);
  }

  // Gift, Offline Sale, Cancel, Return per product in period
  const miscData = await query(
    `SELECT product_id,
            COALESCE(SUM(CASE WHEN type='gift'         THEN quantity ELSE 0 END), 0) AS gift,
            COALESCE(SUM(CASE WHEN type='offline_sale' THEN quantity ELSE 0 END), 0) AS offline_sale,
            COALESCE(SUM(CASE WHEN type='adjustment' AND direction=-1 THEN quantity ELSE 0 END), 0) AS cancel,
            COALESCE(SUM(CASE WHEN type='return'       THEN quantity ELSE 0 END), 0) AS ret
     FROM stock_transactions
     ${pw()}
     GROUP BY product_id`,
    periodValues
  ) as { product_id: number; gift: number; offline_sale: number; cancel: number; ret: number }[];
  const miscMap: Record<number, { gift: number; offline_sale: number; cancel: number; ret: number }> = {};
  for (const r of miscData) {
    miscMap[r.product_id] = {
      gift: Number(r.gift), offline_sale: Number(r.offline_sale),
      cancel: Number(r.cancel), ret: Number(r.ret),
    };
  }

  // 5. Build worksheet
  const ws: XLSX.WorkSheet = {};
  const setCell = (r: number, c: number, v: unknown) => {
    ws[XLSX.utils.encode_cell({ r, c })] = {
      v: v as XLSX.CellObject['v'],
      t: (typeof v === 'number' ? 'n' : 's') as XLSX.CellObject['t'],
    };
  };

  // Period label for header
  const periodLabel = startDate && endDate
    ? `${startDate} to ${endDate}`
    : startDate ? `From ${startDate}`
    : endDate   ? `To ${endDate}`
    : 'All Time';

  // Headers — Row 0
  const headers = [
    'Product',
    'Prev Closing Stock',
    'This Period Restock',
    'Total Stock',
    ...allPlatformNames,
    'Gift',
    'Offline Sale',
    'Cancel',
    'Return',
    'Closing Stock',
  ];
  headers.forEach((h, c) => setCell(0, c, h));

  // Numeric columns for totals (all except Product)
  const numericColIndices = headers.slice(1).map((_, i) => i + 1);

  // Totals row — row 1 (fill after data)
  const totalsRowIdx = 1;
  const colTotals: Record<number, number> = {};
  const addT = (c: number, v: number) => { colTotals[c] = (colTotals[c] ?? 0) + v; };

  // Data rows start at row 2
  let dataRow = 2;

  for (const prod of sortedProducts) {
    const pc    = prevClosing[prod.id] ?? 0;
    const rst   = restockMap[prod.id]  ?? 0;
    const misc  = miscMap[prod.id]     ?? { gift: 0, offline_sale: 0, cancel: 0, ret: 0 };
    const total = pc + rst;

    const platSales: number[] = allPlatformNames.map(pn => platSalesMap[pn]?.[prod.id] ?? 0);
    const totalPlatSales = platSales.reduce((s, v) => s + v, 0);
    const totalOut = totalPlatSales + misc.gift + misc.offline_sale + misc.cancel;
    const closing = Math.max(0, total - totalOut + misc.ret);

    let c = 0;
    setCell(dataRow, c++, prod.name);
    setCell(dataRow, c, pc);   addT(c++, pc);
    setCell(dataRow, c, rst);  addT(c++, rst);
    setCell(dataRow, c, total);addT(c++, total);

    for (const qty of platSales) { setCell(dataRow, c, qty); addT(c++, qty); }

    setCell(dataRow, c, misc.gift);         addT(c++, misc.gift);
    setCell(dataRow, c, misc.offline_sale); addT(c++, misc.offline_sale);
    setCell(dataRow, c, misc.cancel);       addT(c++, misc.cancel);
    setCell(dataRow, c, misc.ret);          addT(c++, misc.ret);
    setCell(dataRow, c, closing);           addT(c++, closing);

    dataRow++;
  }

  // Fill totals row
  setCell(totalsRowIdx, 0, 'TOTAL');
  for (const [ci, total] of Object.entries(colTotals)) {
    setCell(totalsRowIdx, Number(ci), total);
  }

  // Worksheet range & column widths
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: dataRow - 1, c: headers.length - 1 },
  });
  ws['!cols'] = headers.map((h, i) => ({
    wch: i === 0 ? 36 : Math.max(h.length + 2, 14),
  }));
  ws['!freeze'] = { xSplit: 1, ySplit: 2 };

  XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
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

    // Shared date+platform+product filter for standard sheets
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (start)      { conditions.push(`t.transaction_date >= $${idx++}`); values.push(start); }
    if (end)        { conditions.push(`t.transaction_date <= $${idx++}`); values.push(end); }
    if (platformId) { conditions.push(`t.platform_id = $${idx++}`);       values.push(parseInt(platformId)); }
    if (productId)  { conditions.push(`t.product_id = $${idx++}`);        values.push(parseInt(productId)); }
    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    // ── Complete Report ───────────────────────────────────────────────────────
    if (type === 'all') {
      await buildCompleteReportSheet(wb, start, end);
    }

    // ── Current Stock ─────────────────────────────────────────────────────────
    if (type === 'all' || type === 'stock') {
      const rawRows = await query(
        `SELECT p.sku AS "SKU", p.name AS "Product", p.category AS "Category",
                p.unit AS "Unit", p.master_stock AS "Current Stock",
                p.low_stock_threshold AS "Low Stock Alert",
                CASE WHEN p.master_stock = 0 THEN 'Out of Stock'
                     WHEN p.master_stock <= p.low_stock_threshold THEN 'Low Stock'
                     ELSE 'OK' END AS "Status"
         FROM products p`
      ) as Record<string, unknown>[];
      const ws = styleSheet(XLSX.utils.json_to_sheet(
        addTotalsRow(sortByProductOrder(rawRows), ['Current Stock'], 'Product')
      ));
      XLSX.utils.book_append_sheet(wb, ws, 'Current Stock');
    }

    // ── All Transactions ──────────────────────────────────────────────────────
    if (type === 'all' || type === 'transactions') {
      const rawRows = await query(
        `SELECT t.transaction_date AS "Date",
                p.sku AS "SKU", p.name AS "Product",
                COALESCE(pl.name, '—') AS "Channel / Platform",
                t.type AS "Type",
                CASE WHEN t.direction = 1 THEN t.quantity ELSE 0 END AS "Stock In",
                CASE WHEN t.direction =-1 THEN t.quantity ELSE 0 END AS "Stock Out",
                t.notes AS "Notes", t.supplier AS "Supplier",
                t.cost_per_unit AS "Cost/Unit (₹)"
         FROM stock_transactions t
         JOIN products p ON t.product_id = p.id
         LEFT JOIN platforms pl ON t.platform_id = pl.id
         WHERE 1=1 ${where}
         ORDER BY t.transaction_date DESC, p.name ASC`, values
      ) as Record<string, unknown>[];
      XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.json_to_sheet(rawRows)), 'All Transactions');
    }

    // ── Platform Sales & Returns ──────────────────────────────────────────────
    if (type === 'all' || type === 'platform') {
      const rawRows = await query(
        `SELECT t.transaction_date AS "Date", pl.name AS "Platform",
                p.sku AS "SKU", p.name AS "Product",
                t.type AS "Type", t.quantity AS "Quantity", t.notes AS "Notes"
         FROM stock_transactions t
         JOIN products p ON t.product_id = p.id
         JOIN platforms pl ON t.platform_id = pl.id
         WHERE t.type IN ('sale','return') ${where}
         ORDER BY t.transaction_date DESC, pl.name ASC, p.name ASC`, values
      ) as Record<string, unknown>[];
      XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.json_to_sheet(rawRows)), 'Platform Sales & Returns');
    }

    // ── Monthly Summary ───────────────────────────────────────────────────────
    if (type === 'all' || type === 'monthly') {
      const prods = sortByProductOrder(
        await query(`SELECT id, sku, name FROM products`) as Record<string, unknown>[], 'sku'
      );
      const monthRows = await query(
        `SELECT DISTINCT TO_CHAR(t.transaction_date,'YYYY-MM') AS month
         FROM stock_transactions t WHERE 1=1 ${where} ORDER BY month DESC`, values
      ) as { month: string }[];
      const months = monthRows.map(r => r.month);
      if (months.length === 0) {
        XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.json_to_sheet([{ Note: 'No data for selected period' }])), 'Monthly Summary');
      } else {
        const txns = await query(
          `SELECT p.sku, TO_CHAR(t.transaction_date,'YYYY-MM') AS month, t.type, SUM(t.quantity) AS qty
           FROM stock_transactions t JOIN products p ON t.product_id = p.id
           WHERE 1=1 ${where} GROUP BY p.sku, TO_CHAR(t.transaction_date,'YYYY-MM'), t.type`, values
        ) as { sku: string; month: string; type: string; qty: number }[];
        const index: Record<string, Record<string, Record<string, number>>> = {};
        for (const t of txns) {
          if (!index[t.sku]) index[t.sku] = {};
          if (!index[t.sku][t.month]) index[t.sku][t.month] = {};
          index[t.sku][t.month][t.type] = Number(t.qty);
        }
        const sheetRows: Record<string, unknown>[] = [];
        for (const prod of prods) {
          const sku = prod.sku as string;
          const row: Record<string, unknown> = { SKU: sku, Product: prod.name };
          for (const mon of months) {
            const d = index[sku]?.[mon] || {};
            const lbl = new Date(mon + '-02').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            row[`${lbl} - Sales`]   = d['sale']         || 0;
            row[`${lbl} - Returns`] = d['return']       || 0;
            row[`${lbl} - Offline`] = d['offline_sale'] || 0;
            row[`${lbl} - Gifts`]   = d['gift']         || 0;
            row[`${lbl} - Restock`] = d['restock']      || 0;
          }
          sheetRows.push(row);
        }
        const numCols = Object.keys(sheetRows[0] || {}).filter(k => k !== 'SKU' && k !== 'Product');
        const totalRow: Record<string, unknown> = { SKU: '', Product: 'TOTAL' };
        for (const col of numCols) totalRow[col] = sheetRows.reduce((s, r) => s + (Number(r[col]) || 0), 0);
        sheetRows.push(totalRow);
        XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.json_to_sheet(sheetRows)), 'Monthly Summary');
      }
    }

    // ── Date-wise Summary ─────────────────────────────────────────────────────
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
         FROM stock_transactions t WHERE 1=1 ${where}
         GROUP BY t.transaction_date ORDER BY t.transaction_date DESC`, values
      ) as Record<string, unknown>[];
      XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.json_to_sheet(
        addTotalsRow(rawRows, ['Total In','Total Out','Platform Sales','Returns','Offline Sales','Gifts / Samples','Restocked','Adj (+)','Adj (-)'], 'Date', 'TOTAL')
      )), 'Date-wise Summary');
    }

    // ── Product Summary ───────────────────────────────────────────────────────
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
         LEFT JOIN stock_transactions t ON t.product_id = p.id AND (1=1 ${where.replace(/t\./g, 't.')})
         GROUP BY p.id, p.sku, p.name, p.master_stock`, values
      ) as Record<string, unknown>[];
      XLSX.utils.book_append_sheet(wb, styleSheet(XLSX.utils.json_to_sheet(
        addTotalsRow(sortByProductOrder(rawRows),
          ['Current Stock','Total Restocked','Platform Sales','Returns','Offline Sales','Gifts','Total Out'], 'Product')
      )), 'Product Summary');
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
