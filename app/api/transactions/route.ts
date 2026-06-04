export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const DIRECTION: Record<string, number> = {
  restock: 1, sale: -1, return: 1, gift: -1, offline_sale: -1, adjustment: 1,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const platformId = searchParams.get('platform_id');
    const productId = searchParams.get('product_id');
    const type = searchParams.get('type');

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (start)      { conditions.push(`t.transaction_date >= $${idx++}`); values.push(start); }
    if (end)        { conditions.push(`t.transaction_date <= $${idx++}`); values.push(end); }
    if (platformId) { conditions.push(`t.platform_id = $${idx++}`); values.push(parseInt(platformId)); }
    if (productId)  { conditions.push(`t.product_id = $${idx++}`); values.push(parseInt(productId)); }
    if (type)       { conditions.push(`t.type = $${idx++}`); values.push(type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `SELECT t.*,
              p.name AS product_name, p.sku AS product_sku,
              pl.name AS platform_name, pl.color AS platform_color, pl.type AS platform_type
       FROM stock_transactions t
       JOIN products p ON t.product_id = p.id
       LEFT JOIN platforms pl ON t.platform_id = pl.id
       ${where}
       ORDER BY t.transaction_date DESC, t.created_at DESC`,
      values
    );
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, platform_id, type, quantity, transaction_date, notes, supplier, cost_per_unit, adjustment_direction } = body;

    if (!product_id || !type || !quantity) {
      return NextResponse.json({ error: 'product_id, type, quantity required' }, { status: 400 });
    }

    const direction = type === 'adjustment'
      ? (adjustment_direction === 'deduct' ? -1 : 1)
      : DIRECTION[type];
    if (direction === undefined) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    const absQty = Math.abs(parseInt(quantity));
    const delta = direction * absQty;

    const [txn] = await query(
      `INSERT INTO stock_transactions
         (product_id, platform_id, type, quantity, direction, transaction_date, notes, supplier, cost_per_unit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [product_id, platform_id || null, type, absQty, direction,
       transaction_date || new Date().toISOString().split('T')[0],
       notes || null, supplier || null, cost_per_unit || null]
    );

    await query(
      `UPDATE products SET master_stock = master_stock + $1, updated_at = NOW() WHERE id = $2`,
      [delta, product_id]
    );

    return NextResponse.json(txn, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const rows = await query<{ product_id: number; quantity: number; direction: number }>(
      `SELECT product_id, quantity, direction FROM stock_transactions WHERE id=$1`, [id]
    );
    const txn = rows[0];
    if (txn) {
      await query(
        `UPDATE products SET master_stock = master_stock - $1, updated_at = NOW() WHERE id = $2`,
        [txn.direction * txn.quantity, txn.product_id]
      );
    }
    await query(`DELETE FROM stock_transactions WHERE id=$1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
