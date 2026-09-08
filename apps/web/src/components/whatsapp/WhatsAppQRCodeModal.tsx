import { ReloadOutlined } from '@ant-design/icons';
import { Button, Image, Modal, Space, Spin, Typography } from 'antd';

interface WhatsAppQRCodeModalProps {
  open: boolean;
  qrcode: string | null | undefined;
  refreshingQr: boolean;
  cancelling: boolean;
  onRefreshQr: () => void;
  onCancelPairing: () => void;
}

export function WhatsAppQRCodeModal({
  open,
  qrcode,
  refreshingQr,
  cancelling,
  onRefreshQr,
  onCancelPairing,
}: WhatsAppQRCodeModalProps) {
  const showQrLoading = open && !qrcode;

  return (
    <Modal
      title="Parear WhatsApp"
      open={open}
      onCancel={onCancelPairing}
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
            onClick={onRefreshQr}
          >
            Atualizar QR
          </Button>
          <Button danger loading={cancelling} onClick={onCancelPairing}>
            Cancelar pareamento
          </Button>
        </Space>
      }
      centered
      destroyOnClose={false}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho e
          escaneie o código abaixo. Fechar esta janela cancela o pareamento.
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
              <Typography.Text type="secondary">Gerando QR Code...</Typography.Text>
            </Space>
          </div>
        ) : qrcode ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0' }}>
            <Image
              src={qrcode}
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
  );
}
