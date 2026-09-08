import { Empty, Space, Spin } from 'antd';
import { ConversationItem } from '../../types';
import { ConversationItemCard } from './ConversationItemCard';

interface ConversationListProps {
  unitName: string;
  conversations: ConversationItem[];
  selectedId: string | null;
  loading: boolean;
  deletingId: string | null;
  isConversationUnread: (item: ConversationItem) => boolean;
  onSelect: (id: string, updatedAt: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationList({
  unitName,
  conversations,
  selectedId,
  loading,
  deletingId,
  isConversationUnread,
  onSelect,
  onDelete,
}: ConversationListProps) {
  return (
    <div>
      <div className="inbox-section__header">
        <div className="inbox-section__heading">
          <strong className="inbox-section__title">Conversas</strong>
          <span className="inbox-section__unit">{unitName}</span>
        </div>
        <span className="inbox-section__count">{conversations.length}</span>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : conversations.length === 0 ? (
        <Empty description="Nenhuma conversa" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {conversations.map((item) => (
            <ConversationItemCard
              key={item.id}
              item={item}
              isSelected={selectedId === item.id}
              isUnread={isConversationUnread(item)}
              isDeleting={deletingId === item.id}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </Space>
      )}
    </div>
  );
}
