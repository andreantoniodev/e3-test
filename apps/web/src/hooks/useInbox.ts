import { message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFriendlyError } from '../lib/errors';
import { conversationService } from '../services/conversationService';
import { userService } from '../services/userService';
import { ConversationItem, MeResponse, MessageItem } from '../types';

export function useInbox() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastReadAt, setLastReadAt] = useState<Record<string, string>>(() => {
    try {
      const raw = sessionStorage.getItem('mini-crm-last-read');
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const markConversationRead = useCallback((conversationId: string, at: string) => {
    setLastReadAt((prev) => {
      const current = prev[conversationId];
      if (current && new Date(current).getTime() >= new Date(at).getTime()) {
        return prev;
      }
      const next = { ...prev, [conversationId]: at };
      sessionStorage.setItem('mini-crm-last-read', JSON.stringify(next));
      return next;
    });
  }, []);

  const isConversationUnread = useCallback(
    (item: ConversationItem) => {
      if (item.id === selectedId) {
        return false;
      }
      if (!item.messages[0]) {
        return false;
      }
      const readAt = lastReadAt[item.id];
      if (!readAt) {
        return true;
      }
      return new Date(item.updatedAt).getTime() > new Date(readAt).getTime();
    },
    [lastReadAt, selectedId],
  );

  const loadConversations = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoadingConversations(true);
    }
    try {
      const data = await conversationService.getConversations();
      setConversations(data);
      setError(null);
      setSelectedId((current) => {
        if (current && data.some((item) => item.id === current)) {
          return current;
        }
        return null;
      });
    } catch (err) {
      setError(getFriendlyError(err, 'Erro ao listar conversas.'));
    } finally {
      if (!opts?.silent) {
        setLoadingConversations(false);
      }
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoadingMessages(true);
      }
      try {
        const data = await conversationService.getMessages(conversationId);
        setMessages((prev) => {
          if (
            prev.length === data.length &&
            prev[prev.length - 1]?.id === data[data.length - 1]?.id
          ) {
            return prev;
          }
          return data;
        });
      } catch (err) {
        if (!opts?.silent) {
          setError(getFriendlyError(err, 'Erro ao carregar mensagens.'));
        }
      } finally {
        if (!opts?.silent) {
          setLoadingMessages(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      setLoadingMe(true);
      try {
        const profile = await userService.getMe();
        setMe(profile);
        setError(null);
      } catch (err) {
        setMe(null);
        setError(getFriendlyError(err, 'Erro ao carregar perfil.'));
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!me) {
      return;
    }
    void loadConversations();
    const id = window.setInterval(() => {
      void loadConversations({ silent: true });
    }, 8000);
    return () => window.clearInterval(id);
  }, [me, loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setDraft('');
      return;
    }
    setDraft('');
    void loadMessages(selectedId);
    const id = window.setInterval(() => {
      void loadMessages(selectedId, { silent: true });
    }, 4000);
    return () => window.clearInterval(id);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (!selectedId || !selectedConversation) {
      return;
    }
    markConversationRead(selectedId, selectedConversation.updatedAt);
  }, [selectedId, selectedConversation, markConversationRead]);

  async function handleDeleteConversation(conversationId: string) {
    setDeletingId(conversationId);
    try {
      await conversationService.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((item) => item.id !== conversationId));
      if (selectedId === conversationId) {
        setSelectedId(null);
        setMessages([]);
      }
      message.success('Conversa excluída');
      setError(null);
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível excluir a conversa.'));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSendMessage() {
    if (!selectedId || !draft.trim() || sending) {
      return;
    }

    const conversationId = selectedId;
    const text = draft.trim();
    setSending(true);
    try {
      const sent = await conversationService.sendMessage(conversationId, text);
      setMessages((prev) => [...prev, sent]);
      setDraft('');
      setError(null);
      setConversations((prev) => {
        const updated = prev.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                updatedAt: sent.createdAt,
                messages: [sent],
              }
            : item,
        );
        return [...updated].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível enviar a mensagem.'));
    } finally {
      setSending(false);
      requestAnimationFrame(() => {
        composerRef.current?.focus();
      });
    }
  }

  return {
    me,
    conversations,
    selectedId,
    setSelectedId,
    selectedConversation,
    messages,
    draft,
    setDraft,
    sending,
    loadingMe,
    loadingConversations,
    loadingMessages,
    deletingId,
    error,
    setError,
    composerRef,
    isConversationUnread,
    markConversationRead,
    handleDeleteConversation,
    handleSendMessage,
  };
}
