export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

// GET all users (admin only - enforced by middleware)
export async function GET() {
  try {
    const users = await query(
      `SELECT id, name, email, role, is_active, created_at, last_login
       FROM users ORDER BY created_at DESC`
    );
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST create user (admin only)
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password required' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const hash = await hashPassword(password);
    const [user] = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email.toLowerCase().trim(), hash, role || 'manager']
    );

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const msg = String(error);
    if (msg.includes('unique')) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
