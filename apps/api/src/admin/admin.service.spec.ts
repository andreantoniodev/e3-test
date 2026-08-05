import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const prisma = {
    unit: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    message: { deleteMany: vi.fn() },
    conversation: { deleteMany: vi.fn() },
    whatsAppInstance: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };

  const whatsappService = {
    disconnectAndDelete: vi.fn(),
  };

  const service = new AdminService(prisma as never, whatsappService as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUnit', () => {
    it('cria unidade gerando slug a partir do nome', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);
      prisma.unit.create.mockResolvedValue({ id: 'unit-1', name: 'Unidade Centro', slug: 'unidade-centro' });

      const result = await service.createUnit({ name: 'Unidade Centro' });

      expect(prisma.unit.findUnique).toHaveBeenCalledWith({ where: { slug: 'unidade-centro' }, select: { id: true } });
      expect(prisma.unit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Unidade Centro', slug: 'unidade-centro' },
        }),
      );
      expect(result).toHaveProperty('id', 'unit-1');
    });

    it('rejeita nome de unidade vazio', async () => {
      await expect(service.createUnit({ name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita slug duplicado com ConflictException', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: 'existing-id' });
      await expect(service.createUnit({ name: 'Unidade Centro' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('upsertUser', () => {
    it('vincula e-mail a uma unidade existente', async () => {
      prisma.unit.findUnique.mockResolvedValue({ id: 'unit-1', name: 'Unidade A', slug: 'unidade-a' });
      prisma.user.upsert.mockResolvedValue({ id: 'user-1', email: 'user@test.com', unitId: 'unit-1' });

      const result = await service.upsertUser({ email: 'USER@test.com ', unitId: 'unit-1' });

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'user@test.com' },
          create: { email: 'user@test.com', name: null, unitId: 'unit-1' },
        }),
      );
      expect(result).toHaveProperty('id', 'user-1');
    });

    it('rejeita e-mail com formato inválido', async () => {
      await expect(service.upsertUser({ email: 'invalid-email', unitId: 'unit-1' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança NotFoundException quando a unidade não existe', async () => {
      prisma.unit.findUnique.mockResolvedValue(null);
      await expect(service.upsertUser({ email: 'user@test.com', unitId: 'invalid-unit' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
