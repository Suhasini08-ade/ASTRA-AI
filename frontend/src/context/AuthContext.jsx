import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  isFirebaseConfigured,
  onAuthStateChange,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  auth,
} from '../services/firebase';
import {
  removeAuthToken,
  apiGoogleAuth,
  apiGetMe,
  apiRegister,
} from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session from Firebase on mount
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChange(async (fbUser) => {
      if (fbUser) {
        try {
          // Use Firebase ID token (auto-injected by fetchAPI) to call /me
          const res = await apiGetMe();
          if (res?.data) {
            setCurrentUser({
              id: res.data.id,
              uid: fbUser.uid,
              email: res.data.email || fbUser.email,
              displayName: res.data.name || fbUser.displayName || fbUser.email?.split('@')[0],
              photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            });
          }
        } catch (err) {
          // User is authenticated in Firebase but not yet registered in backend.
          // For Google users, register them via /api/auth/google.
          // For email users, they'll be registered during signup.
          if (fbUser.providerData?.[0]?.providerId === 'google.com') {
            try {
              const res = await apiGoogleAuth();
              if (res?.data?.user) {
                setCurrentUser({
                  id: res.data.user.id,
                  uid: fbUser.uid,
                  email: res.data.user.email,
                  displayName: res.data.user.name || fbUser.displayName,
                  photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
                });
              }
            } catch (syncErr) {
              console.warn('Firebase sync to backend failed:', syncErr);
            }
          } else {
            console.warn('Backend /me failed for Firebase user:', err);
          }
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      // 1. Sign in with Firebase first — this establishes the Firebase session
      if (isFirebaseConfigured) {
        await signInWithEmail(email, password);
      }

      // 2. The Firebase ID token is now available via auth.currentUser.getIdToken()
      //    The /me endpoint will resolve the user using the verified token
      const res = await apiGetMe();
      if (res?.data) {
        const fbUser = auth?.currentUser;
        setCurrentUser({
          id: res.data.id,
          uid: fbUser?.uid || res.data.id,
          email: res.data.email,
          displayName: res.data.name || email.split('@')[0],
          photoURL: fbUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
        });
      }
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signup = async (email, password, name) => {
    setLoading(true);
    try {
      // 1. Create Firebase user first
      if (isFirebaseConfigured) {
        await signUpWithEmail(email, password);
      }

      // 2. Register in the backend — the Firebase ID token is auto-sent
      const res = await apiRegister(name, email, password);
      const u = res?.data?.user;

      if (u) {
        const fbUser = auth?.currentUser;
        setCurrentUser({
          id: u.id,
          uid: fbUser?.uid || u.id,
          email: u.email,
          displayName: u.name || name || email.split('@')[0],
          photoURL: fbUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
        });
      }
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        throw new Error('Firebase is not configured. Add VITE_FIREBASE_API_KEY in frontend/.env.');
      }

      // 1. Sign in with Google via Firebase popup
      const result = await signInWithGoogle();
      const fbUser = result.user;

      // 2. The Firebase ID token is now available — call backend to register/sync
      const res = await apiGoogleAuth();
      const u = res?.data?.user;

      setCurrentUser({
        id: u?.id || fbUser.uid,
        uid: fbUser.uid,
        email: u?.email || fbUser.email,
        displayName: u?.name || fbUser.displayName || fbUser.email?.split('@')[0],
        photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
      });
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        throw new Error('Google Sign-In popup was closed before completing authentication.');
      }
      throw err;
    }
  };

  const logout = async () => {
    removeAuthToken();
    try {
      await signOutUser();
    } catch (e) {
      // ignore
    }
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, signup, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
