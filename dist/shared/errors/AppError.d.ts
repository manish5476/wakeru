export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly code: string;
    readonly details?: any;
    constructor(message: any, statusCode: any, code?: any, details?: any, isOperational?: boolean);
}
export declare class BadRequestError extends AppError {
    constructor(message: string, code?: string, details?: any);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class TooManyRequestsError extends AppError {
    constructor(message?: string);
}
export declare class InternalServerError extends AppError {
    constructor(message?: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: any);
}
export declare class PaymentError extends AppError {
    constructor(message: string, details?: any);
}
export declare class InsufficientFundsError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=AppError.d.ts.map