import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppInstanceStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvolutionApiEvent, normalizeEvolutionApiEvent } from './evolution-api.events';
import { EvolutionClient } from './evolution.client';
import { WhatsappMessageService } from './services/whatsapp-message.service';
import { WhatsappPairingService } from './services/whatsapp-pairing.service';
import { WhatsappSyncService } from './services/whatsapp-sync.service';

type EvolutionApiWebhookBody = {
  event?: string;
  instance?: string;
  data?: unknown;
  progress?: number | string;
  isLatest?: boolean;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionClient,
    private readonly syncService: WhatsappSyncService,
    private readonly pairingService: WhatsappPairingService,
    private readonly messageService: WhatsappMessageService,
  ) {}

  private statusPayload(params: {
    status: WhatsAppInstanceStatus;
    instanceName?: string | null;
    instanceId?: string | null;
    phone?: string | null;
    qrcode?: string | null;
    code?: string | null;
  }) {
    const sync = this.syncService.getHistorySyncState(params.instanceName ?? null);
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

  private async promotePendingIfConnected(unitId: string) {
    const pending = this.pairingService.getPendingByUnitId(unitId);
    if (!pending) {
      return null;
    }

    try {
      if (
        await this.pairingService.isRemoteOpen(
          pending.instanceName,
          pending.evolutionToken,
        )
      ) {
        await this.pairingService.persistPairedInstance(pending);
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
        } | ${error instanceof Error ? error.message : error}`,
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
        await this.pairingService.isRemoteOpen(
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
        `Falha ao consultar status na Evolution API | instance=${
          instance.evolutionInstanceName
        } | ${error instanceof Error ? error.message : error}`,
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

    await this.pairingService.cancelPendingRemote(unitId);

    const saved = await this.prisma.whatsAppInstance.findFirst({
      where: { unitId },
    });

    if (saved) {
      this.syncService.clearHistorySync(saved.evolutionInstanceName);
      await this.pairingService.deleteRemoteInstance(
        saved.evolutionInstanceName,
        saved.evolutionToken,
      );
      await this.prisma.whatsAppInstance.delete({ where: { id: saved.id } });
    }

    const credentials = await this.pairingService.createRemoteCredentials(unitSlug);
    const qrcode = await this.pairingService.ensureQrcode(
      credentials.instanceName,
      credentials.evolutionToken,
      credentials.qrcode,
    );

    this.pairingService.setPending({
      unitId,
      unitSlug,
      instanceName: credentials.instanceName,
      evolutionToken: credentials.evolutionToken,
      qrcode,
      phone: null,
    });

    const pending = this.pairingService.getPendingByUnitId(unitId);
    if (pending) {
      this.pairingService.logQrCode(pending);
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

      const pending = this.pairingService.getPendingByUnitId(unitId);
      if (pending && !pending.qrcode) {
        pending.qrcode = await this.pairingService.ensureQrcode(
          pending.instanceName,
          pending.evolutionToken,
          null,
        );
        this.pairingService.setPending(pending);
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
    await this.pairingService.cancelPendingRemote(unitId);

    await this.prisma.whatsAppInstance.deleteMany({
      where: {
        unitId,
        status: { not: WhatsAppInstanceStatus.connected },
      },
    });

    return this.getStatus(unitId);
  }

  async disconnectAndDelete(unitId: string) {
    const pending = this.pairingService.getPendingByUnitId(unitId);
    if (pending) {
      this.syncService.clearHistorySync(pending.instanceName);
      try {
        await this.evolution.deleteInstance(
          pending.instanceName,
          pending.evolutionToken,
        );
      } catch (error) {
        this.pairingService.logRemoteCleanupError(
          'excluir instância pendente',
          pending.instanceName,
          error,
        );
      }
      this.pairingService.clearPending(unitId);
    }

    const instances = await this.prisma.whatsAppInstance.findMany({
      where: { unitId },
    });

    for (const instance of instances) {
      this.syncService.clearHistorySync(instance.evolutionInstanceName);
      try {
        await this.evolution.deleteInstance(
          instance.evolutionInstanceName,
          instance.evolutionToken || undefined,
        );
      } catch (error) {
        this.pairingService.logRemoteCleanupError(
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

  async handleWebhook(body: EvolutionApiWebhookBody) {
    const event = normalizeEvolutionApiEvent(body.event);
    const instanceName = body.instance;
    if (!event || !instanceName) {
      return { ok: true };
    }

    const pending = this.pairingService.getPendingByInstanceName(instanceName);
    const data = body.data as Record<string, unknown> | undefined;

    if (event === EvolutionApiEvent.QrcodeUpdated && pending) {
      const qrcode = await this.evolution.resolveQrImage(data);
      if (qrcode) {
        pending.qrcode = qrcode;
        this.pairingService.setPending(pending);
        this.pairingService.logQrCode(pending);
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
      const webhookPhone = this.pairingService.extractPhoneFromUnknown(data);

      if (state === 'open') {
        if (pending) {
          if (webhookPhone) {
            pending.phone = webhookPhone;
            this.pairingService.setPending(pending);
          }
          this.syncService.markHistorySyncStarted(instanceName);
          await this.pairingService.persistPairedInstance(pending);
          return { ok: true };
        }

        const instance = await this.prisma.whatsAppInstance.findUnique({
          where: { evolutionInstanceName: instanceName },
        });
        if (instance) {
          this.syncService.markHistorySyncStarted(instanceName);
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
        this.syncService.clearHistorySync(instanceName);
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
      this.syncService.updateHistorySyncProgress(
        instanceName,
        this.syncService.parseSyncProgress(body.progress),
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
      await this.messageService.persistInboundMessage(instance, body.data);
    }

    return { ok: true };
  }
}
