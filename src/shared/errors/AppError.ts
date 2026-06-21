export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly code: string;
    public readonly details?: any;
  
    constructor(
      message: any,
      statusCode: any,
      code?: any,
      details?: any,
      isOperational = true
    ) {
      super(message);
      this.statusCode = statusCode;
      this.code = code || 'INTERNAL_ERROR';
      this.details = details;
      this.isOperational = isOperational;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export class BadRequestError extends AppError {
    constructor(message: string, code?: string, details?: any) {
      super(message, 400, code || 'BAD_REQUEST', details);
    }
  }
  
  export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized access') {
      super(message, 401, 'UNAUTHORIZED');
    }
  }
  
  export class ForbiddenError extends AppError {
    constructor(message: string = 'Access forbidden') {
      super(message, 403, 'FORBIDDEN');
    }
  }
  
  export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
      super(`${resource} not found`, 404, 'NOT_FOUND');
    }
  }
  
  export class ConflictError extends AppError {
    constructor(message: string) {
      super(message, 409, 'CONFLICT');
    }
  }
  
  export class TooManyRequestsError extends AppError {
    constructor(message: string = 'Too many requests') {
      super(message, 429, 'TOO_MANY_REQUESTS');
    }
  }
  
  export class InternalServerError extends AppError {
    constructor(message: string = 'Internal server error') {
      super(message, 500, 'INTERNAL_SERVER_ERROR', undefined, false);
    }
  }
  
  export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
      super(message, 422, 'VALIDATION_ERROR', details);
    }
  }
  
  export class PaymentError extends AppError {
    constructor(message: string, details?: any) {
      super(message, 402, 'PAYMENT_ERROR', details);
    }
  }
  
  export class InsufficientFundsError extends AppError {
    constructor(message: string = 'Insufficient funds') {
      super(message, 402, 'INSUFFICIENT_FUNDS');
    }
  }