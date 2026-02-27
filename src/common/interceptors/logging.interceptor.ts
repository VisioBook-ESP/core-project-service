import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // Extract or generate correlation ID
    const correlationId = (request.headers['x-request-id'] as string) || randomUUID();
    request.correlationId = correlationId;

    // Extract user ID
    const userId = request.headers['x-user-id'] as string | undefined;

    const startTime = Date.now();

    this.logger.log({
      message: 'Incoming request',
      correlationId,
      userId,
      method,
      url,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.log({
            message: 'Request completed',
            correlationId,
            userId,
            method,
            url,
            statusCode: response.statusCode,
            duration,
          });
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            message: 'Request failed',
            correlationId,
            userId,
            method,
            url,
            error: error.message,
            duration,
          });
        },
      }),
    );
  }
}
