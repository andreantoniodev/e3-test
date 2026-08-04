import { Injectable } from '@nestjs/common';

export type HistorySyncState = {
  syncing: boolean;
  progress: number | null;
  updatedAt: number;
};

const HISTORY_SYNC_IDLE_MS = 45_000;

@Injectable()
export class WhatsappSyncService {
  private readonly syncByInstanceName = new Map<string, HistorySyncState>();

  getHistorySyncState(instanceName: string | null | undefined) {
    if (!instanceName) {
      return { syncing: false, progress: null as number | null };
    }

    const current = this.syncByInstanceName.get(instanceName);
    if (!current) {
      return { syncing: false, progress: null as number | null };
    }

    if (
      current.syncing &&
      Date.now() - current.updatedAt > HISTORY_SYNC_IDLE_MS
    ) {
      const settled = {
        syncing: false,
        progress: current.progress ?? 100,
        updatedAt: Date.now(),
      };
      this.syncByInstanceName.set(instanceName, settled);
      return { syncing: false, progress: settled.progress };
    }

    return { syncing: current.syncing, progress: current.progress };
  }

  markHistorySyncStarted(instanceName: string) {
    this.syncByInstanceName.set(instanceName, {
      syncing: true,
      progress: 0,
      updatedAt: Date.now(),
    });
  }

  updateHistorySyncProgress(
    instanceName: string,
    progress: number | null,
    isLatest?: boolean,
  ) {
    const previous = this.syncByInstanceName.get(instanceName);
    const nextProgress =
      progress ?? previous?.progress ?? (isLatest ? 100 : null);
    const done =
      isLatest === true ||
      (typeof nextProgress === 'number' && nextProgress >= 100);

    this.syncByInstanceName.set(instanceName, {
      syncing: !done,
      progress: nextProgress,
      updatedAt: Date.now(),
    });
  }

  clearHistorySync(instanceName: string) {
    this.syncByInstanceName.delete(instanceName);
  }

  parseSyncProgress(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
    return null;
  }
}
