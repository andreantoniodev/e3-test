import { firebaseAuth } from './firebase';
import { MessageDirection, WhatsAppInstanceStatus } from './enums';
import { getFriendlyError } from './errors';

export { MessageDirection, WhatsAppInstanceStatus };

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

async function getToken() {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    throw new Error('Unauthenticated');
  }
  return user.getIdToken();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
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
  } catch (error) {
    throw new Error(getFriendlyError(error, 'Falha ao comunicar com a API.'));
  }
}

export async function adminFetch<T>(
  path: string,
  adminSecret: string,
  init: RequestInit = {},
): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
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
  } catch (error) {
    throw new Error(getFriendlyError(error, 'Falha ao comunicar com a API admin.'));
  }
}

export type AdminUnit = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    users: number;
    conversations: number;
    instances: number;
  };
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  unitId: string;
  createdAt: string;
  updatedAt: string;
  unit: { id: string; name: string; slug: string };
};

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
  phone?: string | null;
  qrcode?: string | null;
  code?: string | null;
  syncing?: boolean;
};
