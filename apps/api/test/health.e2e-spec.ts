import { describe, expect, it } from 'vitest';
import { HealthController } from '../src/health/health.controller';

describe('HealthController (E2E Integration)', () => {
  const controller = new HealthController();

  it('GET /health Handler retorna ok: true', () => {
    const response = controller.check();
    expect(response).toEqual({ ok: true });
  });
});
