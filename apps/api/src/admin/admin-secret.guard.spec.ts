import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminSecretGuard } from './admin-secret.guard';

function mockContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('AdminSecretGuard', () => {
  const guard = new AdminSecretGuard();
  const previous = process.env.ADMIN_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SECRET = 'admin-secret';
  });

  afterEach(() => {
    process.env.ADMIN_SECRET = previous;
  });

  it('aceita x-admin-secret', () => {
    expect(
      guard.canActivate(
        mockContext({ headers: { 'x-admin-secret': 'admin-secret' } }),
      ),
    ).toBe(true);
  });

  it('aceita Bearer no Authorization', () => {
    expect(
      guard.canActivate(
        mockContext({ headers: { authorization: 'Bearer admin-secret' } }),
      ),
    ).toBe(true);
  });

  it('aceita header Authorization cru', () => {
    expect(
      guard.canActivate(
        mockContext({ headers: { authorization: 'admin-secret' } }),
      ),
    ).toBe(true);
  });

  it('rejeita secret inválido', () => {
    expect(() =>
      guard.canActivate(
        mockContext({ headers: { 'x-admin-secret': 'errado' } }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejeita quando ADMIN_SECRET não está configurado', () => {
    delete process.env.ADMIN_SECRET;
    expect(() =>
      guard.canActivate(
        mockContext({ headers: { 'x-admin-secret': 'admin-secret' } }),
      ),
    ).toThrow(UnauthorizedException);
  });
});
