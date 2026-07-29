import { DeleteOutlined, LogoutOutlined, SendOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { WhatsAppPanel } from '../components/WhatsAppPanel';
import {
  ConversationItem,
  MeResponse,
  MessageDirection,
  MessageItem,
  apiFetch,
} from '../lib/api';
import { getFriendlyError } from '../lib/errors';

export function InboxPage() {
  const { user, logout } = useAuth();
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
  const threadEndRef = useRef<HTMLDivElement | null>(null);
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
      const data = await apiFetch<ConversationItem[]>('/conversations');
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
        const data = await apiFetch<MessageItem[]>(
          `/conversations/${conversationId}/messages`,
        );
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
        const profile = await apiFetch<MeResponse>('/me');
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

  useEffect(() => {
    const end = threadEndRef.current;
    const thread = end?.parentElement;
    if (!thread || !end) {
      return;
    }
    const distanceFromBottom =
      thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    if (distanceFromBottom < 120) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages, selectedId]);

  async function handleDeleteConversation(conversationId: string) {
    setDeletingId(conversationId);
    try {
      await apiFetch<void>(`/conversations/${conversationId}`, {
        method: 'DELETE',
      });
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
      const sent = await apiFetch<MessageItem>(
        `/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body: text }),
        },
      );
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

  if (loadingMe) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!me) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <Space direction="vertical" size="large" style={{ maxWidth: 520, width: '100%' }}>
          <Alert
            type="error"
            showIcon
            message="Não foi possível acessar o CRM"
            description={
              error ||
              'A API não validou seu login. Confira o Firebase Admin e o seed de e-mails.'
            }
          />
          <Popconfirm
            title="Sair da conta?"
            description="Você precisará entrar com Google novamente."
            okText="Sair"
            cancelText="Cancelar"
            onConfirm={() => void logout()}
          >
            <Button icon={<LogoutOutlined />} block>
              Sair e tentar outro login
            </Button>
          </Popconfirm>
        </Space>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div className="app-header__brand-row">
            <img
              className="app-header__logo"
              src="https://lpw.e3digitalagencia.com/wp-content/uploads/2026/03/1.svg"
              alt="E3 Digital"
            />
            <h1 className="app-header__title">Mini CRM</h1>
          </div>
          <div className="app-header__meta">
            {me.unit.name} · {user?.email || me.email}
          </div>
        </div>
        <Popconfirm
          title="Sair da conta?"
          description="Você precisará entrar com Google novamente."
          okText="Sair"
          cancelText="Cancelar"
          onConfirm={() => void logout()}
        >
          <Button icon={<LogoutOutlined />}>Sair</Button>
        </Popconfirm>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <WhatsAppPanel />

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <strong style={{ fontSize: '1rem' }}>Conversas</strong>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                {conversations.length}
              </span>
            </div>

            {loadingConversations ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : conversations.length === 0 ? (
              <Empty description="Nenhuma conversa" />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {conversations.map((item) => {
                  const last = item.messages[0];
                  const title = item.contactName || item.phone || item.remoteJid;
                  const unread = isConversationUnread(item);
                  return (
                    <div
                      key={item.id}
                      className={`conversation-item${selectedId === item.id ? ' is-active' : ''}${unread ? ' is-unread' : ''}`}
                      onClick={() => {
                        setSelectedId(item.id);
                        markConversationRead(item.id, item.updatedAt);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedId(item.id);
                          markConversationRead(item.id, item.updatedAt);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="conversation-item__body">
                        <div className="conversation-item__title-row">
                          <div className="conversation-item__title">{title}</div>
                          {unread ? (
                            <span className="conversation-item__badge">Nova</span>
                          ) : null}
                        </div>
                        <div className="conversation-item__preview">
                          {last?.body || 'Sem mensagens'}
                        </div>
                        <div className="conversation-item__meta">
                          <span className="conversation-item__time">
                            {dayjs(item.updatedAt).format('DD/MM HH:mm')}
                          </span>
                          {unread ? (
                            <span className="conversation-item__unread-dot" aria-hidden />
                          ) : null}
                        </div>
                      </div>
                      <Popconfirm
                        title="Excluir conversa?"
                        description="As mensagens desta conversa serão removidas."
                        okText="Excluir"
                        cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                        onConfirm={(event) => {
                          event?.stopPropagation();
                          void handleDeleteConversation(item.id);
                        }}
                        onCancel={(event) => event?.stopPropagation()}
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          loading={deletingId === item.id}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Excluir conversa ${title}`}
                        />
                      </Popconfirm>
                    </div>
                  );
                })}
              </Space>
            )}
          </div>
        </aside>

        <main className="app-main">
          {error ? (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ margin: 16 }}
              closable
              onClose={() => setError(null)}
            />
          ) : null}

          {!selectedConversation ? (
            <div style={{ margin: 'auto', padding: 24 }}>
              <Empty description="Selecione uma conversa" />
            </div>
          ) : (
            <>
              <div className="chat-toolbar">
                <div style={{ minWidth: 0 }}>
                  <h2 className="chat-toolbar__title">
                    {selectedConversation.contactName ||
                      selectedConversation.phone ||
                      selectedConversation.remoteJid}
                  </h2>
                  <div className="chat-toolbar__subtitle">
                    {selectedConversation.phone || selectedConversation.remoteJid}
                  </div>
                </div>
                <Popconfirm
                  title="Excluir conversa?"
                  description="As mensagens desta conversa serão removidas."
                  okText="Excluir"
                  cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDeleteConversation(selectedConversation.id)}
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingId === selectedConversation.id}
                  >
                    Excluir
                  </Button>
                </Popconfirm>
              </div>

              <div className="chat-thread">
                {loadingMessages ? (
                  <div style={{ margin: 'auto' }}>
                    <Spin />
                  </div>
                ) : messages.length === 0 ? (
                  <Empty description="Sem mensagens nesta conversa" />
                ) : (
                  messages.map((item) => (
                    <div
                      key={item.id}
                      className={`bubble ${
                        item.direction === MessageDirection.Outbound
                          ? 'bubble--out'
                          : 'bubble--in'
                      }`}
                    >
                      {item.body}
                      <span className="bubble__time">
                        {dayjs(item.createdAt).format('DD/MM HH:mm')}
                      </span>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              <div
                className="chat-composer"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                  }
                }}
              >
                <Input.TextArea
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Digite uma mensagem"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  onPressEnter={(event) => {
                    if (!event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={sending}
                  disabled={!draft.trim() || sending}
                  onClick={() => void handleSendMessage()}
                >
                  Enviar
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
