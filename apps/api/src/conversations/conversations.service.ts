import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WhatsAppInstanceStatus, MessageDirection } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvolutionClient } from '../whatsapp/evolution.client';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
  ) {}

  listByUnit(unitId: string) {
    return this.prisma.conversation.findMany({
      where: { unitId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        remoteJid: true,
        phone: true,
        contactName: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            body: true,
            direction: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async listMessages(unitId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, unitId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException();
    }

    return this.prisma.message.findMany({
      where: { conversationId, unitId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        conversationId: true,
        direction: true,
        body: true,
        externalId: true,
        createdAt: true,
      },
    });
  }

  async sendMessage(unitId: string, conversationId: string, body: string) {
    const text = body.trim();
    if (!text) {
      throw new BadRequestException('Mensagem vazia.');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, unitId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    const instance = await this.prisma.whatsAppInstance.findFirst({
      where: {
        unitId,
        status: WhatsAppInstanceStatus.connected,
        evolutionToken: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!instance?.evolutionToken) {
      throw new BadRequestException(
        'WhatsApp desconectado. Conecte uma instância para enviar mensagens.',
      );
    }

    const number =
      conversation.phone ||
      conversation.remoteJid.split('@')[0]?.split(':')[0] ||
      '';

    if (!number) {
      throw new BadRequestException('Número do contato inválido.');
    }

    const sent = await this.evolution.sendText(
      instance.evolutionInstanceName,
      instance.evolutionToken,
      number,
      text,
    );

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        unitId,
        direction: MessageDirection.outbound,
        body: text,
        externalId: sent.data?.Info?.ID || null,
      },
      select: {
        id: true,
        conversationId: true,
        direction: true,
        body: true,
        externalId: true,
        createdAt: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async remove(unitId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, unitId },
      select: { id: true },
    });

    if (!conversation) {
      throw new NotFoundException();
    }

    await this.prisma.$transaction([
      this.prisma.message.deleteMany({
        where: { conversationId, unitId },
      }),
      this.prisma.conversation.delete({
        where: { id: conversationId },
      }),
    ]);
  }
}
