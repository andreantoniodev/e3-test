import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

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
