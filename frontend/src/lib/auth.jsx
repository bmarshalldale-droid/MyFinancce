import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=loading, null=anon, obj=auth
  const [token, setToken] = useState(localStorage.getItem('mf_token'));

  const checkAuth = useCallback(async () => {
    if (!token) { setUser(null); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch (e) {
      localStorage.removeItem('mf_token');
      localStorage.removeItem('mf_user');
      setToken(null);
      setUser(null);
    }
  }, [token]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('mf_token', data.token);
    localStorage.setItem('mf_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post('/auth/register', { email, password, name });
    localStorage.setItem('mf_token', data.token);
    localStorage.setItem('mf_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('mf_token');
    localStorage.removeItem('mf_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const value = useMemo(
    () => ({ user, login, register, logout, loading: user === undefined }),
    [user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
