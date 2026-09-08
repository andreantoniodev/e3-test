import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button } from 'antd';

interface AdminToolbarProps {
  unitsCount: number;
  usersCount: number;
  loading: boolean;
  onRefresh: () => void;
  onLock: () => void;
}

export function AdminToolbar({
  unitsCount,
  usersCount,
  loading,
  onRefresh,
  onLock,
}: AdminToolbarProps) {
  return (
    <div className="admin-toolbar">
      <div className="admin-toolbar__meta">
        <span>{unitsCount} unidades</span>
        <span className="admin-toolbar__dot" aria-hidden />
        <span>{usersCount} acessos</span>
      </div>
      <div className="admin-toolbar__actions">
        <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
          Atualizar
        </Button>
        <Button onClick={onLock}>Trocar secret</Button>
        <Button icon={<ArrowLeftOutlined />} href="/">
          Login
        </Button>
      </div>
    </div>
  );
}
