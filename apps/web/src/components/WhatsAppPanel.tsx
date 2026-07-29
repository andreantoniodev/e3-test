import { LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Image, Space, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  WhatsAppInstanceStatus,
  WhatsappStatus,
  apiFetch,
} from '../lib/api';

const statusColor: Record<WhatsAppInstanceStatus, string> = {
  [WhatsAppInstanceStatus.Disconnected]: 'default',
  [WhatsAppInstanceStatus.Qr]: 'orange',
  [WhatsAppInstanceStatus.Connected]: 'green',
};

const statusLabel: Record<WhatsAppInstanceStatus, string> = {
  [WhatsAppInstanceStatus.Disconnected]: 'Desconectado',
  [WhatsAppInstanceStatus.Qr]: 'Aguardando QR',
  [WhatsAppInstanceStatus.Connected]: 'Conectado',
};

export function WhatsAppPanel() {
  const [data, setData] = useState<WhatsappStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await apiFetch<WhatsappStatus>('/whatsapp/status');
      setData(status);
      setError(null);
      return status;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar status');
      return null;
    }
  }, []);

  const loadQr = useCallback(async () => {
    try {
      const qr = await apiFetch<WhatsappStatus>('/whatsapp/qr');
      setData(qr);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar QR');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!data || data.status === WhatsAppInstanceStatus.Connected) {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        const status = await loadStatus();
        if (status?.status === WhatsAppInstanceStatus.Qr) {
          await loadQr();
        }
      })();
    }, 4000);
    return () => window.clearInterval(id);
  }, [data, loadQr, loadStatus]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<WhatsappStatus>('/whatsapp/connect', {
        method: 'POST',
      });
      setData(result);
      if (!result.qrcode) {
        await loadQr();
      }
      message.success('Conexão iniciada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao conectar');
    } finally {
      setLoading(false);
    }
  }

  const currentStatus = data?.status ?? WhatsAppInstanceStatus.Disconnected;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Typography.Text strong>WhatsApp</Typography.Text>
        <Tag color={statusColor[currentStatus]}>{statusLabel[currentStatus]}</Tag>
        <Button
          icon={<LinkOutlined />}
          type="primary"
          loading={loading}
          onClick={handleConnect}
        >
          Conectar
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadQr()}>
          Atualizar QR
        </Button>
      </Space>
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {data?.status !== WhatsAppInstanceStatus.Connected && data?.qrcode ? (
        <Image
          src={data.qrcode}
          alt="QR Code WhatsApp"
          width={220}
          preview={false}
        />
      ) : null}
      {data?.status === WhatsAppInstanceStatus.Connected ? (
        <Alert type="success" message="Número pareado com sucesso." showIcon />
      ) : null}
    </Space>
  );
}
