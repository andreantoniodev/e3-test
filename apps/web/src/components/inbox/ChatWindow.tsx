import { DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Popconfirm, Spin } from 'antd';
import dayjs from 'dayjs';
import { RefObject, useEffect, useRef } from 'react';
import { ConversationItem, MessageDirection, MessageItem } from '../../types';

interface ChatWindowProps {
  selectedConversation: ConversationItem | null;
  messages: MessageItem[];
  loadingMessages: boolean;
  draft: string;
  sending: boolean;
  deletingId: string | null;
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  onDeleteConversation: (id: string) => void;
}

export function ChatWindow({
  selectedConversation,
  messages,
  loadingMessages,
  draft,
  sending,
  deletingId,
  composerRef,
  onDraftChange,
  onSendMessage,
  onDeleteConversation,
}: ChatWindowProps) {
  const threadEndRef = useRef<HTMLDivElement | null>(null);

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
  }, [messages, selectedConversation?.id]);

  if (!selectedConversation) {
    return (
      <div style={{ margin: 'auto', padding: 24 }}>
        <Empty description="Selecione uma conversa" />
      </div>
    );
  }

  const title =
    selectedConversation.contactName ||
    selectedConversation.phone ||
    selectedConversation.remoteJid;
  const subtitle = selectedConversation.phone || selectedConversation.remoteJid;

  return (
    <>
      <div className="chat-toolbar">
        <div style={{ minWidth: 0 }}>
          <h2 className="chat-toolbar__title">{title}</h2>
          <div className="chat-toolbar__subtitle">{subtitle}</div>
        </div>
        <Popconfirm
          title="Excluir conversa?"
          description="As mensagens desta conversa serão removidas."
          okText="Excluir"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          onConfirm={() => onDeleteConversation(selectedConversation.id)}
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
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Digite uma mensagem"
          autoSize={{ minRows: 1, maxRows: 4 }}
          onPressEnter={(event) => {
            if (!event.shiftKey) {
              event.preventDefault();
              onSendMessage();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          disabled={!draft.trim() || sending}
          onClick={onSendMessage}
        >
          Enviar
        </Button>
      </div>
    </>
  );
}
