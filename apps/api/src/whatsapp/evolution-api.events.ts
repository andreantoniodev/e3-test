export enum EvolutionApiEvent {
  QrcodeUpdated = 'qrcode.updated',
  ConnectionUpdate = 'connection.update',
  MessagesUpsert = 'messages.upsert',
}

const EVENT_ALIASES: Record<string, EvolutionApiEvent> = {
  'qrcode.updated': EvolutionApiEvent.QrcodeUpdated,
  QRCODE_UPDATED: EvolutionApiEvent.QrcodeUpdated,
  'connection.update': EvolutionApiEvent.ConnectionUpdate,
  CONNECTION_UPDATE: EvolutionApiEvent.ConnectionUpdate,
  'messages.upsert': EvolutionApiEvent.MessagesUpsert,
  MESSAGES_UPSERT: EvolutionApiEvent.MessagesUpsert,
};

export function normalizeEvolutionApiEvent(
  event: string | undefined,
): EvolutionApiEvent | null {
  if (!event) {
    return null;
  }
  return EVENT_ALIASES[event] || EVENT_ALIASES[event.toUpperCase()] || null;
}
