export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { SCHEMA_SQL } from '@/lib/schema';

export async function GET() {
  // Health-check: tell client whether DB is initialized
  try {
    const rows = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'users'
       ) AS exists`
    );
    return NextResponse.json({ initialized: rows[0].exists });
  } catch (error) {
    return NextResponse.json({ initialized: false, error: String(error) });
  }
}

export async function POST() {
  try {
    // Run schema (all CREATE IF NOT EXISTS — safe to re-run)
    await query(SCHEMA_SQL);

    // Create default admin only if no users exist
    const existing = await query('SELECT id FROM users LIMIT 1');
    let createdAdmin = false;
    if (existing.length === 0) {
      const hash = await hashPassword('admin123');
      await query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)`,
        ['Admin', 'admin@stockflow.com', hash, 'admin']
      );
      createdAdmin = true;
    }

    return NextResponse.json({
      success: true,
      createdAdmin,
      credentials: createdAdmin
        ? { email: 'admin@stockflow.com', password: 'admin123' }
        : null,
    });
  } catch (error) {
    console.error('[init] error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
