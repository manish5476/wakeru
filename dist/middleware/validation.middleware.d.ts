import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';
export declare class ValidationMiddleware {
    static validate(schema: ZodTypeAny): (req: Request, res: Response, next: NextFunction) => void;
    static validateQuery(schema: ZodTypeAny): (req: Request, res: Response, next: NextFunction) => void;
    static validateParams(schema: ZodTypeAny): (req: Request, res: Response, next: NextFunction) => void;
}
//# sourceMappingURL=validation.middleware.d.ts.map