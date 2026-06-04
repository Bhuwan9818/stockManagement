export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { hashPassword, verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, email, password, role, is_active } = await req.json();

    const token = req.cookies.get(COOKIE_NAME)?.value;
    const me = token ? await verifyToken(token) : null;
    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    let user;
    if (password) {
      const hash = await hashPassword(password);
      user = await queryOne(
        `UPDATE users SET name=$1, email=$2, password_hash=$3, role=$4, is_active=$5
         WHERE id=$6 RETURNING id, name, email, role, is_active`,
        [name, email.toLowerCase().trim(), hash, role, is_active, id]
      );
    } else {
      user = await queryOne(
        `UPDATE users SET name=$1, email=$2, role=$3, is_active=$4
         WHERE id=$5 RETURNING id, name, email, role, is_active`,
        [name, email.toLowerCase().trim(), role, is_active, id]
      );
    }

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const me = token ? await verifyToken(token) : null;
    if (me?.userId === parseInt(id)) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }
    await query('DELETE FROM users WHERE id=$1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
