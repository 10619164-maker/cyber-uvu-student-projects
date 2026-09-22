import { useCallback, useEffect, useState } from 'react';
import { auth, ApiError } from '../lib/api.js';

/**
 * Tracks whether the current browser session has a valid login cookie, by asking
 * the API (GET /api/auth/me, which requires a valid session). This is the client
 * half of the Domain 1 fix - the app now has a real login gate instead of showing
 * every teammate's data to anyone who loads the page.
 */
export function useAuth() {
  const [username, setUsername] = useState(null);
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    setChecking(true);
    try {
      const me = await auth.me();
      setUsername(me.username);
    } catch {
      setUsername(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (usernameInput, password) => {
    try {
      const result = await auth.login(usernameInput, password);
      setUsername(result.username);
      return { ok: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed.';
      return { ok: false, message };
    }
  }, []);

  const logout = useCallback(async () => {
    await auth.logout().catch(() => {});
    setUsername(null);
  }, []);

  return { username, isAuthenticated: Boolean(username), checking, login, logout };
}
