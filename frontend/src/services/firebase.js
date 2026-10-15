import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// Environment check for active Firebase credentials
export const isFirebaseConfigured = Boolean(
  apiKey && 
  apiKey.trim() !== '' && 
  !apiKey.includes('DemoKey')
);

let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };

    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: 'select_account',
    });
  } catch (e) {
    console.warn('Firebase initialization warning:', e);
  }
}

/**
 * Clean exported authentication helper functions.
 */

export async function signInWithGoogle() {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    throw new Error('Firebase Google Authentication is not configured. Add VITE_FIREBASE_API_KEY in frontend/.env.');
  }

  // Ensure prompt: select_account parameter is passed on every Google sign-in click
  googleProvider.setCustomParameters({
    prompt: 'select_account',
  });

  return await signInWithPopup(auth, googleProvider);
}

export async function signInWithEmail(email, password) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured.');
  }
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email, password, displayName = '') {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured.');
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && displayName.trim() && credential.user) {
    try {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    } catch (profileErr) {
      console.warn('Failed to update Firebase profile displayName:', profileErr);
    }
  }
  return credential;
}

export async function signOutUser() {
  if (isFirebaseConfigured && auth) {
    return await signOut(auth);
  }
}

export async function resetPassword(email) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured.');
  }
  // Firebase delivers and owns the credential reset link. The configured
  // continue URL routes the user back to this app's reset-password screen.
  const actionCodeSettings = {
    url: `${window.location.origin}/reset-password`,
    handleCodeInApp: true,
  };
  return await sendPasswordResetEmail(auth, email, actionCodeSettings);
}

export async function verifyResetCode(code) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured.');
  }
  return await verifyPasswordResetCode(auth, code);
}

export async function confirmResetPassword(code, newPassword) {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase Auth is not configured.');
  }
  return await confirmPasswordReset(auth, code, newPassword);
}

export function getCurrentUser() {
  return auth?.currentUser || null;
}

export function onAuthStateChange(callback) {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, callback);
  }
  return () => {};
}

export { auth, googleProvider };
export default app;
