"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationMiddleware = void 0;
const zod_1 = require("zod");
const AppError_1 = require("@shared/errors/AppError");
class ValidationMiddleware {
    static validate(schema) {
        return (req, res, next) => {
            try {
                schema.parse(req.body);
                next();
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
                    const errorMessages = error.issues.map((issue) => ({
                        message: `${issue.path.join('.')} is ${issue.message}`,
                    }));
                    next(new AppError_1.ValidationError('Invalid input', errorMessages));
                }
                else {
                    next(error);
                }
            }
        };
    }
    static validateQuery(schema) {
        return (req, res, next) => {
            try {
                schema.parse(req.query);
                next();
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
                    const errorMessages = error.issues.map((issue) => ({
                        message: `${issue.path.join('.')} is ${issue.message}`,
                    }));
                    next(new AppError_1.ValidationError('Invalid query parameters', errorMessages));
                }
                else {
                    next(error);
                }
            }
        };
    }
    static validateParams(schema) {
        return (req, res, next) => {
            try {
                schema.parse(req.params);
                next();
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
                    const errorMessages = error.issues.map((issue) => ({
                        message: `${issue.path.join('.')} is ${issue.message}`,
                    }));
                    next(new AppError_1.ValidationError('Invalid path parameters', errorMessages));
                }
                else {
                    next(error);
                }
            }
        };
    }
}
exports.ValidationMiddleware = ValidationMiddleware;
//# sourceMappingURL=validation.middleware.js.map