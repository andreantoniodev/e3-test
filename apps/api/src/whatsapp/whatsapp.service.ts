import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BOT_AUTO_REPLY_TEXT } from '../constants';
import { MessageDirection, WhatsAppInstanceStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EvolutionApiEvent,
  normalizeEvolutionApiEvent,
} from './evolution-api.events';
import { describeEvolutionError, EvolutionClient } from './evolution.client';
import {
  EvolutionMessageKey,
  isLidJid,
  resolveContactJid,
  sendTargetFromJid,
} from './jid';

type EvolutionApiWebhookBody = {
  event?: string;
  instance?: string;
  data?: unknown;
  progress?: number | string;
  isLatest?: boolean;
};

type PendingPairing = {
  unitId: string;
  unitSlug: string;
  instanceName: string;
  evolutionToken: string;
  qrcode: string | null;
  phone: string | null;
};

type HistorySyncState = {
  syncing: boolean;
  progress: number | null;
  updatedAt: number;
};

const HISTORY_SYNC_IDLE_MS = 45_000;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly pendingByUnitId = new Map<string, PendingPairing>();
  private readonly pendingByInstanceName = new Map<string, PendingPairing>();
  private readonly syncByInstanceName = new Map<string, HistorySyncState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
  ) {}

  private phoneFromJid(jid: string | null | undefined) {
    if (!jid || isLidJid(jid)) {
      return null;
    }
    const user = jid.split('@')[0] || '';
    const phone = (user.split(':')[0] || '').replace(/\D/g, '');
    return phone || null;
  }

  private extractPhoneFromUnknown(data: unknown): string | null {
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

  private statusPayload(params: {
    status: WhatsAppInstanceStatus;
    instanceName?: string | null;
    instanceId?: string | null;
    phone?: string | null;
    qrcode?: string | null;
    code?: string | null;
  }) {
    const sync = this.getHistorySyncState(params.instanceName ?? null);
    return {
      status: params.status,
      instanceName: params.instanceName ?? null,
      instanceId: params.instanceId ?? null,
      phone: params.phone ?? null,
      qrcode: params.qrcode ?? null,
      code: params.code ?? null,
      syncing: sync.syncing,
    };
  }

  private getHistorySyncState(instanceName: string | null | undefined) {
    if (!instanceName) {
      return { syncing: false, progress: null as number | null };
    }

    const current = this.syncByInstanceName.get(instanceName);
    if (!current) {
      return { syncing: false, progress: null as number | null };
    }

    if (
      current.syncing &&
      Date.now() - current.updatedAt > HISTORY_SYNC_IDLE_MS
    ) {
      const settled = {
        syncing: false,
        progress: current.progress ?? 100,
        updatedAt: Date.now(),
      };
      this.syncByInstanceName.set(instanceName, settled);
      return { syncing: false, progress: settled.progress };
    }

    return { syncing: current.syncing, progress: current.progress };
  }

  private markHistorySyncStarted(instanceName: string) {
    this.syncByInstanceName.set(instanceName, {
      syncing: true,
      progress: 0,
      updatedAt: Date.now(),
    });
  }

  private updateHistorySyncProgress(
    instanceName: string,
    progress: number | null,
    isLatest?: boolean,
  ) {
    const previous = this.syncByInstanceName.get(instanceName);
    const nextProgress =
      progress ?? previous?.progress ?? (isLatest ? 100 : null);
    const done =
      isLatest === true ||
      (typeof nextProgress === 'number' && nextProgress >= 100);

    this.syncByInstanceName.set(instanceName, {
      syncing: !done,
      progress: nextProgress,
      updatedAt: Date.now(),
    });
  }

  private clearHistorySync(instanceName: string) {
    this.syncByInstanceName.delete(instanceName);
  }

  private parseSyncProgress(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
    return null;
  }

  private instanceNameForUnit(unitSlug: string) {
    return `unit-${unitSlug}-${randomUUID().slice(0, 8)}`;
  }

  private webhookUrl() {
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

  private setPending(pending: PendingPairing) {
    const previous = this.pendingByUnitId.get(pending.unitId);
    if (previous) {
      this.pendingByInstanceName.delete(previous.instanceName);
    }
    this.pendingByUnitId.set(pending.unitId, pending);
    this.pendingByInstanceName.set(pending.instanceName, pending);
  }

  private clearPending(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (!pending) {
      return;
    }
    this.pendingByUnitId.delete(unitId);
    this.pendingByInstanceName.delete(pending.instanceName);
  }

  private logQrCode(pending: PendingPairing) {
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

  private extractMessageBody(message: Record<string, unknown> | undefined) {
    if (!message) {
      return null;
    }
    if (typeof message.conversation === 'string') {
      return message.conversation;
    }
    const extended = message.extendedTextMessage as
      | { text?: string }
      | undefined;
    if (extended?.text) {
      return extended.text;
    }
    const image = message.imageMessage as { caption?: string } | undefined;
    if (image?.caption) {
      return image.caption;
    }
    const video = message.videoMessage as { caption?: string } | undefined;
    if (video?.caption) {
      return video.caption;
    }
    return null;
  }

  private async createRemoteCredentials(unitSlug: string) {
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

  private async ensureQrcode(
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

  private async isRemoteOpen(
    instanceName: string,
    evolutionToken?: string | null,
  ) {
    const remote = await this.evolution.connectionState(
      instanceName,
      evolutionToken || undefined,
    );
    return remote.instance?.state === 'open';
  }

  private async promotePendingIfConnected(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (!pending) {
      return null;
    }

    try {
      if (await this.isRemoteOpen(pending.instanceName, pending.evolutionToken)) {
        await this.persistPairedInstance(pending);
        return this.statusPayload({
          status: WhatsAppInstanceStatus.connected,
          instanceName: pending.instanceName,
          instanceId: pending.instanceName,
          phone: pending.phone,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao verificar conexão pendente | instance=${
          pending.instanceName
        } | ${describeEvolutionError(error)}`,
      );
    }

    return this.statusPayload({
      status: WhatsAppInstanceStatus.qr,
      instanceName: pending.instanceName,
      instanceId: pending.instanceName,
      phone: pending.phone,
      qrcode: pending.qrcode,
    });
  }

  async getStatus(unitId: string) {
    const pendingStatus = await this.promotePendingIfConnected(unitId);
    if (pendingStatus) {
      return pendingStatus;
    }

    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!instance) {
      return this.statusPayload({
        status: WhatsAppInstanceStatus.disconnected,
      });
    }

    try {
      if (
        await this.isRemoteOpen(
          instance.evolutionInstanceName,
          instance.evolutionToken,
        )
      ) {
        if (instance.status !== WhatsAppInstanceStatus.connected) {
          await this.prisma.whatsAppInstance.update({
            where: { id: instance.id },
            data: {
              status: WhatsAppInstanceStatus.connected,
              lastQrCode: null,
            },
          });
        }

        return this.statusPayload({
          status: WhatsAppInstanceStatus.connected,
          instanceName: instance.evolutionInstanceName,
          instanceId: instance.evolutionInstanceName,
          phone: instance.phone,
        });
      }

      if (instance.status !== WhatsAppInstanceStatus.disconnected) {
        await this.prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: {
            status: WhatsAppInstanceStatus.disconnected,
            lastQrCode: null,
          },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao consultar status na Evolution API | instance=${instance.evolutionInstanceName} | ${error instanceof Error ? error.message : error}`,
      );
      if (instance.status === WhatsAppInstanceStatus.connected) {
        return this.statusPayload({
          status: WhatsAppInstanceStatus.connected,
          instanceName: instance.evolutionInstanceName,
          instanceId: instance.evolutionInstanceName,
          phone: instance.phone,
        });
      }
    }

    return this.statusPayload({
      status: WhatsAppInstanceStatus.disconnected,
      instanceId: instance.evolutionInstanceName,
    });
  }

  private async deleteRemoteInstance(
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

  async connect(unitId: string, unitSlug: string) {
    const current = await this.getStatus(unitId);
    if (current.status === WhatsAppInstanceStatus.connected) {
      return {
        ...current,
        qrcode: null,
        code: null,
      };
    }

    await this.cancelPendingRemote(unitId);

    const saved = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId },
    });

    if (saved) {
      this.clearHistorySync(saved.evolutionInstanceName);
      await this.deleteRemoteInstance(
        saved.evolutionInstanceName,
        saved.evolutionToken,
      );
      await this.prisma.whatsAppInstance.delete({ where: { id: saved.id } });
    }

    const credentials = await this.createRemoteCredentials(unitSlug);
    const qrcode = await this.ensureQrcode(
      credentials.instanceName,
      credentials.evolutionToken,
      credentials.qrcode,
    );

    this.setPending({
      unitId,
      unitSlug,
      instanceName: credentials.instanceName,
      evolutionToken: credentials.evolutionToken,
      qrcode,
      phone: null,
    });

    const pending = this.pendingByUnitId.get(unitId);
    if (pending) {
      this.logQrCode(pending);
    }

    return this.statusPayload({
      status: WhatsAppInstanceStatus.qr,
      instanceName: credentials.instanceName,
      instanceId: credentials.instanceName,
      qrcode,
    });
  }

  async getQr(unitId: string) {
    const pendingStatus = await this.promotePendingIfConnected(unitId);
    if (pendingStatus) {
      if (pendingStatus.status === WhatsAppInstanceStatus.connected) {
        return {
          ...pendingStatus,
          qrcode: null,
          code: null,
        };
      }

      const pending = this.pendingByUnitId.get(unitId);
      if (pending && !pending.qrcode) {
        pending.qrcode = await this.ensureQrcode(
          pending.instanceName,
          pending.evolutionToken,
          null,
        );
        this.setPending(pending);
        return {
          status: WhatsAppInstanceStatus.qr,
          instanceName: pending.instanceName,
          instanceId: pending.instanceName,
          qrcode: pending.qrcode,
          code: null,
        };
      }

      return {
        status: WhatsAppInstanceStatus.qr,
        instanceName: pendingStatus.instanceName,
        instanceId: pendingStatus.instanceId,
        qrcode: pendingStatus.qrcode || null,
        code: null,
      };
    }

    const status = await this.getStatus(unitId);
    return {
      ...status,
      qrcode: null,
      code: null,
    };
  }

  async cancelPairing(unitId: string) {
    await this.cancelPendingRemote(unitId);

    await this.prisma.whatsAppInstance.deleteMany({
      where: {
        unitId,
        status: { not: WhatsAppInstanceStatus.connected },
      },
    });

    return this.getStatus(unitId);
  }

  private logRemoteCleanupError(
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

  async disconnectAndDelete(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (pending) {
      this.clearHistorySync(pending.instanceName);
      try {
        await this.evolution.deleteInstance(
          pending.instanceName,
          pending.evolutionToken,
        );
      } catch (error) {
        this.logRemoteCleanupError(
          'excluir instância pendente',
          pending.instanceName,
          error,
        );
      }
      this.clearPending(unitId);
    }

    const instances = await this.prisma.whatsAppInstance.findMany({
      where: { unitId },
    });

    for (const instance of instances) {
      this.clearHistorySync(instance.evolutionInstanceName);
      try {
        await this.evolution.deleteInstance(
          instance.evolutionInstanceName,
          instance.evolutionToken || undefined,
        );
      } catch (error) {
        this.logRemoteCleanupError(
          'excluir instância',
          instance.evolutionInstanceName,
          error,
        );
      }
    }

    await this.prisma.whatsAppInstance.deleteMany({ where: { unitId } });

    return this.statusPayload({
      status: WhatsAppInstanceStatus.disconnected,
    });
  }

  private async cancelPendingRemote(unitId: string) {
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

  private async persistPairedInstance(pending: PendingPairing) {
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

  async handleWebhook(body: EvolutionApiWebhookBody) {
    const event = normalizeEvolutionApiEvent(body.event);
    const instanceName = body.instance;
    if (!event || !instanceName) {
      return { ok: true };
    }

    const pending = this.pendingByInstanceName.get(instanceName);
    const data = body.data as Record<string, unknown> | undefined;

    if (event === EvolutionApiEvent.QrcodeUpdated && pending) {
      const qrcode = await this.evolution.resolveQrImage(data);
      if (qrcode) {
        pending.qrcode = qrcode;
        this.setPending(pending);
        this.logQrCode(pending);
      } else {
        this.logger.warn(
          `Webhook QRCODE_UPDATED sem QR utilizável | instance=${instanceName}`,
        );
      }
      return { ok: true };
    }

    if (event === EvolutionApiEvent.ConnectionUpdate) {
      const state =
        typeof data?.state === 'string'
          ? data.state
          : typeof (data?.instance as { state?: string } | undefined)?.state ===
              'string'
            ? (data?.instance as { state?: string }).state
            : null;
      const webhookPhone = this.extractPhoneFromUnknown(data);

      if (state === 'open') {
        if (pending) {
          if (webhookPhone) {
            pending.phone = webhookPhone;
            this.setPending(pending);
          }
          this.markHistorySyncStarted(instanceName);
          await this.persistPairedInstance(pending);
          return { ok: true };
        }

        const instance = await this.prisma.whatsAppInstance.findUnique({
          where: { evolutionInstanceName: instanceName },
        });
        if (instance) {
          this.markHistorySyncStarted(instanceName);
          await this.prisma.whatsAppInstance.update({
            where: { id: instance.id },
            data: {
              status: WhatsAppInstanceStatus.connected,
              lastQrCode: null,
              ...(webhookPhone ? { phone: webhookPhone } : {}),
            },
          });
        }
        return { ok: true };
      }

      if (state === 'close') {
        this.clearHistorySync(instanceName);
        const instance = await this.prisma.whatsAppInstance.findUnique({
          where: { evolutionInstanceName: instanceName },
        });
        if (instance) {
          await this.prisma.whatsAppInstance.update({
            where: { id: instance.id },
            data: {
              status: WhatsAppInstanceStatus.disconnected,
              lastQrCode: null,
            },
          });
        }
      }
      return { ok: true };
    }

    if (event === EvolutionApiEvent.MessagesSet) {
      this.updateHistorySyncProgress(
        instanceName,
        this.parseSyncProgress(body.progress),
        body.isLatest === true,
      );
      return { ok: true };
    }

    if (event === EvolutionApiEvent.MessagesUpsert) {
      const instance = await this.prisma.whatsAppInstance.findUnique({
        where: { evolutionInstanceName: instanceName },
      });
      if (!instance) {
        return { ok: true };
      }
      await this.persistInboundMessage(instance, body.data);
    }

    return { ok: true };
  }

  private isAutoReplyTrigger(body: string) {
    return body.trim().toLowerCase() === 'oi';
  }

  private async persistInboundMessage(
    instance: {
      unitId: string;
      evolutionInstanceName: string;
      evolutionToken: string | null;
    },
    data: unknown,
  ) {
    type InboundItem = {
      key?: EvolutionMessageKey & {
        fromMe?: boolean;
        id?: string;
      };
      pushName?: string;
      message?: Record<string, unknown>;
      messageType?: string;
    };

    const payload = data as InboundItem | InboundItem[] | undefined;

    const items = Array.isArray(payload)
      ? payload
      : payload
        ? [payload]
        : [];

    for (const item of items) {
      if (!item?.key || item.key.fromMe) {
        continue;
      }

      const remoteJid = resolveContactJid(item.key);
      if (
        !remoteJid ||
        remoteJid === 'status@broadcast' ||
        remoteJid.endsWith('@g.us')
      ) {
        continue;
      }

      const body = this.extractMessageBody(item.message);
      if (!body) {
        continue;
      }

      const phone = this.phoneFromJid(remoteJid);
      const conversation = await this.prisma.conversation.upsert({
        where: {
          unitId_remoteJid: {
            unitId: instance.unitId,
            remoteJid,
          },
        },
        update: {
          contactName: item.pushName || undefined,
          phone: phone || undefined,
          updatedAt: new Date(),
        },
        create: {
          unitId: instance.unitId,
          remoteJid,
          phone,
          contactName: item.pushName || null,
        },
      });

      if (item.key.id) {
        const existing = await this.prisma.message.findFirst({
          where: { unitId: instance.unitId, externalId: item.key.id },
          select: { id: true },
        });
        if (existing) {
          continue;
        }
      }

      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          unitId: instance.unitId,
          direction: MessageDirection.inbound,
          body,
          externalId: item.key.id || null,
        },
      });

      if (this.isAutoReplyTrigger(body)) {
        const target = sendTargetFromJid(remoteJid, phone);
        if (target) {
          await this.sendAutoReply({
            unitId: instance.unitId,
            evolutionInstanceName: instance.evolutionInstanceName,
            evolutionToken: instance.evolutionToken,
            conversationId: conversation.id,
            number: target,
          });
        }
      }
    }
  }

  private async sendAutoReply(params: {
    unitId: string;
    evolutionInstanceName: string;
    evolutionToken: string | null;
    conversationId: string;
    number: string;
  }) {
    try {
      const sent = await this.evolution.sendText(
        params.evolutionInstanceName,
        params.number,
        BOT_AUTO_REPLY_TEXT,
        params.evolutionToken || undefined,
      );

      await this.prisma.message.create({
        data: {
          conversationId: params.conversationId,
          unitId: params.unitId,
          direction: MessageDirection.outbound,
          body: BOT_AUTO_REPLY_TEXT,
          externalId: sent.key?.id || null,
        },
      });

      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Falha ao enviar resposta automática | instance=${
          params.evolutionInstanceName
        } | to=${params.number} | ${describeEvolutionError(error)}`,
      );
    }
  }
}
