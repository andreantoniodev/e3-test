import { DeleteOutlined, LogoutOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Popconfirm,
  Space,
  Spin,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId],
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
      return;
    }
    void (async () => {
      setLoadingMessages(true);
      try {
        const data = await apiFetch<MessageItem[]>(
          `/conversations/${selectedId}/messages`,
        );
        setMessages(data);
      } catch (err) {
        setError(getFriendlyError(err, 'Erro ao carregar mensagens.'));
      } finally {
        setLoadingMessages(false);
      }
    })();
  }, [selectedId]);

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
                  return (
                    <div
                      key={item.id}
                      className={`conversation-item${selectedId === item.id ? ' is-active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedId(item.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="conversation-item__body">
                        <div className="conversation-item__title">{title}</div>
                        <div className="conversation-item__preview">
                          {last?.body || 'Sem mensagens'}
                        </div>
                        <div className="conversation-item__time">
                          {dayjs(item.updatedAt).format('DD/MM HH:mm')}
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
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
