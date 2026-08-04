import { message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFriendlyError } from '../lib/errors';
import { whatsappService } from '../services/whatsappService';
import { WhatsAppInstanceStatus, WhatsappStatus } from '../types';

export function useWhatsApp() {
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
      const status = await whatsappService.getStatus();
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
      const qr = await whatsappService.getQr();
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
        await whatsappService.cancel();
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

  useEffect(() => {
    if (data?.status !== WhatsAppInstanceStatus.Connected || !data.syncing) {
      return;
    }
    const id = window.setInterval(() => {
      void loadStatus();
    }, 1500);
    return () => window.clearInterval(id);
  }, [data?.status, data?.syncing, loadStatus]);

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
      const result = await whatsappService.connect();
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
      const result = await whatsappService.disconnect();
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
      const result = await whatsappService.cancel();
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

  return {
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
  };
}
