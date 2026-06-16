"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsufficientFundsError = exports.PaymentError = exports.ValidationError = exports.InternalServerError = exports.TooManyRequestsError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.AppError = void 0;
class AppError extends Error {
    constructor(statusCode, message, code, details, isOperational = true) {
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
        super(400, message, code || 'BAD_REQUEST', details);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized access') {
        super(401, message, 'UNAUTHORIZED');
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super(403, message, 'FORBIDDEN');
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(404, `${resource} not found`, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(409, message, 'CONFLICT');
    }
}
exports.ConflictError = ConflictError;
class TooManyRequestsError extends AppError {
    constructor(message = 'Too many requests') {
        super(429, message, 'TOO_MANY_REQUESTS');
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
class InternalServerError extends AppError {
    constructor(message = 'Internal server error') {
        super(500, message, 'INTERNAL_SERVER_ERROR', undefined, false);
    }
}
exports.InternalServerError = InternalServerError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(422, message, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class PaymentError extends AppError {
    constructor(message, details) {
        super(402, message, 'PAYMENT_ERROR', details);
    }
}
exports.PaymentError = PaymentError;
class InsufficientFundsError extends AppError {
    constructor(message = 'Insufficient funds') {
        super(402, message, 'INSUFFICIENT_FUNDS');
    }
}
exports.InsufficientFundsError = InsufficientFundsError;
//# sourceMappingURL=AppError.js.map