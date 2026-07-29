import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { WhatsappService } from './whatsapp.service';

@Controller('webhooks')
export class EvolutionWebhookController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('evolution')
  @UseGuards(WebhookSecretGuard)
  handle(
    @Body()
    body: {
      event?: string;
      instance?: string;
      data?: unknown;
    },
  ) {
    return this.whatsappService.handleWebhook(body);
  }
}
