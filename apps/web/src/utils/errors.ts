type FirebaseLikeError = {
  code?: string;
  message?: string;
};

export abstract class AppError extends Error {
  public abstract readonly friendlyMessage: string;
  public abstract readonly code: string;
  public readonly statusCode: number | null = null;
  public readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.originalError = originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FirebaseAuthError extends AppError {
  public readonly friendlyMessage: string;
  public readonly code: string;

  private static readonly CODES_MAP: Record<string, string> = {
    'auth/configuration-not-found':
      'Autenticação do Firebase não configurada. Ative Authentication e o provedor Google no Console do Firebase.',
    'auth/operation-not-allowed':
      'Login com Google não está habilitado no Firebase. Ative o provedor Google em Authentication → Sign-in method.',
    'auth/unauthorized-domain':
      'Este domínio não está autorizado no Firebase. Adicione-o em Authentication → Settings → Authorized domains.',
    'auth/invalid-api-key':
      'Chave do Firebase inválida. Confira VITE_FIREBASE_API_KEY em apps/web/.env.',
    'auth/popup-closed-by-user': 'Login cancelado. Feche o popup só depois de escolher a conta.',
    'auth/cancelled-popup-request': 'Outra janela de login já estava aberta. Tente novamente.',
    'auth/popup-blocked':
      'O navegador bloqueou o popup de login. Permita popups para este site e tente de novo.',
    'auth/network-request-failed':
      'Falha de rede ao falar com o Firebase. Verifique sua conexão e tente novamente.',
    'auth/user-disabled': 'Esta conta Google está desativada no Firebase.',
    'auth/too-many-requests': 'Muitas tentativas de login. Aguarde um momento e tente novamente.',
    'auth/internal-error': 'Erro interno do Firebase. Tente novamente em instantes.',
  };

  constructor(code: string, originalError?: unknown) {
    const friendly =
      FirebaseAuthError.CODES_MAP[code] ||
      'Falha na autenticação do Firebase. Verifique sua conta e tente novamente.';
    super(friendly, originalError);
    this.name = 'FirebaseAuthError';
    this.code = code;
    this.friendlyMessage = friendly;
  }

  static isFirebaseCode(code: string): boolean {
    return code.startsWith('auth/') || Boolean(FirebaseAuthError.CODES_MAP[code]);
  }
}

export class HttpThrottlerError extends AppError {
  public readonly friendlyMessage =
    'Muitas requisições em pouco tempo. Por favor, aguarde alguns instantes.';
  public readonly code = 'TOO_MANY_REQUESTS';
  public override readonly statusCode = 429;

  constructor(originalError?: unknown) {
    super('Muitas requisições em pouco tempo. Por favor, aguarde alguns instantes.', originalError);
    this.name = 'HttpThrottlerError';
  }
}

export class HttpUnauthorizedError extends AppError {
  public readonly friendlyMessage =
    'A API não validou seu login. Faça login novamente.';
  public readonly code = 'UNAUTHORIZED';
  public override readonly statusCode = 401;

  constructor(originalError?: unknown) {
    super('A API não validou seu login. Faça login novamente.', originalError);
    this.name = 'HttpUnauthorizedError';
  }
}

export class HttpForbiddenError extends AppError {
  public readonly friendlyMessage =
    'Acesso negado. Seu e-mail precisa estar cadastrado no seed da API.';
  public readonly code = 'FORBIDDEN';
  public override readonly statusCode = 403;

  constructor(originalError?: unknown) {
    super(
      'Acesso negado. Seu e-mail precisa estar cadastrado no seed da API.',
      originalError,
    );
    this.name = 'HttpForbiddenError';
  }
}

export class HttpNotFoundError extends AppError {
  public readonly friendlyMessage =
    'Não encontramos esse recurso. Atualize a página ou tente conectar o WhatsApp de novo.';
  public readonly code = 'NOT_FOUND';
  public override readonly statusCode = 404;

  constructor(originalError?: unknown) {
    super(
      'Não encontramos esse recurso. Atualize a página ou tente conectar o WhatsApp de novo.',
      originalError,
    );
    this.name = 'HttpNotFoundError';
  }
}

export class HttpServerError extends AppError {
  public readonly friendlyMessage =
    'Erro interno da API. Verifique os logs do backend.';
  public readonly code = 'INTERNAL_SERVER_ERROR';
  public override readonly statusCode: number;

  constructor(statusCode = 500, originalError?: unknown) {
    super('Erro interno da API. Verifique os logs do backend.', originalError);
    this.name = 'HttpServerError';
    this.statusCode = statusCode;
  }
}

export class NetworkError extends AppError {
  public readonly friendlyMessage: string;
  public readonly code = 'NETWORK_ERROR';

  constructor(apiUrl?: string, originalError?: unknown) {
    const targetUrl = apiUrl || import.meta.env.VITE_API_URL || 'a URL configurada';
    const message = `Não foi possível conectar à API. Confirme se o backend está no ar em ${targetUrl}.`;
    super(message, originalError);
    this.name = 'NetworkError';
    this.friendlyMessage = message;
  }
}

export class GenericAppError extends AppError {
  public readonly friendlyMessage: string;
  public readonly code: string;
  public override readonly statusCode: number | null;

