import { LogoutOutlined } from '@ant-design/icons';
import { Alert, Button, Popconfirm, Space, Spin } from 'antd';
import { useAuth } from '../auth/AuthContext';
import { ChatHeader } from '../components/inbox/ChatHeader';
import { ChatWindow } from '../components/inbox/ChatWindow';
import { ConversationList } from '../components/inbox/ConversationList';
import { WhatsAppPanel } from '../components/WhatsAppPanel';
import { useInbox } from '../hooks/useInbox';

export function InboxPage() {
  const { user, logout } = useAuth();
  const {
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
  } = useInbox();

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
      <ChatHeader user={user} me={me} onLogout={() => void logout()} />

      <div className="app-body">
        <aside className="app-sidebar">
          <WhatsAppPanel />
          <ConversationList
            unitName={me.unit.name}
            conversations={conversations}
            selectedId={selectedId}
            loading={loadingConversations}
            deletingId={deletingId}
            isConversationUnread={isConversationUnread}
            onSelect={(id, updatedAt) => {
              setSelectedId(id);
              markConversationRead(id, updatedAt);
            }}
            onDelete={(id) => void handleDeleteConversation(id)}
          />
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

          <ChatWindow
            selectedConversation={selectedConversation}
            messages={messages}
            loadingMessages={loadingMessages}
            draft={draft}
            sending={sending}
            deletingId={deletingId}
            composerRef={composerRef}
            onDraftChange={setDraft}
            onSendMessage={() => void handleSendMessage()}
            onDeleteConversation={(id) => void handleDeleteConversation(id)}
          />
        </main>
      </div>
    </div>
  );
}
