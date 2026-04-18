import { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken, clearToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api('GET', '/auth/me')
        .then(data => setUser(data.user))
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api('POST', '/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const signup = async (email, password, name, restaurant_name) => {
    const data = await api('POST', '/auth/signup', { email, password, name, restaurant_name });
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  // Call this after a payment to refresh plan info
  const refreshUser = async () => {
    try {
      const data = await api('GET', '/auth/me');
      setUser(data.user);
    } catch (_) {}
  };

  // Update user in context directly (e.g. after payment verify)
  const updateUser = (updatedUser) => setUser(updatedUser);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
