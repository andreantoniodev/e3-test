import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  const prisma = {
    conversation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    whatsAppInstance: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const evolution = {
    sendText: vi.fn(),
  };
  const service = new ConversationsService(prisma as never, evolution as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listByUnit filtra por unitId', async () => {
    prisma.conversation.findMany.mockResolvedValue([]);
    await service.listByUnit('unit-a');
    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: 'unit-a' },
      }),
    );
  });

  it('listMessages lança NotFound quando conversa é de outra unidade', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(
      service.listMessages('unit-a', 'conv-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1', unitId: 'unit-a' },
      }),
    );
  });

  it('listMessages filtra mensagens por unitId', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.message.findMany.mockResolvedValue([]);
    await service.listMessages('unit-a', 'conv-1');
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv-1', unitId: 'unit-a' },
      }),
    );
  });

  it('sendMessage rejeita corpo vazio', async () => {
    await expect(
      service.sendMessage('unit-a', 'conv-1', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendMessage lança NotFound para conversa de outra unidade', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(
      service.sendMessage('unit-a', 'conv-1', 'olá'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sendMessage rejeita sem instância conectada', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      remoteJid: '5511999998888@s.whatsapp.net',
      phone: '5511999998888',
    });
    prisma.whatsAppInstance.findFirst.mockResolvedValue(null);

    await expect(
      service.sendMessage('unit-a', 'conv-1', 'olá'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendMessage grava outbound com externalId da Evolution', async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: 'conv-1',
      remoteJid: '5511999998888@s.whatsapp.net',
      phone: null,
    });
    prisma.whatsAppInstance.findFirst.mockResolvedValue({
      evolutionInstanceName: 'unit-a-1',
      evolutionToken: 'token',
    });
    evolution.sendText.mockResolvedValue({ key: { id: 'ext-1' } });
    prisma.message.create.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      direction: 'outbound',
      body: 'olá',
      externalId: 'ext-1',
      createdAt: new Date(),
    });
    prisma.conversation.update.mockResolvedValue({});

    const result = await service.sendMessage('unit-a', 'conv-1', 'olá');

    expect(evolution.sendText).toHaveBeenCalledWith(
      'unit-a-1',
      '5511999998888@s.whatsapp.net',
      'olá',
      'token',
    );
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: 'unit-a',
          body: 'olá',
          externalId: 'ext-1',
        }),
      }),
    );
    expect(result.externalId).toBe('ext-1');
  });

  it('remove filtra por unitId e apaga em transação', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.$transaction.mockResolvedValue([]);

    await service.remove('unit-a', 'conv-1');

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1', unitId: 'unit-a' },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('remove lança NotFound para conversa de outra unidade', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(service.remove('unit-a', 'conv-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
