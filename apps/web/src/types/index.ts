import { MessageDirection, WhatsAppInstanceStatus } from '../lib/enums';

export { MessageDirection, WhatsAppInstanceStatus };

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

export type LinkFormValues = {
  email: string;
  unitId: string;
  name?: string;
};

export type UnitFormValues = {
  name: string;
  slug?: string;
};
