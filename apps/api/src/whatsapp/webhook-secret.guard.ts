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
    const expectedWebhook = (process.env.WEBHOOK_SECRET || '').trim();
    const expectedApiKey = (process.env.EVOLUTION_API_KEY || '').trim();
    const allowed = new Set(
      [expectedWebhook, expectedApiKey].filter((value) => Boolean(value)),
    );

    if (allowed.size === 0) {
      throw new UnauthorizedException();
    }

    const header =
      (request.headers['x-webhook-secret'] as string | undefined) ||
      (request.headers['apikey'] as string | undefined) ||
      (request.headers['authorization'] as string | undefined);

    const fromHeader = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : header?.trim();

    const querySecretRaw =
      typeof request.query?.secret === 'string' ? request.query.secret : undefined;
    // byEvents pode anexar "/evento" ao fim da query.
    const querySecret = querySecretRaw?.split('/')[0]?.trim();

    const bodyApiKey =
      request.body && typeof request.body.apikey === 'string'
        ? String(request.body.apikey).trim()
        : undefined;

    const provided = fromHeader || querySecret || bodyApiKey;
    if (!provided || !allowed.has(provided)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
