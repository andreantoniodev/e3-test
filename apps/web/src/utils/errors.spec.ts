import { describe, expect, it } from 'vitest';
import {
  ErrorParser,
  FirebaseAuthError,
  getFriendlyError,
  HttpForbiddenError,
  HttpNotFoundError,
  HttpServerError,
  HttpThrottlerError,
  HttpUnauthorizedError,
  NetworkError,
} from './errors';

describe('Domain Error Classes & ErrorParser', () => {
  it('instancia FirebaseAuthError com mensagens encapsuladas por código', () => {
    const err = new FirebaseAuthError('auth/user-disabled');
    expect(err).toBeInstanceOf(FirebaseAuthError);
    expect(err.code).toBe('auth/user-disabled');
    expect(err.friendlyMessage).toContain('desativada no Firebase');
  });

  it('ErrorParser identifica e instancia HttpThrottlerError (429)', () => {
    const parsed = ErrorParser.parse('ThrottlerException: Too Many Requests');
    expect(parsed).toBeInstanceOf(HttpThrottlerError);
    expect(parsed.statusCode).toBe(429);
    expect(parsed.friendlyMessage).toContain('Muitas requisições em pouco tempo');
  });

  it('ErrorParser identifica e instancia HttpUnauthorizedError (401)', () => {
    const parsed = ErrorParser.parse('Unauthorized');
    expect(parsed).toBeInstanceOf(HttpUnauthorizedError);
    expect(parsed.statusCode).toBe(401);
    expect(parsed.friendlyMessage).toContain('A API não validou seu login');
  });

  it('ErrorParser identifica e instancia HttpForbiddenError (403)', () => {
    const parsed = ErrorParser.parse('Forbidden resource');
    expect(parsed).toBeInstanceOf(HttpForbiddenError);
    expect(parsed.statusCode).toBe(403);
    expect(parsed.friendlyMessage).toContain('Acesso negado');
  });

  it('ErrorParser identifica e instancia HttpNotFoundError (404)', () => {
    const parsed = ErrorParser.parse('Not Found');
    expect(parsed).toBeInstanceOf(HttpNotFoundError);
    expect(parsed.statusCode).toBe(404);
  });

  it('ErrorParser identifica e instancia HttpServerError (500)', () => {
    const parsed = ErrorParser.parse('HTTP 500');
    expect(parsed).toBeInstanceOf(HttpServerError);
    expect(parsed.statusCode).toBe(500);
  });

  it('ErrorParser identifica e instancia NetworkError ao falhar a conexao', () => {
    const parsed = ErrorParser.parse(new Error('Failed to fetch'));
    expect(parsed).toBeInstanceOf(NetworkError);
    expect(parsed.friendlyMessage).toContain('Não foi possível conectar à API');
  });

  it('getFriendlyError retorna a friendlyMessage da classe instanciada pelo ErrorParser', () => {
    expect(getFriendlyError('Unauthorized')).toBe(
      'A API não validou seu login. Faça login novamente.',
    );
  });
});
