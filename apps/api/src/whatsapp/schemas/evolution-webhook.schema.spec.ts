import { describe, expect, it } from 'vitest';
import { EvolutionApiWebhookBodySchema } from './evolution-webhook.schema';

describe('EvolutionApiWebhookBodySchema', () => {
  it('valida payload do webhook válido com sucesso', () => {
    const valid = {
      event: 'messages.upsert',
      instance: 'unit-a',
      data: { key: { id: 'msg-1' } },
      progress: 50,
      isLatest: true,
    };

    const result = EvolutionApiWebhookBodySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event).toBe('messages.upsert');
      expect(result.data.instance).toBe('unit-a');
    }
  });

  it('aceita payload vazio ou mínimo', () => {
    const minimal = {};
    const result = EvolutionApiWebhookBodySchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});
