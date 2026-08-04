import { DeleteOutlined } from '@ant-design/icons';
import { Button, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import { ConversationItem } from '../../types';

interface ConversationItemCardProps {
  item: ConversationItem;
  isSelected: boolean;
  isUnread: boolean;
  isDeleting: boolean;
  onSelect: (id: string, updatedAt: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationItemCard({
  item,
  isSelected,
  isUnread,
  isDeleting,
  onSelect,
  onDelete,
}: ConversationItemCardProps) {
  const last = item.messages[0];
  const title = item.contactName || item.phone || item.remoteJid;

  return (
    <div
      className={`conversation-item${isSelected ? ' is-active' : ''}${isUnread ? ' is-unread' : ''}`}
      onClick={() => onSelect(item.id, item.updatedAt)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onSelect(item.id, item.updatedAt);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="conversation-item__body">
        <div className="conversation-item__title-row">
          <div className="conversation-item__title">{title}</div>
          {isUnread ? <span className="conversation-item__badge">Nova</span> : null}
        </div>
        <div className="conversation-item__preview">
          {last?.body || 'Sem mensagens'}
        </div>
        <div className="conversation-item__meta">
          <span className="conversation-item__time">
            {dayjs(item.updatedAt).format('DD/MM HH:mm')}
          </span>
          {isUnread ? (
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
          onDelete(item.id);
        }}
        onCancel={(event) => event?.stopPropagation()}
      >
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          loading={isDeleting}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Excluir conversa ${title}`}
        />
      </Popconfirm>
    </div>
  );
}
