import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BOT_AUTO_REPLY_TEXT } from '../constants';
import { MessageDirection, WhatsAppInstanceStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  EVOLUTION_GO_CONNECTED_EVENTS,
  EvolutionGoEvent,
} from './evolution-go.events';
import { EvolutionClient } from './evolution.client';

type EvolutionGoWebhookBody = {
  event?: string;
  instanceId?: string;
  instanceToken?: string;
  data?: unknown;
};

type PendingPairing = {
  unitId: string;
  unitSlug: string;
  instanceName: string;
  evolutionInstanceId: string;
  evolutionToken: string;
  qrcode: string | null;
  phone: string | null;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly pendingByUnitId = new Map<string, PendingPairing>();
  private readonly pendingByEvolutionId = new Map<string, PendingPairing>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
  ) {}

  private phoneFromJid(jid: string | null | undefined) {
    if (!jid) {
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
    const candidates = [record.phone, record.Phone, record.jid, record.Jid, record.wid];
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

  private async resolveInstancePhone(
    instanceId: string,
    _instanceToken?: string,
    fallbackPhone?: string | null,
  ) {
    if (fallbackPhone) {
      return fallbackPhone;
    }
    try {
      const info = await this.evolution.info(instanceId);
      return this.extractPhoneFromUnknown(info.data);
    } catch {
      try {
        const listed = await this.evolution.listInstances();
        const match = listed.find((item) => item.id === instanceId);
        return this.extractPhoneFromUnknown(match);
      } catch {
        return null;
      }
    }
  }

  private statusPayload(params: {
    status: WhatsAppInstanceStatus;
    instanceName?: string | null;
    instanceId?: string | null;
    phone?: string | null;
    qrcode?: string | null;
    code?: string | null;
  }) {
    return {
      status: params.status,
      instanceName: params.instanceName ?? null,
      instanceId: params.instanceId ?? null,
      phone: params.phone ?? null,
      qrcode: params.qrcode ?? null,
      code: params.code ?? null,
    };
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
      this.pendingByEvolutionId.delete(previous.evolutionInstanceId);
    }
    this.pendingByUnitId.set(pending.unitId, pending);
    this.pendingByEvolutionId.set(pending.evolutionInstanceId, pending);
  }

  private clearPending(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (!pending) {
      return;
    }
    this.pendingByUnitId.delete(unitId);
    this.pendingByEvolutionId.delete(pending.evolutionInstanceId);
  }

  private logQrCode(pending: PendingPairing) {
    if (!pending.qrcode) {
      this.logger.warn(
        `QR Code ainda não disponível | unit=${pending.unitSlug} | instance=${pending.evolutionInstanceId}`,
      );
      return;
    }

    this.logger.log(
      `QR Code gerado | unit=${pending.unitSlug} | instance=${pending.evolutionInstanceId}`,
    );
    this.logger.log(pending.qrcode);
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
    const evolutionToken = randomUUID();
    const created = await this.evolution.createInstance(
      instanceName,
      evolutionToken,
    );
    const evolutionInstanceId =
      created.data?.id || created.data?.token || evolutionToken;
    const savedToken = created.data?.token || evolutionToken;

    return {
      instanceName,
      evolutionInstanceId,
      evolutionToken: savedToken,
    };
  }

  private async promotePendingIfLoggedIn(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (!pending) {
      return null;
    }

    try {
      const remote = await this.evolution.status(
        pending.evolutionInstanceId,
        pending.evolutionToken,
      );
      if (remote.data?.LoggedIn === true) {
        if (!pending.phone) {
          pending.phone = await this.resolveInstancePhone(
            pending.evolutionInstanceId,
            pending.evolutionToken,
          );
          this.setPending(pending);
        }
        await this.persistPairedInstance(pending);
        return this.statusPayload({
          status: WhatsAppInstanceStatus.connected,
          instanceName: pending.instanceName,
          instanceId: pending.evolutionInstanceId,
          phone: pending.phone,
        });
      }
    } catch {
      // keep waiting for QR / webhook
    }

    return this.statusPayload({
      status: WhatsAppInstanceStatus.qr,
      instanceName: pending.instanceName,
      instanceId: pending.evolutionInstanceId,
      phone: pending.phone,
      qrcode: pending.qrcode,
    });
  }

  async getStatus(unitId: string) {
    const pendingStatus = await this.promotePendingIfLoggedIn(unitId);
    if (pendingStatus) {
      return pendingStatus;
    }

    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!instance?.evolutionToken) {
      return this.statusPayload({
        status: WhatsAppInstanceStatus.disconnected,
      });
    }

    try {
      const remote = await this.evolution.status(
        instance.evolutionInstanceName,
        instance.evolutionToken,
      );
      if (remote.data?.LoggedIn === true) {
        let phone = instance.phone;
        if (!phone) {
          phone = await this.resolveInstancePhone(
            instance.evolutionInstanceName,
            instance.evolutionToken,
          );
        }

        if (
          instance.status !== WhatsAppInstanceStatus.connected ||
          (phone && phone !== instance.phone)
        ) {
          await this.prisma.whatsAppInstance.update({
            where: { id: instance.id },
            data: {
              status: WhatsAppInstanceStatus.connected,
              lastQrCode: null,
              ...(phone ? { phone } : {}),
            },
          });
        }

        return this.statusPayload({
          status: WhatsAppInstanceStatus.connected,
          instanceName: instance.evolutionInstanceName,
          instanceId: instance.evolutionInstanceName,
          phone,
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
        `Falha ao consultar status na Evolution | instance=${instance.evolutionInstanceName} | ${error instanceof Error ? error.message : error}`,
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

    let credentials: {
      instanceName: string;
      evolutionInstanceId: string;
      evolutionToken: string;
    };

    if (saved?.evolutionToken) {
      credentials = {
        instanceName: saved.evolutionInstanceName,
        evolutionInstanceId: saved.evolutionInstanceName,
        evolutionToken: saved.evolutionToken,
      };
    } else {
      if (saved) {
        await this.prisma.whatsAppInstance.delete({ where: { id: saved.id } });
      }
      credentials = await this.createRemoteCredentials(unitSlug);
    }

    this.setPending({
      unitId,
      unitSlug,
      instanceName: credentials.instanceName,
      evolutionInstanceId: credentials.evolutionInstanceId,
      evolutionToken: credentials.evolutionToken,
      qrcode: null,
      phone: null,
    });

    await this.evolution.connect(
      credentials.evolutionInstanceId,
      credentials.evolutionToken,
      {
        webhookUrl: this.webhookUrl(),
        subscribe: ['MESSAGE', 'CONNECTION', 'QRCODE'],
        immediate: true,
      },
    );

    const pending = this.pendingByUnitId.get(unitId);
    this.logQrCode(
      pending || {
        unitId,
        unitSlug,
        instanceName: credentials.instanceName,
        evolutionInstanceId: credentials.evolutionInstanceId,
        evolutionToken: credentials.evolutionToken,
        qrcode: null,
        phone: null,
      },
    );

    return this.statusPayload({
      status: WhatsAppInstanceStatus.qr,
      instanceName: credentials.instanceName,
      instanceId: credentials.evolutionInstanceId,
      qrcode: pending?.qrcode || null,
    });
  }

  async getQr(unitId: string) {
    const pendingStatus = await this.promotePendingIfLoggedIn(unitId);
    if (pendingStatus) {
      if (pendingStatus.status === WhatsAppInstanceStatus.connected) {
        return {
          ...pendingStatus,
          qrcode: null,
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
      `Falha ao ${action} na Evolution | instance=${instanceId} | ${
        error instanceof Error ? error.message : error
      }`,
    );
  }

  async disconnectAndDelete(unitId: string) {
    const pending = this.pendingByUnitId.get(unitId);
    if (pending) {
      try {
        await this.evolution.deleteInstance(
          pending.evolutionInstanceId,
          pending.evolutionToken,
        );
      } catch (error) {
        this.logRemoteCleanupError(
          'excluir instância pendente',
          pending.evolutionInstanceId,
          error,
        );
      }
      this.clearPending(unitId);
    }

    const instances = await this.prisma.whatsAppInstance.findMany({
      where: { unitId },
    });

    for (const instance of instances) {
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
        pending.evolutionInstanceId,
        pending.evolutionToken,
      );
    } catch (deleteError) {
      this.logRemoteCleanupError(
        'excluir instância pendente',
        pending.evolutionInstanceId,
        deleteError,
      );
      try {
        await this.evolution.disconnect(
          pending.evolutionInstanceId,
          pending.evolutionToken,
        );
      } catch (disconnectError) {
        this.logRemoteCleanupError(
          'desconectar instância pendente',
          pending.evolutionInstanceId,
          disconnectError,
        );
      }
    }

    this.clearPending(unitId);
  }

  private async persistPairedInstance(pending: PendingPairing) {
    const phone =
      pending.phone ||
      (await this.resolveInstancePhone(
        pending.evolutionInstanceId,
        pending.evolutionToken,
      ));

    const existing = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId: pending.unitId },
    });

    if (existing) {
      await this.prisma.whatsAppInstance.update({
        where: { id: existing.id },
        data: {
          evolutionInstanceName: pending.evolutionInstanceId,
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
          evolutionInstanceName: pending.evolutionInstanceId,
          evolutionToken: pending.evolutionToken,
          phone,
          status: WhatsAppInstanceStatus.connected,
          lastQrCode: null,
        },
      });
    }

    this.clearPending(pending.unitId);
  }

  async handleWebhook(body: EvolutionGoWebhookBody) {
    const event = body.event || '';
    const instanceId = body.instanceId;
    if (!instanceId) {
      return { ok: true };
    }

    const pending = this.pendingByEvolutionId.get(instanceId);
    const webhookPhone = this.extractPhoneFromUnknown(body.data);

    if (event === EvolutionGoEvent.QRCode && pending) {
      const data = body.data as { qrcode?: string; code?: string } | undefined;
      pending.qrcode = data?.qrcode || null;
      this.setPending(pending);
      this.logQrCode(pending);
      return { ok: true };
    }

    if (
      pending &&
      (EVOLUTION_GO_CONNECTED_EVENTS.has(event) ||
        (event === EvolutionGoEvent.Connected &&
          (body.data as { LoggedIn?: boolean } | undefined)?.LoggedIn === true))
    ) {
      if (webhookPhone) {
        pending.phone = webhookPhone;
        this.setPending(pending);
      }
      await this.persistPairedInstance(pending);
      return { ok: true };
    }

    if (event === EvolutionGoEvent.Connected && pending) {
      const data = body.data as { LoggedIn?: boolean } | undefined;
      if (data?.LoggedIn === true) {
        if (webhookPhone) {
          pending.phone = webhookPhone;
          this.setPending(pending);
        }
        await this.persistPairedInstance(pending);
      }
      return { ok: true };
    }

    const instance = await this.prisma.whatsAppInstance.findUnique({
      where: { evolutionInstanceName: instanceId },
    });

    if (!instance) {
      return { ok: true };
    }

    if (EVOLUTION_GO_CONNECTED_EVENTS.has(event)) {
      await this.prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: {
          status: WhatsAppInstanceStatus.connected,
          lastQrCode: null,
          ...(webhookPhone ? { phone: webhookPhone } : {}),
        },
      });
      return { ok: true };
    }

    if (event === EvolutionGoEvent.Connected) {
      const data = body.data as { LoggedIn?: boolean } | undefined;
      if (data?.LoggedIn === true) {
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

    if (event === EvolutionGoEvent.LoggedOut) {
      await this.prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: { status: WhatsAppInstanceStatus.disconnected, lastQrCode: null },
      });
      return { ok: true };
    }

    if (event === EvolutionGoEvent.Message) {
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
    const payload = data as
      | {
          Info?: {
            Chat?: string;
            Sender?: string;
            IsFromMe?: boolean;
            IsGroup?: boolean;
            ID?: string;
            PushName?: string;
          };
          Message?: Record<string, unknown>;
        }
      | undefined;

    if (!payload?.Info || payload.Info.IsFromMe || payload.Info.IsGroup) {
      return;
    }

    const remoteJid = payload.Info.Chat;
    if (!remoteJid || remoteJid === 'status@broadcast') {
      return;
    }

    const body = this.extractMessageBody(payload.Message);
    if (!body) {
      return;
    }

    const phone = remoteJid.split('@')[0] || null;
    const conversation = await this.prisma.conversation.upsert({
      where: {
        unitId_remoteJid: {
          unitId: instance.unitId,
          remoteJid,
        },
      },
      update: {
        contactName: payload.Info.PushName || undefined,
        phone: phone || undefined,
        updatedAt: new Date(),
      },
      create: {
        unitId: instance.unitId,
        remoteJid,
        phone,
        contactName: payload.Info.PushName || null,
      },
    });

    if (payload.Info.ID) {
      const existing = await this.prisma.message.findFirst({
        where: { unitId: instance.unitId, externalId: payload.Info.ID },
        select: { id: true },
      });
      if (existing) {
        return;
      }
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        unitId: instance.unitId,
        direction: MessageDirection.inbound,
        body,
        externalId: payload.Info.ID || null,
      },
    });

    if (this.isAutoReplyTrigger(body) && phone && instance.evolutionToken) {
      await this.sendAutoReply({
        unitId: instance.unitId,
        evolutionInstanceId: instance.evolutionInstanceName,
        evolutionToken: instance.evolutionToken,
        conversationId: conversation.id,
        number: phone,
      });
    }
  }

  private async sendAutoReply(params: {
    unitId: string;
    evolutionInstanceId: string;
    evolutionToken: string;
    conversationId: string;
    number: string;
  }) {
    try {
      const sent = await this.evolution.sendText(
        params.evolutionInstanceId,
        params.evolutionToken,
        params.number,
        BOT_AUTO_REPLY_TEXT,
      );

      await this.prisma.message.create({
        data: {
          conversationId: params.conversationId,
          unitId: params.unitId,
          direction: MessageDirection.outbound,
          body: BOT_AUTO_REPLY_TEXT,
          externalId: sent.data?.Info?.ID || null,
        },
      });

      await this.prisma.conversation.update({
        where: { id: params.conversationId },
        data: { updatedAt: new Date() },
      });
    } catch {
      return;
    }
  }
}
