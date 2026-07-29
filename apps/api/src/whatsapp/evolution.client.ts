import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
import { EVOLUTION_API_WEBHOOK_EVENTS } from './evolution-api.events';

export function describeEvolutionError(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    return typeof response === 'string' ? response : JSON.stringify(response);
  }
  return error instanceof Error ? error.message : String(error);
}

type EvolutionApiRequestOptions = {
  method?: string;
  body?: unknown;
  path: string;
  instanceToken?: string;
};

export type EvolutionApiCreateResponse = {
  instance?: {
    instanceName?: string;
    instanceId?: string;
    status?: string;
  };
  hash?: string | { apikey?: string };
  qrcode?: {
    pairingCode?: string | null;
    code?: string;
    base64?: string;
    count?: number;
  };
  message?: string;
};

export type EvolutionApiConnectResponse = {
  pairingCode?: string | null;
  code?: string;
  base64?: string;
  count?: number;
};

export type EvolutionApiConnectionStateResponse = {
  instance?: {
    instanceName?: string;
    state?: string;
  };
};

export type EvolutionApiSendTextResponse = {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  message?: unknown;
};

@Injectable()
export class EvolutionClient {
  private readonly logger = new Logger(EvolutionClient.name);
  private readonly baseUrl = (
    process.env.EVOLUTION_API_URL || 'http://localhost:8080'
  ).replace(/\/$/, '');
  private readonly globalApiKey = process.env.EVOLUTION_API_KEY || '';

  async request<T = unknown>({
    path,
    method = 'GET',
    body,
    instanceToken,
  }: EvolutionApiRequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      apikey: instanceToken || this.globalApiKey,
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      throw new InternalServerErrorException({
        message: 'Evolution API request failed',
        status: response.status,
        data,
      });
    }

    return data as T;
  }

  createInstance(params: {
    instanceName: string;
    webhookUrl: string;
  }) {
    return this.request<EvolutionApiCreateResponse>({
      path: '/instance/create',
      method: 'POST',
      body: {
        instanceName: params.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          enabled: true,
          url: params.webhookUrl,
          byEvents: false,
          base64: true,
          events: [...EVOLUTION_API_WEBHOOK_EVENTS],
        },
      },
    });
  }

  setWebhook(instanceName: string, webhookUrl: string, instanceToken?: string) {
    return this.request({
      path: `/webhook/set/${encodeURIComponent(instanceName)}`,
      method: 'POST',
      instanceToken,
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: [...EVOLUTION_API_WEBHOOK_EVENTS],
        },
      },
    });
  }

  setSettings(instanceName: string, instanceToken?: string) {
    return this.request({
      path: `/settings/set/${encodeURIComponent(instanceName)}`,
      method: 'POST',
      instanceToken,
      body: {
        rejectCall: false,
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      },
    });
  }

  connect(instanceName: string, instanceToken?: string) {
    return this.request<EvolutionApiConnectResponse>({
      path: `/instance/connect/${encodeURIComponent(instanceName)}`,
      instanceToken,
    });
  }

  connectionState(instanceName: string, instanceToken?: string) {
    return this.request<EvolutionApiConnectionStateResponse>({
      path: `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      instanceToken,
    });
  }

  logout(instanceName: string, instanceToken?: string) {
    return this.request({
      path: `/instance/logout/${encodeURIComponent(instanceName)}`,
      method: 'DELETE',
      instanceToken,
    });
  }

  async deleteInstance(instanceName: string, instanceToken?: string) {
    const path = `/instance/delete/${encodeURIComponent(instanceName)}`;
    try {
      return await this.request({
        path,
        method: 'DELETE',
        instanceToken,
      });
    } catch (error) {
      if (!instanceToken) {
        throw error;
      }
      return this.request({
        path,
        method: 'DELETE',
      });
    }
  }

  sendText(
    instanceName: string,
    number: string,
    text: string,
    instanceToken?: string,
  ) {
    return this.request<EvolutionApiSendTextResponse>({
      path: `/message/sendText/${encodeURIComponent(instanceName)}`,
      method: 'POST',
      instanceToken,
      body: {
        number,
        text,
      },
    });
  }

  async listInstances() {
    const response = await this.request<
      | Array<Record<string, unknown>>
      | { instance?: Array<Record<string, unknown>> | Record<string, unknown> }
    >({
      path: '/instance/fetchInstances',
    });

    if (Array.isArray(response)) {
      return response;
    }
    if (Array.isArray(response.instance)) {
      return response.instance;
    }
    if (response.instance && typeof response.instance === 'object') {
      return [response.instance];
    }
    return [];
  }

  instanceNameFrom(item: Record<string, unknown>) {
    const nested =
      item.instance && typeof item.instance === 'object'
        ? (item.instance as Record<string, unknown>)
        : null;
    const name =
      (typeof item.name === 'string' && item.name) ||
      (typeof item.instanceName === 'string' && item.instanceName) ||
      (typeof nested?.instanceName === 'string' && nested.instanceName) ||
      (typeof nested?.name === 'string' && nested.name) ||
      null;
    return name;
  }

  extractInstanceToken(hash: EvolutionApiCreateResponse['hash']) {
    if (!hash) {
      return this.globalApiKey || null;
    }
    if (typeof hash === 'string' && hash.trim()) {
      return hash.trim();
    }
    if (typeof hash === 'object' && hash.apikey?.trim()) {
      return hash.apikey.trim();
    }
    return this.globalApiKey || null;
  }

  extractQrCode(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const record = payload as Record<string, unknown>;
    const nestedQr =
      record.qrcode && typeof record.qrcode === 'object'
        ? (record.qrcode as Record<string, unknown>)
        : null;
    const candidates = [record.code, nestedQr?.code];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return null;
  }

  extractQrBase64(payload: unknown): string | null {
    if (!payload) {
      return null;
    }
    if (typeof payload === 'string' && payload.trim()) {
      const raw = payload.trim();
      if (!raw.startsWith('data:') && raw.length < 500) {
        return null;
      }
      return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
    }
    if (typeof payload !== 'object') {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const nestedQr =
      record.qrcode && typeof record.qrcode === 'object'
        ? (record.qrcode as Record<string, unknown>)
        : null;

    const candidates = [record.base64, nestedQr?.base64];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        continue;
      }
      const raw = candidate.trim();
      return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
    }

    return null;
  }

  async resolveQrImage(payload: unknown): Promise<string | null> {
    const base64 = this.extractQrBase64(payload);
    if (base64) {
      return base64;
    }

    const code = this.extractQrCode(payload);
    if (!code) {
      return null;
    }

    try {
      return await QRCode.toDataURL(code, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: 'M',
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gerar imagem do QR a partir do code | ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }
}
