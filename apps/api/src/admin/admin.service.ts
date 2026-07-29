import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const unitSelect = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      users: true,
      conversations: true,
      instances: true,
    },
  },
} as const;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  listUnits() {
    return this.prisma.unit.findMany({
      orderBy: { name: 'asc' },
      select: unitSelect,
    });
  }

  async createUnit(input: { name: string; slug?: string }) {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Informe o nome da unidade.');
    }

    const slug = slugify(input.slug?.trim() || name);
    if (!slug) {
      throw new BadRequestException('Slug inválido.');
    }

    const existing = await this.prisma.unit.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Já existe uma unidade com este slug.');
    }

    return this.prisma.unit.create({
      data: { name, slug },
      select: unitSelect,
    });
  }

  async updateUnit(
    id: string,
    input: { name?: string; slug?: string },
  ) {
    const existing = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Unidade não encontrada.');
    }

    const data: { name?: string; slug?: string } = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException('Informe o nome da unidade.');
      }
      data.name = name;
    }

    if (input.slug !== undefined) {
      const slug = slugify(input.slug);
      if (!slug) {
        throw new BadRequestException('Slug inválido.');
      }
      const conflict = await this.prisma.unit.findFirst({
        where: { slug, NOT: { id } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException('Já existe uma unidade com este slug.');
      }
      data.slug = slug;
    }

    if (!data.name && !data.slug) {
      throw new BadRequestException('Nada para atualizar.');
    }

    return this.prisma.unit.update({
      where: { id },
      data,
      select: unitSelect,
    });
  }

  async deleteUnit(id: string) {
    const existing = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw new NotFoundException('Unidade não encontrada.');
    }

    try {
      await this.whatsappService.disconnectAndDelete(id);
    } catch (error) {
      this.logger.warn(
        `Falha ao limpar WhatsApp da unidade ${id}; seguindo com exclusão local | ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.message.deleteMany({ where: { unitId: id } }),
      this.prisma.conversation.deleteMany({ where: { unitId: id } }),
      this.prisma.whatsAppInstance.deleteMany({ where: { unitId: id } }),
      this.prisma.user.deleteMany({ where: { unitId: id } }),
      this.prisma.unit.delete({ where: { id } }),
    ]);

    return { ok: true };
  }

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        unitId: true,
        createdAt: true,
        updatedAt: true,
        unit: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async upsertUser(input: { email: string; unitId: string; name?: string }) {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('E-mail inválido.');
    }
    if (!input.unitId.trim()) {
      throw new BadRequestException('Selecione uma unidade.');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: input.unitId },
      select: { id: true, name: true, slug: true },
    });

    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }

    const name =
      input.name === undefined ? undefined : input.name.trim() || null;

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {
        unitId: unit.id,
        ...(name !== undefined ? { name } : {}),
      },
      create: {
        email,
        name: name ?? null,
        unitId: unit.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        unitId: true,
        createdAt: true,
        updatedAt: true,
        unit: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return user;
  }

  async deleteUser(id: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
