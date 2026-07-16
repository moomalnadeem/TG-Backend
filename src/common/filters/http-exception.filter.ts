import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      // Already formatted by our custom ValidationPipe exceptionFactory
      if (exceptionResponse?.success === false) {
        response.status(status).json(exceptionResponse);
        return;
      }

      response.status(status).json({
        success: false,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : exceptionResponse?.message ?? 'An error occurred.',
      });
      return;
    }

    // Generic / unexpected errors — log and return 500 with the real message
    console.error('[UnhandledException]', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: exception instanceof Error ? exception.message : 'Internal server error.',
    });
  }
}
