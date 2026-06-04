export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, comparePassword, signToken, COOKIE_NAME } from '@/lib/auth';
import { SCHEMA_SQL } from '@/lib/schema';

async function ensureDbReady() {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'
     ) AS exists`
  );
  if (!rows[0]?.exists) {
    await query(SCHEMA_SQL);
    const hash = await hashPassword('admin123');
    await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
      ['Admin', 'admin@stockflow.com', hash, 'admin']
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    await ensureDbReady();

    const users = await query<{
      id: number; name: string; email: string;
      password_hash: string; role: string; is_active: boolean;
    }>('SELECT * FROM users WHERE email = $1 LIMIT 1', [email.toLowerCase().trim()]);

    const user = users[0];

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    if (!user.is_active) {
      return NextResponse.json({ error: 'Account deactivated. Contact your admin.' }, { status: 401 });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // signToken is now async (uses jose)
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'manager',
      name: user.name,
    });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('[login]', error);
    return NextResponse.json(
      { error: 'Login failed. Please check your database connection.' },
      { status: 500 }
    );
  }
}
