import { describe, expect, it } from 'vitest';
import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  const options = {
    throttlers: [{ name: 'default', ttl: 60000, limit: 10 }],
  };

  const guard = new CustomThrottlerGuard(options as never, {} as never, {} as never);

  it('gera chave de rastreamento baseada no ID do usuário autenticado', async () => {
    const req = { user: { id: 'usr-123' }, ip: '127.0.0.1' };
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('user-usr-123');
  });

  it('gera chave de rastreamento baseada no cabeçalho x-forwarded-for ou IP para requisição anônima', async () => {
    const reqWithForwarded = { headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' } };
    const trackerForwarded = await (guard as any).getTracker(reqWithForwarded);
    expect(trackerForwarded).toBe('ip-203.0.113.195');

    const reqWithIp = { ip: '192.168.1.1' };
    const trackerIp = await (guard as any).getTracker(reqWithIp);
    expect(trackerIp).toBe('ip-192.168.1.1');
  });
});
