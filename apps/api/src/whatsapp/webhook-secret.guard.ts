import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class WebhookSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expected = process.env.WEBHOOK_SECRET || '';

    if (!expected) {
      throw new UnauthorizedException();
    }

    const header =
      (request.headers['x-webhook-secret'] as string | undefined) ||
      (request.headers['authorization'] as string | undefined);
    const querySecret =
      typeof request.query?.secret === 'string' ? request.query.secret : undefined;

    const fromHeader = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : header?.trim();

    const provided = querySecret || fromHeader;
    if (!provided || provided !== expected) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
