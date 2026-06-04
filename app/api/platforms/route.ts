export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const platforms = await query(`SELECT * FROM platforms ORDER BY type, name ASC`);
    return NextResponse.json(platforms);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, color, type } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const [platform] = await query(
      `INSERT INTO platforms (name, color, type) VALUES ($1,$2,$3) RETURNING *`,
      [name, color || '#6366f1', type || 'online']
    );
    return NextResponse.json(platform, { status: 201 });
  } catch (error) {
    const msg = String(error);
    if (msg.includes('unique')) return NextResponse.json({ error: 'Platform already exists' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
