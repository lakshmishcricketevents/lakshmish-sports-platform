'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Lock, Mail, User, Shield, Play } from 'lucide-react';

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
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
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.59-1.04-1.34-1.21-2.09z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/profile';

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // If user is already authenticated, redirect to target path
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace(redirectPath);
        }
      });
    }
  }, [router, redirectPath]);

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase is not configured. Please supply NEXT_PUBLIC_SUPABASE_URL and KEY.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('oauth_signin_in_progress', 'true');
      }
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lakshmish-sports-platform.vercel.app';
      const redirectToUrl = origin.includes('localhost') || origin.includes('127.0.0.1')
        ? origin
        : 'https://lakshmish-sports-platform.vercel.app';

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectToUrl
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during Google authentication');
      setLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase is not configured. Please supply NEXT_PUBLIC_SUPABASE_URL and KEY.');
      return;
    }

    setLoading(true);


    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        
        router.push(redirectPath);
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;

        if (data.user) {
          // Initialize profile record in public schema
          const { error: profileError } = await supabase.from('profiles').insert([
            {
              id: data.user.id,
              email: email,
              role: 'user', // Default role
              full_name: fullName.trim() || email.split('@')[0],
              created_at: new Date().toISOString()
            }
          ]);
          if (profileError) {
            console.warn('Failed to insert profiles row:', profileError);
          }
        }
        
        setSuccessMsg('Registration successful! Please check your email or log in.');
        setMode('signin');
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?mode=reset`
        });
        if (error) throw error;
        setSuccessMsg('Password reset link sent to your email.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full glass-panel border border-purple-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden bg-gradient-to-b from-dark-900 to-dark-950">
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
      
      <div className="text-center mb-6">
        <div className="mx-auto w-12 h-12 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400 mb-3 shadow-lg">
          {mode === 'signup' ? <User className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
        </div>
        <h1 className="text-xl font-black text-white uppercase tracking-wider">
          {mode === 'signin' && 'Sign In'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'forgot' && 'Reset Password'}
        </h1>
        <p className="text-[10px] text-dark-450 uppercase font-semibold mt-1">
          {mode === 'signin' && 'Enter your sports hub credentials'}
          {mode === 'signup' && 'Join Karnataka\'s Premier Sports Platform'}
          {mode === 'forgot' && 'Send recovery instructions to your email'}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 bg-red-950/20 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-semibold text-center">
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-semibold text-center">
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 h-4 w-4 text-dark-500" />
              <input
                type="text"
                placeholder="Virat Kohli"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-dark-950 border border-dark-800 focus:border-purple-500/50 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none placeholder-dark-500"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-dark-500" />
            <input
              type="email"
              placeholder="name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-dark-950 border border-dark-800 focus:border-purple-500/50 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none placeholder-dark-500"
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div>
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-dark-500" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-dark-950 border border-dark-800 focus:border-purple-500/50 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none placeholder-dark-500"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
          ) : (
            <span>
              {mode === 'signin' && 'Sign In'}
              {mode === 'signup' && 'Register Profile'}
              {mode === 'forgot' && 'Send Reset Link'}
            </span>
          )}
        </button>
      </form>

      {isSupabaseConfigured && (
        <div className="mt-4 space-y-4">
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-dark-850"></div>
            <span className="flex-shrink mx-4 text-dark-500 text-[8px] font-extrabold uppercase tracking-widest">or</span>
            <div className="flex-grow border-t border-dark-850"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-dark-950 hover:bg-dark-900 border border-dark-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-2"
          >
            <GoogleIcon className="h-4 w-4" />
            <span>Continue with Google</span>
          </button>
        </div>
      )}

      {/* Local Dev Admin Bypass (only shown on localhost/127.0.0.1) */}
      {isMounted && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
        <div className="mt-4 p-4 bg-purple-950/20 border border-purple-500/35 rounded-xl text-center space-y-2">
          <p className="text-[9px] text-purple-400 font-black uppercase tracking-widest leading-none mb-1">Local Development Mode</p>
          <button
            onClick={() => {
              localStorage.setItem('lce_admin_auth', 'true');
              router.push('/admin');
            }}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-purple-500/15"
          >
            Dev Login (Local Admin Bypass)
          </button>
        </div>
      )}

      <div className="mt-5 border-t border-dark-850 pt-4 flex flex-col items-center space-y-2 text-[10px] font-bold text-dark-400 uppercase">

        {mode === 'signin' ? (
          <>
            <button onClick={() => setMode('signup')} className="hover:text-purple-400 transition-colors">
              Need an account? <span className="text-purple-400 font-extrabold">Register Here</span>
            </button>
            <button onClick={() => setMode('forgot')} className="hover:text-purple-400 transition-colors text-[9px]">
              Forgot Password?
            </button>
            <Link href="/admin" className="hover:text-purple-405 text-purple-400 transition-colors text-[9px] mt-1 text-center font-extrabold tracking-wider">
              Scoring Admin Console
            </Link>
          </>
        ) : mode === 'signup' ? (
          <button onClick={() => setMode('signin')} className="hover:text-purple-400 transition-colors">
            Already registered? <span className="text-purple-400 font-extrabold">Sign In</span>
          </button>
        ) : (
          <button onClick={() => setMode('signin')} className="hover:text-purple-405 text-purple-400 transition-colors">
            Back to <span className="text-purple-400 font-extrabold">Sign In</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen bg-brand-navy">
      <Navbar />
      <main className="flex-grow flex items-center justify-center p-4">
        <Suspense fallback={
          <div className="text-center py-10">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
          </div>
        }>
          <LoginContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
