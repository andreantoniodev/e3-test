import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsAppInstanceStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { describeEvolutionError, EvolutionClient } from '../evolution.client';
import { isLidJid } from '../jid';

export type PendingPairing = {
  unitId: string;
  unitSlug: string;
  instanceName: string;
  evolutionToken: string;
  qrcode: string | null;
  phone: string | null;
};

@Injectable()
export class WhatsappPairingService {
  private readonly logger = new Logger(WhatsappPairingService.name);
  private readonly pendingByUnitId = new Map<string, PendingPairing>();
  private readonly pendingByInstanceName = new Map<string, PendingPairing>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
  ) {}

  getPendingByUnitId(unitId: string): PendingPairing | undefined {
    return this.pendingByUnitId.get(unitId);
  }

  getPendingByInstanceName(instanceName: string): PendingPairing | undefined {
    return this.pendingByInstanceName.get(instanceName);
  }

  setPending(pending: PendingPairing) {
    const previous = this.pendingByUnitId.get(pending.unitId);
    if (previous) {
      this.pendingByInstanceName.delete(previous.instanceName);
    }
    this.pendingByUnitId.set(pending.unitId, pending);
    this.pendingByInstanceName.set(pending.instanceName, pending);
  }

  clearPending(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (!pending) {
      return;
    }
    this.pendingByUnitId.delete(unitId);
    this.pendingByInstanceName.delete(pending.instanceName);
  }

  logQrCode(pending: PendingPairing) {
    if (!pending.qrcode) {
      this.logger.warn(
        `QR Code ainda não disponível | unit=${pending.unitSlug} | instance=${pending.instanceName}`,
      );
      return;
    }

    this.logger.log(
      `QR Code gerado | unit=${pending.unitSlug} | instance=${pending.instanceName}`,
    );
  }

  instanceNameForUnit(unitSlug: string) {
    return `unit-${unitSlug}-${randomUUID().slice(0, 8)}`;
  }

  webhookUrl() {
    const base = (process.env.PUBLIC_API_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    const secret = process.env.WEBHOOK_SECRET || '';
    const url = new URL(`${base}/webhooks/evolution`);
    if (secret) {
      url.searchParams.set('secret', secret);
    }
    return url.toString();
  }

  phoneFromJid(jid: string | null | undefined) {
    if (!jid || isLidJid(jid)) {
      return null;
    }
    const user = jid.split('@')[0] || '';
    const phone = (user.split(':')[0] || '').replace(/\D/g, '');
    return phone || null;
  }

  extractPhoneFromUnknown(data: unknown): string | null {
    if (!data) {
      return null;
    }
    if (typeof data === 'string') {
      return this.phoneFromJid(data);
    }
    if (typeof data !== 'object') {
      return null;
    }
    const record = data as Record<string, unknown>;
    const candidates = [
      record.phone,
      record.owner,
      record.wuid,
      record.wid,
      record.remoteJid,
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        continue;
      }
      if (candidate.includes('@')) {
        const phone = this.phoneFromJid(candidate);
        if (phone) {
          return phone;
        }
        continue;
      }
      const digits = candidate.replace(/\D/g, '');
      if (/^\d{10,15}$/.test(digits)) {
        return digits;
      }
    }
    return null;
  }

  async createRemoteCredentials(unitSlug: string) {
    const instanceName = this.instanceNameForUnit(unitSlug);
    const webhookUrl = this.webhookUrl();
    const created = await this.evolution.createInstance({
      instanceName,
      webhookUrl,
    });

    const resolvedName = created.instance?.instanceName || instanceName;
    const evolutionToken =
      this.evolution.extractInstanceToken(created.hash) ||
      process.env.EVOLUTION_API_KEY ||
      randomUUID();

    try {
      await this.evolution.setWebhook(
        resolvedName,
        webhookUrl,
        evolutionToken,
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao configurar webhook | instance=${resolvedName} | ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    try {
      await this.evolution.setSettings(resolvedName, evolutionToken);
    } catch (error) {
      this.logger.warn(
        `Falha ao configurar settings da instância | instance=${resolvedName} | ${describeEvolutionError(error)}`,
      );
    }

    const qrcode =
      (await this.evolution.resolveQrImage(created.qrcode)) ||
      (await this.evolution.resolveQrImage(created));

    return {
      instanceName: resolvedName,
      evolutionToken,
      qrcode,
    };
  }

  async ensureQrcode(
    instanceName: string,
    evolutionToken: string,
    currentQr: string | null,
  ) {
    if (currentQr) {
      return currentQr;
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const connected = await this.evolution.connect(
          instanceName,
          evolutionToken,
        );
        const qrcode = await this.evolution.resolveQrImage(connected);
        if (qrcode) {
          return qrcode;
        }
      } catch (error) {
        this.logger.warn(
          `Falha ao obter QR via connect | instance=${instanceName} | attempt=${
            attempt + 1
          }/8 | ${describeEvolutionError(error)}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return null;
  }

  async isRemoteOpen(
    instanceName: string,
    evolutionToken?: string | null,
  ) {
    const remote = await this.evolution.connectionState(
      instanceName,
      evolutionToken || undefined,
    );
    return remote.instance?.state === 'open';
  }

  logRemoteCleanupError(
    action: string,
    instanceId: string,
    error: unknown,
  ) {
    this.logger.warn(
      `Falha ao ${action} na Evolution API | instance=${instanceId} | ${
        error instanceof Error ? error.message : error
      }`,
    );
  }

  async deleteRemoteInstance(
    instanceName: string,
    evolutionToken?: string | null,
  ) {
    try {
      await this.evolution.deleteInstance(
        instanceName,
        evolutionToken || undefined,
      );
    } catch (error) {
      this.logRemoteCleanupError('excluir instância', instanceName, error);
    }
  }

  async cancelPendingRemote(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (!pending) {
      return;
    }

    try {
      await this.evolution.deleteInstance(
        pending.instanceName,
        pending.evolutionToken,
      );
    } catch (deleteError) {
      this.logRemoteCleanupError(
        'excluir instância pendente',
        pending.instanceName,
        deleteError,
      );
      try {
        await this.evolution.logout(
          pending.instanceName,
          pending.evolutionToken,
        );
      } catch (logoutError) {
        this.logRemoteCleanupError(
          'logout instância pendente',
          pending.instanceName,
          logoutError,
        );
      }
    }

    this.clearPending(unitId);
  }

  async persistPairedInstance(pending: PendingPairing) {
    const phone = pending.phone;

    const existing = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId: pending.unitId },
    });

    if (existing) {
      await this.prisma.whatsAppInstance.update({
        where: { id: existing.id },
        data: {
          evolutionInstanceName: pending.instanceName,
          evolutionToken: pending.evolutionToken,
          phone,
          status: WhatsAppInstanceStatus.connected,
          lastQrCode: null,
        },
      });
    } else {
      await this.prisma.whatsAppInstance.create({
        data: {
          unitId: pending.unitId,
          evolutionInstanceName: pending.instanceName,
          evolutionToken: pending.evolutionToken,
          phone,
          status: WhatsAppInstanceStatus.connected,
          lastQrCode: null,
        },
      });
    }

    this.clearPending(pending.unitId);
  }
}
