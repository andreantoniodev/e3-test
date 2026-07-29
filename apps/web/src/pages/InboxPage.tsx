import { LogoutOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
  Layout,
  List,
  Space,
  Spin,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
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

const { Header, Sider, Content } = Layout;

export function InboxPage() {
  const { user, logout } = useAuth();
  const { token } = theme.useToken();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const data = await apiFetch<ConversationItem[]>('/conversations');
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(getFriendlyError(err, 'Erro ao listar conversas.'));
    } finally {
      setLoadingConversations(false);
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
      void loadConversations();
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
          <Button icon={<LogoutOutlined />} onClick={() => void logout()} block>
            Sair e tentar outro login
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          paddingInline: 24,
        }}
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Mini-CRM WhatsApp E3
          </Typography.Title>
          <Typography.Text type="secondary">
            {me.unit.name} · {user?.email}
          </Typography.Text>
        </div>
        <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
          Sair
        </Button>
      </Header>
      <Layout>
        <Sider
          width={320}
          theme="light"
          style={{
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            padding: 16,
            overflow: 'auto',
          }}
        >
          <WhatsAppPanel />
          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Conversas
          </Typography.Title>
          {loadingConversations ? (
            <Spin />
          ) : conversations.length === 0 ? (
            <Empty description="Nenhuma conversa" />
          ) : (
            <List
              dataSource={conversations}
              renderItem={(item) => {
                const last = item.messages[0];
                return (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      background:
                        selectedId === item.id ? token.colorFillSecondary : undefined,
                      paddingInline: 8,
                      borderRadius: 8,
                    }}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <List.Item.Meta
                      title={item.contactName || item.phone || item.remoteJid}
                      description={
                        <span>
                          {last?.body || 'Sem mensagens'}
                          <br />
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(item.updatedAt).format('DD/MM HH:mm')}
                          </Typography.Text>
                        </span>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Sider>
        <Content style={{ padding: 24 }}>
          {error ? (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {!selectedId ? (
            <Empty description="Selecione uma conversa" />
          ) : loadingMessages ? (
            <Spin />
          ) : (
            <List
              dataSource={messages}
              renderItem={(item) => (
                <List.Item
                  style={{
                    justifyContent:
                      item.direction === MessageDirection.Outbound
                        ? 'flex-end'
                        : 'flex-start',
                    border: 'none',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      background:
                        item.direction === MessageDirection.Outbound
                          ? token.colorPrimaryBg
                          : token.colorFillTertiary,
                      padding: '10px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <Typography.Text>{item.body}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.createdAt).format('DD/MM HH:mm')}
                      </Typography.Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
