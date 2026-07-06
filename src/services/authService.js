// Auth service calls are made with raw fetch (not apiClient) so they are
// never accidentally caught by the token-refresh interceptor loop.
import { BASE_URL } from './apiClient';

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw json;
  return json;
}

export const authService = {
  /**
   * Step 1 of login — validates credentials and triggers OTP email.
   * Returns { pendingToken, destination } where destination is a masked email.
   */
  async login(email, password) {
    const { data } = await post('/api/auth/login', { email, password });
    return data; // { pendingToken, destination }
  },

  /**
   * Step 2 of login — submits the OTP code alongside the pending token.
   * Returns { accessToken, refreshToken, user } on success.
   */
  async verifyOtp(pendingToken, otpCode) {
    const { data } = await post('/api/auth/verify-otp', { pendingToken, otpCode });
    return data; // { accessToken, refreshToken, user }
  },

  /**
   * Revokes the refresh token server-side. Always resolves — a network
   * failure must not block the local logout flow.
   */
  async logout(refreshToken) {
    try {
      await post('/api/auth/logout', { refreshToken });
    } catch {
      // Intentionally silent: local session is cleared regardless
    }
  },
};
