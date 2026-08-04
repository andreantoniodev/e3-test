import { Injectable, Logger } from '@nestjs/common';
import { BOT_AUTO_REPLY_TEXT } from '../../constants';
import { MessageDirection } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { describeEvolutionError, EvolutionClient } from '../evolution.client';
import {
  EvolutionMessageKey,
  resolveContactJid,
  sendTargetFromJid,
} from '../jid';
import { WhatsappPairingService } from './whatsapp-pairing.service';

@Injectable()
export class WhatsappMessageService {
  private readonly logger = new Logger(WhatsappMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
    private readonly pairingService: WhatsappPairingService,
  ) {}

  extractMessageBody(message: Record<string, unknown> | undefined) {
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

  isAutoReplyTrigger(body: string) {
    return body.trim().toLowerCase() === 'oi';
  }

  async persistInboundMessage(
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

      const phone = this.pairingService.phoneFromJid(remoteJid);
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

  async sendAutoReply(params: {
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
