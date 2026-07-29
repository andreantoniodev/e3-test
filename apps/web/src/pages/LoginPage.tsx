import { GoogleOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getFriendlyError } from '../lib/errors';

export function LoginPage() {
  const { signInWithGoogle, configured } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível entrar com Google.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(160deg, #f7fafc 0%, #e8eef5 100%)',
        padding: 24,
      }}
    >
      <Card style={{ width: 420, maxWidth: '100%' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Mini-CRM WhatsApp E3
            </Typography.Title>
            <Typography.Text type="secondary">
              Entre com Google para acessar as conversas da sua unidade.
            </Typography.Text>
          </div>
          {!configured ? (
            <Alert
              type="warning"
              showIcon
              message="Firebase não configurado"
              description="Preencha VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID e VITE_FIREBASE_APP_ID em apps/web/.env e reinicie o Vite."
            />
          ) : null}
          {error ? <Alert type="error" message={error} showIcon /> : null}
          <Button
            type="primary"
            size="large"
            icon={<GoogleOutlined />}
            loading={loading}
            disabled={!configured}
            block
            onClick={handleLogin}
          >
            Entrar com Google
          </Button>
        </Space>
      </Card>
    </div>
  );
}
