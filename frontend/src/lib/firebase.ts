import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import appletConfig from '../../firebase-applet-config.json';

// Helper function to safely read Vite env vars with fallback to firebase-applet-config.json
const getEnvVar = (key: string, fallback: string): string => {
  const val = import.meta.env[key];
  return (typeof val === 'string' && val.trim().length > 0) ? val.trim() : fallback;
};

// Build Firebase config using import.meta.env with fallback to appletConfig
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY', appletConfig.apiKey),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN', appletConfig.authDomain),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID', appletConfig.projectId),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET', appletConfig.storageBucket),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID', appletConfig.messagingSenderId),
  appId: getEnvVar('VITE_FIREBASE_APP_ID', appletConfig.appId),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID', appletConfig.measurementId || ''),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db = getFirestore(app, appletConfig.firestoreDatabaseId || '(default)');

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
};
export type { FirebaseUser };
