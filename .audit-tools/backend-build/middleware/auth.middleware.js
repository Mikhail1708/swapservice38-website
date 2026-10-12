"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.requireAuth = exports.optionalAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const credentialVersion_1 = require("../utils/credentialVersion");
const prisma_1 = require("../config/prisma");
const findUser = (id) => prisma_1.prisma.user.findUnique({
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
const getToken = (req) => {
    const cookieToken = req.cookies?.token;
    if (typeof cookieToken === 'string' && cookieToken.length > 0)
        return cookieToken;
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string')
        return undefined;
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || undefined;
};
const authenticate = async (req) => {
    const token = getToken(req);
    if (!token)
        return { authenticated: false, reason: 'missing' };
    const secret = process.env.JWT_SECRET;
    if (!secret)
        return { authenticated: false, reason: 'misconfigured' };
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        if (decoded.id === undefined || decoded.id === null) {
            return { authenticated: false, reason: 'invalid' };
        }
        const user = await findUser(String(decoded.id));
        if (!user)
            return { authenticated: false, reason: 'not_found' };
        if (user.blockedAt)
            return { authenticated: false, reason: 'blocked' };
        if (decoded.cv !== (0, credentialVersion_1.credentialVersion)(user.passwordHash)) {
            return { authenticated: false, reason: 'invalid' };
        }
        return { authenticated: true, user };
    }
    catch {
        return { authenticated: false, reason: 'invalid' };
    }
};
/** Adds req.user when possible, but deliberately permits guests. */
const optionalAuth = async (req, _res, next) => {
    const result = await authenticate(req);
    if (result.authenticated)
        req.user = result.user;
    next();
};
exports.optionalAuth = optionalAuth;
/** Requires a valid, existing and non-blocked user session. */
const requireAuth = async (req, res, next) => {
    const result = await authenticate(req);
    if (result.authenticated) {
        req.user = result.user;
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
exports.requireAuth = requireAuth;
// Backwards compatibility for routes that deliberately support guests.
exports.authMiddleware = exports.optionalAuth;
//# sourceMappingURL=auth.middleware.js.map