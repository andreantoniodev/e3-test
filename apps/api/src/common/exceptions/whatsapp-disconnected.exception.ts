import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class WhatsAppDisconnectedException extends DomainException {
  constructor(message = 'Instância do WhatsApp desconectada ou indisponível.') {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
