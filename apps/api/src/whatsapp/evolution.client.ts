import { Injectable, InternalServerErrorException } from '@nestjs/common';

type EvolutionGoRequestOptions = {
  method?: string;
  body?: unknown;
  path: string;
  instanceId?: string;
  instanceToken?: string;
};

export type EvolutionGoCreateResponse = {
  data?: {
    id?: string;
    name?: string;
    token?: string;
    connected?: boolean;
    qrcode?: string;
  };
  message?: string;
};

export type EvolutionGoStatusResponse = {
  data?: {
    Connected?: boolean;
    LoggedIn?: boolean;
    Name?: string;
  };
  message?: string;
};

export type EvolutionGoInfoResponse = {
  data?: {
    id?: string;
    name?: string;
    jid?: string;
    Jid?: string;
    phone?: string;
    connected?: boolean;
    Connected?: boolean;
  };
  message?: string;
};

export type EvolutionGoInstanceListItem = {
  id?: string;
  name?: string;
  jid?: string;
  Jid?: string;
  phone?: string;
  connected?: boolean;
  Connected?: boolean;
  token?: string;
};

@Injectable()
export class EvolutionClient {
  private readonly baseUrl = (
    process.env.EVOLUTION_API_URL || 'http://localhost:8080'
  ).replace(/\/$/, '');
  private readonly globalApiKey = process.env.EVOLUTION_API_KEY || '';

  async request<T = unknown>({
    path,
    method = 'GET',
    body,
    instanceId,
    instanceToken,
  }: EvolutionGoRequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      apikey: instanceToken || this.globalApiKey,
      'Content-Type': 'application/json',
    };

    if (instanceToken) {
      headers.token = instanceToken;
    }

    if (instanceId) {
      headers.instanceId = instanceId;
    }

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
        message: 'Evolution Go request failed',
        status: response.status,
        data,
      });
    }

    return data as T;
  }

  createInstance(name: string, token: string) {
    return this.request<EvolutionGoCreateResponse>({
      path: '/instance/create',
      method: 'POST',
      body: { name, token },
    });
  }

  connect(
    instanceId: string,
    instanceToken: string,
    payload: {
      webhookUrl: string;
      subscribe: string[];
      immediate?: boolean;
    },
  ) {
    return this.request({
      path: '/instance/connect',
      method: 'POST',
      instanceId,
      instanceToken,
      body: payload,
    });
  }

  status(instanceId: string, instanceToken: string) {
    return this.request<EvolutionGoStatusResponse>({
      path: '/instance/status',
      instanceId,
      instanceToken,
    });
  }

  info(instanceId: string) {
    // /instance/info exige GLOBAL_API_KEY (token da instância retorna 401).
    return this.request<EvolutionGoInfoResponse>({
      path: `/instance/info/${encodeURIComponent(instanceId)}`,
      instanceId,
    });
  }

  async listInstances() {
    const response = await this.request<{ data?: EvolutionGoInstanceListItem[] } | EvolutionGoInstanceListItem[]>({
      path: '/instance/all',
    });
    if (Array.isArray(response)) {
      return response;
    }
    return response.data || [];
  }

  disconnect(instanceId: string, instanceToken: string) {
    return this.request({
      path: '/instance/disconnect',
      method: 'POST',
      instanceId,
      instanceToken,
    });
  }

  async deleteInstance(instanceId: string, instanceToken?: string) {
    const path = `/instance/delete/${encodeURIComponent(instanceId)}`;
    try {
      return await this.request({
        path,
        method: 'DELETE',
        instanceId,
        instanceToken,
      });
    } catch (error) {
      if (!instanceToken) {
        throw error;
      }
      // Fallback com a GLOBAL_API_KEY (algumas rotas admin exigem isso).
      return this.request({
        path,
        method: 'DELETE',
        instanceId,
      });
    }
  }

  sendText(instanceId: string, instanceToken: string, number: string, text: string) {
    return this.request<{
      data?: { Info?: { ID?: string } };
      message?: string;
    }>({
      path: '/send/text',
      method: 'POST',
      instanceId,
      instanceToken,
      body: { number, text },
    });
  }
}
