import { DisconnectOutlined, LinkOutlined } from '@ant-design/icons';
import { Alert, Button, Popconfirm, Tag, Typography } from 'antd';
import { WhatsAppInstanceStatus, WhatsappStatus } from '../../types';
import { formatWhatsAppPhone } from '../../utils/formatters';

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

interface WhatsAppStatusCardProps {
  data: WhatsappStatus | null;
  currentStatus: WhatsAppInstanceStatus;
  loading: boolean;
  disconnecting: boolean;
  cancelling: boolean;
  qrOpen: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WhatsAppStatusCard({
  data,
  currentStatus,
  loading,
  disconnecting,
  cancelling,
  qrOpen,
  error,
  onConnect,
  onDisconnect,
}: WhatsAppStatusCardProps) {
  const isConnected = currentStatus === WhatsAppInstanceStatus.Connected;
  const connectedPhone = formatWhatsAppPhone(data?.phone);

  return (
    <>
      <div className="wa-panel__row">
        <Typography.Text strong>WhatsApp</Typography.Text>
        <Tag color={statusColor[currentStatus]}>{statusLabel[currentStatus]}</Tag>
      </div>

      {isConnected ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          {connectedPhone || '—'}
        </Typography.Text>
      ) : null}

      {isConnected && data?.syncing ? (
        <Alert
          type="info"
          message="Sincronizando histórico do WhatsApp…"
          showIcon
          style={{ marginTop: 12 }}
        />
      ) : null}

      <div className="wa-panel__row" style={{ marginTop: 10 }}>
        {isConnected ? (
          <Popconfirm
            title="Desconectar WhatsApp?"
            description="A instância será removida da Evolution e do Mini CRM."
            okText="Desconectar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true, loading: disconnecting }}
            onConfirm={onDisconnect}
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
            onClick={onConnect}
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
    </>
  );
}
