export type EvolutionMessageKey = {
  remoteJid?: string;
  remoteJidAlt?: string;
  addressingMode?: string;
};

export function isLidJid(remoteJid: string | null | undefined) {
  return (remoteJid || '').trim().endsWith('@lid');
}

export function resolveContactJid(key: EvolutionMessageKey | undefined) {
  const remoteJid = (key?.remoteJid || '').trim();
  const alt = (key?.remoteJidAlt || '').trim();

  if (isLidJid(remoteJid) && alt && !isLidJid(alt)) {
    return alt;
  }
  return remoteJid || alt || '';
}

export function sendTargetFromJid(
  remoteJid: string | null | undefined,
  phone?: string | null,
) {
  const jid = (remoteJid || '').trim().replace(/:\d+/, '');
  if (jid.includes('@')) {
    return jid;
  }

  const digits = (phone || jid).replace(/\D/g, '');
  return digits || null;
}
