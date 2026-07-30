type FirebaseLikeError = {
  code?: string;
  message?: string;
};

function readFirebaseCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const code = (error as FirebaseLikeError).code;
  return typeof code === 'string' ? code : null;
}

function readMessage(error: unknown): string {
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

function parseApiPayload(raw: string): {
  message: string | null;
  statusCode: number | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
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
    if (trimmed.length < 220 && !trimmed.startsWith('<')) {
      return { message: trimmed, statusCode: null };
    }
  }

  return { message: null, statusCode: null };
}

const firebaseMessages: Record<string, string> = {
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

export function getFriendlyError(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  const code = readFirebaseCode(error);
  if (code && firebaseMessages[code]) {
    return firebaseMessages[code];
  }

  const message = readMessage(error);

  if (
    code === 'auth/configuration-not-found' ||
    /auth\/configuration-not-found/i.test(message)
  ) {
    return firebaseMessages['auth/configuration-not-found'];
  }

  const authCodeMatch = message.match(/auth\/[a-z0-9-]+/i);
  if (authCodeMatch) {
    const matched = authCodeMatch[0].toLowerCase();
    if (firebaseMessages[matched]) {
      return firebaseMessages[matched];
    }
  }

  if (/Failed to fetch|NetworkError|Load failed|ECONNREFUSED/i.test(message)) {
    const apiUrl = import.meta.env.VITE_API_URL || 'a URL configurada em VITE_API_URL';
    return `Não foi possível conectar à API. Confirme se o backend está no ar em ${apiUrl}.`;
  }

  if (/Firebase não configurado/i.test(message) && !message.trim().startsWith('{')) {
    return 'Firebase do front não configurado. Preencha VITE_FIREBASE_* em apps/web/.env e reinicie o Vite.';
  }

  if (/Evolution API request failed/i.test(message) || /Evolution Go request failed/i.test(message) || /not authorized/i.test(message)) {
    if (/401|not authorized/i.test(message)) {
      return 'Evolution API recusou a API key. Confira se EVOLUTION_API_KEY é a mesma em .env e AUTHENTICATION_API_KEY do container, depois rode: docker compose up -d --force-recreate evolution-api api';
    }
    return 'Falha ao falar com a Evolution API. Confirme se o serviço está rodando na porta 8080.';
  }

  const httpMatch = message.match(/^HTTP (\d{3})$/);
  if (httpMatch) {
    const status = Number(httpMatch[1]);
    if (status === 401) {
      return 'A API não validou seu login. Confira o Firebase Admin na API ou faça login novamente.';
    }
    if (status === 403) {
      return 'Acesso negado. Seu e-mail precisa estar cadastrado no seed da API.';
    }
    if (status === 404) {
      return 'Recurso não encontrado.';
    }
    if (status >= 500) {
      return 'Erro interno da API. Verifique os logs do backend.';
    }
    return `A API respondeu com erro (${status}).`;
  }

  const { message: apiMessage, statusCode } = parseApiPayload(message);
  if (apiMessage) {
    if (/Firebase Admin não configurado/i.test(apiMessage)) {
      return 'Firebase Admin não configurado na API. Preencha FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY e reinicie a API.';
    }
    if (/não está cadastrado|seed da API/i.test(apiMessage)) {
      return apiMessage;
    }
    if (statusCode === 403 || /forbidden/i.test(apiMessage)) {
      return 'Acesso negado. Seu e-mail precisa estar cadastrado no seed da API.';
    }
    if (
      statusCode === 401 ||
      apiMessage === 'Unauthorized' ||
      /invalid token|token Firebase inválido|expirado/i.test(apiMessage)
    ) {
      return 'A API não validou seu login. Confira o Firebase Admin (service account) na API ou faça login novamente.';
    }
    if (statusCode === 404 || apiMessage === 'Not Found') {
      return 'Não encontramos esse recurso. Atualize a página ou tente conectar o WhatsApp de novo.';
    }
    if (apiMessage.length <= 220) {
      return apiMessage;
    }
  }

  if (/Firebase Admin não configurado/i.test(message)) {
    return 'Firebase Admin não configurado na API. Preencha FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY e reinicie a API.';
  }

  if (/não está cadastrado|seed da API/i.test(message) && !message.trim().startsWith('{')) {
    return message;
  }

  if (message === 'Unauthenticated' || message === 'Unauthorized') {
    return 'A API não validou seu login. Confira o Firebase Admin na API ou faça login novamente.';
  }

  if (message.startsWith('Firebase:')) {
    return 'Falha na autenticação do Firebase. Verifique Authentication e o provedor Google no Console.';
  }

  if (message && message.length <= 220 && !message.startsWith('{')) {
    return message;
  }

  return fallback;
}
