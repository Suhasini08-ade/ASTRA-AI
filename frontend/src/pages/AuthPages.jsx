import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { confirmResetPassword, resetPassword, verifyResetCode } from '../services/firebase';
import { getAuthErrorMessage } from '../services/authErrors';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const { login, loginWithGoogle, loading } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      if (showSuccess) showSuccess('Signed in successfully!');
      navigate('/app');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'login');
      setError(message);
      if (showError) showError(message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      if (showSuccess) showSuccess('Google authentication successful!');
      navigate('/app');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'login');
      setError(message);
      if (showError) showError(message);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="font-headline text-3xl font-extrabold text-primary dark:text-blue-400">
            Astra AI
          </h1>
          <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 mt-1">
            Sign in to access your AI Operating System
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-primary dark:text-blue-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2.5 pr-14 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
              required
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary dark:text-blue-400">{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 mt-4 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Astra'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-outline-variant/30 dark:bg-slate-700"></div>
          <span className="text-[10px] text-on-surface-variant dark:text-slate-400 uppercase font-bold">Or</span>
          <div className="flex-1 h-px bg-outline-variant/30 dark:bg-slate-700"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 text-on-surface dark:text-slate-200 font-semibold text-xs rounded-xl hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg text-red-500">g_translate</span>
          <span>Sign In with Google</span>
        </button>

        <p className="text-center text-xs text-on-surface-variant dark:text-slate-400 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary dark:text-blue-400 font-semibold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { signup, loginWithGoogle, loading } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await signup(email, password, name);
      if (showSuccess) showSuccess('Account created successfully!');
      navigate('/app');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'signup');
      setError(message);
      if (showError) showError(message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      if (showSuccess) showSuccess('Google authentication successful!');
      navigate('/app');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'signup');
      setError(message);
      if (showError) showError(message);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="font-headline text-3xl font-extrabold text-primary dark:text-blue-400">
            Astra AI
          </h1>
          <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 mt-1">
            Create your account to get started
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Morgan"
              className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div>
            <label className="font-label text-xs font-semibold text-on-surface dark:text-slate-200 block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 mt-4 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-outline-variant/30 dark:bg-slate-700"></div>
          <span className="text-[10px] text-on-surface-variant dark:text-slate-400 uppercase font-bold">Or</span>
          <div className="flex-1 h-px bg-outline-variant/30 dark:bg-slate-700"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2.5 bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 text-on-surface dark:text-slate-200 font-semibold text-xs rounded-xl hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg text-red-500">g_translate</span>
          <span>Sign Up with Google</span>
        </button>

        <p className="text-center text-xs text-on-surface-variant dark:text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary dark:text-blue-400 font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showError, showSuccess } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
      showSuccess?.('Password reset email sent.');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'recovery');
      setError(message);
      showError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-8 shadow-xl text-center">
        <h1 className="font-headline text-3xl font-extrabold text-primary dark:text-blue-400 mb-2">
          Password Recovery
        </h1>
        <p className="font-label text-xs text-on-surface-variant dark:text-slate-400 mb-6">
          Enter your registered email to receive a password reset link.
        </p>

        {sent ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl text-xs font-semibold mb-4">
            If an account matches that email address, a reset link is on its way. Please check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-left text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full bg-surface-container-low dark:bg-slate-700 border border-outline-variant/40 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-on-surface dark:text-slate-100 focus:outline-none focus:border-primary"
              required
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-all shadow-md"
            >
              {submitting ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-6">
          Back to{' '}
          <Link to="/login" className="text-primary dark:text-blue-400 font-semibold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showError, showSuccess } = useToast();
  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    let active = true;
    const verifyCode = async () => {
      if (!oobCode) {
        if (active) {
          setStatus('invalid');
          setError('This password reset link is invalid. Request a new one.');
        }
        return;
      }
      try {
        const accountEmail = await verifyResetCode(oobCode);
        if (active) {
          setEmail(accountEmail);
          setStatus('ready');
        }
      } catch (err) {
        if (active) {
          setStatus('invalid');
          setError(getAuthErrorMessage(err, 'reset'));
        }
      }
    };
    verifyCode();
    return () => { active = false; };
  }, [oobCode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Choose a stronger password with at least 6 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    setSubmitting(true);
    try {
      await confirmResetPassword(oobCode, password);
      setPassword('');
      setConfirmation('');
      setStatus('complete');
      showSuccess?.('Password updated successfully.');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'reset');
      setError(message);
      showError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface dark:bg-slate-800 border border-outline-variant/40 dark:border-slate-700 rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-7"><h1 className="font-headline text-3xl font-extrabold text-primary dark:text-blue-400">Set a new password</h1><p className="mt-2 text-xs text-on-surface-variant dark:text-slate-400">Choose a new password for your ASTRA AI account.</p></div>
        {status === 'verifying' && <p className="text-center text-sm text-on-surface-variant">Verifying your reset link…</p>}
        {status === 'invalid' && <div className="text-center"><p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p><Link to="/forgot-password" className="mt-5 inline-block text-sm font-semibold text-primary dark:text-blue-400 hover:underline">Request a new reset link</Link></div>}
        {status === 'complete' && <div className="text-center"><p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Password updated successfully.</p><Link to="/login" className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">Back to Login</Link></div>}
        {status === 'ready' && <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-center text-xs text-on-surface-variant">Resetting password for {email}</p>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          <div><label className="mb-1 block text-xs font-semibold text-on-surface dark:text-slate-200">New password</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" required /></div>
          <div><label className="mb-1 block text-xs font-semibold text-on-surface dark:text-slate-200">Confirm new password</label><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" required /></div>
          <button disabled={submitting} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Updating…' : 'Update Password'}</button>
        </form>}
      </div>
    </div>
  );
}
