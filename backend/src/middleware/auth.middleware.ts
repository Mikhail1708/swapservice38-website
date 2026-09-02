import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { credentialVersion } from '../utils/credentialVersion';

const prisma = new PrismaClient();

type AuthFailure = 'missing' | 'invalid' | 'not_found' | 'blocked' | 'misconfigured';

const findUser = (id: string) => prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    address: true,
    role: true,
    isVerified: true,
    blockedAt: true,
    passwordHash: true,
  },
});

type AuthResult =
  | { authenticated: true; user: NonNullable<Awaited<ReturnType<typeof findUser>>> }
  | { authenticated: false; reason: AuthFailure };

const getToken = (req: Request): string | undefined => {
  const cookieToken = req.cookies?.token;
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;

  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string') return undefined;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
};

const authenticate = async (req: Request): Promise<AuthResult> => {
  const token = getToken(req);
  if (!token) return { authenticated: false, reason: 'missing' };

  const secret = process.env.JWT_SECRET;
  if (!secret) return { authenticated: false, reason: 'misconfigured' };

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    if (decoded.id === undefined || decoded.id === null) {
      return { authenticated: false, reason: 'invalid' };
    }

    const user = await findUser(String(decoded.id));
    if (!user) return { authenticated: false, reason: 'not_found' };
    if (user.blockedAt) return { authenticated: false, reason: 'blocked' };
    if (decoded.cv !== credentialVersion(user.passwordHash)) {
      return { authenticated: false, reason: 'invalid' };
    }

    return { authenticated: true, user };
  } catch {
    return { authenticated: false, reason: 'invalid' };
  }
};

/** Adds req.user when possible, but deliberately permits guests. */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const result = await authenticate(req);
  if (result.authenticated) (req as any).user = result.user;
  next();
};

/** Requires a valid, existing and non-blocked user session. */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const result = await authenticate(req);

  if (result.authenticated) {
    (req as any).user = result.user;
    return next();
  }

  if ('reason' in result && result.reason === 'misconfigured') {
    return res.status(500).json({ error: 'Authentication is not configured' });
  }
  if ('reason' in result && result.reason === 'blocked') {
    return res.status(403).json({ error: 'User account is blocked' });
  }
  return res.status(401).json({ error: 'Authentication required' });
};

// Backwards compatibility for routes that deliberately support guests.
export const authMiddleware = optionalAuth;
