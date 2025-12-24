import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, POSTGRESQL_ERROR_CODES } from './errors';

const isDevelopment = process.env.NODE_ENV !== 'production';

export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {

  request.log.error(
    {
      err: error,
      requestId: request.id,
      url: request.url,
      method: request.method,
      body: request.body,
    },
    'Request error'
  );

  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: isDevelopment
        ? error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          }))
        : undefined,
    });
  }

  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: isDevelopment ? error.details : undefined,
    });
  }

  if (error.code) {
    if (error.code === POSTGRESQL_ERROR_CODES.UNIQUE_VIOLATION) {
      const match = error.message.match(/Key \((.*?)\)=\((.*?)\) already exists/);
      const field = match ? match[1] : 'field';
      return reply.code(409).send({
        error: 'CONFLICT',
        message: `A record with this ${field} already exists`,
        details: isDevelopment
          ? { constraint: error.message }
          : undefined,
      });
    }

    if (error.code === POSTGRESQL_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
      return reply.code(400).send({
        error: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist',
        details: isDevelopment
          ? { constraint: error.message }
          : undefined,
      });
    }

    if (error.code === POSTGRESQL_ERROR_CODES.NOT_NULL_VIOLATION) {
      const match = error.message.match(/column "(.*?)" of relation/);
      const column = match ? match[1] : 'field';
      return reply.code(400).send({
        error: 'MISSING_REQUIRED_FIELD',
        message: `Required field '${column}' is missing`,
      });
    }
  }

  if (error.validation) {
    return reply.code(400).send({
      error: 'VALIDATION_ERROR',
      message: error.message,
      details: isDevelopment ? error.validation : undefined,
    });
  }

  const statusCode = error.statusCode || 500;

  return reply.code(statusCode).send({
    error: error.name || 'INTERNAL_ERROR',
    message: isDevelopment
      ? error.message
      : statusCode === 500
      ? 'An internal error occurred'
      : error.message,
    stack: isDevelopment ? error.stack : undefined,
  });
}