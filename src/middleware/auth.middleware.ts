import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../modules/auth/auth.model';
import { UnauthorizedError } from '../shared/errors/AppError';
import { AuthenticatedRequest } from '../shared/types/common.types';
import { config } from '../config';

export interface JwtPayload {
  userId: string;
  role?: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Authentication middleware — verifies JWT access token.
 * Attaches user info to req.user on success.
 */
export const protect = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Not authorized, no token provided'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new UnauthorizedError('Not authorized, no token provided'));
    }

    // 2. Verify JWT
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        token,
        config.JWT_SECRET || process.env.JWT_SECRET || 'tripsplit-secret-dev'
      ) as JwtPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return next(new UnauthorizedError('Token has expired. Please login again.'));
      }
      return next(new UnauthorizedError('Invalid token. Please login again.'));
    }

    // 3. Validate token type
    if (decoded.type !== 'access') {
      return next(new UnauthorizedError('Invalid token type. Use access token for API requests.'));
    }

    // 4. Find user by the userId from token (matches _id since we use UUID strings)
    const userDoc = await User.findOne({
      _id: decoded.userId,
      isActive: true,
      isDeleted: false,
    }).select('email role displayName photoURL isActive isDeleted').lean();

    if (!userDoc) {
      return next(new UnauthorizedError('User no longer exists or account is deactivated.'));
    }

    // 5. Attach user to request
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

/**
 * Role-based authorization middleware.
 * Must be used AFTER protect middleware.
 * 
 * Usage: router.post('/admin', protect, authorize('admin'), handler);
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }

    next();
  };
};