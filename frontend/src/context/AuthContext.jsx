import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendPasswordReset,
  signOutUser,
  onAuthStateChange,
  getAuthErrorMessage,
} from '../services/firebase';
import { apiGetMe, apiGoogleAuth, apiLogin, apiRegister, apiUpdateProfile } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('astra_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem('astra_token'));
  });

  const [loading, setLoading] = useState(true);

  // Sync session with Firebase Auth on mount and retain session across refreshes
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChange(async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          localStorage.setItem('astra_token', idToken);

          // Resolve or sync user with backend
          let backendUser = null;
          try {
            const res = await apiGetMe();
            backendUser = res?.data;
          } catch {
            // If getMe failed, trigger google sync
            try {
              const googleRes = await apiGoogleAuth();
              backendUser = googleRes?.data?.user;
            } catch (err) {
              console.warn('Backend sync warning on auth state change:', err);
            }
          }

          if (isMounted) {
            const resolvedUser = {
              id: backendUser?.id || fbUser.uid,
              uid: fbUser.uid,
              name: backendUser?.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
              email: backendUser?.email || fbUser.email || '',
              avatar:
                fbUser.photoURL ||
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
              bio: 'ASTRA AI Productivity Power User',
              role: 'Pro Member',
              joinDate: backendUser?.created_at
                ? new Date(backendUser.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : 'July 2026',
            };
            setUser(resolvedUser);
            setIsAuthenticated(true);
            localStorage.setItem('astra_user', JSON.stringify(resolvedUser));
          }
        } catch (err) {
          console.error('Failed to resolve Firebase user session:', err);
        }
      } else {
        // No Firebase user; check if there is an active local JWT session
        const localToken = localStorage.getItem('astra_token');
        if (localToken) {
          try {
            const res = await apiGetMe();
            if (res?.data && isMounted) {
              const u = res.data;
              const resolvedUser = {
                id: u.id,
                name: u.name,
                email: u.email,
                avatar:
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
                bio: 'ASTRA AI Productivity Power User',
                role: 'Pro Member',
                joinDate: u.created_at
                  ? new Date(u.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'July 2026',
              };
              setUser(resolvedUser);
              setIsAuthenticated(true);
              localStorage.setItem('astra_user', JSON.stringify(resolvedUser));
            }
          } catch {
            if (isMounted) {
              localStorage.removeItem('astra_token');
              localStorage.removeItem('astra_user');
              setUser(null);
              setIsAuthenticated(false);
            }
          }
        } else if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        throw new Error('Firebase Authentication is not configured. Check frontend/.env.');
      }
      const cred = await signInWithGoogle();
      const idToken = await cred.user.getIdToken();
      localStorage.setItem('astra_token', idToken);

      // Register/sync with backend
      const res = await apiGoogleAuth();
      const backendUser = res?.data?.user;

      const newUser = {
        id: backendUser?.id || cred.user.uid,
        uid: cred.user.uid,
        name: backendUser?.name || cred.user.displayName || cred.user.email?.split('@')[0],
        email: backendUser?.email || cred.user.email,
        avatar:
          cred.user.photoURL ||
          'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
        bio: 'ASTRA AI Productivity Power User',
        role: 'Pro Member',
        joinDate: backendUser?.created_at
          ? new Date(backendUser.created_at).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })
          : 'July 2026',
      };
      setUser(newUser);
      setIsAuthenticated(true);
      localStorage.setItem('astra_user', JSON.stringify(newUser));
      setLoading(false);
      return { success: true, user: newUser };
    } catch (err) {
      setLoading(false);
      throw new Error(getAuthErrorMessage(err));
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isFirebaseConfigured) {
        // Primary flow: Firebase Email Sign-In
        const cred = await signInWithEmail(email, password);
        const idToken = await cred.user.getIdToken();
        localStorage.setItem('astra_token', idToken);

        const res = await apiGetMe();
        const backendUser = res?.data;

        const resolvedUser = {
          id: backendUser?.id || cred.user.uid,
          uid: cred.user.uid,
          name: backendUser?.name || cred.user.displayName || email.split('@')[0],
          email: backendUser?.email || email,
          avatar:
            cred.user.photoURL ||
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
          bio: 'ASTRA AI Productivity Power User',
          role: 'Pro Member',
          joinDate: 'July 2026',
        };
        setUser(resolvedUser);
        setIsAuthenticated(true);
        localStorage.setItem('astra_user', JSON.stringify(resolvedUser));
        setLoading(false);
        return { success: true, user: resolvedUser };
      } else {
        // Fallback: Direct backend login
        const res = await apiLogin({ email, password });
        const token = res?.data?.access_token || res?.data?.token;
        if (token) localStorage.setItem('astra_token', token);
        const u = res?.data?.user;
        const resolvedUser = {
          id: u?.id,
          name: u?.name || email.split('@')[0],
          email: u?.email || email,
          avatar:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
          bio: 'ASTRA AI Productivity Power User',
          role: 'Pro Member',
          joinDate: 'July 2026',
        };
        setUser(resolvedUser);
        setIsAuthenticated(true);
        localStorage.setItem('astra_user', JSON.stringify(resolvedUser));
        setLoading(false);
        return { success: true, user: resolvedUser };
      }
    } catch (err) {
      setLoading(false);
      throw new Error(getAuthErrorMessage(err));
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      if (isFirebaseConfigured) {
        // Primary flow: Firebase Email Sign-Up
        const cred = await signUpWithEmail(name, email, password);
        const idToken = await cred.user.getIdToken();
        localStorage.setItem('astra_token', idToken);

        // Synchronize with backend
        let backendUser = null;
        try {
          const res = await apiRegister({ name, email, password });
          backendUser = res?.data?.user;
        } catch (syncErr) {
          console.warn('Backend register sync fallback:', syncErr);
        }

        const resolvedUser = {
          id: backendUser?.id || cred.user.uid,
          uid: cred.user.uid,
          name: name || backendUser?.name || email.split('@')[0],
          email: email,
          avatar:
            cred.user.photoURL ||
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
          bio: 'New ASTRA AI Member',
          role: 'Pro Member',
          joinDate: 'July 2026',
        };
        setUser(resolvedUser);
        setIsAuthenticated(true);
        localStorage.setItem('astra_user', JSON.stringify(resolvedUser));
        setLoading(false);
        return { success: true, user: resolvedUser };
      } else {
        // Fallback: Direct backend registration
        const res = await apiRegister({ name, email, password });
        const token = res?.data?.access_token || res?.data?.token;
        if (token) localStorage.setItem('astra_token', token);
        const u = res?.data?.user;
        const resolvedUser = {
          id: u?.id,
          name: u?.name || name,
          email: u?.email || email,
          avatar:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
          bio: 'New ASTRA AI Member',
          role: 'Pro Member',
          joinDate: 'July 2026',
        };
        setUser(resolvedUser);
        setIsAuthenticated(true);
        localStorage.setItem('astra_user', JSON.stringify(resolvedUser));
        setLoading(false);
        return { success: true, user: resolvedUser };
      }
    } catch (err) {
      setLoading(false);
      throw new Error(getAuthErrorMessage(err));
    }
  };

  const resetPassword = async (email) => {
    try {
      if (!isFirebaseConfigured) {
        throw new Error('Firebase Authentication is not configured.');
      }
      await sendPasswordReset(email);
      return { success: true };
    } catch (err) {
      throw new Error(getAuthErrorMessage(err));
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
    } catch (e) {
      console.warn('Firebase sign out error:', e);
    }
    localStorage.removeItem('astra_token');
    localStorage.removeItem('astra_user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = async (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    setUser(updated);
    localStorage.setItem('astra_user', JSON.stringify(updated));
    try {
      await apiUpdateProfile(updatedFields);
    } catch (err) {
      console.warn('Failed to sync profile update to backend:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        loginWithGoogle,
        register,
        resetPassword,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
