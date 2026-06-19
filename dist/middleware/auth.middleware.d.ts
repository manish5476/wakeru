import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../shared/types/common.types';
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
export declare const protect: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>;
/**
 * Role-based authorization middleware.
 * Must be used AFTER protect middleware.
 *
 * Usage: router.post('/admin', protect, authorize('admin'), handler);
 */
export declare const authorize: (...allowedRoles: string[]) => (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map