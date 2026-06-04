export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Quick check that tables exist
    const check = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'products'
       ) AS exists`
    );
    if (!check[0]?.exists) {
      return NextResponse.json({ error: 'not_initialized' }, { status: 503 });
    }

    const [products] = await query<{ count: string }>('SELECT COUNT(*) as count FROM products');
    const [platforms] = await query<{ count: string }>('SELECT COUNT(*) as count FROM platforms WHERE is_active = true');

    const lowStock = await query<{ id: number; name: string; master_stock: number; low_stock_threshold: number }>(
      'SELECT id, name, master_stock, low_stock_threshold FROM products WHERE master_stock <= low_stock_threshold ORDER BY master_stock ASC LIMIT 10'
    );

    const [todayOut] = await query<{ total: string }>(
      `SELECT COALESCE(SUM(quantity),0) as total FROM stock_transactions WHERE direction=-1 AND transaction_date=CURRENT_DATE`
    );
    const [monthOut] = await query<{ total: string }>(
      `SELECT COALESCE(SUM(quantity),0) as total FROM stock_transactions WHERE direction=-1 AND DATE_TRUNC('month',transaction_date)=DATE_TRUNC('month',CURRENT_DATE)`
    );
    const [monthIn] = await query<{ total: string }>(
      `SELECT COALESCE(SUM(quantity),0) as total FROM stock_transactions WHERE direction=1 AND DATE_TRUNC('month',transaction_date)=DATE_TRUNC('month',CURRENT_DATE)`
    );

    const recentTxns = await query(
      `SELECT t.*, p.name as product_name, pl.name as platform_name, pl.color as platform_color
       FROM stock_transactions t
       JOIN products p ON t.product_id=p.id
       LEFT JOIN platforms pl ON t.platform_id=pl.id
       ORDER BY t.created_at DESC LIMIT 12`
    );

    const platformBreakdown = await query(
      `SELECT pl.name, pl.color, pl.type,
              COALESCE(SUM(CASE WHEN t.direction=-1 THEN t.quantity ELSE 0 END),0) as total_out,
              COALESCE(SUM(CASE WHEN t.type='return' THEN t.quantity ELSE 0 END),0) as total_return
       FROM platforms pl
       LEFT JOIN stock_transactions t ON t.platform_id=pl.id
         AND DATE_TRUNC('month',t.transaction_date)=DATE_TRUNC('month',CURRENT_DATE)
       WHERE pl.is_active=true
       GROUP BY pl.id, pl.name, pl.color, pl.type
       ORDER BY total_out DESC`
    );

    return NextResponse.json({
      total_products: parseInt(products.count),
      total_platforms: parseInt(platforms.count),
      low_stock_count: lowStock.length,
      today_out: parseInt(todayOut.total),
      month_out: parseInt(monthOut.total),
      month_in: parseInt(monthIn.total),
      low_stock_items: lowStock,
      recent_txns: recentTxns,
      platform_breakdown: platformBreakdown,
    });
  } catch (error) {
    console.error('[dashboard]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
