import { of, Observable } from 'rxjs';
import { MetricsService } from '../../../src/metrics/metrics.service.js';
import { MetricsInterceptor } from '../../../src/metrics/metrics.interceptor.js';
import { MetricsController } from '../../../src/metrics/metrics.controller.js';

describe('MetricsService', () => {
  it('should register all expected metric names', () => {
    const service = new MetricsService();

    expect(service.httpRequestsTotal).toBeDefined();
    expect(service.httpRequestDuration).toBeDefined();
    expect(service.workflowExecutionsTotal).toBeDefined();
    expect(service.workflowDuration).toBeDefined();
    expect(service.workflowStepDuration).toBeDefined();
    expect(service.bullmqJobsActive).toBeDefined();
    expect(service.bullmqJobsWaiting).toBeDefined();
    expect(service.bullmqJobsFailedTotal).toBeDefined();
    expect(service.natsMessagesPublishedTotal).toBeDefined();
    expect(service.natsMessagesReceivedTotal).toBeDefined();
    expect(service.prismaQueryDuration).toBeDefined();
    expect(service.activeSseConnections).toBeDefined();
  });

  it('should have a registry', () => {
    const service = new MetricsService();
    expect(service.registry).toBeDefined();
  });

  it('should collect default metrics on module init', async () => {
    const service = new MetricsService();
    service.onModuleInit();

    const metrics = await service.registry.metrics();
    // Default metrics include process_cpu_seconds_total or nodejs_version_info
    expect(metrics).toContain('process_');
  });
});

describe('MetricsInterceptor', () => {
  it('should increment httpRequestsTotal on successful response', async () => {
    const metricsService = new MetricsService();
    const incSpy = vi.spyOn(metricsService.httpRequestsTotal, 'inc');
    const observeSpy = vi.spyOn(metricsService.httpRequestDuration, 'observe');

    const interceptor = new MetricsInterceptor(metricsService);

    const mockRequest = {
      method: 'GET',
      route: { path: '/api/v1/projects' },
      url: '/api/v1/projects',
    };
    const mockResponse = { statusCode: 200 };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const mockNext = {
      handle: () => of({ result: 'ok' }),
    };

    const result$ = interceptor.intercept(mockContext as never, mockNext as never);

    await new Promise<void>((resolve) => {
      result$.subscribe({
        complete: () => resolve(),
      });
    });

    expect(incSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/v1/projects',
      status: '200',
    });
    expect(observeSpy).toHaveBeenCalledWith(
      { method: 'GET', path: '/api/v1/projects' },
      expect.any(Number),
    );
  });

  it('should increment httpRequestsTotal on error response', async () => {
    const metricsService = new MetricsService();
    const incSpy = vi.spyOn(metricsService.httpRequestsTotal, 'inc');

    const interceptor = new MetricsInterceptor(metricsService);

    const mockRequest = {
      method: 'POST',
      route: { path: '/api/v1/projects' },
      url: '/api/v1/projects',
    };
    const mockResponse = { statusCode: 500 };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const error = { status: 404, message: 'Not Found' };
    const mockNext = {
      handle: () =>
        new Observable((subscriber) => {
          subscriber.error(error);
        }),
    };

    const result$ = interceptor.intercept(mockContext as never, mockNext as never);

    await new Promise<void>((resolve) => {
      result$.subscribe({
        error: () => resolve(),
      });
    });

    expect(incSpy).toHaveBeenCalledWith({
      method: 'POST',
      path: '/api/v1/projects',
      status: '404',
    });
  });

  it('should use request.url when route.path is not available', async () => {
    const metricsService = new MetricsService();
    const incSpy = vi.spyOn(metricsService.httpRequestsTotal, 'inc');

    const interceptor = new MetricsInterceptor(metricsService);

    const mockRequest = {
      method: 'GET',
      route: undefined,
      url: '/metrics',
    };
    const mockResponse = { statusCode: 200 };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };

    const mockNext = {
      handle: () => of('ok'),
    };

    const result$ = interceptor.intercept(mockContext as never, mockNext as never);

    await new Promise<void>((resolve) => {
      result$.subscribe({ complete: () => resolve() });
    });

    expect(incSpy).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/metrics' }),
    );
  });
});

describe('MetricsController', () => {
  it('should return metrics in valid Prometheus format', async () => {
    const metricsService = new MetricsService();
    metricsService.onModuleInit();

    // Increment a counter so there is output
    metricsService.httpRequestsTotal.inc({ method: 'GET', path: '/test', status: '200' });

    const controller = new MetricsController(metricsService);
    const output = await controller.getMetrics();

    expect(typeof output).toBe('string');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('method="GET"');
    // Prometheus format: lines are either comments (#) or metric lines
    const lines = output.split('\n').filter((line) => line.trim().length > 0);
    for (const line of lines) {
      expect(line.startsWith('#') || /^[a-zA-Z_]/.test(line)).toBe(true);
    }
  });

  it('should include workflow metrics in output', async () => {
    const metricsService = new MetricsService();
    metricsService.workflowExecutionsTotal.inc({ status: 'completed' });

    const controller = new MetricsController(metricsService);
    const output = await controller.getMetrics();

    expect(output).toContain('workflow_executions_total');
    expect(output).toContain('status="completed"');
  });
});
