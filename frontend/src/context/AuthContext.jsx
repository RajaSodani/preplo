import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * AuthContext provides login state to the entire app.
 *
 * Pattern: Context + custom hook (useAuth).
 * Any component calls useAuth() instead of useContext(AuthContext) directly —
 * cleaner API and throws a helpful error if used outside the provider.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('accessToken'));
  const [loading, setLoading] = useState(true);  // true on first load while we verify token

  // On mount, verify the stored token is still valid
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then(res => setUser(res.data.data.user))
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem('accessToken');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);  // empty deps — only runs on mount

  const saveToken = useCallback((newToken) => {
    localStorage.setItem('accessToken', newToken);
    setToken(newToken);
    // Update the axios default header so all subsequent requests are authenticated
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user, accessToken } = res.data.data;
    saveToken(accessToken);
    setUser(user);
    return user;
  }, [saveToken]);

  const register = useCallback(async (fullName, email, password) => {
    const res = await api.post('/auth/register', { fullName, email, password });
    const { user, accessToken } = res.data.data;
    saveToken(accessToken);
    setUser(user);
    return user;
  }, [saveToken]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
      setToken(null);
      setUser(null);
    }
  }, []);

  // Called after Google OAuth redirect — reads token from URL fragment
  const handleOAuthCallback = useCallback((accessToken) => {
    saveToken(accessToken);
    // Fetch the user profile with the new token
    api.get('/auth/me').then(res => setUser(res.data.data.user));
  }, [saveToken]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    handleOAuthCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
