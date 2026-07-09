import { apiFetch } from './client';

export interface LoginResponse {
  accessToken: string;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
