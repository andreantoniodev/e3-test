import { apiFetch } from '../lib/api';
import { ConversationItem, MessageItem } from '../types';

export const conversationService = {
  getConversations: () => apiFetch<ConversationItem[]>('/conversations'),
  getMessages: (conversationId: string) =>
    apiFetch<MessageItem[]>(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, body: string) =>
    apiFetch<MessageItem>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  deleteConversation: (conversationId: string) =>
    apiFetch<void>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    }),
};
