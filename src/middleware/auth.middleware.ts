import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../modules/auth/auth.model';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError';
import { AuthenticatedRequest } from '../shared/types/common.types';
import { config } from '../config';
import { redisClient } from '../config/redis';

// ============================================================
// JWT Payload Interface
// ============================================================

export interface JwtPayload {
  userId: string;
  role?: string;
  type: 'access' | 'refresh';
  tokenVersion?: number; // FIX 1: Token versioning for revocation
  iat?: number;
  exp?: number;
}

// ============================================================
// Token Blacklist Helpers (Redis-backed)
// ============================================================

/**
 * Blacklist a token on logout or password change.
 * TTL is set to the token's remaining lifetime so Redis
 * auto-cleans expired entries.
 *
 * Usage (in your AuthService logout / changePassword):
 *   await blacklistToken(token, decoded.exp);
 */
export const blacklistToken = async (
  token: string,
  expUnix?: number
): Promise<void> => {
  const ttlSeconds = expUnix
    ? Math.max(expUnix - Math.floor(Date.now() / 1000), 1)
    : 60 * 60; // fallback: 1 hour

  const key = `blacklist:${token}`;
  await redisClient.set(key, '1', ttlSeconds);
};

/**
 * Check whether a token has been blacklisted.
 */
const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const result = await redisClient.get(`blacklist:${token}`);
    return result !== null;
  } catch {
    // If Redis is unavailable, fail open cautiously — log & continue.
    // In high-security apps you may prefer to fail closed (throw).
    console.warn('[auth] Redis unavailable for blacklist check — proceeding');
    return false;
  }
};

// ============================================================
// protect — JWT Access Token Verification
// ============================================================

/**
 * Authentication middleware — verifies JWT access token.
 *
 * Improvements over original:
 *  1. Token blacklist check via Redis (handles logout / pwd change revocation)
 *  2. tokenVersion check against DB (handles forced global sign-out)
 *  3. JWT_SECRET sourced only from config — no inline fallback string
 *  4. Returns next(error) consistently; no implicit void/undefined returns
 */
export const protect = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // ── 1. Extract token from Authorization header ──────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Not authorized, no token provided'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new UnauthorizedError('Not authorized, no token provided'));
    }

    // ── 2. Check Redis blacklist (logout / password change revocation) ───────
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return next(
        new UnauthorizedError('Token has been revoked. Please login again.')
      );
    }

    // ── 3. Verify JWT signature & expiry ────────────────────────────────────
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      // NOTE: Remove the inline fallback secret ('tripsplit-secret-dev').
      // A missing JWT_SECRET should throw at config validation time, not silently
      // fall back to a weak secret in production.
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return next(
          new UnauthorizedError('Token has expired. Please login again.')
        );
      }
      return next(new UnauthorizedError('Invalid token. Please login again.'));
    }

    // ── 4. Validate token type ───────────────────────────────────────────────
    if (decoded.type !== 'access') {
      return next(
        new UnauthorizedError(
          'Invalid token type. Use access token for API requests.'
        )
      );
    }

    // ── 5. Fetch user + tokenVersion from DB ────────────────────────────────
    const userDoc = await User.findOne({
      _id: decoded.userId,
      isActive: true,
      isDeleted: false,
    })
      .select(
        'email role displayName photoURL isActive isDeleted tokenVersion'
      )
      .lean();

    if (!userDoc) {
      return next(
        new UnauthorizedError('User no longer exists or account is deactivated.')
      );
    }

    // ── 6. FIX 1 — tokenVersion check (forced global sign-out) ──────────────
    //
    // When you rotate tokenVersion on the user document (e.g. on password
    // change, suspicious activity, or admin force-logout), all previously
    // issued tokens for that user become invalid instantly — even if they
    // haven't expired yet and aren't individually blacklisted.
    //
    // To use: increment user.tokenVersion in your AuthService whenever you
    // want to invalidate ALL sessions for a user, and ensure your token
    // generation includes tokenVersion in the payload.
    if (
      decoded.tokenVersion !== undefined &&
      userDoc.tokenVersion !== undefined &&
      decoded.tokenVersion !== userDoc.tokenVersion
    ) {
      return next(
        new UnauthorizedError(
          'Session invalidated. Please login again.'
        )
      );
    }

    // ── 7. Attach user to request ────────────────────────────────────────────
    req.user = {
      userId: decoded.userId,
      email: userDoc.email,
      role: userDoc.role,
      displayName: userDoc.displayName || 'User',
      photoURL: userDoc.photoURL || '',
    };

    next();
  } catch (error) {
    return next(new UnauthorizedError('Not authorized, authentication failed'));
  }
};

