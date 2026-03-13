import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, route } = request;
    const path: string = route?.path ?? request.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const status: number = response.statusCode;
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.httpRequestsTotal.inc({
            method,
            path,
            status: String(status),
          });
          this.metricsService.httpRequestDuration.observe({ method, path }, duration);
        },
        error: (error: { status?: number }) => {
          const status = error.status ?? 500;
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.httpRequestsTotal.inc({
            method,
            path,
            status: String(status),
          });
          this.metricsService.httpRequestDuration.observe({ method, path }, duration);
        },
      }),
    );
  }
}
