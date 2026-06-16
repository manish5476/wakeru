import { Request, Response, NextFunction } from 'express';
export declare class IdempotencyMiddleware {
    static checkIdempotency(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=idempotency.middleware.d.ts.map