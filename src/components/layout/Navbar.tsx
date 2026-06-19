'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play, Home, Menu, X, Shield, User, LogOut, Award, Bell } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLocalAdmin, setIsLocalAdmin] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'Bengaluru Royals vs Mumbai Spartans is LIVE', desc: 'Cricket • Innings 1, 15.4 Overs', time: '10m ago', unread: true },
    { id: '2', title: 'Fazel Atrachali completed Super Tackle', desc: 'Kabaddi • Golden Warriors enforce ALL OUT', time: '40m ago', unread: true },
    { id: '3', title: 'Broadcaster connected Ground Camera stream', desc: 'System • WebRTC stream node online', time: '1h ago', unread: false }
  ]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLocalAdmin(localStorage.getItem('lce_admin_auth') === 'true');
    }
  }, [session, role]);


  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Session listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function syncProfile(user: any) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          setProfile(data);
          setRole(data.role);
          
          // Sync missing avatar_url or name if they exist in OAuth user_metadata
          const metadata = user.user_metadata || {};
          const avatarUrl = metadata.avatar_url || metadata.picture || '';
          if (!data.avatar_url && avatarUrl) {
            const { data: updated } = await supabase
              .from('profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', user.id)
              .select()
              .single();
            if (updated) setProfile(updated);
          }
        } else {
          // Auto create profile for OAuth sign-in callback redirects
          const metadata = user.user_metadata || {};
          const fullName = metadata.full_name || metadata.name || user.email?.split('@')[0] || 'Sports Fan';
          const avatarUrl = metadata.avatar_url || metadata.picture || '';
          
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert([
              {
                id: user.id,
                email: user.email,
                role: 'user',
                full_name: fullName,
                avatar_url: avatarUrl,
                created_at: new Date().toISOString()
              }
            ])
            .select()
            .single();

          if (newProfile) {
            setProfile(newProfile);
            setRole(newProfile.role);
          } else {
            console.error('Failed to auto-generate profile on OAuth login:', insertError);
          }
        }
      } catch (err) {
        console.warn('Failed to retrieve user profile role:', err);
      }
    }

    if (session?.user?.id) {
      syncProfile(session.user);
      
      // Perform redirect check for Google Login callback
      if (typeof window !== 'undefined') {
        const oauthProgress = sessionStorage.getItem('oauth_signin_in_progress');
        if (oauthProgress === 'true') {
          sessionStorage.removeItem('oauth_signin_in_progress');
          window.location.href = '/profile';
        }
      }
    } else {
      setProfile(null);
      setRole(null);
    }
  }, [session]);


  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      localStorage.removeItem('lce_admin_auth');
      window.location.href = '/';
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  // Construct links
  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/cricket', label: 'Cricket', icon: Play },
    { href: '/kabaddi', label: 'Kabaddi', icon: Award },
  ];

  if (session) {
    navLinks.push({ href: '/admin', label: 'Admin', icon: Shield });
    navLinks.push({ href: '/profile', label: 'Profile', icon: User });
  } else {
    if (isLocalAdmin) {
      navLinks.push({ href: '/admin', label: 'Admin', icon: Shield });
    }
    navLinks.push({ href: '/login', label: 'Login', icon: User });
  }

  return (
    <nav className="glass-panel border-b border-purple-500/10 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Branding */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg shadow-purple-500/10 group-hover:scale-105 transition-transform flex items-center justify-center">
                <Play className="h-5.5 w-5.5 text-white fill-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black tracking-wider text-white uppercase font-sans leading-none mb-0.5">
                  Lakshmish
                </span>
                <span className="text-[9px] tracking-widest text-purple-400 font-extrabold uppercase leading-none">
                  sports hub
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              const isProfile = link.href === '/profile';
              const avatarSrc = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 ${
                    active
                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/35 glow-purple'
                      : 'text-dark-300 hover:text-purple-450 hover:bg-purple-500/5 hover:border-purple-500/10 border border-transparent'
                  }`}
                >
                  {isProfile && avatarSrc ? (
                    <img src={avatarSrc} alt="" className="h-4 w-4 rounded-full object-cover border border-purple-500/30" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span>{link.label}</span>
                </Link>
              );
            })}


            {/* Notifications Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="flex items-center justify-center p-2 rounded-xl text-dark-300 hover:text-purple-450 hover:bg-purple-500/5 border border-transparent hover:border-purple-500/10 transition-all cursor-pointer relative"
                title="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {notifications.some(n => n.unread) && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2.5 w-80 glass-panel border border-purple-500/20 bg-dark-950 p-4 rounded-xl shadow-2xl z-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-dark-850 pb-2">
                    <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">Alert Center</span>
                    <button 
                      onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}
                      className="text-[8px] font-extrabold uppercase text-dark-400 hover:text-white transition-colors animate-pulse"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className={`p-2 rounded-lg border transition-all text-xs text-left ${n.unread ? 'bg-purple-500/5 border-purple-500/20' : 'bg-dark-900/40 border-dark-850'}`}>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={`text-[10px] uppercase tracking-wide font-black ${n.unread ? 'text-white' : 'text-dark-300'}`}>{n.title}</h4>
                          <span className="text-[8px] text-dark-500 font-bold whitespace-nowrap">{n.time}</span>
                        </div>
                        <p className="text-[9px] text-dark-400 mt-0.5 leading-normal">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {session && (
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            )}
          </div>

          {/* Live indicator on desktop */}
          <div className="hidden md:flex items-center">
            <div className="flex items-center space-x-1.5 px-3.5 py-1 bg-red-950/20 border border-red-500/25 rounded-full">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-450">
                LIVE SCOREBOARD
              </span>
            </div>
          </div>

          {/* Mobile hamburger menu */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-xl text-dark-300 hover:text-purple-450 hover:bg-purple-500/10 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer menu */}
      {isOpen && (
        <div className="md:hidden glass-panel border-t border-purple-500/10 px-3 pt-2 pb-4 space-y-1 animate-fadeIn">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            const isProfile = link.href === '/profile';
            const avatarSrc = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture;

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${
                  active
                    ? 'bg-purple-500/15 text-purple-400 border border-purple-500/35'
                    : 'text-dark-300 hover:text-purple-450 hover:bg-purple-500/5'
                }`}
              >
                {isProfile && avatarSrc ? (
                  <img src={avatarSrc} alt="" className="h-5 w-5 rounded-full object-cover border border-purple-500/30" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
                <span>{link.label}</span>
              </Link>
            );
          })}

          {/* Mobile Notifications toggle */}
          <div className="border-t border-dark-850 my-1 pt-1">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider text-dark-300 hover:text-purple-450 hover:bg-purple-500/5 transition-all text-left"
            >
              <div className="flex items-center space-x-3">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </div>
              {notifications.some(n => n.unread) && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-black tracking-widest animate-pulse">
                  NEW
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="px-4 py-2 space-y-2 max-h-48 overflow-y-auto bg-dark-950/40 rounded-xl border border-dark-850 mt-1">
                {notifications.map(n => (
                  <div key={n.id} className="text-xs py-1.5 border-b border-dark-850 last:border-b-0 text-left">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-[10px] uppercase font-black text-white">{n.title}</h4>
                      <span className="text-[8px] text-dark-500">{n.time}</span>
                    </div>
                    <p className="text-[9px] text-dark-400 mt-0.5">{n.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          
          {session && (
            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all text-left"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          )}
          
          <div className="pt-3 px-4">
            <div className="flex items-center justify-center space-x-2 py-2.5 bg-red-950/20 border border-red-500/25 rounded-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-widest text-red-450">
                LIVE SCOREBOARD
              </span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
