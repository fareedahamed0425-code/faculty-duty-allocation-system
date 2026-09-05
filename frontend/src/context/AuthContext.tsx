import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { apiClient } from '../api/client';
import { INSTITUTIONAL_USERS } from '../api/mockData';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  demoSwitchRole: (roleName: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiClient.get<User>('/auth/me');
      setUser(res.data);
      localStorage.setItem('auth_user', JSON.stringify(res.data));
    } catch (err) {
      console.warn('Backend unavailable, checking stored/mock session:', err);
      const savedUser = localStorage.getItem('auth_user');
      if (!savedUser) {
        setUser(null);
        setToken(null);
        localStorage.removeItem('auth_token');
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, []);

  const login = async (email: string, password = 'password123') => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Attempt live backend authentication
      const res = await apiClient.post('/auth/json-login', { email: cleanEmail, password });
      const newToken = res.data.access_token;
      const loggedUser = res.data.user;
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_user', JSON.stringify(loggedUser));
      setToken(newToken);
      setUser(loggedUser);
    } catch (err) {
      console.warn('Live backend login error, activating institutional registry fallback:', err);
      // 2. Offline / Resilient Local Institutional Authentication
      const matchedUserEntry = INSTITUTIONAL_USERS[cleanEmail];
      if (matchedUserEntry) {
        if (password !== 'password123' && password !== 'admin' && password.length < 4) {
          throw new Error('Invalid credentials. Default institutional password is: password123');
        }
        localStorage.setItem('auth_token', matchedUserEntry.token);
        localStorage.setItem('auth_user', JSON.stringify(matchedUserEntry.user));
        setToken(matchedUserEntry.token);
        setUser(matchedUserEntry.user);
      } else {
        // Create standard Faculty session if unrecognized valid institutional email
        if (cleanEmail.includes('@') && cleanEmail.includes('.')) {
          const fallbackUser: User = {
            id: 99,
            email: cleanEmail,
            full_name: cleanEmail.split('@')[0].replace('.', ' ').toUpperCase(),
            is_active: true,
            role: {
              id: 4,
              name: 'FACULTY',
              description: 'Teaching Faculty Member',
              is_default_exempt: false,
              is_default_eligible: true,
              permissions: ['view_my_schedule', 'view_my_duties'],
            },
            faculty_id: 99,
            faculty_code: 'FAC-999',
            department_name: 'Computer Science & Engineering',
          };
          localStorage.setItem('auth_token', 'mock_jwt_session_faculty');
          localStorage.setItem('auth_user', JSON.stringify(fallbackUser));
          setToken('mock_jwt_session_faculty');
          setUser(fallbackUser);
        } else {
          throw new Error('Unrecognized institutional email. Use: admin@institution.edu, hod.cse@institution.edu, dean@institution.edu, or kumar@institution.edu');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  const demoSwitchRole = async (roleName: string) => {
    setIsLoading(true);
    const roleUpper = roleName.toUpperCase();
    try {
      const res = await apiClient.post(`/auth/demo-switch/${roleUpper}`);
      const newToken = res.data.access_token;
      const loggedUser = res.data.user;
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_user', JSON.stringify(loggedUser));
      setToken(newToken);
      setUser(loggedUser);
    } catch {
      // Fallback
      let fallbackEmail = 'admin@institution.edu';
      if (roleUpper === 'HOD') fallbackEmail = 'hod.cse@institution.edu';
      else if (roleUpper === 'DEAN') fallbackEmail = 'dean@institution.edu';
      else if (roleUpper === 'FACULTY') fallbackEmail = 'kumar@institution.edu';

      const entry = INSTITUTIONAL_USERS[fallbackEmail];
      if (entry) {
        localStorage.setItem('auth_token', entry.token);
        localStorage.setItem('auth_user', JSON.stringify(entry.user));
        setToken(entry.token);
        setUser(entry.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, demoSwitchRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
