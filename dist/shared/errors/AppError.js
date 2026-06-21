"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsufficientFundsError = exports.PaymentError = exports.ValidationError = exports.InternalServerError = exports.TooManyRequestsError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode, code, details, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code || 'INTERNAL_ERROR';
        this.details = details;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class BadRequestError extends AppError {
    constructor(message, code, details) {
        super(message, 400, code || 'BAD_REQUEST', details);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized access') {
        super(message, 401, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}
exports.ConflictError = ConflictError;
class TooManyRequestsError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'TOO_MANY_REQUESTS');
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
class InternalServerError extends AppError {
    constructor(message = 'Internal server error') {
        super(message, 500, 'INTERNAL_SERVER_ERROR', undefined, false);
    }
}
exports.InternalServerError = InternalServerError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 422, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class PaymentError extends AppError {
    constructor(message, details) {
        super(message, 402, 'PAYMENT_ERROR', details);
    }
}
exports.PaymentError = PaymentError;
class InsufficientFundsError extends AppError {
    constructor(message = 'Insufficient funds') {
        super(message, 402, 'INSUFFICIENT_FUNDS');
    }
}
exports.InsufficientFundsError = InsufficientFundsError;
//# sourceMappingURL=AppError.js.map