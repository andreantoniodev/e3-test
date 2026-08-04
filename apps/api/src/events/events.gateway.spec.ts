import { describe, expect, it, vi } from 'vitest';
import { EventsGateway } from './events.gateway';

describe('EventsGateway', () => {
  const gateway = new EventsGateway();

  it('adiciona socket ao canal da unidade no momento da conexão', () => {
    const joinMock = vi.fn();
    const client = {
      id: 'socket-123',
      handshake: { query: { unitId: 'unit-a' } },
      join: joinMock,
    } as any;

    gateway.handleConnection(client);
    expect(joinMock).toHaveBeenCalledWith('unit:unit-a');
  });

  it('emite evento WebSocket direcionado para a sala da unidade', () => {
    const emitMock = vi.fn();
    const toMock = vi.fn().mockReturnValue({ emit: emitMock });

    gateway.server = { to: toMock } as any;

    gateway.emitToUnit('unit-a', 'message:created', { id: 'msg-1' });

    expect(toMock).toHaveBeenCalledWith('unit:unit-a');
    expect(emitMock).toHaveBeenCalledWith('message:created', { id: 'msg-1' });
  });
});
