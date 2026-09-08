import { LogoutOutlined } from '@ant-design/icons';
import { Avatar, Button, Dropdown, Popconfirm } from 'antd';
import { IMAGES } from '../../constants';
import { MeResponse } from '../../types';
import { googlePhotoUrl, userInitials } from '../../utils/formatters';

interface ChatHeaderProps {
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    providerData?: Array<{ providerId: string; photoURL?: string | null }>;
  } | null;
  me: MeResponse;
  onLogout: () => void;
}

export function ChatHeader({ user, me, onLogout }: ChatHeaderProps) {
  const photoUrl = googlePhotoUrl(user);

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <div className="app-header__brand-row">
          <img className="app-header__logo" src={IMAGES.logoHeader} alt="E3 Digital" />
          <h1 className="app-header__title">Mini CRM</h1>
        </div>
      </div>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        dropdownRender={() => (
          <div className="user-menu">
            <div className="user-menu__identity">
              <strong>{user?.displayName || me.name || 'Conta'}</strong>
              <span>{user?.email || me.email}</span>
            </div>
            <Popconfirm
              title="Sair da conta?"
              description="Você precisará entrar com Google novamente."
              okText="Sair"
              cancelText="Cancelar"
              placement="left"
              onConfirm={onLogout}
            >
              <Button
                type="text"
                danger
                icon={<LogoutOutlined />}
                block
                className="user-menu__logout"
              >
                Sair
              </Button>
            </Popconfirm>
          </div>
        )}
      >
        <button
          type="button"
          className="user-avatar-trigger"
          aria-label="Menu da conta"
        >
          <Avatar
            size={40}
            alt={user?.displayName || user?.email || 'Usuário'}
            src={
              photoUrl ? (
                <img
                  src={photoUrl}
                  alt={user?.displayName || user?.email || 'Usuário'}
                  referrerPolicy="no-referrer"
                />
              ) : undefined
            }
          >
            {userInitials(user?.displayName, user?.email || me.email)}
          </Avatar>
        </button>
      </Dropdown>
    </header>
  );
}