// ============================================================
// authorize — Role-Based Access Control
// ============================================================

/**
 * Role-based authorization middleware.
 * Must be used AFTER protect middleware.
 *
 * Improvements over original:
 *  1. Distinguishes 401 (not authenticated) from 403 (authenticated but forbidden)
 *  2. Logs role mismatch clearly (userId + required roles vs actual role)
 *
 * Usage:
 *   router.post('/admin', protect, authorize('admin'), handler);
 *   router.post('/mod',   protect, authorize('admin', 'moderator'), handler);
 */
export const authorize = (...allowedRoles: string[]) => {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    // FIX 2 — 401 vs 403 distinction
    if (!req.user) {
      // protect wasn't called first — 401 Unauthorized
      return next(new UnauthorizedError('Not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      // User is authenticated but lacks permission — 403 Forbidden
      return next(
        new ForbiddenError(
          `Access denied. Required role(s): [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

// ============================================================
// Usage Guide (AuthService integration)
// ============================================================
//
// ── On LOGIN / token generation ─────────────────────────────
//
//   const payload: JwtPayload = {
//     userId: user._id.toString(),
//     role:   user.role,
//     type:   'access',
//     tokenVersion: user.tokenVersion,   // include this!
//   };
//   const accessToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '15m' });
//
// ── On LOGOUT ────────────────────────────────────────────────
//
//   const decoded = jwt.decode(accessToken) as JwtPayload;
//   await blacklistToken(accessToken, decoded?.exp);
//
// ── On PASSWORD CHANGE / force sign-out all devices ─────────
//
//   await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
//   // (optionally also blacklist the current token)
//
// ── User model: add tokenVersion field ──────────────────────
//
//   tokenVersion: { type: Number, default: 0 }
//
// ── app.ts: fix auth route rate limiter ─────────────────────
//
//   // BEFORE (wrong):
//   app.use('/api/v1/auth', authenticatedRateLimiter, authRoutes);
//
//   // AFTER (correct — use the strict brute-force limiter):
//   app.use('/api/v1/auth', strictRateLimiter, authRoutes);
// 
// 
// // import { Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';
// import { User } from '../modules/auth/auth.model';
// import { UnauthorizedError } from '../shared/errors/AppError';
// import { AuthenticatedRequest } from '../shared/types/common.types';
// import { config } from '../config';
// import { redisClient } from '../config/redis';

// export interface JwtPayload {
//   userId: string;
//   role?: string;
//   type: 'access' | 'refresh';
//   iat?: number;
//   exp?: number;
// }

// /**
//  * Authentication middleware — verifies JWT access token.
//  * Attaches user info to req.user on success.
//  * Uses Redis caching to reduce DB load on repeated requests.
//  */
// export const protect = async (
//   req: AuthenticatedRequest,
//   _res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     // 1. Extract token from Authorization header
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       return next(new UnauthorizedError('Not authorized, no token provided'));
//     }

//     const token = authHeader.split(' ')[1];
//     if (!token) {
//       return next(new UnauthorizedError('Not authorized, no token provided'));
//     }

//     // 2. Verify JWT
//     let decoded: JwtPayload;
//     try {
//       decoded = jwt.verify(
//         token,
//         config.JWT_SECRET || process.env.JWT_SECRET || 'tripsplit-secret-dev'
//       ) as JwtPayload;
//     } catch (error: any) {
//       if (error.name === 'TokenExpiredError') {
//         return next(new UnauthorizedError('Token has expired. Please login again.'));
//       }
//       return next(new UnauthorizedError('Invalid token. Please login again.'));
//     }

//     // 3. Validate token type
//     if (decoded.type !== 'access') {
//       return next(new UnauthorizedError('Invalid token type. Use access token for API requests.'));
//     }

//     // 4. Try Redis cache first for user data
//     const cacheKey = `user:${decoded.userId}`;
//     let userDoc = await redisClient.get(cacheKey)
//       .then(r => r ? JSON.parse(r) : null)
//       .catch(() => null); // Fail silently, fall back to DB

//     // 5. If not in cache, fetch from MongoDB
//     if (!userDoc) {
//       userDoc = await User.findOne({
//         _id: decoded.userId,
//         isActive: true,
//         isDeleted: false,
//       }).select('email role displayName photoURL isActive isDeleted').lean();

//       if (!userDoc) {
//         return next(new UnauthorizedError('User no longer exists or account is deactivated.'));
//       }

//       // Cache for remaining JWT lifetime or 5 minutes, whichever is shorter
//       const now = Math.floor(Date.now() / 1000);
//       const ttl = decoded.exp ? Math.max(decoded.exp - now, 0) : 300;
//       const cacheTtl = Math.min(ttl, 300); // Max 5 min cache

//       if (cacheTtl > 0) {
//         redisClient.set(cacheKey, JSON.stringify(userDoc), cacheTtl).catch(() => {});
//       }
//     }

//     // 6. Attach user to request
//     req.user = {
//       userId: decoded.userId,
//       email: userDoc.email,
//       role: userDoc.role,
//       displayName: userDoc.displayName || 'User',
//       photoURL: userDoc.photoURL || '',
//     };

//     next();
//   } catch (error) {
//     return next(new UnauthorizedError('Not authorized, authentication failed'));
//   }
// };

// /**
//  * Role-based authorization middleware.
//  * Must be used AFTER protect middleware.
//  * 
//  * Usage: router.post('/admin', protect, authorize('admin'), handler);
//  */
// export const authorize = (...allowedRoles: string[]) => {
//   return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
//     if (!req.user) {
//       return next(new UnauthorizedError('Not authenticated'));
//     }

//     if (!allowedRoles.includes(req.user.role)) {
//       return next(new UnauthorizedError('Insufficient permissions'));
//     }

//     next();
//   };
// };

// // import { Response, NextFunction } from 'express';
// // import jwt from 'jsonwebtoken';
// // import { User } from '../modules/auth/auth.model';
// // import { UnauthorizedError } from '../shared/errors/AppError';
// // import { AuthenticatedRequest } from '../shared/types/common.types';
// // import { config } from '../config';

// // export interface JwtPayload {
// //   userId: string;
// //   role?: string;
// //   type: 'access' | 'refresh';
// //   iat?: number;
// //   exp?: number;
// // }

// // /**
// //  * Authentication middleware — verifies JWT access token.
// //  * Attaches user info to req.user on success.
// //  */
// // export const protect = async (
// //   req: AuthenticatedRequest,
// //   _res: Response,
// //   next: NextFunction
// // ): Promise<void> => {
// //   try {
// //     // 1. Extract token from Authorization header
// //     const authHeader = req.headers.authorization;
// //     if (!authHeader || !authHeader.startsWith('Bearer ')) {
// //       return next(new UnauthorizedError('Not authorized, no token provided'));
// //     }

// //     const token = authHeader.split(' ')[1];
// //     if (!token) {
// //       return next(new UnauthorizedError('Not authorized, no token provided'));
// //     }

// //     // 2. Verify JWT
// //     let decoded: JwtPayload;
// //     try {
// //       decoded = jwt.verify(
// //         token,
// //         config.JWT_SECRET || process.env.JWT_SECRET || 'tripsplit-secret-dev'
// //       ) as JwtPayload;
// //     } catch (error: any) {
// //       if (error.name === 'TokenExpiredError') {
// //         return next(new UnauthorizedError('Token has expired. Please login again.'));
// //       }
// //       return next(new UnauthorizedError('Invalid token. Please login again.'));
// //     }

// //     // 3. Validate token type
// //     if (decoded.type !== 'access') {
// //       return next(new UnauthorizedError('Invalid token type. Use access token for API requests.'));
// //     }

// //     // 4. Find user by the userId from token (matches _id since we use UUID strings)
// //     const userDoc = await User.findOne({
// //       _id: decoded.userId,
// //       isActive: true,
// //       isDeleted: false,
// //     }).select('email role displayName photoURL isActive isDeleted').lean();

// //     if (!userDoc) {
// //       return next(new UnauthorizedError('User no longer exists or account is deactivated.'));
// //     }

// //     // 5. Attach user to request
// //     req.user = {
// //       userId: decoded.userId,
// //       email: userDoc.email,
// //       role: userDoc.role,
// //       displayName: userDoc.displayName || 'User',
// //       photoURL: userDoc.photoURL || '',
// //     };

// //     next();
// //   } catch (error) {
// //     return next(new UnauthorizedError('Not authorized, authentication failed'));
// //   }
// // };

// // /**
// //  * Role-based authorization middleware.
// //  * Must be used AFTER protect middleware.
// //  * 
// //  * Usage: router.post('/admin', protect, authorize('admin'), handler);
// //  */
// // export const authorize = (...allowedRoles: string[]) => {
// //   return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
// //     if (!req.user) {
// //       return next(new UnauthorizedError('Not authenticated'));
// //     }

// //     if (!allowedRoles.includes(req.user.role)) {
// //       return next(new UnauthorizedError('Insufficient permissions'));
// //     }

// //     next();
// //   };
// // };