export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const products = await query(`SELECT * FROM products ORDER BY name ASC`);
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, sku, category, unit, low_stock_threshold, master_stock } = await req.json();
    if (!name || !sku) return NextResponse.json({ error: 'Name and SKU required' }, { status: 400 });

    const [product] = await query(
      `INSERT INTO products (name, sku, category, unit, low_stock_threshold, master_stock)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, sku, category || null, unit || 'pcs', low_stock_threshold || 10, master_stock || 0]
    );
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    const msg = String(error);
    if (msg.includes('unique')) return NextResponse.json({ error: 'SKU already exists' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
