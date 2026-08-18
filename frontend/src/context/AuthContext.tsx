import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  FirebaseUser 
} from '../lib/firebase';
import { UserProfile } from '../types';
import { loginApi, registerApi, googleAuthApi, getMeApi, getStoredToken, removeStoredToken } from '../services/api';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  enterGuestMode: () => void;
  logout: () => Promise<void>;
}

const profileFromUser = (user: { name?: string; email?: string }): UserProfile => ({
  name: user.name || 'User',
  username: user.email?.split('@')[0] || 'user',
  email: user.email || '',
  phone: '+1 (555) 019-2834', dob: '1995-08-14', gender: 'Prefer not to say',
  role: 'Productivity User', organization: 'Personal Workspace', bio: 'AI Workspace Power User',
  location: 'Latur, IN', language: 'English (US)', timeZone: 'IST (UTC+5:30)',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  plan: 'Enterprise Pro AI',
});

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const loadFastApiUser = async () => {
    const token = getStoredToken();
    if (token) {
      try {
        const meRes = await getMeApi();
        if (meRes?.data) {
          const user = meRes.data;
          setUserProfile(profileFromUser(user));
        } else {
          removeStoredToken();
        }
      } catch (err) {
        console.warn('Failed to load FastAPI session:', err);
        removeStoredToken();
      }
    }
  };

  useEffect(() => {
    loadFastApiUser().finally(() => {
      if (localStorage.getItem('astra_guest_session') === 'true' || localStorage.getItem('nexus_guest_session') === 'true') {
        setUserProfile(profileFromUser({ name: 'Guest User', email: 'guest@astra.ai' }));
      }
      setLoading(false);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setUserProfile((prev) => ({
          name: user.displayName || prev?.name || user.email?.split('@')[0] || 'User',
          username: user.email?.split('@')[0] || 'user',
          email: user.email || 'user@astra.ai',
          phone: prev?.phone || '+1 (555) 019-2834',
          dob: prev?.dob || '1995-08-14',
          gender: prev?.gender || 'Prefer not to say',
          role: prev?.role || 'Productivity User',
          organization: prev?.organization || 'Personal Workspace',
          bio: prev?.bio || 'AI Workspace Power User',
          location: prev?.location || 'Latur, IN',
          language: prev?.language || 'English (US)',
          timeZone: prev?.timeZone || 'IST (UTC+5:30)',
          avatar: user.photoURL || prev?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
          plan: prev?.plan || 'Enterprise Pro AI',
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const res = await loginApi(email, pass);
      if (res?.data?.user) {
        setUserProfile(profileFromUser(res.data.user));
      }
    } catch (error) { throw error; }
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    try {
      const res = await registerApi(name, email, pass);
      if (res?.data?.user) {
        setUserProfile(profileFromUser(res.data.user));
      }
    } catch (error) { throw error; }
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (user && user.email) {
      try {
        const name = user.displayName || user.email.split('@')[0] || 'Google User';
        const res = await googleAuthApi(name, user.email, user.photoURL, user.uid);
        if (res?.data?.user) {
          setUserProfile(profileFromUser(res.data.user));
        }
      } catch (err) {
        console.warn('Backend sync failed during Google login:', err);
        // Fallback to local profile if backend call fails
        setUserProfile(profileFromUser({ name: user.displayName || 'Google User', email: user.email }));
      }
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const enterGuestMode = () => {
    localStorage.setItem('astra_guest_session', 'true');
    setUserProfile(profileFromUser({ name: 'Guest User', email: 'guest@astra.ai' }));
  };

  const logout = async () => {
    removeStoredToken();
    localStorage.removeItem('astra_guest_session');
    localStorage.removeItem('nexus_guest_session');
    setUserProfile(null);
    try {
      await firebaseSignOut(auth);
    } catch (_) {}
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        userProfile,
        setUserProfile,
        loginWithEmail,
        signupWithEmail,
        loginWithGoogle,
        resetPassword,
        enterGuestMode,
        logout,
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
