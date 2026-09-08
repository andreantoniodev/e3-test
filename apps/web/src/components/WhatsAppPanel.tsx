import { useWhatsApp } from '../hooks/useWhatsApp';
import { WhatsAppQRCodeModal } from './whatsapp/WhatsAppQRCodeModal';
import { WhatsAppStatusCard } from './whatsapp/WhatsAppStatusCard';

export function WhatsAppPanel() {
  const {
    data,
    loading,
    disconnecting,
    refreshingQr,
    cancelling,
    error,
    qrOpen,
    currentStatus,
    loadQr,
    handleConnect,
    handleDisconnect,
    handleCancelPairing,
  } = useWhatsApp();

  return (
    <div className="wa-panel">
      <WhatsAppStatusCard
        data={data}
        currentStatus={currentStatus}
        loading={loading}
        disconnecting={disconnecting}
        cancelling={cancelling}
        qrOpen={qrOpen}
        error={error}
        onConnect={() => void handleConnect()}
        onDisconnect={() => void handleDisconnect()}
      />
      <WhatsAppQRCodeModal
        open={qrOpen}
        qrcode={data?.qrcode}
        refreshingQr={refreshingQr}
        cancelling={cancelling}
        onRefreshQr={() => void loadQr()}
        onCancelPairing={() => void handleCancelPairing()}
      />
    </div>
  );
}
