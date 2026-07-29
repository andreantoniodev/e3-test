import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = (process.env.ADMIN_SECRET || '').trim();
    if (!expected) {
      throw new UnauthorizedException(
        'ADMIN_SECRET não configurado na API. Defina a variável de ambiente ADMIN_SECRET.',
      );
    }

    const request = context.switchToHttp().getRequest();
    const header =
      (request.headers['x-admin-secret'] as string | undefined) ||
      (request.headers['authorization'] as string | undefined);

    let provided = '';
    if (header?.startsWith('Bearer ')) {
      provided = header.slice('Bearer '.length).trim();
    } else if (header) {
      provided = header.trim();
    }

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Secret de admin inválido.');
    }

    return true;
  }
}
