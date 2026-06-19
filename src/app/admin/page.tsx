'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match, Tournament, Team, Player, Sponsor } from '@/lib/db';
import { Shield, Play, PlusCircle, CheckCircle, Database, Lock, Trophy, Users, UserPlus, FileImage, Trash2, Camera } from 'lucide-react';
import CameraStreamReceiver from '@/components/admin/CameraStreamReceiver';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Lists
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  // Form States
  const [activeForm, setActiveForm] = useState<'match' | 'tournament' | 'team' | 'player' | 'sponsor' | 'camera'>('match');
  const [localIp, setLocalIp] = useState('http://localhost:3000');
  const [successBanner, setSuccessBanner] = useState('');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  // 1. Match Form State
  const [matchForm, setMatchForm] = useState({
    tournamentId: '',
    sport: 'cricket',
    teamAId: '',
    teamBId: '',
    date: ''
  });

  // 2. Tournament Form State
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    logo: '',
    sport: 'cricket',
    rules: '',
    teamIds: [] as string[]
  });

  // 3. Team Form State
  const [teamForm, setTeamForm] = useState({
    name: '',
    logo: '',
    purse: 1500,
    playerIds: [] as string[],
    captainId: '',
    viceCaptainId: ''
  });

  // 4. Player Form State
  const [playerForm, setPlayerForm] = useState({
    name: '',
    photo: '',
    role: 'Batsman',
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium fast',
    auctionBaseValue: 100
  });

  // 5. Sponsor Form State
  const [sponsorForm, setSponsorForm] = useState({
    name: '',
    logo: '',
    link: '#'
  });

  useEffect(() => {
    // Check local storage session authorization
    const auth = localStorage.getItem('lce_admin_auth');
    if (auth === 'true') {
      setAuthorized(true);
      fetchAdminData();
    }
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

  useEffect(() => {
    if (activeForm !== 'camera') return;
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
  }, [activeForm]);

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
      if (Array.isArray(resTournaments)) setTournaments(resTournaments);
      if (Array.isArray(resTeams)) setTeams(resTeams);
      if (Array.isArray(resPlayers)) setPlayers(resPlayers);
      if (Array.isArray(resSponsors)) setSponsors(resSponsors);
    } catch (err) {
      console.error(err);
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase === 'admin123') {
      setAuthorized(true);
      localStorage.setItem('lce_admin_auth', 'true');
      setErrorMsg('');
      fetchAdminData();
    } else {
      setErrorMsg('Invalid administrative passphrase.');
    }
  };

  const triggerBanner = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(''), 3000);
  };

  // Submit Handlers
  const handleMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchForm)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      triggerBanner('Live Match successfully scheduled!');
      setMatchForm({ tournamentId: '', sport: 'cricket', teamAId: '', teamBId: '', date: '' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTournamentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tournamentForm)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      triggerBanner('Tournament successfully created!');
      setTournamentForm({ name: '', logo: '', sport: 'cricket', rules: '', teamIds: [] });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamForm)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      triggerBanner('Franchise Team successfully added!');
      setTeamForm({ name: '', logo: '', purse: 1500, playerIds: [], captainId: '', viceCaptainId: '' });
      fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePlayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerForm)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      triggerBanner('Player profile registered successfully!');
      setPlayerForm({ name: '', photo: '', role: 'Batsman', battingStyle: 'Right-hand bat', bowlingStyle: 'Right-arm medium fast', auctionBaseValue: 100 });
      fetchAdminData();
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

  if (!authorized) {
    return (
      <div className="flex flex-col min-h-screen justify-between bg-dark-950">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel border border-gold-500/25 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden bg-gradient-to-b from-dark-900 to-dark-950">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-24 h-24 bg-gold-500/5 rounded-full blur-2xl" />
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-gold-500/10 border border-gold-500/30 rounded-xl flex items-center justify-center text-gold-500 mb-3 shadow-lg">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold text-white uppercase tracking-wider">Scoring Administration</h1>
              <p className="text-xs text-dark-400 mt-1">Authenticate to access platform creation forms</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Administrative Passphrase</label>
                <input
                  type="password"
                  placeholder="Enter Passphrase (e.g. admin123)"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 focus:border-gold-500/50 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none placeholder-dark-500"
                />
              </div>
              
              {errorMsg && (
                <p className="text-xs font-semibold text-red-400 text-center">{errorMsg}</p>
              )}

              <button
                type="submit"
                className="w-full gold-gradient-bg hover:opacity-95 text-dark-950 font-bold py-2.5 rounded-lg text-sm transition-all"
              >
                Authenticate Session
              </button>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-dark-950">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gold-500/10 pb-4 mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Shield className="h-8 w-8 text-gold-500" />
              <span>Admin <span className="gold-gradient-text">Console</span></span>
            </h1>
            <p className="text-xs text-dark-400 mt-1">Configure matches, brackets, register players, and control live scorers</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('lce_admin_auth');
              setAuthorized(false);
            }}
            className="text-xs font-bold text-red-400 hover:underline border border-red-500/20 px-3 py-1 rounded bg-red-950/10"
          >
            Lock Session
          </button>
        </div>

        {successBanner && (
          <div className="mb-6 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg text-sm text-center font-bold">
            {successBanner}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Controls & Forms */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Form Selection Tabs */}
            <div className="flex flex-wrap gap-2 bg-dark-900/60 p-1 rounded-lg border border-dark-850">
              {([
                { id: 'match', label: 'Match', icon: Play },
                { id: 'tournament', label: 'Tournament', icon: Trophy },
                { id: 'team', label: 'Team', icon: Users },
                { id: 'player', label: 'Player', icon: UserPlus },
                { id: 'sponsor', label: 'Sponsor', icon: FileImage },
                { id: 'camera', label: 'Camera Connect', icon: Camera }
              ] as const).map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveForm(tab.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                      activeForm === tab.id
                        ? 'gold-gradient-bg text-dark-950'
                        : 'text-dark-400 hover:text-white hover:bg-dark-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Forms */}
            <div className="glass-panel p-6 rounded-xl border-gold-500/10 bg-dark-900/10">
              
              {/* Match creation form */}
              {activeForm === 'match' && (
                <form onSubmit={handleMatchSubmit} className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Schedule New Fixture</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Select Tournament</label>
                      <select
                        value={matchForm.tournamentId}
                        onChange={(e) => setMatchForm({ ...matchForm, tournamentId: e.target.value })}
                        required
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
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
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
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
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
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
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
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
                      className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  <button type="submit" className="gold-gradient-bg text-dark-950 text-xs font-bold uppercase tracking-wider py-2 px-5 rounded-lg">
                    Schedule Match
                  </button>
                </form>
              )}

              {/* Tournament creation form */}
              {activeForm === 'tournament' && (
                <form onSubmit={handleTournamentSubmit} className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Create New League</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">League Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Pro Kabaddi Season 1"
                        value={tournamentForm.name}
                        onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })}
                        required
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">League Logo URL</label>
                      <input
                        type="text"
                        placeholder="Image URL"
                        value={tournamentForm.logo}
                        onChange={(e) => setTournamentForm({ ...tournamentForm, logo: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Sport Format</label>
                      <select
                        value={tournamentForm.sport}
                        onChange={(e) => setTournamentForm({ ...tournamentForm, sport: e.target.value as any })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      >
                        <option value="cricket">Cricket</option>
                        <option value="kabaddi">Kabaddi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Teams to Register (Hold Ctrl/Cmd to Multi-select)</label>
                      <select
                        multiple
                        value={tournamentForm.teamIds}
                        onChange={(e) => {
                          const options = Array.from(e.target.selectedOptions).map(o => o.value);
                          setTournamentForm({ ...tournamentForm, teamIds: options });
                        }}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white h-24"
                      >
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Rules & Regulations</label>
                    <textarea
                      placeholder="Enter rules summary..."
                      value={tournamentForm.rules}
                      onChange={(e) => setTournamentForm({ ...tournamentForm, rules: e.target.value })}
                      className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white h-20"
                    />
                  </div>

                  <button type="submit" className="gold-gradient-bg text-dark-950 text-xs font-bold uppercase tracking-wider py-2 px-5 rounded-lg">
                    Create Tournament
                  </button>
                </form>
              )}

              {/* Team creation form */}
              {activeForm === 'team' && (
                <form onSubmit={handleTeamSubmit} className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Register Franchise Team</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Team Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Bangalore Royals"
                        value={teamForm.name}
                        onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                        required
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Team Logo URL</label>
                      <input
                        type="text"
                        placeholder="Image URL"
                        value={teamForm.logo}
                        onChange={(e) => setTeamForm({ ...teamForm, logo: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Purse (in Lakhs)</label>
                      <input
                        type="number"
                        placeholder="1500"
                        value={teamForm.purse}
                        onChange={(e) => setTeamForm({ ...teamForm, purse: Number(e.target.value) })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Select Roster (Hold Ctrl to Multi-select)</label>
                      <select
                        multiple
                        value={teamForm.playerIds}
                        onChange={(e) => {
                          const options = Array.from(e.target.selectedOptions).map(o => o.value);
                          setTeamForm({ ...teamForm, playerIds: options });
                        }}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white h-20"
                      >
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Captain</label>
                      <select
                        value={teamForm.captainId}
                        onChange={(e) => setTeamForm({ ...teamForm, captainId: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      >
                        <option value="">-- Choose --</option>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Vice Captain</label>
                      <select
                        value={teamForm.viceCaptainId}
                        onChange={(e) => setTeamForm({ ...teamForm, viceCaptainId: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      >
                        <option value="">-- Choose --</option>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="gold-gradient-bg text-dark-950 text-xs font-bold uppercase tracking-wider py-2 px-5 rounded-lg">
                    Add Franchise Team
                  </button>
                </form>
              )}

              {/* Player creation form */}
              {activeForm === 'player' && (
                <form onSubmit={handlePlayerSubmit} className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Register Player Profile</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Player Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Pawan Kumar"
                        value={playerForm.name}
                        onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                        required
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Profile Photo URL</label>
                      <input
                        type="text"
                        placeholder="Image Link"
                        value={playerForm.photo}
                        onChange={(e) => setPlayerForm({ ...playerForm, photo: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Specialization Role</label>
                      <select
                        value={playerForm.role}
                        onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      >
                        <option value="Batsman">Batsman</option>
                        <option value="Bowler">Bowler</option>
                        <option value="All-Rounder">All-Rounder (Cricket)</option>
                        <option value="Wicketkeeper">Wicketkeeper</option>
                        <option value="Raider">Raider (Kabaddi)</option>
                        <option value="Defender">Defender (Kabaddi)</option>
                        <option value="All-Rounder (Kabaddi)">All-Rounder (Kabaddi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Auction Base Price (in Lakhs)</label>
                      <input
                        type="number"
                        placeholder="100"
                        value={playerForm.auctionBaseValue}
                        onChange={(e) => setPlayerForm({ ...playerForm, auctionBaseValue: Number(e.target.value) })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Batting Style</label>
                      <input
                        type="text"
                        placeholder="Right-hand bat"
                        value={playerForm.battingStyle}
                        onChange={(e) => setPlayerForm({ ...playerForm, battingStyle: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Bowling Style</label>
                      <input
                        type="text"
                        placeholder="Right-arm fast medium"
                        value={playerForm.bowlingStyle}
                        onChange={(e) => setPlayerForm({ ...playerForm, bowlingStyle: e.target.value })}
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <button type="submit" className="gold-gradient-bg text-dark-950 text-xs font-bold uppercase tracking-wider py-2 px-5 rounded-lg">
                    Add Player Profile
                  </button>
                </form>
              )}

              {/* Sponsor Form */}
              {activeForm === 'sponsor' && (
                <form onSubmit={handleSponsorSubmit} className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Add Overlay Sponsor</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Sponsor Brand Name</label>
                      <input
                        type="text"
                        placeholder="e.g. TATA"
                        value={sponsorForm.name}
                        onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                        required
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Sponsor Logo URL</label>
                      <input
                        type="text"
                        placeholder="Image link"
                        value={sponsorForm.logo}
                        onChange={(e) => setSponsorForm({ ...sponsorForm, logo: e.target.value })}
                        required
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-1.5">Website Link</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={sponsorForm.link}
                      onChange={(e) => setSponsorForm({ ...sponsorForm, link: e.target.value })}
                      className="w-full bg-dark-950 border border-dark-800 text-xs rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  <button type="submit" className="gold-gradient-bg text-dark-950 text-xs font-bold uppercase tracking-wider py-2 px-5 rounded-lg">
                    Add Sponsor Banner
                  </button>

                  {/* Active Sponsors list */}
                  <div className="mt-6 border-t border-dark-800 pt-4">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-dark-400 mb-3">Active Sponsors</p>
                    <div className="space-y-2">
                      {sponsors.map(sp => (
                        <div key={sp.id} className="flex justify-between items-center bg-dark-950/40 p-2.5 rounded border border-dark-800">
                          <div className="flex items-center space-x-2">
                            <img src={sp.logo} alt="" className="w-5 h-5 object-contain" />
                            <span className="text-xs text-white font-bold">{sp.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSponsor(sp.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              )}

              {activeForm === 'camera' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-950/40 p-4 rounded-xl border border-dark-850">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">WebRTC Server Configuration</h3>
                      <p className="text-xs text-dark-400 mt-1">
                        Input your computer's local Wi-Fi IP address so your phone can discover this server.
                      </p>
                    </div>
                    
                    <div className="w-full sm:w-64">
                      <label className="block text-[8px] font-bold text-gold-450 uppercase tracking-widest mb-1">Local Base URL</label>
                      <input
                        type="text"
                        value={localIp}
                        onChange={(e) => setLocalIp(e.target.value)}
                        placeholder="http://192.168.x.x:3000"
                        className="w-full bg-dark-950 border border-dark-800 text-xs rounded px-3 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <CameraStreamReceiver
                      token="ground"
                      name="ground"
                      resolution="720p"
                      baseUrl={localIp}
                    />
                    <CameraStreamReceiver
                      token="commentary"
                      name="commentary"
                      resolution="720p"
                      baseUrl={localIp}
                    />
                    <CameraStreamReceiver
                      token="boundary"
                      name="boundary"
                      resolution="1080p"
                      baseUrl={localIp}
                    />
                  </div>

                  {/* Diagnostics: Active Server Sessions */}
                  <div className="glass-panel p-5 rounded-xl border border-dark-800 bg-dark-900/40">
                    <h3 className="text-xs font-extrabold uppercase text-gold-450 tracking-wider mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gold-500" />
                      <span>Active Server Camera Sessions (Admin Diagnostics)</span>
                    </h3>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activeSessions.length === 0 ? (
                        <p className="text-xs text-dark-500 italic py-2 text-center">No active camera sessions registered on server.</p>
                      ) : (
                        activeSessions.map((session, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-dark-950/60 p-2.5 rounded border border-dark-850 text-xs">
                            <div className="flex items-center space-x-3">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                              <div>
                                <span className="font-bold text-white uppercase">{session.name}</span>
                                <span className="text-[10px] text-dark-400 font-mono ml-2">[{session.token}]</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className="text-[10px] text-dark-400 uppercase font-semibold">{session.resolution}</span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                session.status === 'connected'
                                  ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-450 border border-amber-500/20'
                              }`}>
                                {session.status.toUpperCase()}
                              </span>
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

          {/* Active Scoring Controls Panel */}
          <div className="space-y-6">
            <div className="glass-panel p-5 rounded-xl border border-red-500/20 bg-red-950/5">
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Database className="h-4.5 w-4.5" />
                <span>Live Matches In Progress</span>
              </h2>

              <div className="space-y-3">
                {matches.filter(m => m.status === 'live').length === 0 ? (
                  <p className="text-xs text-dark-500 text-center py-4">No live matches scoring currently.</p>
                ) : (
                  matches.filter(m => m.status === 'live').map((match) => (
                    <div key={match.id} className="bg-dark-950/80 border border-dark-800 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="inline-block px-1.5 py-0.2 rounded text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 font-bold uppercase tracking-wider mb-1">
                          {match.sport}
                        </span>
                        <h4 className="text-xs font-bold text-white max-w-[140px] truncate">
                          {match.teamA.name} vs {match.teamB.name}
                        </h4>
                      </div>
                      
                      <Link
                        href={`/admin/score/${match.id}`}
                        className="bg-red-500 text-white hover:bg-red-600 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      >
                        Scorer
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Scheduled Matches */}
            <div className="glass-panel p-5 rounded-xl border border-dark-800">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Play className="h-4.5 w-4.5 text-gold-500" />
                <span>Scheduled Fixtures</span>
              </h2>

              <div className="space-y-3">
                {matches.filter(m => m.status === 'upcoming').length === 0 ? (
                  <p className="text-xs text-dark-500 text-center py-4">No scheduled fixtures pending.</p>
                ) : (
                  matches.filter(m => m.status === 'upcoming').map((match) => (
                    <div key={match.id} className="bg-dark-950/40 border border-dark-800 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="block text-[8px] text-dark-400 uppercase tracking-widest font-semibold">{match.date}</span>
                        <h4 className="text-xs font-bold text-white mt-0.5 max-w-[140px] truncate">
                          {match.teamA.name} vs {match.teamB.name}
                        </h4>
                      </div>
                      
                      <button
                        onClick={async () => {
                          const actionBody = {
                            action: 'update_general',
                            payload: { status: 'live' }
                          };
                          await fetch(`/api/matches/${match.id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(actionBody)
                          });
                          fetchAdminData();
                          triggerBanner('Match scoring initialized!');
                        }}
                        className="bg-gold-500 hover:opacity-90 text-dark-950 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      >
                        Start Live
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
