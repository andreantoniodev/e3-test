import { AppError, ErrorParser, HttpUnauthorizedError } from '../utils/errors';
import { firebaseAuth } from './firebase';

export * from '../types';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export interface RequestOptions extends RequestInit {
  adminSecret?: string;
  skipAuth?: boolean;
}

type UnauthorizedHandler = () => void;

export class HttpClient {
  private static onUnauthorizedListeners: Set<UnauthorizedHandler> = new Set();

  static onUnauthorized(handler: UnauthorizedHandler) {
    HttpClient.onUnauthorizedListeners.add(handler);
    return () => {
      HttpClient.onUnauthorizedListeners.delete(handler);
    };
  }

  private static async getAuthToken(): Promise<string> {
    const user = firebaseAuth?.currentUser;
    if (!user) {
      throw new HttpUnauthorizedError('Usuário não autenticado.');
    }
    try {
      return await user.getIdToken();
    } catch (err) {
      throw new HttpUnauthorizedError('Falha ao obter token de acesso.');
    }
  }

  static async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { adminSecret, skipAuth, headers, ...restOptions } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((headers as Record<string, string>) || {}),
    };

    try {
      if (adminSecret) {
        requestHeaders['x-admin-secret'] = adminSecret;
      } else if (!skipAuth) {
        const token = await HttpClient.getAuthToken();
        requestHeaders.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...restOptions,
        headers: requestHeaders,
      });

      if (!response.ok) {
        const rawBody = await response.text();
        const parsedError = ErrorParser.parse(
          rawBody || `HTTP ${response.status}`,
          'Falha na requisição.',
        );

        if (response.status === 401 || parsedError instanceof HttpUnauthorizedError) {
          HttpClient.onUnauthorizedListeners.forEach((listener) => listener());
        }

        throw parsedError;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw ErrorParser.parse(error, 'Falha de comunicação com a API.');
    }
  }

  static get<T>(path: string, options?: RequestOptions): Promise<T> {
    return HttpClient.request<T>(path, { ...options, method: 'GET' });
  }

  static post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return HttpClient.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return HttpClient.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return HttpClient.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return HttpClient.request<T>(path, init);
}

export async function adminFetch<T>(
  path: string,
  adminSecret: string,
  init: RequestInit = {},
): Promise<T> {
  return HttpClient.request<T>(path, { ...init, adminSecret });
}
