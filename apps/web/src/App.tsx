import { ConfigProvider, Spin } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return user ? <InboxPage /> : <LoginPage />;
}

export default function App() {
  return (
    <ConfigProvider locale={ptBR}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ConfigProvider>
  );
}
