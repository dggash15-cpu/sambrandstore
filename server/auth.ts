import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';
import type { AuthUser, PermissionKey } from '../src/types.ts';

const SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + ':sam-brand-store-dev-secret').digest('hex');

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

export function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { uid: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: string;
      exp: number;
    };
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function loadUserById(userId: string): Promise<AuthUser | null> {
  const row = (await db
    .prepare(
      `
      SELECT
        u.id, u.name, u.email, u.phone, u.role_id, u.custom_permissions,
        u.department_scope, u.status, u.last_login_at,
        r.name as role_name, r.slug as role_slug, r.permissions as role_permissions,
        r.max_discount_pct, r.max_refund_amount
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `
    )
    .get(userId)) as Record<string, unknown> | undefined;

  if (!row) return null;

  const rolePerms = JSON.parse(String(row.role_permissions || '[]')) as PermissionKey[];
  const customPerms = JSON.parse(String(row.custom_permissions || '[]')) as PermissionKey[];
  const merged = Array.from(new Set<PermissionKey>([...rolePerms, ...customPerms]));

  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: row.phone ? String(row.phone) : null,
    roleId: String(row.role_id),
    roleName: String(row.role_name),
    roleSlug: String(row.role_slug),
    permissions: merged,
    customPermissions: customPerms,
    departmentScope: String(row.department_scope || 'all'),
    maxDiscountPct: Number(row.max_discount_pct || 0),
    maxRefundAmount: Number(row.max_refund_amount || 0),
    status: row.status === 'suspended' ? 'suspended' : 'active',
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('sbs_session='));
    if (match) {
      return decodeURIComponent(match.slice('sbs_session='.length));
    }
  }
  return null;
}

export async function attachOptionalUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);
  if (token) {
    const verified = verifySessionToken(token);
    if (verified) {
      const user = await loadUserById(verified.uid);
      if (user && user.status === 'active') {
        req.authUser = user;
      }
    }
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  if (req.authUser.status !== 'active') {
    res.status(403).json({ error: 'Your account is currently suspended.' });
    return;
  }
  next();
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (req.authUser.status !== 'active') {
      res.status(403).json({ error: 'Account is suspended.' });
      return;
    }
    if (!req.authUser.permissions.includes(permission)) {
      res.status(403).json({
        error: `Access denied: missing '${permission}' permission for role '${req.authUser.roleName}'.`,
      });
      return;
    }
    next();
  };
}
