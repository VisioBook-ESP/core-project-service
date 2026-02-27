import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter.js';

function createMockHost(url: string = '/test'): {
  host: ArgumentsHost;
  mockResponse: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
} {
  const mockJson = vi.fn();
  const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
  const mockResponse = { status: mockStatus, json: mockJson };

  const host = {
    switchToHttp: vi.fn().mockReturnValue({
      getResponse: vi.fn().mockReturnValue(mockResponse),
      getRequest: vi.fn().mockReturnValue({ url }),
    }),
  } as unknown as ArgumentsHost;

  return { host, mockResponse };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    // Silence logger output during tests
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle HttpException with status 400', () => {
    const { host, mockResponse } = createMockHost('/api/test');
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.path).toBe('/api/test');
    expect(body.timestamp).toBeDefined();
  });

  it('should handle HttpException with status 500', () => {
    const { host, mockResponse } = createMockHost('/api/error');
    const exception = new HttpException(
      'Internal Server Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.path).toBe('/api/error');
  });

  it('should handle non-HttpException as 500', () => {
    const { host, mockResponse } = createMockHost('/api/unknown');
    const exception = new Error('Something broke');

    filter.catch(exception, host);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(body.path).toBe('/api/unknown');
  });

  it('should include timestamp in ISO format', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    const body = mockResponse.json.mock.calls[0][0];
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should log error for 5xx exceptions', () => {
    const { host } = createMockHost();
    const errorSpy = vi.spyOn(Logger.prototype, 'error');
    const exception = new HttpException(
      'Internal Server Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    filter.catch(exception, host);

    expect(errorSpy).toHaveBeenCalled();
  });

  it('should log warning for 4xx exceptions', () => {
    const { host } = createMockHost();
    const warnSpy = vi.spyOn(Logger.prototype, 'warn');
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(warnSpy).toHaveBeenCalled();
  });

  it('should handle HttpException with object response', () => {
    const { host, mockResponse } = createMockHost();
    const exception = new HttpException(
      { message: 'Validation failed', error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    const body = mockResponse.json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Validation failed');
    expect(body.error).toBe('Bad Request');
  });
});
