export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, sku, category, unit, low_stock_threshold, master_stock } = await req.json();
    const product = await queryOne(
      `UPDATE products SET name=$1,sku=$2,category=$3,unit=$4,low_stock_threshold=$5,master_stock=$6,updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, sku, category, unit, low_stock_threshold, master_stock ?? 0, id]
    );
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query('DELETE FROM products WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
