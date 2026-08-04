import { ArrowLeftOutlined, LinkOutlined } from '@ant-design/icons';
import { Alert, Button, Input, Space } from 'antd';

interface AdminGateCardProps {
  secretInput: string;
  error: string | null;
  onSecretInputChange: (value: string) => void;
  onUnlock: () => void;
}

export function AdminGateCard({
  secretInput,
  error,
  onSecretInputChange,
  onUnlock,
}: AdminGateCardProps) {
  return (
    <div className="admin-gate">
      <div className="admin-gate__card">
        <h2>Acesso admin</h2>
        <p>
          Informe o <code>ADMIN_SECRET</code> da API para gerenciar unidades e e-mails.
        </p>
        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        ) : null}
        <Space.Compact style={{ width: '100%' }}>
          <Input.Password
            size="large"
            value={secretInput}
            onChange={(event) => onSecretInputChange(event.target.value)}
            placeholder="ADMIN_SECRET"
            onPressEnter={onUnlock}
          />
          <Button
            type="primary"
            size="large"
            icon={<LinkOutlined />}
            onClick={onUnlock}
          >
            Entrar
          </Button>
        </Space.Compact>
        <Button
          className="admin-gate__back"
          type="link"
          icon={<ArrowLeftOutlined />}
          href="/"
        >
          Voltar ao login
        </Button>
      </div>
    </div>
  );
}
