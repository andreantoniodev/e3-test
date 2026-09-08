import { firebaseAuth } from './firebase';
import { getFriendlyError } from './errors';
export * from '../types';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

async function getToken() {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    throw new Error('Unauthenticated');
  }
  return user.getIdToken();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const token = await getToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    throw new Error(getFriendlyError(error, 'Falha ao comunicar com a API.'));
  }
}

export async function adminFetch<T>(
  path: string,
  adminSecret: string,
  init: RequestInit = {},
): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    throw new Error(getFriendlyError(error, 'Falha ao comunicar com a API admin.'));
  }
}
