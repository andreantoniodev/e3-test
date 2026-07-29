import { DisconnectOutlined, LinkOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Image,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WhatsAppInstanceStatus,
  WhatsappStatus,
  apiFetch,
} from '../lib/api';
import { getFriendlyError } from '../lib/errors';

const statusColor: Record<WhatsAppInstanceStatus, string> = {
  [WhatsAppInstanceStatus.Disconnected]: 'default',
  [WhatsAppInstanceStatus.Qr]: 'orange',
  [WhatsAppInstanceStatus.Connected]: 'green',
};

const statusLabel: Record<WhatsAppInstanceStatus, string> = {
  [WhatsAppInstanceStatus.Disconnected]: 'Desconectado',
  [WhatsAppInstanceStatus.Qr]: 'Aguardando pareamento',
  [WhatsAppInstanceStatus.Connected]: 'Conectado',
};

function formatWhatsAppPhone(phone: string | null | undefined) {
  if (!phone) {
    return null;
  }
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  return digits ? `+${digits}` : phone;
}

export function WhatsAppPanel() {
  const [data, setData] = useState<WhatsappStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const pairedRef = useRef(false);
  const qrOpenRef = useRef(false);

  useEffect(() => {
    qrOpenRef.current = qrOpen;
  }, [qrOpen]);

  const loadStatus = useCallback(async () => {
    try {
      const status = await apiFetch<WhatsappStatus>('/whatsapp/status');
      setError(null);
      if (status.status === WhatsAppInstanceStatus.Connected) {
        const justPaired = qrOpenRef.current && !pairedRef.current;
        pairedRef.current = true;
        setQrOpen(false);
        setData(status);
        if (justPaired) {
          message.success('WhatsApp pareado com sucesso');
        }
      } else if (!qrOpenRef.current) {
        setData(status);
      }
      return status;
    } catch (err) {
      setError(getFriendlyError(err, 'Erro ao carregar status do WhatsApp.'));
      return null;
    }
  }, []);

  const loadQr = useCallback(async () => {
    setRefreshingQr(true);
    try {
      const qr = await apiFetch<WhatsappStatus>('/whatsapp/qr');
      setError(null);
      if (qr.status === WhatsAppInstanceStatus.Connected) {
        const justPaired = qrOpenRef.current && !pairedRef.current;
        pairedRef.current = true;
        setQrOpen(false);
        setData(qr);
        if (justPaired) {
          message.success('WhatsApp pareado com sucesso');
        }
        return;
      }
      setData((prev) => ({
        ...qr,
        status: WhatsAppInstanceStatus.Qr,
        qrcode: qr.qrcode || prev?.qrcode || null,
      }));
    } catch (err) {
      setError(getFriendlyError(err, 'Erro ao carregar o QR Code.'));
    } finally {
      setRefreshingQr(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await apiFetch<WhatsappStatus>('/whatsapp/cancel', { method: 'POST' });
      } catch (err) {
        console.warn(
          'Falha ao cancelar pareamento ao entrar no painel:',
          getFriendlyError(err, 'Erro ao cancelar pareamento.'),
        );
      }
      await loadStatus();
    })();
  }, [loadStatus]);

  useEffect(() => {
    if (!qrOpen) {
      return;
    }
    const id = window.setInterval(() => {
      void (async () => {
        const status = await loadStatus();
        if (status?.status === WhatsAppInstanceStatus.Connected) {
          return;
        }
        if (qrOpenRef.current) {
          await loadQr();
        }
      })();
    }, 1500);
    return () => window.clearInterval(id);
  }, [qrOpen, loadQr, loadStatus]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    pairedRef.current = false;
    setData((prev) => ({
      status: WhatsAppInstanceStatus.Qr,
      instanceName: prev?.instanceName || null,
      instanceId: prev?.instanceId || null,
      qrcode: null,
      code: null,
    }));
    setQrOpen(true);
    try {
      const result = await apiFetch<WhatsappStatus>('/whatsapp/connect', {
        method: 'POST',
      });
      setData({
        ...result,
        status: WhatsAppInstanceStatus.Qr,
        qrcode: result.qrcode || null,
      });
      if (!result.qrcode) {
        await loadQr();
      }
      message.success('Conexão iniciada');
    } catch (err) {
      setError(getFriendlyError(err, 'Falha ao conectar o WhatsApp.'));
      setQrOpen(false);
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: WhatsAppInstanceStatus.Disconnected,
              qrcode: null,
            }
          : prev,
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const result = await apiFetch<WhatsappStatus>('/whatsapp/disconnect', {
        method: 'POST',
      });
      pairedRef.current = false;
      setQrOpen(false);
      setData(result);
      message.success('WhatsApp desconectado');
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível desconectar o WhatsApp.'));
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleCancelPairing() {
    if (pairedRef.current || cancelling) {
      setQrOpen(false);
      return;
    }

    setCancelling(true);
    try {
      const result = await apiFetch<WhatsappStatus>('/whatsapp/cancel', {
        method: 'POST',
      });
      setData(result);
      setQrOpen(false);
      message.info('Pareamento cancelado');
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível cancelar o pareamento.'));
      setQrOpen(false);
    } finally {
      setCancelling(false);
    }
  }

  const currentStatus =
    data?.status === WhatsAppInstanceStatus.Connected
      ? WhatsAppInstanceStatus.Connected
      : qrOpen
        ? WhatsAppInstanceStatus.Qr
        : WhatsAppInstanceStatus.Disconnected;

  const showQrLoading = qrOpen && !data?.qrcode;
  const isConnected = currentStatus === WhatsAppInstanceStatus.Connected;
  const connectedPhone = formatWhatsAppPhone(data?.phone);

  return (
    <div className="wa-panel">
      <div className="wa-panel__row">
        <Typography.Text strong>WhatsApp</Typography.Text>
        <Tag color={statusColor[currentStatus]}>{statusLabel[currentStatus]}</Tag>
      </div>
      {isConnected ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          {connectedPhone || '—'}
        </Typography.Text>
      ) : null}
      <div className="wa-panel__row" style={{ marginTop: 10 }}>
        {isConnected ? (
          <Popconfirm
            title="Desconectar WhatsApp?"
            description="A instância será removida da Evolution e do Mini CRM."
            okText="Desconectar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true, loading: disconnecting }}
            onConfirm={() => void handleDisconnect()}
          >
            <Button icon={<DisconnectOutlined />} danger loading={disconnecting}>
              Desconectar
            </Button>
          </Popconfirm>
        ) : (
          <Button
            icon={<LinkOutlined />}
            type="primary"
            loading={loading}
            disabled={qrOpen || cancelling}
            onClick={handleConnect}
          >
            Conectar
          </Button>
        )}
      </div>
      {error ? (
        <Alert type="error" message={error} showIcon style={{ marginTop: 12 }} />
      ) : null}
      {currentStatus === WhatsAppInstanceStatus.Disconnected ? (
        <Alert
          type="info"
          message="WhatsApp desconectado. Clique em Conectar e escaneie o QR Code."
          showIcon
          style={{ marginTop: 12 }}
        />
      ) : null}
      {currentStatus === WhatsAppInstanceStatus.Qr ? (
        <Alert
          type="warning"
          message="Aguardando pareamento. Escaneie o QR Code no celular."
          showIcon
          style={{ marginTop: 12 }}
        />
      ) : null}

      <Modal
        title="Parear WhatsApp"
        open={qrOpen}
        onCancel={() => void handleCancelPairing()}
        maskClosable={false}
        keyboard={!cancelling}
        closable={!cancelling}
        confirmLoading={cancelling}
        footer={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={refreshingQr}
              disabled={cancelling || showQrLoading}
              onClick={() => void loadQr()}
            >
              Atualizar QR
            </Button>
            <Button
              danger
              loading={cancelling}
              onClick={() => void handleCancelPairing()}
            >
              Cancelar pareamento
            </Button>
          </Space>
        }
        centered
        destroyOnClose={false}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho
            e escaneie o código abaixo. Fechar esta janela cancela o pareamento.
          </Typography.Paragraph>
          {showQrLoading ? (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                minHeight: 280,
                padding: '24px 0',
              }}
            >
              <Space direction="vertical" align="center">
                <Spin size="large" />
                <Typography.Text type="secondary">
                  Gerando QR Code...
                </Typography.Text>
              </Space>
            </div>
          ) : data?.qrcode ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0' }}>
              <Image
                src={data.qrcode}
                alt="QR Code WhatsApp"
                width={260}
                preview={false}
                style={{
                  background: '#fff',
                  padding: 12,
                  borderRadius: 12,
                }}
              />
            </div>
          ) : null}
        </Space>
      </Modal>
    </div>
  );
}
