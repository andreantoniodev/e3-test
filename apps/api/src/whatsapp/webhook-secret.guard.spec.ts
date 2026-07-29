import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebhookSecretGuard } from './webhook-secret.guard';

function mockContext(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('WebhookSecretGuard', () => {
  const guard = new WebhookSecretGuard();
  const previousWebhook = process.env.WEBHOOK_SECRET;
  const previousApiKey = process.env.EVOLUTION_API_KEY;

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = 'webhook-secret';
    process.env.EVOLUTION_API_KEY = 'evo-key';
  });

  afterEach(() => {
    process.env.WEBHOOK_SECRET = previousWebhook;
    process.env.EVOLUTION_API_KEY = previousApiKey;
  });

  it('aceita secret no header x-webhook-secret', () => {
    expect(
      guard.canActivate(
        mockContext({
          headers: { 'x-webhook-secret': 'webhook-secret' },
          query: {},
          body: {},
        }),
      ),
    ).toBe(true);
  });

  it('aceita secret na query e remove sufixo /EVENTO', () => {
    expect(
      guard.canActivate(
        mockContext({
          headers: {},
          query: { secret: 'webhook-secret/QRCODE_UPDATED' },
          body: {},
        }),
      ),
    ).toBe(true);
  });

  it('aceita apikey no body', () => {
    expect(
      guard.canActivate(
        mockContext({
          headers: {},
          query: {},
          body: { apikey: 'evo-key' },
        }),
      ),
    ).toBe(true);
  });

  it('rejeita secret inválido', () => {
    expect(() =>
      guard.canActivate(
        mockContext({
          headers: { 'x-webhook-secret': 'errado' },
          query: {},
          body: {},
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejeita quando nenhum segredo está configurado', () => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.EVOLUTION_API_KEY;
    expect(() =>
      guard.canActivate(
        mockContext({
          headers: { 'x-webhook-secret': 'qualquer' },
          query: {},
          body: {},
        }),
      ),
    ).toThrow(UnauthorizedException);
  });
});
