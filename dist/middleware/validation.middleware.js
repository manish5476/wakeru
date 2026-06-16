"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationMiddleware = void 0;
const AppError_1 = require("../shared/errors/AppError");
class ValidationMiddleware {
    static validate(schema) {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.body, {
                abortEarly: false,
                stripUnknown: true,
                allowUnknown: false
            });
            if (error) {
                const details = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }));
                throw new AppError_1.ValidationError('Validation failed', details);
            }
            req.body = value;
            next();
        };
    }
    static validateQuery(schema) {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.query, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                const details = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }));
                throw new AppError_1.ValidationError('Invalid query parameters', details);
            }
            req.query = value;
            next();
        };
    }
    static validateParams(schema) {
        return (req, res, next) => {
            const { error, value } = schema.validate(req.params, {
                abortEarly: false,
                stripUnknown: true
            });
            if (error) {
                const details = error.details.map(detail => ({
                    field: detail.path.join('.'),
                    message: detail.message
                }));
                throw new AppError_1.ValidationError('Invalid path parameters', details);
            }
            req.params = value;
            next();
        };
    }
}
exports.ValidationMiddleware = ValidationMiddleware;
//# sourceMappingURL=validation.middleware.js.map