import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_AUTO_REPLY_TEXT } from '../constants';
import { WhatsappService } from './whatsapp.service';

const instance = {
  id: 'wa-1',
  unitId: 'unit-a',
  evolutionInstanceName: 'unit-unidade-a',
  evolutionToken: 'token',
};

function inboundPayload(overrides?: {
  remoteJid?: string;
  remoteJidAlt?: string;
  fromMe?: boolean;
  id?: string;
  text?: string | null;
  pushName?: string;
}) {
  const text = overrides?.text === null ? undefined : (overrides?.text ?? 'Oi');
  return {
    key: {
      remoteJid: overrides?.remoteJid ?? '7194204500216@lid',
      remoteJidAlt: overrides?.remoteJidAlt,
      fromMe: overrides?.fromMe ?? false,
      id: overrides?.id ?? 'msg-ext-1',
    },
    pushName: overrides?.pushName ?? 'Contato',
    message: text
      ? {
          conversation: text,
        }
      : {},
  };
}

describe('WhatsappService.handleWebhook (messages.upsert)', () => {
  const prisma = {
    whatsAppInstance: {
      findUnique: vi.fn(),
    },
    conversation: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    message: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  const evolution = {
    sendText: vi.fn(),
    resolveQrImage: vi.fn(),
  };
  const service = new WhatsappService(prisma as never, evolution as never);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.whatsAppInstance.findUnique.mockResolvedValue(instance);
    prisma.conversation.upsert.mockResolvedValue({
      id: 'conv-1',
      unitId: 'unit-a',
      remoteJid: '5511999998888@s.whatsapp.net',
    });
    prisma.message.findFirst.mockResolvedValue(null);
    prisma.message.create.mockResolvedValue({ id: 'msg-1' });
    prisma.conversation.update.mockResolvedValue({});
    evolution.sendText.mockResolvedValue({ key: { id: 'out-1' } });
  });

  async function upsert(data: unknown) {
    return service.handleWebhook({
      event: 'messages.upsert',
      instance: instance.evolutionInstanceName,
      data,
    });
  }

  it('responde exatamente o texto do bot para "oi" (case/trim)', async () => {
    for (const text of ['oi', 'Oi', ' oi ']) {
      vi.clearAllMocks();
      prisma.whatsAppInstance.findUnique.mockResolvedValue(instance);
      prisma.conversation.upsert.mockResolvedValue({ id: 'conv-1' });
      prisma.message.findFirst.mockResolvedValue(null);
      prisma.message.create.mockResolvedValue({ id: 'msg-1' });
      evolution.sendText.mockResolvedValue({ key: { id: 'out-1' } });

      await upsert(inboundPayload({ text, id: `id-${text}` }));

      expect(evolution.sendText).toHaveBeenCalledWith(
        instance.evolutionInstanceName,
        expect.any(String),
        BOT_AUTO_REPLY_TEXT,
        'token',
      );
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: BOT_AUTO_REPLY_TEXT,
            unitId: 'unit-a',
          }),
        }),
      );
    }
  });

  it('não responde para "oi tudo bem"', async () => {
    await upsert(inboundPayload({ text: 'oi tudo bem' }));
    expect(evolution.sendText).not.toHaveBeenCalled();
  });

  it('envia para remoteJidAlt quando o contato chega como @lid', async () => {
    await upsert(
      inboundPayload({
        remoteJid: '7194204500216@lid',
        remoteJidAlt: '5511999998888@s.whatsapp.net',
        text: 'oi',
      }),
    );

    expect(prisma.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          unitId_remoteJid: {
            unitId: 'unit-a',
            remoteJid: '5511999998888@s.whatsapp.net',
          },
        },
      }),
    );
    expect(evolution.sendText).toHaveBeenCalledWith(
      instance.evolutionInstanceName,
      '5511999998888@s.whatsapp.net',
      BOT_AUTO_REPLY_TEXT,
      'token',
    );
  });

  it('ignora fromMe, grupos e status@broadcast', async () => {
    await upsert(inboundPayload({ fromMe: true, text: 'oi' }));
    await upsert(
      inboundPayload({
        remoteJid: '120363@g.us',
        text: 'oi',
        id: 'g1',
      }),
    );
    await upsert(
      inboundPayload({
        remoteJid: 'status@broadcast',
        text: 'oi',
        id: 's1',
      }),
    );

    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(evolution.sendText).not.toHaveBeenCalled();
  });

  it('deduplica por externalId e não reenvia auto-resposta', async () => {
    prisma.message.findFirst.mockResolvedValue({ id: 'already' });
    await upsert(inboundPayload({ text: 'oi', id: 'dup-1' }));

    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(evolution.sendText).not.toHaveBeenCalled();
  });

  it('grava Conversation e Message com unitId da instância', async () => {
    await upsert(
      inboundPayload({
        remoteJid: '5511888777666@s.whatsapp.net',
        text: 'olá',
      }),
    );

    expect(prisma.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ unitId: 'unit-a' }),
      }),
    );
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: 'unit-a',
          body: 'olá',
          externalId: 'msg-ext-1',
        }),
      }),
    );
  });

  it('aceita payload em array', async () => {
    await upsert([
      inboundPayload({ text: 'oi', id: 'a1' }),
      inboundPayload({
        text: 'oi',
        id: 'a2',
        remoteJid: '5511999998888@s.whatsapp.net',
      }),
    ]);
    expect(evolution.sendText).toHaveBeenCalledTimes(2);
  });

  it('não quebra quando a mensagem não tem texto', async () => {
    await expect(
      upsert(inboundPayload({ text: null, id: 'empty' })),
    ).resolves.toEqual({ ok: true });
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('não propaga falha da Evolution na auto-resposta', async () => {
    evolution.sendText.mockRejectedValue(new Error('Evolution down'));
    await expect(
      upsert(inboundPayload({ text: 'oi', id: 'fail-1' })),
    ).resolves.toEqual({ ok: true });
  });

  it('retorna ok quando a instância não existe', async () => {
    prisma.whatsAppInstance.findUnique.mockResolvedValue(null);
    await expect(
      upsert(inboundPayload({ text: 'oi' })),
    ).resolves.toEqual({ ok: true });
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
  });
});
