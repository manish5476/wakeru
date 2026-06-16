import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/common.types';
export interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    type: 'access' | 'refresh';
    iat?: number;
    exp?: number;
    iss?: string;
    sub?: string;
}
export declare class AuthMiddleware {
    /**
     * Verify JWT access token
     */
    static authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Optional authentication - doesn't fail if no token
     */
    static optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Role-based authorization
     */
    static authorize(...roles: string[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
    /**
     * Premium user check
     */
    static requirePremium(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Business account check
     */
    static requireBusiness(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=auth.middleware.d.ts.map