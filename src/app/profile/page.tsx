'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { User, Mail, Shield, LogOut, ArrowRight, Award } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        router.replace('/login');
      } else {
        fetchProfile(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.replace('/login');
      } else if (session) {
        fetchProfile(session.user);
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [router]);

  async function fetchProfile(user: any) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const metadata = user.user_metadata || {};
      const fullName = metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Sports Fan';
      const avatarUrl = metadata.avatar_url || metadata.picture || '';

      if (data) {
        setProfile(data);
        
        // Sync missing avatar_url or name if they exist in OAuth user_metadata
        if ((!data.avatar_url && avatarUrl) || (!data.full_name && fullName)) {
          const updates: any = {};
          if (!data.avatar_url && avatarUrl) updates.avatar_url = avatarUrl;
          if (!data.full_name && fullName) updates.full_name = fullName;
          
          const { data: updated } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single();
          if (updated) setProfile(updated);
        }
      } else {
        const { data: newProfile, error: createError } = await supabase.from('profiles').insert([
          {
            id: user.id,
            email: user.email,
            role: 'user',
            full_name: fullName,
            avatar_url: avatarUrl,
            created_at: new Date().toISOString()
          }
        ]).select().single();
        if (newProfile) {
          setProfile(newProfile);
        } else {
          console.warn('Profile creation failed:', createError);
        }
      }
    } catch (err) {
      console.warn('Failed to load user profile:', err);
    } finally {
      setLoading(false);
    }
  }


  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      localStorage.removeItem('lce_admin_auth');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-brand-navy">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
        </main>
        <Footer />
      </div>
    );
  }

  const userRole = profile?.role || 'user';

  return (
    <div className="flex flex-col min-h-screen bg-brand-navy">
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel border border-purple-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden bg-gradient-to-b from-dark-900 to-dark-950">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
          
          <div className="text-center mb-6 border-b border-dark-850 pb-5">
            <div className="mx-auto w-16 h-16 bg-purple-500/10 border border-purple-500/35 rounded-full flex items-center justify-center text-purple-400 mb-3 shadow-lg relative">
              {profile?.avatar_url ? (
                <div className="w-full h-full rounded-full overflow-hidden">
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                </div>
              ) : (
                <User className="h-8 w-8" />
              )}
              <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-dark-950 ${
                userRole === 'admin' ? 'bg-purple-500' : userRole === 'scorer' ? 'bg-indigo-500' : 'bg-emerald-500'
              }`} />
            </div>
            <h1 className="text-lg font-black text-white uppercase tracking-wider">{profile?.full_name || 'Sports Fan'}</h1>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest mt-1.5 border ${
              userRole === 'admin' 
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' 
                : userRole === 'scorer' 
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                  : 'bg-emerald-500/10 text-emerald-450 border-emerald-500/30'
            }`}>
              {userRole} Account
            </span>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center space-x-3.5 bg-dark-950/40 p-3 rounded-xl border border-dark-850">
              <Mail className="h-5 w-5 text-dark-450" />
              <div>
                <p className="text-[9px] text-dark-500 uppercase tracking-widest font-black">Email Address</p>
                <p className="text-xs text-white/95 font-semibold mt-0.5">{session?.user?.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3.5 bg-dark-950/40 p-3 rounded-xl border border-dark-850">
              <Shield className="h-5 w-5 text-dark-450" />
              <div>
                <p className="text-[9px] text-dark-500 uppercase tracking-widest font-black">Account Role ID</p>
                <p className="text-xs text-white/95 font-semibold mt-0.5 uppercase tracking-wide">{userRole}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(userRole === 'admin' || userRole === 'scorer') && (
              <Link
                href="/admin"
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-1.5"
              >
                <Shield className="w-4 h-4" />
                <span>Enter Admin Panel</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-dark-950 border border-red-500/20 hover:bg-red-500/5 text-red-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out Account</span>
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
