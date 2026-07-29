export enum EvolutionApiEvent {
  QrcodeUpdated = 'qrcode.updated',
  ConnectionUpdate = 'connection.update',
  MessagesUpsert = 'messages.upsert',
  MessagesSet = 'messages.set',
}

export enum EvolutionApiSubscribeEvent {
  QrcodeUpdated = 'QRCODE_UPDATED',
  ConnectionUpdate = 'CONNECTION_UPDATE',
  MessagesUpsert = 'MESSAGES_UPSERT',
  MessagesSet = 'MESSAGES_SET',
}

export const EVOLUTION_API_WEBHOOK_EVENTS = [
  EvolutionApiSubscribeEvent.QrcodeUpdated,
  EvolutionApiSubscribeEvent.ConnectionUpdate,
  EvolutionApiSubscribeEvent.MessagesUpsert,
  EvolutionApiSubscribeEvent.MessagesSet,
] as const;

const EVENT_ALIASES: Record<string, EvolutionApiEvent> = {
  [EvolutionApiEvent.QrcodeUpdated]: EvolutionApiEvent.QrcodeUpdated,
  [EvolutionApiSubscribeEvent.QrcodeUpdated]: EvolutionApiEvent.QrcodeUpdated,
  [EvolutionApiEvent.ConnectionUpdate]: EvolutionApiEvent.ConnectionUpdate,
  [EvolutionApiSubscribeEvent.ConnectionUpdate]:
    EvolutionApiEvent.ConnectionUpdate,
  [EvolutionApiEvent.MessagesUpsert]: EvolutionApiEvent.MessagesUpsert,
  [EvolutionApiSubscribeEvent.MessagesUpsert]: EvolutionApiEvent.MessagesUpsert,
  [EvolutionApiEvent.MessagesSet]: EvolutionApiEvent.MessagesSet,
  [EvolutionApiSubscribeEvent.MessagesSet]: EvolutionApiEvent.MessagesSet,
};

export function normalizeEvolutionApiEvent(
  event: string | undefined,
): EvolutionApiEvent | null {
  if (!event) {
    return null;
  }
  return EVENT_ALIASES[event] || EVENT_ALIASES[event.toUpperCase()] || null;
}
