import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken())); // only wait if there is a token to check

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null)) // expired or invalid token
      .finally(() => setLoading(false));
  }, []);

  const authenticate = useCallback(async (path, body) => {
    const d = await api(path, { method: 'POST', body });
    setToken(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const value = useMemo(() => ({
    user, loading,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (name, email, password) => authenticate('/auth/register', { name, email, password }),
    logout: () => { setToken(null); setUser(null); },
  }), [user, loading, authenticate]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
