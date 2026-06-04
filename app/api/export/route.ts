export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const platformId = searchParams.get('platform_id');
    const productId = searchParams.get('product_id');

    const wb = XLSX.utils.book_new();

    // Build base filter
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (start)      { conditions.push(`t.transaction_date >= $${idx++}`); values.push(start); }
    if (end)        { conditions.push(`t.transaction_date <= $${idx++}`); values.push(end); }
    if (platformId) { conditions.push(`t.platform_id = $${idx++}`); values.push(parseInt(platformId)); }
    if (productId)  { conditions.push(`t.product_id = $${idx++}`); values.push(parseInt(productId)); }
    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    // 1. All Transactions
    if (type === 'all' || type === 'transactions') {
      const rows = await query(
        `SELECT t.transaction_date as "Date", p.name as "Product", p.sku as "SKU",
                COALESCE(pl.name,'-') as "Platform/Channel",
                t.type as "Type",
                CASE WHEN t.direction=1 THEN t.quantity ELSE 0 END as "Stock In",
                CASE WHEN t.direction=-1 THEN t.quantity ELSE 0 END as "Stock Out",
                t.notes as "Notes", t.supplier as "Supplier", t.cost_per_unit as "Cost/Unit"
         FROM stock_transactions t
         JOIN products p ON t.product_id=p.id
         LEFT JOIN platforms pl ON t.platform_id=pl.id
         WHERE 1=1 ${where}
         ORDER BY t.transaction_date DESC, t.created_at DESC`, values
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'All Transactions');
    }

    // 2. Current Stock
    if (type === 'all' || type === 'stock') {
      const rows = await query(
        `SELECT p.name as "Product", p.sku as "SKU", p.category as "Category",
                p.unit as "Unit", p.master_stock as "Current Stock",
                p.low_stock_threshold as "Low Stock Alert",
                CASE WHEN p.master_stock=0 THEN 'Out of Stock'
                     WHEN p.master_stock<=p.low_stock_threshold THEN 'Low Stock'
                     ELSE 'OK' END as "Status"
         FROM products p ORDER BY p.name`
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Current Stock');
    }

    // 3. Platform-wise Sales
    if (type === 'all' || type === 'platform') {
      const rows = await query(
        `SELECT t.transaction_date as "Date", pl.name as "Platform",
                p.name as "Product", p.sku as "SKU", t.type as "Type", t.quantity as "Quantity", t.notes as "Notes"
         FROM stock_transactions t
         JOIN products p ON t.product_id=p.id
         JOIN platforms pl ON t.platform_id=pl.id
         WHERE t.type IN ('sale','return') ${where.replace('AND t.', 'AND t.')}
         ORDER BY pl.name, t.transaction_date DESC`, values
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Platform Sales & Returns');
    }

    // 4. Monthly Summary
    if (type === 'all' || type === 'monthly') {
      const rows = await query(
        `SELECT TO_CHAR(t.transaction_date,'YYYY-MM') as "Month",
                p.name as "Product",
                COALESCE(pl.name,'—') as "Channel",
                t.type as "Type",
                SUM(t.quantity) as "Total Qty"
         FROM stock_transactions t
         JOIN products p ON t.product_id=p.id
         LEFT JOIN platforms pl ON t.platform_id=pl.id
         WHERE 1=1 ${where}
         GROUP BY TO_CHAR(t.transaction_date,'YYYY-MM'), p.name, pl.name, t.type
         ORDER BY "Month" DESC, "Total Qty" DESC`, values
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Monthly Summary');
    }

    // 5. Date-wise summary
    if (type === 'all' || type === 'datewise') {
      const rows = await query(
        `SELECT t.transaction_date as "Date",
                SUM(CASE WHEN t.direction=1 THEN t.quantity ELSE 0 END) as "Total Stock In",
                SUM(CASE WHEN t.direction=-1 THEN t.quantity ELSE 0 END) as "Total Stock Out",
                SUM(CASE WHEN t.type='sale' THEN t.quantity ELSE 0 END) as "Platform Sales",
                SUM(CASE WHEN t.type='return' THEN t.quantity ELSE 0 END) as "Returns",
                SUM(CASE WHEN t.type='offline_sale' THEN t.quantity ELSE 0 END) as "Offline Sales",
                SUM(CASE WHEN t.type='gift' THEN t.quantity ELSE 0 END) as "Gifts",
                SUM(CASE WHEN t.type='restock' THEN t.quantity ELSE 0 END) as "Restocked"
         FROM stock_transactions t
         WHERE 1=1 ${where}
         GROUP BY t.transaction_date
         ORDER BY t.transaction_date DESC`, values
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Date-wise Summary');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stockflow-${type}-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
