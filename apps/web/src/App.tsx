import { ConfigProvider, App as AntApp, Spin, theme as antdTheme } from 'antd';
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
    <ConfigProvider
      locale={ptBR}
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: '#ff6a00',
          colorInfo: '#ff6a00',
          colorSuccess: '#3d9a5f',
          colorWarning: '#ff7d1f',
          colorError: '#e5484d',
          colorText: '#f5f5f5',
          colorTextSecondary: '#a3a3a3',
          colorBgBase: '#0b0b0b',
          colorBgContainer: '#181818',
          colorBgElevated: '#1f1f1f',
          colorBorder: '#2a2a2a',
          colorBorderSecondary: '#2a2a2a',
          borderRadius: 10,
          fontFamily: "'Outfit', sans-serif",
        },
      }}
    >
      <AntApp>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
