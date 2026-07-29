import {
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirebaseAuthGuard } from './firebase-auth.guard';

function mockContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('FirebaseAuthGuard', () => {
  const firebase = {
    verifyIdToken: vi.fn(),
  };
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  const guard = new FirebaseAuthGuard(firebase as never, prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita sem Bearer', async () => {
    await expect(
      guard.canActivate(mockContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita Bearer vazio', async () => {
    await expect(
      guard.canActivate(
        mockContext({ headers: { authorization: 'Bearer ' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita token inválido', async () => {
    firebase.verifyIdToken.mockRejectedValue(new Error('invalid'));
    await expect(
      guard.canActivate(
        mockContext({ headers: { authorization: 'Bearer bad' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita e-mail sem vínculo com 403', async () => {
    firebase.verifyIdToken.mockResolvedValue({
      uid: 'uid-1',
      email: 'novo@gmail.com',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        mockContext({ headers: { authorization: 'Bearer ok' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('injeta request.user e sincroniza firebaseUid', async () => {
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer ok' },
    };
    firebase.verifyIdToken.mockResolvedValue({
      uid: 'uid-novo',
      email: 'user@gmail.com',
      name: 'User',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@gmail.com',
      firebaseUid: 'uid-antigo',
      name: 'Old',
      unitId: 'unit-1',
      unit: { id: 'unit-1', name: 'Unidade A' },
    });
    const updated = {
      id: 'user-1',
      email: 'user@gmail.com',
      firebaseUid: 'uid-novo',
      name: 'User',
      unitId: 'unit-1',
      unit: { id: 'unit-1', name: 'Unidade A' },
    };
    prisma.user.update.mockResolvedValue(updated);

    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { firebaseUid: 'uid-novo', name: 'User' },
      }),
    );
    expect(request.user).toEqual(updated);
  });
});
