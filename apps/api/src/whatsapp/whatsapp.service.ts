import { Injectable, NotFoundException } from '@nestjs/common';
import { WhatsAppInstanceStatus } from '../generated/prisma/client';
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

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
  ) {}

  private instanceNameForUnit(unitSlug: string) {
    return `unit-${unitSlug}`;
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

  async getStatus(unitId: string) {
    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId },
    });

    if (!instance) {
      return {
        status: WhatsAppInstanceStatus.disconnected,
        instanceName: null,
        instanceId: null,
      };
    }

    try {
      const remote = await this.evolution.status(instance.evolutionInstanceName);
      const connected = Boolean(remote.data?.Connected);
      const mapped = connected
        ? WhatsAppInstanceStatus.connected
        : instance.status === WhatsAppInstanceStatus.qr
          ? WhatsAppInstanceStatus.qr
          : WhatsAppInstanceStatus.disconnected;

      if (mapped !== instance.status) {
        await this.prisma.whatsAppInstance.update({
          where: { id: instance.id },
          data: { status: mapped },
        });
      }

      return {
        status: mapped,
        instanceName: this.instanceNameForUnit(
          (
            await this.prisma.unit.findUniqueOrThrow({
              where: { id: unitId },
              select: { slug: true },
            })
          ).slug,
        ),
        instanceId: instance.evolutionInstanceName,
      };
    } catch {
      return {
        status: instance.status,
        instanceName: null,
        instanceId: instance.evolutionInstanceName,
      };
    }
  }

  async connect(unitId: string, unitSlug: string) {
    const instanceName = this.instanceNameForUnit(unitSlug);
    let instance = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId },
    });

    if (!instance) {
      const created = await this.evolution.createInstance(instanceName);
      const evolutionId = created.data?.id;
      if (!evolutionId) {
        throw new NotFoundException();
      }

      instance = await this.prisma.whatsAppInstance.create({
        data: {
          unitId,
          evolutionInstanceName: evolutionId,
          status: WhatsAppInstanceStatus.disconnected,
        },
      });
    }

    await this.evolution.connect(instance.evolutionInstanceName, {
      webhookUrl: this.webhookUrl(),
      subscribe: ['MESSAGE', 'CONNECTION', 'QRCODE'],
      immediate: true,
    });

    await this.prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: { status: WhatsAppInstanceStatus.qr },
    });

    const refreshed = await this.prisma.whatsAppInstance.findUniqueOrThrow({
      where: { id: instance.id },
    });

    return {
      status: WhatsAppInstanceStatus.qr,
      instanceName,
      instanceId: refreshed.evolutionInstanceName,
      qrcode: refreshed.lastQrCode,
      code: null,
    };
  }

  async getQr(unitId: string) {
    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId },
    });

    if (!instance) {
      throw new NotFoundException();
    }

    const state = await this.getStatus(unitId);
    if (state.status === WhatsAppInstanceStatus.connected) {
      return {
        status: WhatsAppInstanceStatus.connected,
        instanceName: state.instanceName,
        instanceId: instance.evolutionInstanceName,
        qrcode: null,
        code: null,
      };
    }

    if (!instance.lastQrCode) {
      await this.evolution.connect(instance.evolutionInstanceName, {
        webhookUrl: this.webhookUrl(),
        subscribe: ['MESSAGE', 'CONNECTION', 'QRCODE'],
        immediate: true,
      });
      await this.prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: { status: WhatsAppInstanceStatus.qr },
      });
    }

    const refreshed = await this.prisma.whatsAppInstance.findUniqueOrThrow({
      where: { id: instance.id },
    });

    return {
      status: WhatsAppInstanceStatus.qr,
      instanceName: state.instanceName,
      instanceId: refreshed.evolutionInstanceName,
      qrcode: refreshed.lastQrCode,
      code: null,
    };
  }

  async handleWebhook(body: EvolutionGoWebhookBody) {
    const event = body.event || '';
    const instanceId = body.instanceId;
    if (!instanceId) {
      return { ok: true };
    }

    const instance = await this.prisma.whatsAppInstance.findUnique({
      where: { evolutionInstanceName: instanceId },
    });

    if (!instance) {
      return { ok: true };
    }

    if (event === EvolutionGoEvent.QRCode) {
      const data = body.data as { qrcode?: string; code?: string } | undefined;
      await this.prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: {
          status: WhatsAppInstanceStatus.qr,
          lastQrCode: data?.qrcode || null,
        },
      });
      return { ok: true };
    }

    if (EVOLUTION_GO_CONNECTED_EVENTS.has(event)) {
      await this.prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: {
          status: WhatsAppInstanceStatus.connected,
          lastQrCode: null,
        },
      });
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
      await this.persistInboundMessage(instance.unitId, body.data);
    }

    return { ok: true };
  }

  private async persistInboundMessage(unitId: string, data: unknown) {
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
          unitId,
          remoteJid,
        },
      },
      update: {
        contactName: payload.Info.PushName || undefined,
        phone: phone || undefined,
        updatedAt: new Date(),
      },
      create: {
        unitId,
        remoteJid,
        phone,
        contactName: payload.Info.PushName || null,
      },
    });

    if (payload.Info.ID) {
      const existing = await this.prisma.message.findFirst({
        where: { unitId, externalId: payload.Info.ID },
        select: { id: true },
      });
      if (existing) {
        return;
      }
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        unitId,
        direction: 'inbound',
        body,
        externalId: payload.Info.ID || null,
      },
    });
  }
}
