import { firebaseAuth } from './firebase';
import { MessageDirection, WhatsAppInstanceStatus } from './enums';

export { MessageDirection, WhatsAppInstanceStatus };

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

async function getToken() {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error('Unauthenticated');
  }
  return user.getIdToken();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type MeResponse = {
  id: string;
  email: string;
  name: string | null;
  unit: { id: string; name: string; slug: string };
};

export type ConversationItem = {
  id: string;
  remoteJid: string;
  phone: string | null;
  contactName: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    body: string;
    direction: MessageDirection;
    createdAt: string;
  }>;
};

export type MessageItem = {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  body: string;
  externalId: string | null;
  createdAt: string;
};

export type WhatsappStatus = {
  status: WhatsAppInstanceStatus;
  instanceName: string | null;
  instanceId?: string | null;
  qrcode?: string | null;
  code?: string | null;
};
