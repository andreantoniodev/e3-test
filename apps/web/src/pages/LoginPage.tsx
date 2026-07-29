import { GoogleOutlined } from '@ant-design/icons';
import { Alert, Button, Space } from 'antd';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { IMAGES } from '../constants';
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
    <div className="login-shell">
      <div className="login-card">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="login-card__brand">
            <img
              className="login-card__logo"
              src={IMAGES.logoLogin}
              alt="E3 Digital"
            />
            <h1>Mini CRM</h1>
            <p>Entre com Google para acessar as conversas da sua unidade.</p>
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
          <Button type="link" href="/admin" block>
            Área admin
          </Button>
        </Space>
      </div>
    </div>
  );
}
