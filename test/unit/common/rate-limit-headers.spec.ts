import { of } from 'rxjs';
import { RateLimitHeadersInterceptor } from '../../../src/common/interceptors/rate-limit-headers.interceptor.js';

function createMockContext(requestHeaders: Record<string, string | undefined>) {
  const setHeader = vi.fn();
  const mockRequest = { headers: requestHeaders };
  const mockResponse = { setHeader };

  const context = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  };

  return { context, setHeader, mockRequest, mockResponse };
}

function createMockCallHandler() {
  const handle = vi.fn().mockReturnValue(of('result'));
  return { handle };
}

describe('RateLimitHeadersInterceptor', () => {
  const interceptor = new RateLimitHeadersInterceptor();

  it('should forward all three rate limit headers when present', () => {
    const { context, setHeader } = createMockContext({
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '99',
      'x-ratelimit-reset': '1700000000',
    });
    const next = createMockCallHandler();

    interceptor.intercept(context as never, next);

    expect(setHeader).toHaveBeenCalledWith('x-ratelimit-limit', '100');
    expect(setHeader).toHaveBeenCalledWith('x-ratelimit-remaining', '99');
    expect(setHeader).toHaveBeenCalledWith('x-ratelimit-reset', '1700000000');
    expect(setHeader).toHaveBeenCalledTimes(3);
  });

  it('should not set headers when none are present', () => {
    const { context, setHeader } = createMockContext({});
    const next = createMockCallHandler();

    interceptor.intercept(context as never, next);

    expect(setHeader).not.toHaveBeenCalled();
  });

  it('should handle partial headers (only some present)', () => {
    const { context, setHeader } = createMockContext({
      'x-ratelimit-limit': '50',
    });
    const next = createMockCallHandler();

    interceptor.intercept(context as never, next);

    expect(setHeader).toHaveBeenCalledWith('x-ratelimit-limit', '50');
    expect(setHeader).toHaveBeenCalledTimes(1);
  });

  it('should call next.handle()', () => {
    const { context } = createMockContext({});
    const next = createMockCallHandler();

    interceptor.intercept(context as never, next);

    expect(next.handle).toHaveBeenCalled();
  });
});
