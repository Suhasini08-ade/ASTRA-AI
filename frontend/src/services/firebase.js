import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_firebase_api_key_here' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id'
);

let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (error) {
    console.error('Failed to initialize Firebase SDK:', error);
  }
} else {
  console.warn(
    'Firebase is not configured or placeholder keys are in use. Please check frontend/.env.'
  );
}

export { auth, googleProvider };

export async function signInWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error('Firebase Authentication is not configured.');
  }
  return await signInWithPopup(auth, googleProvider);
}

export async function signInWithEmail(email, password) {
  if (!auth) {
    throw new Error('Firebase Authentication is not configured.');
  }
  return await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(name, email, password) {
  if (!auth) {
    throw new Error('Firebase Authentication is not configured.');
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name && userCredential.user) {
    try {
      await updateProfile(userCredential.user, { displayName: name });
    } catch (e) {
      console.warn('Failed to set displayName in Firebase profile:', e);
    }
  }
  return userCredential;
}

export async function sendPasswordReset(email) {
  if (!auth) {
    throw new Error('Firebase Authentication is not configured.');
  }
  return await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser() {
  if (!auth) return;
  return await signOut(auth);
}

export function onAuthStateChange(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentUserToken(forceRefresh = false) {
  if (!auth || !auth.currentUser) {
    // Check fallback JWT in localStorage if available
    return localStorage.getItem('astra_token') || null;
  }
  try {
    const token = await auth.currentUser.getIdToken(forceRefresh);
    if (token) {
      localStorage.setItem('astra_token', token);
    }
    return token;
  } catch (err) {
    console.warn('Failed to retrieve Firebase ID token:', err);
    return localStorage.getItem('astra_token') || null;
  }
}

export function getAuthErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is invalid.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In was cancelled.';
    case 'auth/cancelled-popup-request':
      return 'Sign-In process was interrupted. Please try again.';
    case 'auth/popup-blocked':
      return 'Google Sign-In popup was blocked by your browser. Please allow popups.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later or reset password.';
    default:
      return error.message || 'Authentication failed. Please try again.';
  }
}
