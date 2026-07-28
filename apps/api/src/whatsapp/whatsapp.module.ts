import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvolutionClient } from './evolution.client';
import { EvolutionWebhookController } from './evolution-webhook.controller';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappController, EvolutionWebhookController],
  providers: [EvolutionClient, WhatsappService, WebhookSecretGuard],
  exports: [WhatsappService, EvolutionClient],
})
export class WhatsappModule {}
