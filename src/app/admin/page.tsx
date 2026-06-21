'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Match, Tournament, Team, Player, Sponsor } from '@/lib/db';
import { 
  Shield, Play, PlusCircle, CheckCircle, Database, Lock, Trophy, 
  Users, UserPlus, FileImage, Trash2, Camera, Edit2, XCircle, 
  Clock, Calendar, Activity, Cpu, Bell, User, Home, LogOut, ArrowRight, Award 
} from 'lucide-react';
import CameraStreamReceiver from '@/components/admin/CameraStreamReceiver';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function AdminDashboard() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Lists
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  // Navigation Tab State (Dashboard, Matches, Players, Teams, Tournaments, Branding, Cameras)
  const [sidebarTab, setSidebarTab] = useState<'dashboard' | 'matches' | 'players' | 'teams' | 'tournaments' | 'branding' | 'cameras'>('dashboard');
  
  // Selected Context Tournament ID (shown in top bar dropdown and active context card)
  const [selectedTourId, setSelectedTourId] = useState<string>('');

  // Form States & Editing Modes
  const [localIp, setLocalIp] = useState('http://localhost:3000');
  const [successBanner, setSuccessBanner] = useState('');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [connLogs, setConnLogs] = useState<string[]>([
    'System: Session initialized successfully.',
    'DB Sync: Loaded active tournament records.',
    'Gateway: WebRTC signaling channel active.'
  ]);

  // Editing IDs
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  // Forms
  const [matchForm, setMatchForm] = useState({
    tournamentId: '',
    sport: 'cricket',
    teamAId: '',
    teamBId: '',
    date: ''
  });

  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    logo: '',
    sport: 'cricket',
    rules: '',
    teamIds: [] as string[]
  });

  const [teamForm, setTeamForm] = useState({
    name: '',
    logo: '',
    purse: 1500,
    playerIds: [] as string[],
    captainId: '',
    viceCaptainId: ''
  });

  const [playerForm, setPlayerForm] = useState({
    name: '',
    photo: '',
    role: 'Batsman',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium fast',
    auctionBaseValue: 100
  });

  const [sponsorForm, setSponsorForm] = useState({
    name: '',
    logo: '',
    link: '#'
  });

  useEffect(() => {
    async function checkAuth() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            if (profile?.role === 'admin' || profile?.role === 'scorer') {
              setAuthorized(true);
              fetchAdminData();
            } else {
              setAuthorized(false);
              setErrorMsg('Access Denied: Your account role does not have admin/scorer permissions.');
            }
          } else {
            const localAuth = localStorage.getItem('lce_admin_auth');
            if (localAuth === 'true') {
              setAuthorized(true);
              fetchAdminData();
            } else {
              setAuthorized(false);
            }
          }
        } catch (err) {
          console.error('Supabase Admin auth error:', err);
        }
      } else {
        const auth = localStorage.getItem('lce_admin_auth');
        if (auth === 'true') {
          setAuthorized(true);
          fetchAdminData();
        }
      }
      setCheckingAuth(false);
    }

    checkAuth();

    if (typeof window !== 'undefined') {
      setLocalIp(window.location.origin);
      
      const isLocalhost = 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname === '0.0.0.0';
        
      fetch('/api/cam/ip')
        .then(r => r.json())
        .then(data => {
          if (data.ip && data.ip !== 'localhost') {
            const port = window.location.port ? `:${window.location.port}` : '';
            if (isLocalhost) {
              setLocalIp(`http://${data.ip}${port}`);
            }
          }
        })
        .catch(err => console.error('Failed to auto-detect server IP:', err));
    }
  }, []);

  // Poll camera sessions if Cameras tab is open
  useEffect(() => {
    if (sidebarTab !== 'cameras') return;
    const fetchActiveSessions = async () => {
      try {
        const res = await fetch('/api/cam/signal');
        if (res.ok) {
          const data = await res.json();
          setActiveSessions(data);
        }
      } catch (err) {
        console.warn('Failed to fetch active camera sessions:', err);
      }
    };
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 3000);
    return () => clearInterval(interval);
  }, [sidebarTab]);

  async function fetchAdminData() {
    try {
      const [resMatches, resTournaments, resTeams, resPlayers, resSponsors] = await Promise.all([
        fetch('/api/matches').then(r => r.json()),
        fetch('/api/tournaments').then(r => r.json()),
        fetch('/api/teams').then(r => r.json()),
        fetch('/api/players').then(r => r.json()),
        fetch('/api/sponsors').then(r => r.json())
      ]);

      if (Array.isArray(resMatches)) setMatches(resMatches);
      if (Array.isArray(resTournaments)) {
        setTournaments(resTournaments);
        if (resTournaments.length > 0) {
          setSelectedTourId(prev => prev || resTournaments[0].id);
        }
      }
      if (Array.isArray(resTeams)) setTeams(resTeams);
      if (Array.isArray(resPlayers)) setPlayers(resPlayers);
      if (Array.isArray(resSponsors)) setSponsors(resSponsors);
    } catch (err) {
      console.error(err);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase === 'admin123') {
      setAuthorized(true);
      localStorage.setItem('lce_admin_auth', 'true');
      setErrorMsg('');
      
      // Auto promote active Google/Supabase user session to 'admin' in profiles table
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            await supabase
              .from('profiles')
              .update({ role: 'admin' })
              .eq('id', session.user.id);
            addLog(`System: Self-healed role to 'admin' for user ${session.user.email}`);
          }
        } catch (err) {
          console.warn('Failed to self-heal user role:', err);
        }
      }
      fetchAdminData();
    } else {
      setErrorMsg('Invalid administrative passphrase.');
    }
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setConnLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 40));
  };

  const triggerBanner = (msg: string) => {
    setSuccessBanner(msg);
    addLog(msg);
    setTimeout(() => setSuccessBanner(''), 3000);
  };

  // CRUD Handlers
  const handleMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMatchId) {
        const teamA = teams.find(t => t.id === matchForm.teamAId);
        const teamB = teams.find(t => t.id === matchForm.teamBId);
        const res = await fetch(`/api/matches/${editingMatchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tournamentId: matchForm.tournamentId,
            sport: matchForm.sport,
            teamA: teamA ? { id: teamA.id, name: teamA.name, logo: teamA.logo } : undefined,
            teamB: teamB ? { id: teamB.id, name: teamB.name, logo: teamB.logo } : undefined,
            date: matchForm.date
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Match successfully updated!');
        setEditingMatchId(null);
      } else {
        const res = await fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(matchForm)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Live Match successfully scheduled!');
      }
      setMatchForm({ tournamentId: '', sport: 'cricket', teamAId: '', teamBId: '', date: '' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteMatch = async (id: string) => {
    if (!confirm('Are you sure you want to delete this match?')) return;
    try {
      const res = await fetch(`/api/matches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerBanner('Match deleted successfully!');
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTournamentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTournamentId) {
        const res = await fetch(`/api/tournaments?id=${editingTournamentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tournamentForm.name,
            logo: tournamentForm.logo,
            sport: tournamentForm.sport,
            rules: tournamentForm.rules,
            teams: tournamentForm.teamIds
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Tournament successfully updated!');
        setEditingTournamentId(null);
      } else {
        const res = await fetch('/api/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tournamentForm)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Tournament successfully created!');
      }
      setTournamentForm({ name: '', logo: '', sport: 'cricket', rules: '', teamIds: [] });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTournament = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;
    try {
      const res = await fetch(`/api/tournaments?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerBanner('Tournament deleted successfully!');
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeamId) {
        const res = await fetch(`/api/teams?id=${editingTeamId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: teamForm.name,
            logo: teamForm.logo,
            purse: teamForm.purse,
            players: teamForm.playerIds,
            captainId: teamForm.captainId || undefined,
            viceCaptainId: teamForm.viceCaptainId || undefined
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Team roster successfully updated!');
        setEditingTeamId(null);
      } else {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(teamForm)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Franchise Team successfully added!');
      }
      setTeamForm({ name: '', logo: '', purse: 1500, playerIds: [], captainId: '', viceCaptainId: '' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    try {
      const res = await fetch(`/api/teams?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerBanner('Team deleted successfully!');
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPlayerId) {
        const res = await fetch(`/api/players?id=${editingPlayerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: playerForm.name,
            photo: playerForm.photo,
            role: playerForm.role,
            battingStyle: playerForm.battingStyle || undefined,
            bowlingStyle: playerForm.bowlingStyle || undefined,
            auctionBaseValue: playerForm.auctionBaseValue
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Player profile successfully updated!');
        setEditingPlayerId(null);
      } else {
        const res = await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(playerForm)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        triggerBanner('Player profile registered successfully!');
      }
      setPlayerForm({ name: '', photo: '', role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium fast', auctionBaseValue: 100 });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this player?')) return;
    try {
      const res = await fetch(`/api/players?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerBanner('Player deleted successfully!');
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSponsorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sponsorForm)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      triggerBanner('Sponsor added successfully!');
      setSponsorForm({ name: '', logo: '', link: '#' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    try {
      await fetch(`/api/sponsors?id=${id}`, { method: 'DELETE' });
      triggerBanner('Sponsor deleted successfully!');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activeTournament = tournaments.find(t => t.id === selectedTourId) || tournaments[0];

  if (checkingAuth) {
    return (
      <div className="flex flex-col min-h-screen bg-[#05070f] text-white">
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
        </main>
      </div>
    );
  }

  // Passphrase screen (unlocked using local admin123 or auth accounts)
  if (!authorized) {
    return (
      <div className="flex flex-col min-h-screen justify-between bg-[#05070f]">
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel border border-purple-500/20 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#0F1326] to-[#0A0D17]">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400 mb-3 shadow-lg">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-black text-white uppercase tracking-wider">Scoring Administration</h1>
              <p className="text-xs text-dark-400 mt-1 uppercase font-semibold">Authenticate to access platform console</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Administrative Passphrase</label>
                <input
                  type="password"
                  placeholder="Enter Passphrase (e.g. admin123)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 focus:border-purple-500/50 rounded-xl px-4 py-3 text-xs text-white focus:outline-none placeholder-dark-500"
                />
              </div>
              
              {errorMsg && (
                <p className="text-xs font-semibold text-red-400 text-center uppercase tracking-wider">{errorMsg}</p>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
              >
                Authenticate Session
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#05070f] text-white">
      
      {/* 1. LEFT SIDEBAR PANEL (exactly matches the sidebar layout in the reference image) */}
      <aside className="w-64 bg-[#080B14] border-r border-[#161F38] flex flex-col justify-between h-screen sticky top-0 p-4 shrink-0">
        <div className="space-y-6">
          
          {/* Logo Heading */}
          <div className="flex items-center space-x-2.5 px-2">
            <div className="w-6 h-6 rounded-full bg-[#EAB308] flex items-center justify-center text-dark-950 font-black text-xs shadow-md">
              🏆
            </div>
            <span className="text-white font-extrabold uppercase tracking-wider text-sm font-sans">
              Admin Panel
            </span>
          </div>

          {/* Return To Home */}
          <Link 
            href="/" 
            className="flex items-center justify-between w-full bg-[#18153B] border border-[#2D2168] hover:bg-[#201C4F] text-[#B09CFF] px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
          >
            <span className="uppercase tracking-widest text-[9px]">Return to Home</span>
            <Home className="w-3.5 h-3.5" />
          </Link>

          {/* Create Auction / Match Shortcut */}
          <button 
            onClick={() => {
              setSidebarTab('matches');
            }}
            className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-dark-950 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-1.5 shadow-lg shadow-cyan-500/10 cursor-pointer"
          >
            <span>+ Create Auction</span>
          </button>

          {/* Sidebar Menu Options */}
          <div className="space-y-4">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#4E5C78] block px-2">Console</span>
            <nav className="space-y-1.5">
              {[
                { id: 'dashboard', label: 'Dashboard', char: 'D' },
                { id: 'matches', label: 'Auctions', char: 'A' },
                { id: 'players', label: 'Players', char: 'P' },
                { id: 'teams', label: 'Teams', char: 'T' },
                { id: 'tournaments', label: 'Kabaddi', char: 'K' },
                { id: 'branding', label: 'Branding', char: 'B' },
                { id: 'cameras', label: 'Icons', char: 'I' },
              ].map((item) => {
                const active = sidebarTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSidebarTab(item.id as any);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black shadow-lg shadow-blue-500/10'
                        : 'text-[#8495B0] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={`text-[10px] font-black ${active ? 'text-white' : 'text-[#8495B0]'}`}>
                        {item.char}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {active && <span className="text-[8px] text-white">▶</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Profile Footer */}
        <div className="border-t border-[#161F38] pt-4 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm uppercase">
              A
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider leading-none mb-1">Admin</h4>
              <span className="text-[8px] text-[#EAB308] uppercase font-black tracking-widest leading-none">Root Master</span>
            </div>
          </div>
          
          <button
            onClick={() => {
              localStorage.removeItem('lce_admin_auth');
              setAuthorized(false);
              if (isSupabaseConfigured) {
                supabase.auth.signOut().then(() => router.replace('/'));
              } else {
                router.replace('/');
              }
            }}
            className="w-full flex items-center space-x-2 px-2 py-2 text-[#8495B0] hover:text-red-400 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#060811] overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 border-b border-[#161F38] bg-[#080B14] gap-4">
          
          {/* Selected Context Dropdown */}
          <div className="flex items-center space-x-3 bg-[#0D1220] border border-[#1C253B] px-3.5 py-2 rounded-xl w-full sm:w-80 shadow-md">
            <Trophy className="h-4 w-4 text-[#EAB308]" />
            <div className="flex flex-col flex-grow">
              <span className="text-[7px] font-black text-[#EAB308] uppercase tracking-widest leading-none mb-1">Selected Auction</span>
              <select
                value={selectedTourId}
                onChange={(e) => setSelectedTourId(e.target.value)}
                className="bg-transparent text-white font-extrabold text-xs focus:outline-none w-full uppercase cursor-pointer"
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#080B14] text-white uppercase">{t.name}</option>
                ))}
                {tournaments.length === 0 && <option value="">No Active Leagues</option>}
              </select>
            </div>
          </div>

          {/* Status Indicators & Go Live */}
          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            <div className="flex items-center space-x-2 bg-[#0E201B] border border-[#173F35] px-3 py-1.5 rounded-full text-[9px] font-black text-[#22C55E] uppercase tracking-widest">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span>Server Online</span>
            </div>
            
            <button
              onClick={() => {
                const liveMatch = matches.find(m => m.status === 'live');
                if (liveMatch) {
                  router.push(`/admin/score/${liveMatch.id}`);
                } else if (matches.length > 0) {
                  alert("Click 'Start Scoring Live' on a match in Dashboard below to begin.");
                } else {
                  alert("Please schedule a match first.");
                }
              }}
              className="bg-[#EAB308] hover:bg-[#CA8A04] text-dark-950 font-black text-xs uppercase tracking-widest px-5 py-2 rounded-xl transition-all shadow-lg shadow-yellow-500/10 cursor-pointer"
            >
              Go Live
            </button>
          </div>
        </header>

        {/* Tab workspace area */}
        <div className="flex-1">
          {successBanner && (
            <div className="mx-6 mt-6 bg-[#0E201B] border border-[#173F35] text-[#22C55E] px-4 py-3 rounded-xl text-xs text-center font-black uppercase tracking-wider">
              {successBanner}
            </div>
          )}

          {/* ==========================================
              A. ROOT CONSOLE TAB (Default home view)
             ========================================== */}
          {sidebarTab === 'dashboard' && (
            <div className="p-6 space-y-6 animate-fadeIn">
              
              {/* Root Console Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[9px] font-black text-[#A78BFA] uppercase tracking-widest block mb-1">● Good Evening Commander</span>
                  <h2 className="text-2xl font-black text-white uppercase tracking-wider">
                    Root_<span className="text-[#A78BFA]">Console</span>
                  </h2>
                  <p className="text-xs text-[#8495B0] mt-1 font-bold uppercase">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase()}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSidebarTab('matches');
                    setEditingMatchId(null);
                  }}
                  className="bg-[#EAB308] hover:bg-[#CA8A04] text-dark-950 font-black text-[10px] uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 shadow-lg shadow-yellow-500/10 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create New System</span>
                </button>
              </div>

              {/* Rows of Context and Links */}
              <div className="grid md:grid-cols-3 gap-6">
                
                {/* Active Context Card */}
                <div className="md:col-span-2 bg-gradient-to-br from-[#121729] to-[#080B15] border border-[#1C2543] p-6 rounded-2xl flex items-center space-x-5 relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-[#A78BFA]/5 rounded-full blur-3xl" />
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-[#8495B0] uppercase tracking-widest block mb-1">Active Context</span>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                      {activeTournament ? activeTournament.name : 'Goravanahalli Premiere League'}
                    </h3>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="text-[8px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded uppercase tracking-wider">
                        {activeTournament ? activeTournament.status.toUpperCase() : 'COMPLETED'}
                      </span>
                      <span className="text-[9px] font-mono text-[#4E5C78]">
                        ID: {activeTournament ? activeTournament.id.substring(0, 8).toUpperCase() : '614F5F'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Public Registration Link */}
                <div className="bg-gradient-to-br from-[#121729] to-[#080B15] border border-[#1C2543] p-5 rounded-2xl flex items-center justify-between shadow-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#161E34] border border-[#232F52] rounded-xl flex items-center justify-center text-[#8495B0]">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-[#8495B0] uppercase tracking-widest block mb-1">Public Registration Link</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const url = window.location.origin;
                            const doCopy = () => {
                              try {
                                const textArea = document.createElement('textarea');
                                textArea.value = url;
                                textArea.style.position = 'fixed';
                                textArea.style.opacity = '0';
                                document.body.appendChild(textArea);
                                textArea.select();
                                document.execCommand('copy');
                                document.body.removeChild(textArea);
                                triggerBanner('Registration link copied to clipboard!');
                              } catch (err) {
                                alert('Could not copy link: ' + url);
                              }
                            };
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard.writeText(url)
                                .then(() => triggerBanner('Registration link copied to clipboard!'))
                                .catch(() => doCopy());
                            } else {
                              doCopy();
                            }
                          }}
                          className="text-[8px] font-black bg-[#161E34] border border-[#232F52] text-white px-2.5 py-1.5 rounded uppercase tracking-widest hover:bg-[#232F52]"
                        >
                          Copy Link
                        </button>
                        <Link
                          href="/"
                          target="_blank"
                          className="text-[8px] text-[#8495B0] hover:text-white font-bold uppercase tracking-widest flex items-center gap-1"
                        >
                          <span>Visit Portal →</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Widgets */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Teams Widget */}
                <div className="bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl flex flex-col justify-between hover:border-[#202E56] transition-all shadow-md">
                  <div className="flex justify-between items-start text-[#8495B0]">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Teams</span>
                      <h4 className="text-3xl font-black text-white font-mono mt-1">
                        {teams.filter(t => activeTournament?.teams.includes(t.id)).length || teams.length}
                      </h4>
                    </div>
                    <div className="p-2 bg-[#161F36] rounded-xl text-[#8495B0]">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <span className="text-[9px] text-[#4E5C78] font-bold uppercase tracking-wider mt-3 block">Management Active</span>
                </div>

                {/* Players Widget */}
                <div className="bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl flex flex-col justify-between hover:border-[#202E56] transition-all shadow-md">
                  <div className="flex justify-between items-start text-[#8495B0]">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Players</span>
                      <h4 className="text-3xl font-black text-white font-mono mt-1">{players.length}</h4>
                    </div>
                    <div className="p-2 bg-[#161F36] rounded-xl text-[#8495B0]">
                      <Trophy className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    <span className="text-[7px] font-black bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">{players.filter(p => !p.soldToTeamId).length} Available</span>
                    <span className="text-[7px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase">{players.filter(p => p.soldToTeamId).length} Sold</span>
                  </div>
                </div>

                {/* Icons / Branding Widget */}
                <div className="bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl flex flex-col justify-between hover:border-[#202E56] transition-all shadow-md">
                  <div className="flex justify-between items-start text-[#8495B0]">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Icons</span>
                      <h4 className="text-3xl font-black text-white font-mono mt-1">{sponsors.length}</h4>
                    </div>
                    <div className="p-2 bg-[#161F36] rounded-xl text-[#8495B0]">
                      <FileImage className="w-5 h-5" />
                    </div>
                  </div>
                  <span className="text-[9px] text-[#4E5C78] font-bold uppercase tracking-wider mt-3 block">Pre-Retained</span>
                </div>

                {/* Budget Health Widget */}
                <div className="bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl flex flex-col justify-between hover:border-[#202E56] transition-all shadow-md">
                  <div className="flex justify-between items-start text-[#8495B0]">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Budget Health</span>
                      <h4 className="text-3xl font-black text-white font-mono mt-1">100%</h4>
                    </div>
                    <div className="p-2 bg-[#0E201B] border border-[#173F35] rounded-xl text-[#22C55E]">
                      <Activity className="w-5 h-5 animate-pulse" />
                    </div>
                  </div>
                  <span className="text-[9px] text-[#22C55E] font-bold uppercase tracking-wider mt-3 block">Financials OK</span>
                </div>
              </div>

              {/* Bottom Quick Shortcuts Row */}
              <div className="grid md:grid-cols-3 gap-6">
                
                {/* Manage Status Shortcut */}
                <button
                  onClick={() => setSidebarTab('matches')}
                  className="bg-[#0D111E] hover:bg-[#11172A] border border-[#161F38] hover:border-[#25325C] p-6 rounded-2xl flex items-center justify-between text-left transition-all shadow-md cursor-pointer group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/35 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                      <Play className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">Manage Status</h4>
                      <p className="text-[9px] text-[#8495B0] mt-1 font-bold uppercase">Toggle scoring engine states</p>
                    </div>
                  </div>
                  <span className="text-base text-[#8495B0] group-hover:text-white transition-colors">→</span>
                </button>

                {/* Region Registry Shortcut */}
                <button
                  onClick={() => setSidebarTab('tournaments')}
                  className="bg-[#0D111E] hover:bg-[#11172A] border border-[#161F38] hover:border-[#25325C] p-6 rounded-2xl flex items-center justify-between text-left transition-all shadow-md cursor-pointer group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/35 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">Region Registry</h4>
                      <p className="text-[9px] text-[#8495B0] mt-1 font-bold uppercase">Manage Taluks & Hoblis</p>
                    </div>
                  </div>
                  <span className="text-base text-[#8495B0] group-hover:text-white transition-colors">→</span>
                </button>

                {/* Registry Auditor Status Widget */}
                <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl flex items-center justify-between text-left shadow-md">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-500/10 border border-red-500/35 rounded-xl flex items-center justify-center text-red-400">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">Registry Auditor</h4>
                      <p className="text-[9px] text-[#8495B0] mt-1 font-bold uppercase">Detect identity collisions</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-extrabold text-[#22C55E] uppercase bg-[#0E201B] border border-[#173F35] px-2 py-0.5 rounded">Stable</span>
                </div>
              </div>

              {/* Lower Section: Live Matches & Action Logs */}
              <div className="grid lg:grid-cols-3 gap-6">
                
                {/* Live matches list */}
                <div className="lg:col-span-2 bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl space-y-4">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-[#161F38] pb-2.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Live Matches In Progress</span>
                  </h3>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    {matches.filter(m => m.status === 'live').length === 0 ? (
                      <p className="col-span-2 text-xs text-[#8495B0] text-center py-6 italic">No live matches scoring currently.</p>
                    ) : (
                      matches.filter(m => m.status === 'live').map((match) => (
                        <div key={match.id} className="bg-[#070A12] border border-[#161F38] p-4 rounded-xl flex flex-col justify-between space-y-3.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded uppercase tracking-wider">{match.sport}</span>
                            <span className="text-[9px] text-[#8495B0] font-bold uppercase">{match.date}</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-white font-bold uppercase">{match.teamA.name.split('|')[1]?.trim() || match.teamA.name}</span>
                            <span className="text-[10px] text-dark-500 font-bold italic">vs</span>
                            <span className="text-xs text-white font-bold uppercase">{match.teamB.name.split('|')[1]?.trim() || match.teamB.name}</span>
                          </div>
                          
                          <div className="flex gap-2 pt-2 border-t border-[#161F38]">
                            <Link href={`/admin/score/${match.id}`} className="flex-grow text-center bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors">Scoring Panel</Link>
                            <Link href={`/matches/${match.id}`} className="px-3 bg-[#111625] border border-[#1E2943] text-[#8495B0] hover:text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors">Feed</Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Activity Console widget */}
                <div className="bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl flex flex-col justify-between">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-[#161F38] pb-2.5 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-400 animate-pulse" />
                    <span>Broadcaster Action Log</span>
                  </h3>
                  
                  <div className="bg-[#070A12] border border-[#161F38] rounded-xl p-3 h-52 overflow-y-auto font-mono text-[9px] text-[#8495B0] leading-relaxed space-y-1">
                    {connLogs.length === 0 ? (
                      <div className="text-dark-500 italic py-2 text-center">No recent activity logs available.</div>
                    ) : (
                      connLogs.map((log, i) => {
                        let logColor = '';
                        if (log.includes('FAILED') || log.includes('error') || log.includes('BLOCKED')) logColor = 'text-red-400';
                        else if (log.includes('successfully') || log.includes('sync') || log.includes('Registered')) logColor = 'text-emerald-450';
                        
                        return (
                          <div key={i} className={logColor}>
                            {log}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==========================================
              B. MATCHES TAB (Manage / Schedule)
             ========================================== */}
          {sidebarTab === 'matches' && (
            <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
              
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#161F38] pb-3 mb-1">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Play className="h-4.5 w-4.5 text-purple-400" />
                      <span>{editingMatchId ? 'Edit Match Details' : 'Schedule New Match'}</span>
                    </h2>
                    <p className="text-[10px] text-[#8495B0] uppercase font-semibold mt-0.5">Configure live matches and tournament contexts</p>
                  </div>
                  {editingMatchId && (
                    <button
                      onClick={() => {
                        setEditingMatchId(null);
                        setMatchForm({ tournamentId: '', sport: 'cricket', teamAId: '', teamBId: '', date: '' });
                      }}
                      className="text-[9px] font-black text-red-400 flex items-center gap-1 uppercase hover:underline"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleMatchSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Select Tournament</label>
                      <select
                        value={matchForm.tournamentId}
                        onChange={(e) => setMatchForm({ ...matchForm, tournamentId: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="">-- Choose --</option>
                        {tournaments.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.sport})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Sport Format</label>
                      <select
                        value={matchForm.sport}
                        onChange={(e) => setMatchForm({ ...matchForm, sport: e.target.value })}
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="cricket">Cricket</option>
                        <option value="kabaddi">Kabaddi</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Home Team (Team A)</label>
                      <select
                        value={matchForm.teamAId}
                        onChange={(e) => setMatchForm({ ...matchForm, teamAId: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="">-- Choose --</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Away Team (Team B)</label>
                      <select
                        value={matchForm.teamBId}
                        onChange={(e) => setMatchForm({ ...matchForm, teamBId: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="">-- Choose --</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Match Date</label>
                    <input
                      type="date"
                      value={matchForm.date}
                      onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })}
                      required
                      className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <button type="submit" className="bg-[#EAB308] hover:bg-[#CA8A04] text-dark-950 text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-xl">
                    {editingMatchId ? 'Update Match Details' : 'Schedule Match'}
                  </button>
                </form>
              </div>

              {/* Matches List database panel */}
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Scheduled Matches Registry ({matches.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {matches.map(m => (
                    <div key={m.id} className="flex justify-between items-center bg-[#070A12] p-3 rounded-xl border border-[#161F38] text-xs">
                      <div className="min-w-0">
                        <span className="text-[8px] font-black uppercase bg-[#18153B] text-[#B09CFF] px-1.5 py-0.5 rounded border border-[#2D2168]">{m.sport}</span>
                        <span className="text-[9px] text-[#8495B0] font-bold uppercase ml-2">{m.date}</span>
                        <h5 className="font-bold text-white uppercase tracking-wider mt-1.5 truncate max-w-[300px]">
                          {m.teamA.name.split('|')[1]?.trim() || m.teamA.name} vs {m.teamB.name.split('|')[1]?.trim() || m.teamB.name}
                        </h5>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingMatchId(m.id);
                            setMatchForm({
                              tournamentId: m.tournamentId || '',
                              sport: m.sport || 'cricket',
                              teamAId: m.teamA?.id || '',
                              teamBId: m.teamB?.id || '',
                              date: m.date || ''
                            });
                          }}
                          className="p-1.5 bg-[#0F1326] hover:bg-[#1E2543] text-purple-400 hover:text-white rounded-lg border border-[#1E2543]"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(m.id)}
                          className="p-1.5 bg-red-950/15 hover:bg-red-950/30 text-red-400 rounded-lg border border-red-950/20"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              C. PLAYERS TAB (Manage / Register)
             ========================================== */}
          {sidebarTab === 'players' && (
            <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
              
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#161F38] pb-3 mb-1">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <UserPlus className="h-4.5 w-4.5 text-purple-400" />
                      <span>{editingPlayerId ? 'Edit Player Details' : 'Register New Player'}</span>
                    </h2>
                    <p className="text-[10px] text-[#8495B0] uppercase font-semibold mt-0.5">Add athletes to the drafting auction pool</p>
                  </div>
                  {editingPlayerId && (
                    <button
                      onClick={() => {
                        setEditingPlayerId(null);
                        setPlayerForm({ name: '', photo: '', role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium fast', auctionBaseValue: 100 });
                      }}
                      className="text-[9px] font-black text-red-400 flex items-center gap-1 uppercase hover:underline"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handlePlayerSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Athlete Name</label>
                      <input
                        type="text"
                        placeholder="Virat Kohli"
                        value={playerForm.name}
                        onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Athlete Photo URL</label>
                      <input
                        type="text"
                        placeholder="Image URL link"
                        value={playerForm.photo}
                        onChange={(e) => setPlayerForm({ ...playerForm, photo: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Athlete Role</label>
                      <select
                        value={playerForm.role}
                        onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })}
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="Batsman">Cricket Batsman</option>
                        <option value="Bowler">Cricket Bowler</option>
                        <option value="All-Rounder">Cricket All-Rounder</option>
                        <option value="Wicketkeeper">Cricket Wicketkeeper</option>
                        <option value="Raider">Kabaddi Raider</option>
                        <option value="Defender">Kabaddi Defender</option>
                        <option value="All-Rounder (Kabaddi)">Kabaddi All-Rounder</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Batting / Raider Style</label>
                      <input
                        type="text"
                        placeholder="Right-hand bat"
                        value={playerForm.battingStyle}
                        onChange={(e) => setPlayerForm({ ...playerForm, battingStyle: e.target.value })}
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Bowling / Defender Style</label>
                      <input
                        type="text"
                        placeholder="Right-arm medium"
                        value={playerForm.bowlingStyle}
                        onChange={(e) => setPlayerForm({ ...playerForm, bowlingStyle: e.target.value })}
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Auction Base Purse Value (in Lakhs / L)</label>
                    <input
                      type="number"
                      placeholder="100"
                      value={playerForm.auctionBaseValue}
                      onChange={(e) => setPlayerForm({ ...playerForm, auctionBaseValue: Number(e.target.value) })}
                      required
                      className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <button type="submit" className="bg-[#EAB308] hover:bg-[#CA8A04] text-dark-950 text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-xl">
                    {editingPlayerId ? 'Update Player Profile' : 'Register Player'}
                  </button>
                </form>
              </div>

              {/* Active Player Pool list */}
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Registered Player Database ({players.length})</h3>
                
                <div className="grid md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                  {players.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-[#070A12] p-3.5 rounded-xl border border-[#161F38] text-xs">
                      <div className="flex items-center space-x-3 min-w-0">
                        <img src={p.photo} alt="" className="w-9 h-9 rounded-full object-cover bg-dark-950 border border-dark-800" />
                        <div className="min-w-0">
                          <h5 className="font-bold text-white uppercase tracking-wider truncate max-w-[180px]">{p.name}</h5>
                          <span className="text-[9px] text-[#A78BFA] uppercase font-semibold">{p.role} • Base: {p.auctionBaseValue}L</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingPlayerId(p.id);
                            setPlayerForm({
                              name: p.name,
                              photo: p.photo,
                              role: p.role,
                              battingStyle: p.battingStyle || '',
                              bowlingStyle: p.bowlingStyle || '',
                              auctionBaseValue: p.auctionBaseValue
                            });
                          }}
                          className="p-1.5 bg-[#0F1326] hover:bg-[#1E2543] text-purple-400 hover:text-white rounded-lg border border-[#1E2543]"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(p.id)}
                          className="p-1.5 bg-red-950/15 hover:bg-red-950/30 text-red-400 rounded-lg border border-red-950/20"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              D. TEAMS TAB (Franchises & Rosters)
             ========================================== */}
          {sidebarTab === 'teams' && (
            <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
              
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#161F38] pb-3 mb-1">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Users className="h-4.5 w-4.5 text-[#EAB308]" />
                      <span>{editingTeamId ? 'Edit Franchise Roster' : 'Add Franchise Team'}</span>
                    </h2>
                    <p className="text-[10px] text-[#8495B0] uppercase font-semibold mt-0.5">Register franchise teams and budget purses</p>
                  </div>
                  {editingTeamId && (
                    <button
                      onClick={() => {
                        setEditingTeamId(null);
                        setTeamForm({ name: '', logo: '', purse: 1500, playerIds: [], captainId: '', viceCaptainId: '' });
                      }}
                      className="text-[9px] font-black text-red-400 flex items-center gap-1 uppercase hover:underline"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleTeamSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Team Name</label>
                      <input
                        type="text"
                        placeholder="Bengaluru Royals"
                        value={teamForm.name}
                        onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Team Logo URL</label>
                      <input
                        type="text"
                        placeholder="Image URL link"
                        value={teamForm.logo}
                        onChange={(e) => setTeamForm({ ...teamForm, logo: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Auction Budget Purse (in Lakhs / L)</label>
                    <input
                      type="number"
                      placeholder="1500"
                      value={teamForm.purse}
                      onChange={(e) => setTeamForm({ ...teamForm, purse: Number(e.target.value) })}
                      required
                      className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  {/* Assign Captains if editing */}
                  {editingTeamId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Select Captain</label>
                        <select
                          value={teamForm.captainId}
                          onChange={(e) => setTeamForm({ ...teamForm, captainId: e.target.value })}
                          className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none"
                        >
                          <option value="">-- Choose --</option>
                          {players.filter(p => teamForm.playerIds.includes(p.id)).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Select Vice-Captain</label>
                        <select
                          value={teamForm.viceCaptainId}
                          onChange={(e) => setTeamForm({ ...teamForm, viceCaptainId: e.target.value })}
                          className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none"
                        >
                          <option value="">-- Choose --</option>
                          {players.filter(p => teamForm.playerIds.includes(p.id)).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="bg-[#EAB308] hover:bg-[#CA8A04] text-dark-950 text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-xl">
                    {editingTeamId ? 'Update Team Roster' : 'Register Franchise'}
                  </button>
                </form>
              </div>

              {/* Franchise list */}
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Registered Teams ({teams.length})</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {teams.map(t => (
                    <div key={t.id} className="flex justify-between items-center bg-[#070A12] p-4 rounded-xl border border-[#161F38]">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <img src={t.logo} alt="" className="w-10 h-10 object-contain bg-[#111625] p-1.5 rounded-lg border border-dark-800" />
                        <div>
                          <h4 className="font-bold text-white uppercase tracking-wider">{t.name}</h4>
                          <span className="text-[9px] text-[#8495B0] font-bold uppercase block mt-1">Purse: {t.purse}L • {t.players?.length || 0} Athletes</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingTeamId(t.id);
                            setTeamForm({
                              name: t.name,
                              logo: t.logo,
                              purse: t.purse,
                              playerIds: t.players || [],
                              captainId: t.captainId || '',
                              viceCaptainId: t.viceCaptainId || ''
                            });
                          }}
                          className="p-1.5 bg-[#0F1326] hover:bg-[#1E2543] text-purple-400 hover:text-white rounded-lg border border-[#1E2543]"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(t.id)}
                          className="p-1.5 bg-red-950/15 hover:bg-red-950/30 text-red-400 rounded-lg border border-red-950/20"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              E. TOURNAMENTS TAB (Leagues Registry)
             ========================================== */}
          {sidebarTab === 'tournaments' && (
            <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
              
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#161F38] pb-3 mb-1">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Trophy className="h-4.5 w-4.5 text-[#EAB308]" />
                      <span>{editingTournamentId ? 'Edit Tournament Details' : 'Create New Tournament'}</span>
                    </h2>
                    <p className="text-[10px] text-[#8495B0] uppercase font-semibold mt-0.5">Initialize leagues, rules, and participant parameters</p>
                  </div>
                  {editingTournamentId && (
                    <button
                      onClick={() => {
                        setEditingTournamentId(null);
                        setTournamentForm({ name: '', logo: '', sport: 'cricket', rules: '', teamIds: [] });
                      }}
                      className="text-[9px] font-black text-red-400 flex items-center gap-1 uppercase hover:underline"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleTournamentSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Tournament Name</label>
                      <input
                        type="text"
                        placeholder="Lakshmish Gold League 2026"
                        value={tournamentForm.name}
                        onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5 font-sans">Sport Format</label>
                      <select
                        value={tournamentForm.sport}
                        onChange={(e) => setTournamentForm({ ...tournamentForm, sport: e.target.value as any })}
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="cricket">Cricket</option>
                        <option value="kabaddi">Kabaddi</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Tournament Logo URL</label>
                      <input
                        type="text"
                        placeholder="Image URL link"
                        value={tournamentForm.logo}
                        onChange={(e) => setTournamentForm({ ...tournamentForm, logo: e.target.value })}
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Select Franchises (Participating Teams)</label>
                      <div className="bg-[#070A12] border border-[#161F38] rounded-xl p-3 max-h-24 overflow-y-auto space-y-1.5">
                        {teams.map(team => (
                          <label key={team.id} className="flex items-center space-x-2 text-xs text-white">
                            <input
                              type="checkbox"
                              checked={tournamentForm.teamIds.includes(team.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTournamentForm(prev => ({ ...prev, teamIds: [...prev.teamIds, team.id] }));
                                } else {
                                  setTournamentForm(prev => ({ ...prev, teamIds: prev.teamIds.filter(id => id !== team.id) }));
                                }
                              }}
                              className="rounded border-[#161F38]"
                            />
                            <span>{team.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Leagues Rules / Guidelines</label>
                    <textarea
                      placeholder="Enter league boundaries, formats, or match rules details"
                      value={tournamentForm.rules}
                      onChange={(e) => setTournamentForm({ ...tournamentForm, rules: e.target.value })}
                      className="w-full h-20 bg-[#070A12] border border-[#161F38] text-xs rounded-xl p-3 text-white focus:outline-none focus:border-purple-500/50 resize-none"
                    />
                  </div>

                  <button type="submit" className="bg-[#EAB308] hover:bg-[#CA8A04] text-dark-950 text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-xl">
                    {editingTournamentId ? 'Update Tournament Details' : 'Create Tournament'}
                  </button>
                </form>
              </div>

              {/* Tournament list */}
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Active Tournaments ({tournaments.length})</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {tournaments.map(t => (
                    <div key={t.id} className="flex justify-between items-center bg-[#070A12] p-4 rounded-xl border border-[#161F38]">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <img src={t.logo} alt="" className="w-10 h-10 object-contain bg-[#111625] p-1.5 rounded-lg border border-[#232F52]" />
                        <div>
                          <h4 className="font-bold text-white uppercase tracking-wider">{t.name}</h4>
                          <span className="text-[9px] text-[#8495B0] font-bold uppercase block mt-1">{t.sport} | {t.teams?.length || 0} Participant Teams</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingTournamentId(t.id);
                            setTournamentForm({
                              name: t.name,
                              logo: t.logo,
                              sport: t.sport,
                              rules: t.rules || '',
                              teamIds: t.teams || []
                            });
                          }}
                          className="p-1.5 bg-[#0F1326] hover:bg-[#1E2543] text-purple-400 hover:text-white rounded-lg border border-[#1E2543]"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTournament(t.id)}
                          className="p-1.5 bg-red-950/15 hover:bg-red-950/30 text-red-400 rounded-lg border border-red-950/20"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              F. BRANDING TAB (Sponsors Registry)
             ========================================== */}
          {sidebarTab === 'branding' && (
            <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
              
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 border-b border-[#161F38] pb-3 flex items-center gap-2">
                  <FileImage className="h-4.5 w-4.5 text-[#EAB308]" />
                  <span>Register Overlay Sponsor / Banner</span>
                </h3>

                <form onSubmit={handleSponsorSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#8495B0] mb-1.5">Sponsor Brand Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Dream11"
                        value={sponsorForm.name}
                        onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#8495B0] mb-1.5">Sponsor Logo URL</label>
                      <input
                        type="text"
                        placeholder="Image URL link"
                        value={sponsorForm.logo}
                        onChange={(e) => setSponsorForm({ ...sponsorForm, logo: e.target.value })}
                        required
                        className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#8495B0] mb-1.5">Sponsor Destination Website</label>
                    <input
                      type="text"
                      placeholder="https://brand-domain.com"
                      value={sponsorForm.link}
                      onChange={(e) => setSponsorForm({ ...sponsorForm, link: e.target.value })}
                      className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <button type="submit" className="bg-[#EAB308] hover:bg-[#CA8A04] text-dark-950 text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-xl">
                    Register Sponsor
                  </button>
                </form>
              </div>

              {/* Sponsor list */}
              <div className="bg-[#0D111E] border border-[#161F38] p-6 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Registered Sponsors ({sponsors.length})</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  {sponsors.map(sp => (
                    <div key={sp.id} className="flex justify-between items-center bg-[#070A12] p-3 rounded-xl border border-[#161F38] text-xs">
                      <div className="flex items-center space-x-3.5">
                        <img src={sp.logo} alt="" className="w-8 h-8 object-contain bg-[#111625] p-1.5 rounded-lg border border-dark-800" />
                        <div>
                          <span className="text-xs text-white font-bold uppercase">{sp.name}</span>
                          <span className="text-[8px] text-dark-500 block truncate max-w-[200px] mt-0.5">{sp.link}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteSponsor(sp.id)}
                        className="p-1.5 bg-red-950/15 hover:bg-red-950/30 text-red-400 rounded-lg border border-red-950/20"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              G. CAMERAS TAB (Broadcasting Streams)
             ========================================== */}
          {sidebarTab === 'cameras' && (
            <div className="p-6 space-y-6 animate-fadeIn">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl max-w-4xl">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4.5 h-4.5 text-[#EAB308]" />
                    <span>WebRTC Discovery Stream node</span>
                  </h3>
                  <p className="text-[9px] text-[#8495B0] mt-1.5 uppercase font-semibold">
                    Set your local base IP discovery address so camera streams can hook into this gateway.
                  </p>
                </div>
                
                <div className="w-full sm:w-64">
                  <label className="block text-[8px] font-bold text-[#A78BFA] uppercase tracking-widest mb-1.5">Discover Base URL</label>
                  <input
                    type="text"
                    value={localIp}
                    onChange={(e) => setLocalIp(e.target.value)}
                    placeholder="http://192.168.x.x:3000"
                    className="w-full bg-[#070A12] border border-[#161F38] text-xs rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              {/* Cameras Grid */}
              <div className="grid md:grid-cols-3 gap-6 max-w-7xl">
                <CameraStreamReceiver token="ground" name="ground" resolution="720p" baseUrl={localIp} />
                <CameraStreamReceiver token="commentary" name="commentary" resolution="720p" baseUrl={localIp} />
                <CameraStreamReceiver token="boundary" name="boundary" resolution="1080p" baseUrl={localIp} />
              </div>

              {/* Connected feeds logs */}
              <div className="bg-[#0D111E] border border-[#161F38] p-5 rounded-2xl max-w-4xl">
                <h3 className="text-xs font-black text-[#A78BFA] uppercase tracking-wider mb-4 border-b border-[#161F38] pb-2.5 flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  <span>WebRTC Node Diagnostic Channels</span>
                </h3>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activeSessions.length === 0 ? (
                    <p className="text-xs text-dark-500 italic py-2 text-center">No active camera streams registered on server.</p>
                  ) : (
                    activeSessions.map((session, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-[#070A12] p-2.5 rounded-xl border border-[#161F38] text-xs">
                        <div className="flex items-center space-x-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-bold text-white uppercase">{session.name} [{session.token}]</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-[10px] text-dark-400 font-mono">{session.resolution}</span>
                          <span className="text-[9px] font-extrabold px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">{session.status.toUpperCase()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
