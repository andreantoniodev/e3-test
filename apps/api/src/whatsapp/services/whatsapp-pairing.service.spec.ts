import { describe, expect, it, vi } from 'vitest';
import { WhatsappPairingService } from './whatsapp-pairing.service';

describe('WhatsappPairingService', () => {
  const prisma = {
    whatsAppInstance: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const evolution = {
    createInstance: vi.fn(),
    setWebhook: vi.fn(),
    setSettings: vi.fn(),
    resolveQrImage: vi.fn(),
    extractInstanceToken: vi.fn(),
    connectionState: vi.fn(),
  };

  const service = new WhatsappPairingService(prisma as never, evolution as never);

  it('gera nome único de instância para a unidade', () => {
    const instanceName = service.instanceNameForUnit('filial-a');
    expect(instanceName).toMatch(/^unit-filial-a-[a-f0-9]{8}$/);
  });

  it('extrai telefone numérico válido de JID WhatsApp', () => {
    expect(service.phoneFromJid('5511988887777@s.whatsapp.net')).toBe('5511988887777');
    expect(service.phoneFromJid('invalid-lid@lid')).toBe(null);
  });

  it('gerencia estado de pareamento pendente', () => {
    const pending = {
      unitId: 'unit-1',
      unitSlug: 'filial-1',
      instanceName: 'unit-filial-1-12345678',
      evolutionToken: 'token-1',
      qrcode: 'data:image/png;base64,qr',
      phone: '5511999990000',
    };

    service.setPending(pending);
    expect(service.getPendingByUnitId('unit-1')).toEqual(pending);
    expect(service.getPendingByInstanceName('unit-filial-1-12345678')).toEqual(pending);

    service.clearPending('unit-1');
    expect(service.getPendingByUnitId('unit-1')).toBeUndefined();
  });
});
