import { describe, expect, it } from 'vitest';
import { getFriendlyError } from './errors';

describe('getFriendlyError (Frontend Error Translation)', () => {
  it('traduz erros 429 de Throttler / Too Many Requests para Português', () => {
    expect(getFriendlyError('ThrottlerException: Too Many Requests')).toBe(
      'Muitas requisições em pouco tempo. Por favor, aguarde alguns instantes.',
    );
    expect(getFriendlyError('Too Many Requests')).toBe(
      'Muitas requisições em pouco tempo. Por favor, aguarde alguns instantes.',
    );
    expect(
      getFriendlyError(
        JSON.stringify({ statusCode: 429, message: 'Too Many Requests' }),
      ),
    ).toBe('Muitas requisições em pouco tempo. Por favor, aguarde alguns instantes.');
  });

  it('traduz erros 401 / Unauthorized para Português', () => {
    expect(getFriendlyError('Unauthorized')).toBe(
      'A API não validou seu login. Faça login novamente.',
    );
    expect(
      getFriendlyError(
        JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
      ),
    ).toBe('A API não validou seu login. Faça login novamente.');
  });

  it('traduz erros 403 / Forbidden para Português', () => {
    expect(getFriendlyError('Forbidden resource')).toBe(
      'Acesso negado. Seu e-mail precisa estar cadastrado no seed da API.',
    );
    expect(
      getFriendlyError(
        JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
      ),
    ).toBe('Acesso negado. Seu e-mail precisa estar cadastrado no seed da API.');
  });

  it('traduz falhas de conexão de rede', () => {
    expect(getFriendlyError(new Error('Failed to fetch'))).toContain(
      'Não foi possível conectar à API',
    );
  });

  it('preserva mensagens em Português já formatadas', () => {
    expect(getFriendlyError('Informe o ADMIN_SECRET.')).toBe(
      'Informe o ADMIN_SECRET.',
    );
  });
});
