export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, color, type, is_active } = await req.json();
    const platform = await queryOne(
      `UPDATE platforms SET name=$1,color=$2,type=$3,is_active=$4 WHERE id=$5 RETURNING *`,
      [name, color, type, is_active, id]
    );
    if (!platform) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(platform);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await query('DELETE FROM platforms WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
