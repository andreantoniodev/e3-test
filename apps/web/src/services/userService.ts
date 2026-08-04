import { apiFetch } from '../lib/api';
import { MeResponse } from '../types';

export const userService = {
  getMe: () => apiFetch<MeResponse>('/me'),
};
