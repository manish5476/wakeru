import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export interface JwtPayload {
    userId: string;
    role?: string;
    type: 'access' | 'refresh';
    iat?: number;
    exp?: number;
    iss?: string;
}
export declare class AuthMiddleware {
    /**
     * Authenticate request using Bearer JWT access token.
     * Attaches user info to req.user on success.
     */
    static authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void>;
    /**
     * Role-based authorization guard.
     * Use after authenticate middleware.
     */
    static authorize(...allowedRoles: string[]): (req: AuthenticatedRequest, _res: Response, next: NextFunction) => void;
    /**
     * Optional authentication — attaches user if token present, continues if not.
     * Useful for public endpoints that behave differently for logged-in users.
     */
    static optional(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void>;
}
export declare const protect: typeof AuthMiddleware.authenticate;
export declare const authorize: typeof AuthMiddleware.authorize;
export declare const optionalAuth: typeof AuthMiddleware.optional;
//# sourceMappingURL=auth.middleware.d.ts.map