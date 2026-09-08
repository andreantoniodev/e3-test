import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InvalidWebhookPayloadException } from '../common/exceptions';
import { EvolutionApiWebhookBodySchema } from './schemas/evolution-webhook.schema';
import { WebhookSecretGuard } from './webhook-secret.guard';
import { WhatsappService } from './whatsapp.service';

@Controller('webhooks')
export class EvolutionWebhookController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('evolution')
  @UseGuards(WebhookSecretGuard)
  handle(@Body() body: unknown) {
    const result = EvolutionApiWebhookBodySchema.safeParse(body);
    if (!result.success) {
      throw new InvalidWebhookPayloadException(result.error.message);
    }
    return this.whatsappService.handleWebhook(result.data);
  }
}
