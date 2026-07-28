import { Injectable, InternalServerErrorException } from '@nestjs/common';

type EvolutionGoRequestOptions = {
  method?: string;
  body?: unknown;
  path: string;
  instanceId?: string;
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

@Injectable()
export class EvolutionClient {
  private readonly baseUrl = (
    process.env.EVOLUTION_API_URL || 'http://localhost:8080'
  ).replace(/\/$/, '');
  private readonly apiKey = process.env.EVOLUTION_API_KEY || '';

  async request<T = unknown>({
    path,
    method = 'GET',
    body,
    instanceId,
  }: EvolutionGoRequestOptions): Promise<T> {
    const headers: Record<string, string> = {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    };

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

  createInstance(name: string) {
    return this.request<EvolutionGoCreateResponse>({
      path: '/instance/create',
      method: 'POST',
      body: { name },
    });
  }

  connect(
    instanceId: string,
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
      body: payload,
    });
  }

  status(instanceId: string) {
    return this.request<EvolutionGoStatusResponse>({
      path: '/instance/status',
      instanceId,
    });
  }
}
