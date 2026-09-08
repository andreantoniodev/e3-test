import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EvolutionWebhookController } from '../src/whatsapp/evolution-webhook.controller';
import { WebhookSecretGuard } from '../src/whatsapp/webhook-secret.guard';

function mockContext(query: Record<string, string>, headers: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ query, headers }),
    }),
  } as ExecutionContext;
}

describe('Evolution Webhook (E2E Integration)', () => {
  const guard = new WebhookSecretGuard();

  const whatsappServiceMock = {
    handleWebhook: vi.fn().mockResolvedValue({ ok: true }),
  };

  const controller = new EvolutionWebhookController(whatsappServiceMock as never);

  beforeEach(() => {
    process.env.WEBHOOK_SECRET = 'webhook-secret-test';
    vi.clearAllMocks();
  });

  it('bloqueia requisição no guard quando secret query é ausente', () => {
    expect(() => guard.canActivate(mockContext({}))).toThrow(UnauthorizedException);
  });

  it('permite requisição com secret válido e processa o webhook com validação Zod', async () => {
    const authorized = guard.canActivate(
      mockContext({ secret: 'webhook-secret-test' }),
    );
    expect(authorized).toBe(true);

    whatsappServiceMock.handleWebhook.mockResolvedValue({ ok: true });

    const result = await controller.handle({
      event: 'messages.upsert',
      instance: 'unit-a',
      data: { key: { id: 'msg-e2e-1' } },
    });

    expect(result).toEqual({ ok: true });
    expect(whatsappServiceMock.handleWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'messages.upsert',
        instance: 'unit-a',
      }),
    );
  });
});
