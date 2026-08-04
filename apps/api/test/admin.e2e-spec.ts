import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSecretGuard } from '../src/admin/admin-secret.guard';
import { AdminController } from '../src/admin/admin.controller';

function mockContext(headers: Record<string, string>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext;
}

describe('Admin API (E2E Integration)', () => {
  const guard = new AdminSecretGuard();

  const adminServiceMock = {
    listUnits: vi.fn().mockResolvedValue([
      { id: 'unit-1', name: 'Unidade A', slug: 'unidade-a' },
    ]),
    listUsers: vi.fn().mockResolvedValue([]),
  };

  const controller = new AdminController(adminServiceMock as never);

  beforeEach(() => {
    process.env.ADMIN_SECRET = 'secret-test-123';
    vi.clearAllMocks();
  });

  it('bloqueia requisição sem x-admin-secret', () => {
    expect(() => guard.canActivate(mockContext({}))).toThrow(UnauthorizedException);
  });

  it('permite requisição com x-admin-secret correto e executa listUnits', async () => {
    const authorized = guard.canActivate(
      mockContext({ 'x-admin-secret': 'secret-test-123' }),
    );
    expect(authorized).toBe(true);

    adminServiceMock.listUnits.mockResolvedValue([
      { id: 'unit-1', name: 'Unidade A', slug: 'unidade-a' },
    ]);

    const units = await controller.listUnits();
    expect(units).toEqual([
      { id: 'unit-1', name: 'Unidade A', slug: 'unidade-a' },
    ]);
  });
});
