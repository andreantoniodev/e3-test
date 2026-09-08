import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from './api';
import { HttpForbiddenError, HttpThrottlerError, HttpUnauthorizedError } from '../utils/errors';

describe('HttpClient Centralized Infrastructure', () => {
  it('lança HttpThrottlerError ao receber HTTP 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('ThrottlerException: Too Many Requests'),
      }),
    );

    await expect(HttpClient.request('/test', { skipAuth: true })).rejects.toThrow(
      HttpThrottlerError,
    );
  });

  it('lança HttpUnauthorizedError ao receber HTTP 401 e dispara listener', async () => {
    const listener = vi.fn();
    const unsubscribe = HttpClient.onUnauthorized(listener);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }),
    );

    await expect(HttpClient.request('/test', { skipAuth: true })).rejects.toThrow(
      HttpUnauthorizedError,
    );
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('lança HttpForbiddenError ao receber HTTP 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden resource'),
      }),
    );

    await expect(HttpClient.request('/test', { skipAuth: true })).rejects.toThrow(
      HttpForbiddenError,
    );
  });

  it('retorna JSON quando a resposta HTTP é 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      }),
    );

    const result = await HttpClient.request<{ success: boolean }>('/test', {
      skipAuth: true,
    });
    expect(result).toEqual({ success: true });
  });
});
