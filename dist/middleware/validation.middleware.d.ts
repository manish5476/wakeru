import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare class ValidationMiddleware {
    static validate(schema: Joi.ObjectSchema): (req: Request, res: Response, next: NextFunction) => void;
    static validateQuery(schema: Joi.ObjectSchema): (req: Request, res: Response, next: NextFunction) => void;
    static validateParams(schema: Joi.ObjectSchema): (req: Request, res: Response, next: NextFunction) => void;
}
//# sourceMappingURL=validation.middleware.d.ts.map