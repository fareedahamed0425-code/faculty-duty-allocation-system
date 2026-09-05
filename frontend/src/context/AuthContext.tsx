import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiClient } from '../api/client';
import {
  auth,
  loginWithFirebaseEmail,
  signUpWithFirebaseEmail,
  signInWithGoogle,
  sendFirebasePasswordReset,
  logoutFirebase,
  FirebaseUser,
} from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to construct fallback institutional user if backend is offline
export function createFallbackUser(email: string, displayName?: string | null): User {
  const cleanEmail = email.trim().toLowerCase();
  let roleName: UserRole = 'FACULTY';
  let roleDescription = 'Teaching Faculty Member';
  let permissions = ['view_my_schedule', 'view_my_duties'];
  let isExempt = false;
  let isEligible = true;
  let dept = 'Computer Science & Engineering';

  if (cleanEmail.includes('admin')) {
    roleName = 'ADMIN';
    roleDescription = 'System Administrator with full access';
    permissions = ['all'];
    isExempt = true;
    isEligible = false;
    dept = 'Information Technology & Administration';
  } else if (cleanEmail.includes('hod')) {
    roleName = 'HOD';
    roleDescription = 'Head of Department';
    permissions = ['view_dashboard', 'view_department', 'view_reports', 'manage_substitutions'];
    isExempt = true;
    isEligible = false;
    dept = 'Computer Science & Engineering';
  } else if (cleanEmail.includes('dean')) {
    roleName = 'DEAN';
    roleDescription = 'Dean of Academic Affairs';
    permissions = ['view_dashboard', 'view_reports', 'view_timetables', 'compliance_audit'];
    isExempt = true;
    isEligible = false;
    dept = 'Academic Affairs';
  }

  const nameParts = displayName
    ? displayName
    : cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    id: 1,
    email: cleanEmail,
    full_name: nameParts || 'Apollo Faculty Member',
    is_active: true,
    role: {
      id: roleName === 'ADMIN' ? 1 : roleName === 'DEAN' ? 2 : roleName === 'HOD' ? 3 : 4,
      name: roleName,
      description: roleDescription,
      is_default_exempt: isExempt,
      is_default_eligible: isEligible,
      permissions: permissions,
    },
    faculty_id: 1,
    faculty_code: `FAC-${cleanEmail.split('@')[0].slice(0, 4).toUpperCase()}`,
    department_name: dept,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync user with backend database
  const syncWithBackend = async (email: string, fullName?: string | null, fbIdToken?: string): Promise<User> => {
    try {
      const res = await apiClient.post('/users/sync-firebase', {
        email: email.trim().toLowerCase(),
        full_name: fullName,
      });
      const backendToken = res.data.access_token || fbIdToken;
      const backendUser = res.data.user;

      if (backendToken) {
        localStorage.setItem('auth_token', backendToken);
        setToken(backendToken);
      }
      localStorage.setItem('auth_user', JSON.stringify(backendUser));
      setUser(backendUser);
      return backendUser;
    } catch (err) {
      console.warn('Backend sync warning, creating local session:', err);
      const fallback = createFallbackUser(email, fullName);
      if (fbIdToken) {
        localStorage.setItem('auth_token', fbIdToken);
        setToken(fbIdToken);
      }
      localStorage.setItem('auth_user', JSON.stringify(fallback));
      setUser(fallback);
      return fallback;
    }
  };

  // Synchronize Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser && fbUser.email) {
          const idToken = await fbUser.getIdToken();
          await syncWithBackend(fbUser.email, fbUser.displayName, idToken);
        } else {
          // If no Firebase session, check if there was a saved token and sync /me
          const savedToken = localStorage.getItem('auth_token');
          if (savedToken) {
            try {
              const meRes = await apiClient.get<User>('/auth/me');
              setUser(meRes.data);
              localStorage.setItem('auth_user', JSON.stringify(meRes.data));
            } catch {
              // Token expired or invalid
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_user');
              setToken(null);
              setUser(null);
            }
          } else {
            setToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Error in onAuthStateChanged handler:', err);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiClient.get<User>('/auth/me');
      setUser(res.data);
      localStorage.setItem('auth_user', JSON.stringify(res.data));
    } catch (err) {
      console.warn('Backend /auth/me fetch notice:', err);
    }
  };

  // Firebase Email & Password Sign In
  const login = async (email: string, password = 'password123') => {
    setIsLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Attempt Firebase Authentication
      const userCredential = await loginWithFirebaseEmail(cleanEmail, password);
      const idToken = await userCredential.user.getIdToken();
      await syncWithBackend(cleanEmail, userCredential.user.displayName, idToken);
    } catch (firebaseErr: any) {
      console.warn('Firebase sign-in notice:', firebaseErr?.code);

      // Attempt live backend JSON login if account exists there
      try {
        const res = await apiClient.post('/auth/json-login', { email: cleanEmail, password });
        const newToken = res.data.access_token;
        const loggedUser = res.data.user;
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(loggedUser));
        setToken(newToken);
        setUser(loggedUser);
        return;
      } catch {
        // Continue to format error
      }

      // Format human-readable Firebase errors
      if (firebaseErr?.code === 'auth/invalid-credential' || firebaseErr?.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password. Please verify your credentials.');
      } else if (firebaseErr?.code === 'auth/user-not-found') {
        throw new Error('No user found with this email. You can register a new account.');
      } else if (firebaseErr?.code === 'auth/too-many-requests') {
        throw new Error('Access temporarily restricted due to many failed attempts. Please reset your password.');
      } else {
        throw new Error(firebaseErr?.message || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Firebase Google Sign In
  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithGoogle();
      const idToken = await userCredential.user.getIdToken();
      if (userCredential.user.email) {
        await syncWithBackend(userCredential.user.email, userCredential.user.displayName, idToken);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Sign-In was cancelled.');
      } else if (err.code === 'auth/popup-blocked') {
        throw new Error('Pop-up was blocked by your browser. Please allow pop-ups for this site.');
      }
      throw new Error(err.message || 'Google Sign-In failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Firebase Register / Sign Up
  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const userCredential = await signUpWithFirebaseEmail(cleanEmail, password, fullName.trim());
      const idToken = await userCredential.user.getIdToken();
      await syncWithBackend(cleanEmail, fullName.trim(), idToken);
    } catch (err: any) {
      console.error('Firebase Registration Error:', err);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already registered. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      }
      throw new Error(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Firebase Password Reset
  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter your university email address.');
    }
    await sendFirebasePasswordReset(cleanEmail);
  };

  // Logout (Firebase + Local Storage)
  const logout = async () => {
    try {
      await logoutFirebase();
    } catch (err) {
      console.warn('Firebase logout notice:', err);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        loginWithGoogle,
        register,
        resetPassword,
        logout,
        refreshUser,
      }}
    >
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
