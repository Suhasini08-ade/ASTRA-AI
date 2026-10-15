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
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  getCachedUser,
  setCachedUser,
  removeCachedUser,
  apiLogin,
  apiGoogleAuth,
  apiGetMe,
  apiRegister,
} from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Initialize currentUser immediately from persistent cache so page reloads / HMR never kick user out
  const [currentUser, setCurrentUser] = useState(() => getCachedUser());
  const [loading, setLoading] = useState(() => !getCachedUser());

  // Restore authenticated session from Firebase or persistent token on mount
  useEffect(() => {
    let isMounted = true;

    if (!isFirebaseConfigured) {
      // Check for local JWT session if Firebase is disabled
      const localToken = getAuthToken();
      const cached = getCachedUser();
      if (localToken && cached) {
        apiGetMe()
          .then((res) => {
            if (isMounted && res?.data) {
              const u = {
                id: res.data.id,
                uid: res.data.id,
                email: res.data.email,
                displayName: res.data.name || res.data.email?.split('@')[0],
                photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
              };
              setCurrentUser(u);
              setCachedUser(u);
            }
          })
          .catch((err) => {
            const isAuthFail = err?.message?.includes('401') || err?.message?.toLowerCase().includes('unauthorized');
            if (isAuthFail && isMounted) {
              setCurrentUser(null);
              removeCachedUser();
              removeAuthToken();
            }
          })
          .finally(() => {
            if (isMounted) setLoading(false);
          });
      } else {
        setLoading(false);
      }
      return () => { isMounted = false; };
    }

    const unsubscribe = onAuthStateChange(async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        // 1. Immediately ensure state has valid user credentials from Firebase
        const baseUser = {
          id: fbUser.uid,
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0],
          photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
        };
        setCurrentUser((prev) => prev || baseUser);

        try {
          // 2. Fetch authoritative database profile from backend
          const res = await apiGetMe();
          if (isMounted && res?.data) {
            const enrichedUser = {
              id: res.data.id || fbUser.uid,
              uid: fbUser.uid,
              email: res.data.email || fbUser.email,
              displayName: res.data.name || fbUser.displayName || fbUser.email?.split('@')[0],
              photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            };
            setCurrentUser(enrichedUser);
            setCachedUser(enrichedUser);
          }
        } catch (err) {
          console.warn('Backend user resolution on auth state change failed:', err);
          // CRITICAL: Only drop session if token was genuinely rejected as unauthorized (401)
          // If it's a network glitch or backend server reload (503/Failed to fetch), KEEP USER SIGNED IN!
          const isExplicitAuthReject =
            err?.message?.includes('401') ||
            err?.message?.toLowerCase().includes('unauthorized') ||
            err?.message?.toLowerCase().includes('expired');

          if (isExplicitAuthReject) {
            if (isMounted) {
              setCurrentUser(null);
              removeCachedUser();
              removeAuthToken();
            }
          } else {
            // Server might be restarting — retain current user session
            setCachedUser((prev) => prev || baseUser);
          }
        }
      } else {
        // Firebase has no active user. Check if there is a local JWT access token
        const localToken = getAuthToken();
        const cached = getCachedUser();
        if (localToken && cached) {
          try {
            const res = await apiGetMe();
            if (isMounted && res?.data) {
              const u = {
                id: res.data.id,
                uid: res.data.id,
                email: res.data.email,
                displayName: res.data.name || res.data.email?.split('@')[0],
                photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
              };
              setCurrentUser(u);
              setCachedUser(u);
            }
          } catch (err) {
            const isExplicitAuthReject =
              err?.message?.includes('401') ||
              err?.message?.toLowerCase().includes('unauthorized');
            if (isExplicitAuthReject && isMounted) {
              setCurrentUser(null);
              removeCachedUser();
              removeAuthToken();
            }
          }
        } else {
          if (isMounted) {
            setCurrentUser(null);
            removeCachedUser();
          }
        }
      }

      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      let loggedIn = false;
      let userData = null;
      let lastErr = null;

      // 1. Attempt Firebase authentication first (if enabled)
      if (isFirebaseConfigured) {
        try {
          const cred = await signInWithEmail(email, password);
          const fbUser = cred.user || auth?.currentUser;

          try {
            const res = await apiGetMe();
            if (res?.data) {
              userData = {
                id: res.data.id,
                uid: fbUser?.uid || res.data.id,
                email: res.data.email || fbUser?.email || email,
                displayName: res.data.name || fbUser?.displayName || email.split('@')[0],
                photoURL: fbUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
              };
            }
          } catch (backendErr) {
            console.warn('Backend /me resolution delayed after Firebase login:', backendErr);
            userData = {
              id: fbUser?.uid,
              uid: fbUser?.uid,
              email: fbUser?.email || email,
              displayName: fbUser?.displayName || email.split('@')[0],
              photoURL: fbUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            };
          }
          loggedIn = true;
        } catch (fbErr) {
          lastErr = fbErr;
          console.info('Firebase email sign-in attempt passed to backend check:', fbErr?.code || fbErr?.message);
        }
      }

      // 2. Fallback to direct backend authentication (for database-stored users)
      if (!loggedIn) {
        try {
          const res = await apiLogin(email, password);
          if (res?.data?.user) {
            const u = res.data.user;
            const token = res.data.access_token || res.data.token;
            if (token) setAuthToken(token);
            userData = {
              id: u.id,
              uid: u.id,
              email: u.email,
              displayName: u.name || u.email?.split('@')[0],
              photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            };
            loggedIn = true;
          }
        } catch (apiErr) {
          // If backend also fails, rethrow the most specific error
          throw lastErr || apiErr;
        }
      }

      if (!loggedIn || !userData) {
        throw lastErr || new Error('Invalid email or password.');
      }

      setCurrentUser(userData);
      setCachedUser(userData);
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
      let registeredUser = null;

      if (isFirebaseConfigured) {
        try {
          const cred = await signUpWithEmail(email, password, name);
          const fbUser = cred.user || auth?.currentUser;

          try {
            await apiRegister(name, email, password);
          } catch (syncErr) {
            console.warn('Backend register sync warning:', syncErr);
          }

          try {
            const res = await apiGetMe();
            registeredUser = {
              id: res?.data?.id || fbUser?.uid,
              uid: fbUser?.uid,
              email: res?.data?.email || email,
              displayName: res?.data?.name || name || email.split('@')[0],
              photoURL: fbUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            };
          } catch {
            registeredUser = {
              id: fbUser?.uid,
              uid: fbUser?.uid,
              email: email,
              displayName: name || email.split('@')[0],
              photoURL: fbUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
            };
          }
        } catch (fbErr) {
          console.info('Firebase signup fallback to backend:', fbErr?.code || fbErr?.message);
        }
      }

      if (!registeredUser) {
        const res = await apiRegister(name, email, password);
        if (res?.data?.user) {
          const u = res.data.user;
          const token = res.data.access_token || res.data.token;
          if (token) setAuthToken(token);
          registeredUser = {
            id: u.id,
            uid: u.id,
            email: u.email,
            displayName: u.name || name || email.split('@')[0],
            photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
          };
        }
      }

      if (!registeredUser) {
        throw new Error('Registration failed. Please check your credentials.');
      }

      setCurrentUser(registeredUser);
      setCachedUser(registeredUser);
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

      let userData = {
        id: fbUser.uid,
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0],
        photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
      };

      try {
        const res = await apiGoogleAuth();
        if (res?.data?.user) {
          const u = res.data.user;
          userData = {
            id: u.id,
            uid: fbUser.uid,
            email: u.email || fbUser.email,
            displayName: u.name || fbUser.displayName || fbUser.email?.split('@')[0],
            photoURL: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
          };
        }
      } catch (backendErr) {
        console.warn('Backend sync on Google auth returned warning (session remains valid):', backendErr);
      }

      setCurrentUser(userData);
      setCachedUser(userData);
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    removeAuthToken();
    removeCachedUser();
    try {
      await signOutUser();
    } catch (e) {
      console.warn('Sign out warning:', e);
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