  constructor(
    friendlyMessage: string,
    options?: {
      code?: string;
      statusCode?: number | null;
      originalError?: unknown;
    },
  ) {
    super(friendlyMessage, options?.originalError);
    this.name = 'GenericAppError';
    this.friendlyMessage = friendlyMessage;
    this.code = options?.code || 'APP_ERROR';
    this.statusCode = options?.statusCode ?? null;
  }
}

export class ErrorParser {
  static parse(
    error: unknown,
    fallback = 'Ocorreu um erro inesperado. Tente novamente.',
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const firebaseCode = ErrorParser.extractFirebaseCode(error);
    if (firebaseCode && FirebaseAuthError.isFirebaseCode(firebaseCode)) {
      return new FirebaseAuthError(firebaseCode, error);
    }

    const rawMessage = ErrorParser.extractMessage(error);

    if (
      firebaseCode === 'auth/configuration-not-found' ||
      /auth\/configuration-not-found/i.test(rawMessage)
    ) {
      return new FirebaseAuthError('auth/configuration-not-found', error);
    }

    const authCodeMatch = rawMessage.match(/auth\/[a-z0-9-]+/i);
    if (authCodeMatch) {
      return new FirebaseAuthError(authCodeMatch[0].toLowerCase(), error);
    }

    if (/Failed to fetch|NetworkError|Load failed|ECONNREFUSED/i.test(rawMessage)) {
      return new NetworkError(undefined, error);
    }

    const statusCode = ErrorParser.extractStatusCode(error, rawMessage);
    const apiPayload = ErrorParser.parseApiPayload(rawMessage);
    const effectiveStatus = statusCode || apiPayload.statusCode;

    if (
      effectiveStatus === 429 ||
      /ThrottlerException|Too Many Requests/i.test(rawMessage) ||
      (apiPayload.message && /ThrottlerException|Too Many Requests/i.test(apiPayload.message))
    ) {
      return new HttpThrottlerError(error);
    }

    if (
      effectiveStatus === 401 ||
      rawMessage === 'Unauthorized' ||
      rawMessage === 'Unauthenticated' ||
      (apiPayload.message && /Unauthorized|Unauthenticated|invalid token/i.test(apiPayload.message))
    ) {
      return new HttpUnauthorizedError(error);
    }

    if (
      effectiveStatus === 403 ||
      /Forbidden/i.test(rawMessage) ||
      (apiPayload.message && /Forbidden/i.test(apiPayload.message))
    ) {
      return new HttpForbiddenError(error);
    }

    if (
      effectiveStatus === 404 ||
      rawMessage === 'Not Found' ||
      (apiPayload.message && /Not Found/i.test(apiPayload.message))
    ) {
      return new HttpNotFoundError(error);
    }

    if (effectiveStatus && effectiveStatus >= 500) {
      return new HttpServerError(effectiveStatus, error);
    }

    if (apiPayload.message && apiPayload.message.length <= 220) {
      return new GenericAppError(apiPayload.message, {
        code: 'API_MESSAGE',
        statusCode: effectiveStatus,
        originalError: error,
      });
    }

    if (rawMessage && rawMessage.length <= 220 && !rawMessage.startsWith('{')) {
      return new GenericAppError(rawMessage, {
        code: 'RAW_MESSAGE',
        statusCode: effectiveStatus,
        originalError: error,
      });
    }

    return new GenericAppError(fallback, {
      code: 'FALLBACK_ERROR',
      statusCode: effectiveStatus,
      originalError: error,
    });
  }

  private static extractFirebaseCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }
    const code = (error as FirebaseLikeError).code;
    return typeof code === 'string' ? code : null;
  }

  private static extractStatusCode(error: unknown, rawMessage: string): number | null {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (typeof status === 'number') {
        return status;
      }
    }
    const httpMatch = rawMessage.match(/^HTTP (\d{3})$/);
    if (httpMatch) {
      return Number(httpMatch[1]);
    }
    return null;
  }

  private static extractMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as FirebaseLikeError).message;
      if (typeof message === 'string') {
        return message;
      }
    }
    return '';
  }

  private static parseApiPayload(raw: string): {
    message: string | null;
    statusCode: number | null;
  } {
    const trimmed = raw.trim();
    if (!trimmed || !trimmed.startsWith('{')) {
      return { message: null, statusCode: null };
    }

    try {
      const json = JSON.parse(trimmed) as {
        message?: string | string[];
        error?: string;
        statusCode?: number;
      };

      let message: string | null = null;
      if (Array.isArray(json.message)) {
        message = json.message.join(', ');
      } else if (typeof json.message === 'string' && json.message.trim()) {
        message = json.message;
      } else if (typeof json.error === 'string' && json.error.trim()) {
        message = json.error;
      }

      return {
        message,
        statusCode: typeof json.statusCode === 'number' ? json.statusCode : null,
      };
    } catch {
      return { message: null, statusCode: null };
    }
  }
}

export function getFriendlyError(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  return ErrorParser.parse(error, fallback).friendlyMessage;
}
