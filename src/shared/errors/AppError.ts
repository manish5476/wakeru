export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly code: string;
    public readonly details?: any;
  
    constructor(
      statusCode: number,
      message: string,
      code?: string,
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
      super(400, message, code || 'BAD_REQUEST', details);
    }
  }
  
  export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized access') {
      super(401, message, 'UNAUTHORIZED');
    }
  }
  
  export class ForbiddenError extends AppError {
    constructor(message: string = 'Access forbidden') {
      super(403, message, 'FORBIDDEN');
    }
  }
  
  export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
      super(404, `${resource} not found`, 'NOT_FOUND');
    }
  }
  
  export class ConflictError extends AppError {
    constructor(message: string) {
      super(409, message, 'CONFLICT');
    }
  }
  
  export class TooManyRequestsError extends AppError {
    constructor(message: string = 'Too many requests') {
      super(429, message, 'TOO_MANY_REQUESTS');
    }
  }
  
  export class InternalServerError extends AppError {
    constructor(message: string = 'Internal server error') {
      super(500, message, 'INTERNAL_SERVER_ERROR', undefined, false);
    }
  }
  
  export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
      super(422, message, 'VALIDATION_ERROR', details);
    }
  }
  
  export class PaymentError extends AppError {
    constructor(message: string, details?: any) {
      super(402, message, 'PAYMENT_ERROR', details);
    }
  }
  
  export class InsufficientFundsError extends AppError {
    constructor(message: string = 'Insufficient funds') {
      super(402, message, 'INSUFFICIENT_FUNDS');
    }
  }