/** Convert provider errors into safe, consistent ASTRA AI copy. */
export function getAuthErrorMessage(error, context = 'login') {
  const code = error?.code || '';

  if (context === 'recovery' && (code === 'auth/user-not-found' || code === 'auth/invalid-credential')) {
    return 'If an account matches that email address, a reset link will be sent.';
  }

  const messages = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    // Firebase now commonly returns this for both unknown email and bad password.
    // Keeping it neutral avoids revealing whether an account exists.
    'auth/invalid-credential': 'Unable to sign in with those details. Please try again.',
    'auth/user-not-found': 'Unable to sign in with those details. Please try again.',
    'auth/too-many-requests': 'Too many requests. Please wait and try again later.',
    'auth/network-request-failed': 'Unable to connect. Please check your internet connection and try again.',
    'auth/email-already-in-use': 'An account already exists with this email address.',
    'auth/weak-password': 'Choose a stronger password with at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Google sign-in popup was blocked by your browser. Please allow popups for this site.',
    'auth/unauthorized-domain': 'This domain is not authorized for Google Sign-In in Firebase Console.',
    'auth/expired-action-code': 'This password reset link has expired. Request a new one.',
    'auth/invalid-action-code': 'This password reset link is invalid or has already been used. Request a new one.',
    'auth/user-disabled': 'This account is unavailable. Please contact support.',
  };

  if (messages[code]) return messages[code];
  if (context === 'reset') return 'We could not reset your password. Please request a new reset link.';
  if (context === 'recovery') return 'We could not send a reset link. Please try again later.';
  if (context === 'signup') return 'We could not create your account. Please try again.';
  return 'We could not sign you in. Please try again.';
}
