// src/context/AuthContext.jsx
//
// React Context providing Authentication state and Role-Based Access Control (RBAC).
// Manages JWT token storage in localStorage and seamless session restoration.

import { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, fetchCurrentUser } from '../services/api.js';
import { updateSocketAuth } from '../services/socket.js';

const AuthContext = createContext(null);

export const SEEDED_ACCOUNTS = {
  admin: {
    email: 'admin@traffic.ai',
    password: 'Admin@123',
    label: 'System Administrator',
    role: 'admin',
    desc: 'Full operational control, emergency scenario simulation, incident resolution'
  },
  operator: {
    email: 'operator@traffic.ai',
    password: 'Operator@123',
    label: 'Control Room Operator',
    role: 'operator',
    desc: 'Real-time camera feed monitoring, telemetry analytics, and geofence tracking'
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('traffic_ai_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('traffic_ai_token') || null;
  });

  const [loading, setLoading] = useState(true);

  // Validate session on app initialization
  useEffect(() => {
    async function verifySession() {
      if (token) {
        try {
          const res = await fetchCurrentUser();
          if (res.user) {
            setUser(res.user);
            localStorage.setItem('traffic_ai_user', JSON.stringify(res.user));
          }
        } catch (err) {
          console.warn('Session verification failed, logging out:', err.message);
          logout();
        }
      }
      setLoading(false);
    }
    verifySession();
  }, []);

  const login = async (email, password) => {
    const data = await loginUser({ email, password });
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('traffic_ai_token', data.token);
      localStorage.setItem('traffic_ai_user', JSON.stringify(data.user));
      updateSocketAuth(data.token);
      return data.user;
    }
    throw new Error('Invalid response from authentication server');
  };

  const demoLogin = async (role = 'admin') => {
    const creds = SEEDED_ACCOUNTS[role] || SEEDED_ACCOUNTS.admin;
    return login(creds.email, creds.password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('traffic_ai_token');
    localStorage.removeItem('traffic_ai_user');
    updateSocketAuth(null);
  };

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';
  const isAuthenticated = !!token && !!user;

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    isAdmin,
    isOperator,
    login,
    demoLogin,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
