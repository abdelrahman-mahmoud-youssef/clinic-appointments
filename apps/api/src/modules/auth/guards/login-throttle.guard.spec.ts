import { ExecutionContext, HttpException } from '@nestjs/common';
import { LoginThrottleGuard } from './login-throttle.guard';

function createRedisMock() {
  return { incr: jest.fn(), pexpire: jest.fn() };
}

function createContext(body: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ body }) }),
  } as unknown as ExecutionContext;
}

describe('LoginThrottleGuard', () => {
  let redis: ReturnType<typeof createRedisMock>;
  let guard: LoginThrottleGuard;

  beforeEach(() => {
    redis = createRedisMock();
    guard = new LoginThrottleGuard(redis as any);
  });

  it('allows the request while under the attempt limit', async () => {
    redis.incr.mockResolvedValue(1);

    await expect(guard.canActivate(createContext({ email: 'a@b.com' }))).resolves.toBe(true);
    expect(redis.pexpire).toHaveBeenCalledWith('login-throttle:a@b.com', 60_000);
  });

  it('throws 429 once the attempt limit is exceeded', async () => {
    redis.incr.mockResolvedValue(6);

    await expect(guard.canActivate(createContext({ email: 'a@b.com' }))).rejects.toBeInstanceOf(HttpException);
  });

  it('fails open when Redis errors', async () => {
    redis.incr.mockRejectedValue(new Error('connection refused'));

    await expect(guard.canActivate(createContext({ email: 'a@b.com' }))).resolves.toBe(true);
  });

  it('skips throttling when the body has no email, leaving validation to reject it', async () => {
    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('keys by lowercased, trimmed email so case/whitespace cannot bypass the limit', async () => {
    redis.incr.mockResolvedValue(1);

    await guard.canActivate(createContext({ email: '  A@B.com  ' }));

    expect(redis.incr).toHaveBeenCalledWith('login-throttle:a@b.com');
  });
});
