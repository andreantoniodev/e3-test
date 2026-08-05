import { apiFetch } from '../lib/api';
import { WhatsappStatus } from '../types';

export const whatsappService = {
  getStatus: () => apiFetch<WhatsappStatus>('/whatsapp/status'),
  getQr: () => apiFetch<WhatsappStatus>('/whatsapp/qr'),
  connect: () => apiFetch<WhatsappStatus>('/whatsapp/connect', { method: 'POST' }),
  disconnect: () => apiFetch<WhatsappStatus>('/whatsapp/disconnect', { method: 'POST' }),
  cancel: () => apiFetch<WhatsappStatus>('/whatsapp/cancel', { method: 'POST' }),
};
