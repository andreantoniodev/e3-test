import { describe, expect, it } from 'vitest';
import { WhatsappSyncService } from './whatsapp-sync.service';

describe('WhatsappSyncService', () => {
  const service = new WhatsappSyncService();

  it('retorna syncing: false quando não há instância ativa', () => {
    const state = service.getHistorySyncState(null);
    expect(state).toEqual({ syncing: false, progress: null });
  });

  it('gerencia o ciclo de vida do progresso de sincronização', () => {
    service.markHistorySyncStarted('unit-test');
    let state = service.getHistorySyncState('unit-test');
    expect(state.syncing).toBe(true);
    expect(state.progress).toBe(0);

    service.updateHistorySyncProgress('unit-test', 50);
    state = service.getHistorySyncState('unit-test');
    expect(state.syncing).toBe(true);
    expect(state.progress).toBe(50);

    service.updateHistorySyncProgress('unit-test', 100);
    state = service.getHistorySyncState('unit-test');
    expect(state.syncing).toBe(false);
    expect(state.progress).toBe(100);
  });

  it('converte valores brutos em porcentagem parseada', () => {
    expect(service.parseSyncProgress(75.4)).toBe(75);
    expect(service.parseSyncProgress('90')).toBe(90);
    expect(service.parseSyncProgress('invalid')).toBe(null);
  });
});
