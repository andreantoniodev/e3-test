import { ForbiddenException } from '@nestjs/common';

export class UserNotLinkedException extends ForbiddenException {
  constructor(email?: string) {
    const message = email
      ? `E-mail '${email}' não está vinculado a nenhuma unidade.`
      : 'Usuário não vinculado a nenhuma unidade.';
    super(message);
  }
}
