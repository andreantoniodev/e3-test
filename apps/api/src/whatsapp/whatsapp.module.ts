import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvolutionClient } from './evolution.client';
import { EvolutionWebhookController } from './evolution-webhook.controller';
import { WhatsappMessageService } from './services/whatsapp-message.service';
import { WhatsappPairingService } from './services/whatsapp-pairing.service';
import { WhatsappSyncService } from './services/whatsapp-sync.service';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappController, EvolutionWebhookController],
  providers: [
    EvolutionClient,
    WhatsappSyncService,
    WhatsappPairingService,
    WhatsappMessageService,
    WhatsappService,
    WebhookSecretGuard,
  ],
  exports: [
    WhatsappService,
    WhatsappSyncService,
    WhatsappPairingService,
    WhatsappMessageService,
    EvolutionClient,
  ],
})
export class WhatsappModule {}
