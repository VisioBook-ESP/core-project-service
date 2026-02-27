import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GatewayAuthGuard } from '../../../src/common/guards/gateway-auth.guard.js';
import { IS_PUBLIC_KEY } from '../../../src/common/decorators/public.decorator.js';

function createMockContext(headers: Record<string, string | undefined> = {}): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('GatewayAuthGuard', () => {
  let guard: GatewayAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new GatewayAuthGuard(reflector);
  });

  it('should return true when X-User-Id is a valid UUID', () => {
    const context = createMockContext({
      'x-user-id': '550e8400-e29b-41d4-a716-446655440000',
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when X-User-Id header is missing', () => {
    const context = createMockContext({});
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when X-User-Id is an empty string', () => {
    const context = createMockContext({ 'x-user-id': '' });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when X-User-Id is not a valid UUID', () => {
    const context = createMockContext({ 'x-user-id': 'not-a-uuid' });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException with descriptive message', () => {
    const context = createMockContext({});
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(() => guard.canActivate(context)).toThrow('Missing or invalid X-User-Id header');
  });

  it('should return true when @Public() metadata is set, regardless of headers', () => {
    const context = createMockContext({}); // no X-User-Id
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should call reflector.getAllAndOverride with IS_PUBLIC_KEY', () => {
    const context = createMockContext({
      'x-user-id': '550e8400-e29b-41d4-a716-446655440000',
    });
    const spy = vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    guard.canActivate(context);

    expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should accept uppercase UUID', () => {
    const context = createMockContext({
      'x-user-id': '550E8400-E29B-41D4-A716-446655440000',
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

    expect(guard.canActivate(context)).toBe(true);
  });
});
