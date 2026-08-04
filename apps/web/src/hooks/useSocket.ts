import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export function useSocket(
  unitId?: string | null,
  handlers?: {
    onMessageCreated?: (payload: { conversationId: string; message: any }) => void;
    onConversationUpdated?: (payload: { conversationId: string; updatedAt: string }) => void;
    onWhatsAppStatus?: (payload: any) => void;
  },
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!unitId) {
      return;
    }

    const socket: Socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      query: { unitId },
      auth: { unitId },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    if (handlers?.onMessageCreated) {
      socket.on('message:created', handlers.onMessageCreated);
    }
    if (handlers?.onConversationUpdated) {
      socket.on('conversation:updated', handlers.onConversationUpdated);
    }
    if (handlers?.onWhatsAppStatus) {
      socket.on('whatsapp:status', handlers.onWhatsAppStatus);
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [unitId, handlers?.onMessageCreated, handlers?.onConversationUpdated, handlers?.onWhatsAppStatus]);

  return socketRef;
}
