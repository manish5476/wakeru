import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
export declare class ValidationMiddleware {
    static validate(schema: z.ZodObject<any, any>): (req: Request, res: Response, next: NextFunction) => void;
    static validateQuery(schema: z.ZodObject<any, any>): (req: Request, res: Response, next: NextFunction) => void;
    static validateParams(schema: z.ZodObject<any, any>): (req: Request, res: Response, next: NextFunction) => void;
}
//# sourceMappingURL=validation.middleware.d.ts.map