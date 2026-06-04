import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// bcryptjs is only used in API routes (Node.js runtime) - not in middleware
const JWT_EXPIRES = '7d';
export const COOKIE_NAME = 'sf_token';

export interface JWTPayload {
  userId: number;
  email: string;
  role: 'admin' | 'manager';
  name: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'stockflow-dev-secret-do-not-use-in-production';
  return new TextEncoder().encode(secret);
}

// Sign a JWT token (used in API routes - Node.js runtime)
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES)
    .sign(getSecret());
}

// Verify a JWT token (used in middleware - Edge runtime AND API routes)
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
