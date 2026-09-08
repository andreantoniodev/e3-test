import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class InvalidWebhookPayloadException extends DomainException {
  constructor(details?: string) {
    const message = details
      ? `Payload do webhook inválido: ${details}`
      : 'Payload do webhook inválido.';
    super(message, HttpStatus.BAD_REQUEST);
  }
}
