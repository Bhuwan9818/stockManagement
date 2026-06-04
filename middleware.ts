import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'sf_token';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',   // login page calls this to check if already authed
  '/api/init',
];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'stockflow-dev-secret-do-not-use-in-production';
  return new TextEncoder().encode(secret);
}

async function getPayload(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { userId: number; email: string; role: string; name: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt'
  ) {
    return NextResponse.next();
  }

  // Always allow public paths (exact match or prefix)
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Get and verify token
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await getPayload(token) : null;

  if (!payload) {
    // Unauthenticated — API returns 401, pages redirect to /login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is logged in and tries to visit /login, redirect to dashboard
  if (pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Admin-only: /api/users and /users page
  if (pathname.startsWith('/api/users') && payload.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  if (pathname.startsWith('/users') && payload.role !== 'admin') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Forward user info to API routes via request headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', String(payload.userId));
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-name', payload.name);
  requestHeaders.set('x-user-email', payload.email);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
