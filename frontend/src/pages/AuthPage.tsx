import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound,
  ArrowLeft,
  ShieldCheck,
  Palette,
  UserCheck,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthPage: React.FC<{ initialMode?: 'login' | 'signup' }> = ({ initialMode = 'login' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loginWithEmail, signupWithEmail, loginWithGoogle, resetPassword, enterGuestMode } = useAuth();

  // Mode state
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(() => {
    if (location.pathname.includes('signup')) return 'signup';
    return initialMode;
  });

  // UI Theme Option state
  const [authTheme, setAuthTheme] = useState<'cyber' | 'light' | 'aurora'>('cyber');
  const [layoutStyle, setLayoutStyle] = useState<'card' | 'split'>('card');

  useEffect(() => {
    if (location.pathname.includes('signup')) {
      setMode('signup');
    } else if (location.pathname.includes('login')) {
      setMode('login');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Status feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      await loginWithEmail(email, password);
      setIsLoading(false);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setIsLoading(false);
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setErrorMessage('Invalid email or password. You can also click "Instant Guest Demo Access".');
      } else {
        setErrorMessage(err.message || 'Failed to sign in.');
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      await signupWithEmail(email, password, fullName);
      setIsLoading(false);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setIsLoading(false);
      if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email already exists.');
      } else {
        setErrorMessage(err.message || 'Failed to create account.');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      setIsLoading(true);
      await loginWithGoogle();
      setIsLoading(false);
      setSuccessMessage('Successfully signed in with Google!');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    } catch (err: any) {
      setIsLoading(false);
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setErrorMessage('Google Sign-In popup was closed. Please try again.');
      } else if (err.code === 'auth/network-request-failed') {
        setErrorMessage('Network connection error. Please check your internet connection.');
      } else if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname || 'localhost';
        setErrorMessage(
          `Domain "${currentDomain}" is not authorized in Firebase. Please add "${currentDomain}" to Firebase Console -> Authentication -> Settings -> Authorized domains.`
        );
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('Google Sign-In is not enabled in Firebase Console -> Authentication -> Sign-in method.');
      } else {
        setErrorMessage(err.message || 'Failed to authenticate with Google. Please try again.');
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    try {
      setIsLoading(true);
      await resetPassword(email);
      setIsLoading(false);
      setSuccessMessage(`Password reset email sent to ${email}. Check your inbox.`);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err.message || 'Failed to send reset email.');
    }
  };

  // Instant Guest Mode Access
  const handleGuestAccess = () => {
    enterGuestMode();
    navigate('/dashboard', { replace: true });
  };

  // Theme styling mapping
  const themes = {
    cyber: {
      bg: 'bg-[#0B1020] text-slate-100',
      card: 'bg-[#0D1428]/90 border-white/10 shadow-2xl backdrop-blur-2xl',
      input: 'bg-white/5 border-white/10 text-white placeholder-slate-500',
      btn: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25',
    },
    light: {
      bg: 'bg-slate-50 text-slate-900',
      card: 'bg-white border-slate-200 shadow-2xl',
      input: 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400',
      btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20',
    },
    aurora: {
      bg: 'bg-[#080C14] text-emerald-50',
      card: 'bg-emerald-950/30 border-emerald-500/20 shadow-2xl backdrop-blur-2xl',
      input: 'bg-emerald-950/50 border-emerald-500/20 text-emerald-100 placeholder-emerald-600',
      btn: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/25',
    }
  };

  const st = themes[authTheme];

  return (
    <div className={`min-h-screen font-sans flex flex-col justify-between relative overflow-hidden transition-colors duration-300 ${st.bg}`}>
      
      {/* Background Radial Blur */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-600/15 blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-blue-100" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              ASTRA AI
            </span>
            <span className="block text-[10px] uppercase font-semibold tracking-widest opacity-60">
              Authentication Portal
            </span>
          </div>
        </Link>

        {/* Top Controls: Theme & Back Link */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-1 p-1 bg-white/5 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setAuthTheme('cyber')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${authTheme === 'cyber' ? 'bg-blue-600 text-white' : 'opacity-60'}`}
            >
              Cyber
            </button>
            <button
              onClick={() => setAuthTheme('light')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${authTheme === 'light' ? 'bg-indigo-600 text-white' : 'opacity-60'}`}
            >
              Light
            </button>
            <button
              onClick={() => setAuthTheme('aurora')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${authTheme === 'aurora' ? 'bg-emerald-500 text-slate-950' : 'opacity-60'}`}
            >
              Aurora
            </button>
          </div>

          <Link
            to="/"
            className="flex items-center space-x-2 text-xs font-semibold opacity-70 hover:opacity-100 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-6 max-w-5xl mx-auto w-full">
        
        {layoutStyle === 'split' ? (
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Graphic Panel */}
            <div className={`p-8 rounded-3xl border ${st.card} space-y-6 hidden lg:block`}>
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Intelligent Workspace OS</h2>
              <p className="text-xs leading-relaxed opacity-70">
                Unlock multi-turn AI reasoning, automated Kanban boards, markdown scratchpads, and live weather/news integration in one seamless workspace.
              </p>
              <div className="pt-2 border-t border-white/10 space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Cloud Firestore Persistence</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Integrated Gemini 2.5 Intelligence</span>
                </div>
              </div>
            </div>

            {/* Right Auth Card */}
            <div className={`w-full border rounded-3xl p-6 sm:p-8 relative ${st.card}`}>
              {/* Card Header */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-extrabold">
                  {mode === 'login' && 'Welcome Back'}
                  {mode === 'signup' && 'Create Your Account'}
                  {mode === 'forgot' && 'Reset Password'}
                </h1>
                <p className="text-xs opacity-60 mt-1">
                  {mode === 'login' && 'Sign in to access your ASTRA AI Workspace.'}
                  {mode === 'signup' && 'Get started with your intelligent workspace.'}
                  {mode === 'forgot' && 'Enter your email for password recovery.'}
                </p>
              </div>

              {/* Form rendering */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                    />
                  </div>
                  <button type="submit" className={`w-full py-3 rounded-xl text-xs font-bold ${st.btn}`}>
                    Sign In
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* Centered Single Card Layout */
          <div className={`w-full max-w-md border rounded-3xl p-6 sm:p-8 relative shadow-2xl ${st.card}`}>
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-blue-500/20">
                <Lock className="w-6 h-6 text-blue-100" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {mode === 'login' && 'Welcome Back'}
                {mode === 'signup' && 'Create Your Account'}
                {mode === 'forgot' && 'Reset Password'}
              </h1>
              <p className="text-xs opacity-60 mt-1">
                {mode === 'login' && 'Sign in to access your ASTRA AI Workspace.'}
                {mode === 'signup' && 'Get started with your intelligent assistant.'}
                {mode === 'forgot' && 'Enter email to receive password reset link.'}
              </p>
            </div>

            {/* Error / Success alerts */}
            <AnimatePresence mode="wait">
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Mode */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 opacity-40 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="name@astra.ai"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold">Password</label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setErrorMessage(''); }}
                      className="text-xs text-blue-400 hover:underline font-medium"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 opacity-40 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 opacity-40 hover:opacity-100"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${st.btn}`}
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-white/10 opacity-30" />
                  </div>
                  <span className="relative px-3 text-[10px] uppercase tracking-wider font-semibold opacity-50 bg-slate-900 dark:bg-[#0D1428]">
                    Or continue with
                  </span>
                </div>

                {/* Official Google Sign-In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-800 dark:text-white text-xs font-semibold flex items-center justify-center space-x-3 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </form>
            )}

            {/* Signup Mode */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Alex Morgan"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                  />
                </div>

                <button type="submit" disabled={isLoading} className={`w-full py-3 rounded-xl text-xs font-bold ${st.btn}`}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>

                {/* Divider */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-white/10 opacity-30" />
                  </div>
                  <span className="relative px-3 text-[10px] uppercase tracking-wider font-semibold opacity-50 bg-slate-900 dark:bg-[#0D1428]">
                    Or continue with
                  </span>
                </div>

                {/* Official Google Sign-In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-800 dark:text-white text-xs font-semibold flex items-center justify-center space-x-3 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </form>
            )}

            {/* Forgot Password Mode */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl text-xs border outline-none ${st.input}`}
                  />
                </div>
                <button type="submit" disabled={isLoading} className={`w-full py-3 rounded-xl text-xs font-bold ${st.btn}`}>
                  Send Password Reset Email
                </button>
              </form>
            )}

            {/* Quick Guest Mode Access & Switchers */}
            <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
              <button
                onClick={handleGuestAccess}
                className="w-full py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center justify-center space-x-2 transition-all"
              >
                <UserCheck className="w-4 h-4" />
                <span>Instant Guest Demo Access (No Account Required)</span>
              </button>

              <div className="text-center text-xs opacity-70 flex justify-center space-x-2 pt-1">
                {mode === 'login' ? (
                  <span>
                    Don't have an account?{' '}
                    <button onClick={() => setMode('signup')} className="text-blue-400 font-bold hover:underline">
                      Sign Up Free
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button onClick={() => setMode('login')} className="text-blue-400 font-bold hover:underline">
                      Log In
                    </button>
                  </span>
                )}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-[11px] opacity-40">
        <p>ASTRA AI Workspace Security • Encrypted Firebase Data Transmission</p>
      </footer>

    </div>
  );
};
