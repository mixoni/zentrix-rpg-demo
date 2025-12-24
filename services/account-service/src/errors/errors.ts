/**
 * Custom application errors with proper status codes and error codes
 */

export const POSTGRESQL_ERROR_CODES = {
    UNIQUE_VIOLATION: '23505',
    FOREIGN_KEY_VIOLATION: '23503',
    NOT_NULL_VIOLATION: '23502',
};


export class AppError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
      public details?: any
    ) {
      super(message);
      this.name = this.constructor.name;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
      super(400, 'VALIDATION_ERROR', message, details);
    }
  }
  
  export class NotFoundError extends AppError {
    constructor(resource: string) {
      super(404, 'NOT_FOUND', `${resource} not found`);
    }
  }
  
  export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
      super(401, 'UNAUTHORIZED', message);
    }
  }
  
  export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
      super(403, 'FORBIDDEN', message);
    }
  }
  
  export class ConflictError extends AppError {
    constructor(message: string, details?: any) {
      super(409, 'CONFLICT', message, details);
    }
  }
  
  export class InternalError extends AppError {
    constructor(message: string = 'Internal server error') {
      super(500, 'INTERNAL_ERROR', message);
    }
  }