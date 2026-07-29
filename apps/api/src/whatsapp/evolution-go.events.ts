export enum EvolutionGoEvent {
  QRCode = 'QRCode',
  Connected = 'Connected',
  PairSuccess = 'PairSuccess',
  QRSuccess = 'QRSuccess',
  LoggedOut = 'LoggedOut',
  Message = 'Message',
}

export const EVOLUTION_GO_CONNECTED_EVENTS: ReadonlySet<string> = new Set([
  EvolutionGoEvent.PairSuccess,
  EvolutionGoEvent.QRSuccess,
]);
