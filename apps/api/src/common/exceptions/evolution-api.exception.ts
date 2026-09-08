import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class EvolutionApiException extends DomainException {
  constructor(message = 'Falha na comunicação com a Evolution API.') {
    super(message, HttpStatus.BAD_GATEWAY);
  }
}
