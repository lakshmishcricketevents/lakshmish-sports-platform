'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match, Player, Team } from '@/lib/db';
import { Play, Pause, RotateCcw, Shield, Undo2, CheckCircle2, Tv, ShieldAlert, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export default function ScorerConsole() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [isMobile, setIsMobile] = useState(false);

  // Cricket Selection Panel
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [wicketForm, setWicketForm] = useState({
    isOpen: false,
    type: 'bowled',
    batsmanId: ''
  });
  const [runsInput, setRunsInput] = useState<number>(0);
  const [extraInput, setExtraInput] = useState<'none' | 'wide' | 'noball' | 'legbye' | 'bye'>('none');

  // Timer Ref for Kabaddi
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Screen size check for mobile restriction
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                            || window.innerWidth < 768;
      setIsMobile(isMobileDevice);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Authentication & Role Enforcement
  useEffect(() => {
    async function verifyAccess() {
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
              
            const role = profile?.role || 'viewer';
            setUserRole(role);
            
            if (role !== 'admin' && role !== 'scorer') {
              const localAuth = localStorage.getItem('lce_admin_auth');
              if (localAuth === 'true') {
                setUserRole('admin');
              } else {
                router.push('/admin');
              }
            }
          } else {
            const localAuth = localStorage.getItem('lce_admin_auth');
            if (localAuth === 'true') {
              setUserRole('admin');
            } else {
              router.push('/admin');
            }
          }
        } catch (err) {
          console.error('Role verification failed:', err);
          router.push('/admin');
        }
      } else {
        const localAuth = localStorage.getItem('lce_admin_auth');
        if (localAuth === 'true') {
          setUserRole('admin');
        } else {
          router.push('/admin');
        }
      }
    }
    verifyAccess();
  }, [router]);

  useEffect(() => {
    async function loadData() {
      try {
        const [resMatch, resPlayers, resTeams] = await Promise.all([
          fetch(`/api/matches/${id}`).then(r => r.json()),
          fetch('/api/players').then(r => r.json()),
          fetch('/api/teams').then(r => r.json())
        ]);

        if (resMatch && !resMatch.error) {
          setMatch(resMatch);
          if (resMatch.cricketState) {
            setStrikerId(resMatch.cricketState.strikerId || '');
            setNonStrikerId(resMatch.cricketState.nonStrikerId || '');
            setBowlerId(resMatch.cricketState.currentBowlerId || '');
          }
        }
        if (Array.isArray(resPlayers)) setPlayers(resPlayers);
        if (Array.isArray(resTeams)) setTeams(resTeams);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id]);

  // Kabaddi Timer Interval Control
  useEffect(() => {
    if (match?.sport === 'kabaddi' && match.kabaddiState?.timerRunning) {
      timerRef.current = setInterval(() => {
        setMatch(prev => {
          if (!prev || !prev.kabaddiState) return prev;
          const time = prev.kabaddiState.timeRemaining - 1;
          
          if (time <= 0) {
            clearInterval(timerRef.current!);
            postTimerUpdate(0, false);
            return {
              ...prev,
              kabaddiState: { ...prev.kabaddiState, timeRemaining: 0, timerRunning: false }
            };
          }

          if (time % 10 === 0) {
            postTimerUpdate(time, true);
          }

          return {
            ...prev,
            kabaddiState: { ...prev.kabaddiState, timeRemaining: time }
          };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [match?.sport, match?.kabaddiState?.timerRunning]);

  const postTimerUpdate = async (timeRemaining: number, timerRunning: boolean) => {
    try {
      await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kabaddi_timer',
          payload: { timeRemaining, timerRunning }
        })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const refreshMatch = async () => {
    const res = await fetch(`/api/matches/${id}`);
    const data = await res.json();
    if (data && !data.error) {
      setMatch(data);
      if (data.cricketState) {
        setStrikerId(data.cricketState.strikerId || '');
        setNonStrikerId(data.cricketState.nonStrikerId || '');
        setBowlerId(data.cricketState.currentBowlerId || '');
      }
    }
  };

  // Cricket API Scorers
  const submitCricketBall = async () => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      alert('Please select Striker, Non-Striker, and Bowler first.');
      return;
    }

    let wicketData = null;
    if (wicketForm.isOpen && wicketForm.batsmanId) {
      wicketData = {
        type: wicketForm.type,
        batsmanId: wicketForm.batsmanId,
        batsmanName: players.find(p => p.id === wicketForm.batsmanId)?.name || 'Batsman'
      };
    }

    try {
      const res = await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cricket_ball',
          payload: {
            runs: runsInput,
            extraType: extraInput,
            wicket: wicketData,
            strikerId,
            nonStrikerId,
            bowlerId
          }
        })
      });
      await res.json();
      
      // Reset form variables
      setRunsInput(0);
      setExtraInput('none');
      setWicketForm({ isOpen: false, type: 'bowled', batsmanId: strikerId });
      refreshMatch();
    } catch (err) {
      console.error(err);
    }
  };

  const applyCricketPlayers = async () => {
    try {
      await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cricket_set_players',
          payload: { strikerId, nonStrikerId, bowlerId }
        })
      });
      refreshMatch();
      alert('Active players updated successfully.');
    } catch (err) {
      console.error(err);
    }
  };

  const swapCricketInnings = async () => {
    if (!confirm('Are you sure you want to end this innings and swap batting/bowling sides?')) return;
    try {
      await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cricket_swap_innings' })
      });
      refreshMatch();
    } catch (err) {
      console.error(err);
    }
  };

  const undoCricketAction = async () => {
    try {
      await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cricket_undo' })
      });
      refreshMatch();
    } catch (err) {
      console.error(err);
    }
  };

  // Kabaddi API Scorers
  const addKabaddiPoints = async (type: string, teamId: string, points: number, desc?: string) => {
    try {
      await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kabaddi_points',
          payload: { type, teamId, points, description: desc }
        })
      });
      refreshMatch();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleKabaddiTimer = async () => {
    if (!match || !match.kabaddiState) return;
    const nextRunning = !match.kabaddiState.timerRunning;
    postTimerUpdate(match.kabaddiState.timeRemaining, nextRunning);
    setMatch({
      ...match,
      kabaddiState: { ...match.kabaddiState, timerRunning: nextRunning }
    });
  };

  const resetKabaddiTimer = async () => {
    if (!match || !match.kabaddiState) return;
    if (!confirm('Reset timer to 40 minutes?')) return;
    postTimerUpdate(2400, false);
    setMatch({
      ...match,
      kabaddiState: { ...match.kabaddiState, timeRemaining: 2400, timerRunning: false }
    });
  };

  const undoKabaddiAction = async () => {
    try {
      await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kabaddi_undo' })
      });
      refreshMatch();
    } catch (err) {
      console.error(err);
    }
  };

  // Complete match and declare winner
  const completeMatch = async () => {
    if (!match) return;
    const winnerName = prompt(`Declare Match Winner! Type 'A' for ${match.teamA.name}, 'B' for ${match.teamB.name}, or leave blank for a Tie/Draw:`);
    let winnerId = undefined;
    if (winnerName?.toUpperCase() === 'A') winnerId = match.teamA.id;
    if (winnerName?.toUpperCase() === 'B') winnerId = match.teamB.id;

    try {
      await fetch(`/api/matches/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_general',
          payload: {
            status: 'completed',
            winnerId
          }
        })
      });
      
      const tournamentRes = await fetch('/api/tournaments');
      const tournaments = await tournamentRes.json();
      const currentTourney = tournaments.find((t: any) => t.id === match.tournamentId);

      if (currentTourney) {
        const newTable = currentTourney.pointsTable.map((teamEntry: any) => {
          if (teamEntry.teamId === match.teamA.id || teamEntry.teamId === match.teamB.id) {
            const didWin = winnerId === teamEntry.teamId;
            const didTie = winnerId === undefined;

            return {
              ...teamEntry,
              played: teamEntry.played + 1,
              won: teamEntry.won + (didWin ? 1 : 0),
              lost: teamEntry.lost + (!didWin && !didTie ? 1 : 0),
              tied: teamEntry.tied + (didTie ? 1 : 0),
              points: teamEntry.points + (didWin ? 2 : didTie ? 1 : 0)
            };
          }
          return teamEntry;
        });

        await fetch(`/api/tournaments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: match.tournamentId,
            pointsTable: newTable
          })
        });
      }

      router.push(`/matches/${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Player';
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#05070f] text-white">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-neon-yellow border-r-transparent" />
        </div>
        <Footer />
      </div>
    );
  }

  // Mobile Check Enforcement: If the user's role is 'scorer' (not admin), block desktop scoring
  if (userRole === 'scorer' && !isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-[#05070f] text-white justify-between">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel border-red-500/35 rounded-2xl p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto w-14 h-14 bg-red-950/30 border border-red-500/40 rounded-2xl flex items-center justify-center text-red-400 shadow-lg">
              <Smartphone className="h-8 w-8 animate-bounce" />
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-wider">Mobile Only Access</h1>
            <p className="text-xs text-dark-350 leading-relaxed uppercase">
              As a Scorer, you are restricted to updating match scores via mobile phone. Please open this page on your phone or tablet.
            </p>
            <div className="pt-2">
              <Link href="/" className="text-xs font-extrabold text-neon-yellow hover:underline uppercase tracking-widest">
                Return to Home
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not authorized screen
  if (userRole === 'viewer') {
    return (
      <div className="flex flex-col min-h-screen bg-[#05070f] text-white justify-between">
        <Navbar />
        <main className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel border-red-500/35 rounded-2xl p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto w-14 h-14 bg-red-950/30 border border-red-500/40 rounded-2xl flex items-center justify-center text-red-400">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-black text-white uppercase tracking-wider">Unauthorized Access</h1>
            <p className="text-xs text-dark-350 leading-relaxed uppercase">
              Your account role is Viewer. Viewers do not have scoring permissions.
            </p>
            <div className="pt-2">
              <Link href="/admin" className="text-xs font-extrabold text-neon-yellow hover:underline uppercase tracking-widest">
                Scoring Login Panel
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col min-h-screen bg-[#05070f] text-white justify-between">
        <Navbar />
        <div className="flex-grow flex items-center justify-center p-8">
          <p className="text-xl font-bold text-red-400">Match scoring console failed to load.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const isCricket = match.sport === 'cricket';
  const cState = match.cricketState;
  const kState = match.kabaddiState;

  const teamAPlayers = players.filter(p => {
    const team = teams.find(t => t.id === match.teamA.id);
    return team?.players.includes(p.id);
  });

  const teamBPlayers = players.filter(p => {
    const team = teams.find(t => t.id === match.teamB.id);
    return team?.players.includes(p.id);
  });

  const battingPlayers = cState?.battingTeamId === match.teamA.id ? teamAPlayers : teamBPlayers;
  const bowlingPlayers = cState?.bowlingTeamId === match.teamA.id ? teamAPlayers : teamBPlayers;

  return (
    <div className="flex flex-col min-h-screen bg-[#05070f] text-white">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Match Header Info */}
        <div className="glass-panel p-5 border-neon-yellow/20 neon-glow rounded-xl mb-8 flex flex-wrap justify-between items-center bg-gradient-to-r from-dark-900 to-[#05070f] gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-neon-yellow tracking-widest">Scoring Engine Console ({userRole})</span>
            <h1 className="text-lg font-bold text-white mt-1">
              {match.teamA.name} <span className="text-neon-yellow">vs</span> {match.teamB.name}
            </h1>
            <p className="text-xs text-dark-400">Active Cricket/Kabaddi scoring link.</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={isCricket ? undoCricketAction : undoKabaddiAction}
              className="flex items-center space-x-1 border border-dark-800 hover:border-neon-yellow/30 text-dark-300 hover:text-neon-yellow px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Undo2 className="h-4 w-4" />
              <span>Undo Last Ball</span>
            </button>

            <button
              onClick={completeMatch}
              className="flex items-center space-x-1.5 bg-[#EEF824] text-dark-950 px-4 py-1.5 rounded-lg text-xs font-black shadow-lg shadow-neon-yellow/10 hover:opacity-90 transition-all uppercase tracking-wider"
            >
              <CheckCircle2 className="h-4.5 w-4.5" />
              <span>Complete Match</span>
            </button>
          </div>
        </div>

        {/* Cricket Scoring Panel */}
        {isCricket && cState && (
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Control panel col-span-2 */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Score card summary display */}
              <div className="glass-panel p-5 rounded-xl border-neon-yellow/20 neon-glow bg-dark-900/20 text-center">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase text-neon-yellow tracking-wider">Innings {cState.runs > 0 ? cState.innings : 1} Status</span>
                  <span className="text-xs text-dark-400 font-bold">{cState.overs}.{cState.balls} Overs</span>
                </div>
                <p className="text-5xl font-black text-white my-3">
                  {cState.runs}<span className="text-neon-yellow">/</span>{cState.wickets}
                </p>
                {cState.targetRuns && (
                  <p className="text-xs text-neon-yellow font-bold">
                    Target Score: {cState.targetRuns} | Need {cState.targetRuns - cState.runs} runs to win
                  </p>
                )}
              </div>

              {/* Set striker/non-striker/bowler panel */}
              <div className="glass-panel p-5 rounded-xl border-dark-800 space-y-4">
                <h3 className="text-xs font-extrabold uppercase text-neon-yellow tracking-widest border-b border-dark-800 pb-2">Active Field Selections</h3>
                
                <div className="grid sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-dark-450 mb-1.5">Striker</label>
                    <select
                      value={strikerId}
                      onChange={(e) => setStrikerId(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-850 rounded px-2 py-1.5 text-white focus:border-neon-yellow"
                    >
                      <option value="">-- Choose Batsman --</option>
                      {battingPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-dark-450 mb-1.5">Non-Striker</label>
                    <select
                      value={nonStrikerId}
                      onChange={(e) => setNonStrikerId(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-850 rounded px-2 py-1.5 text-white focus:border-neon-yellow"
                    >
                      <option value="">-- Choose Batsman --</option>
                      {battingPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-dark-450 mb-1.5">Active Bowler</label>
                    <select
                      value={bowlerId}
                      onChange={(e) => setBowlerId(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-850 rounded px-2 py-1.5 text-white focus:border-neon-yellow"
                    >
                      <option value="">-- Choose Bowler --</option>
                      {bowlingPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={applyCricketPlayers}
                    className="bg-dark-900 border border-neon-yellow/20 text-neon-yellow text-xs px-4 py-2 rounded font-bold hover:bg-dark-850"
                  >
                    Apply Players
                  </button>
                  <button
                    onClick={swapCricketInnings}
                    className="bg-neon-yellow/10 border border-neon-yellow/30 text-neon-yellow text-xs px-4 py-2 rounded font-bold hover:bg-neon-yellow/20"
                  >
                    Swap Innings
                  </button>
                </div>
              </div>

              {/* Thumb-Optimized Large scoring controls for mobile one-hand use */}
              <div className="glass-panel p-5 rounded-xl border-neon-yellow/20 neon-glow space-y-6">
                <div className="border-b border-dark-850 pb-2 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-neon-yellow tracking-widest">Mobile One-Hand Scoring Panel</h3>
                  <span className="text-[9px] bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Reach Configured</span>
                </div>
                
                {/* 1. Large Circular Runs buttons */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-dark-400 mb-2.5">Runs scored off this delivery</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2, 3, 4, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setRunsInput(num)}
                        className={`h-16 rounded-xl font-black text-2xl border transition-all flex items-center justify-center active:scale-95 ${
                          runsInput === num
                            ? 'neon-gradient-bg text-dark-950 border-neon-yellow neon-glow shadow-lg'
                            : 'bg-dark-950 text-white border-dark-800 hover:border-neon-yellow/40'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Large Extras selector */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-dark-400 mb-2.5">Extras types</label>
                  <div className="grid grid-cols-5 gap-2">
                    {(['none', 'wide', 'noball', 'legbye', 'bye'] as const).map((ext) => (
                      <button
                        key={ext}
                        onClick={() => setExtraInput(ext)}
                        className={`py-3.5 rounded-lg text-xs font-extrabold border transition-all uppercase tracking-widest text-center ${
                          extraInput === ext
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-inner'
                            : 'bg-dark-950 text-dark-300 border-dark-800'
                        }`}
                      >
                        {ext}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Wickets dismissal section */}
                <div className="border-t border-dark-850 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-white">Wicket fall off this ball?</span>
                    <button
                      type="button"
                      onClick={() => setWicketForm(prev => ({ ...prev, isOpen: !prev.isOpen, batsmanId: strikerId }))}
                      className={`px-4 py-2.5 rounded-lg text-xs font-black border uppercase tracking-widest transition-all ${
                        wicketForm.isOpen
                          ? 'bg-red-600 border-red-600 text-white shadow-lg'
                          : 'bg-dark-950 text-red-500 border-red-500/30'
                      }`}
                    >
                      {wicketForm.isOpen ? 'Active Dismissal' : 'No Wicket'}
                    </button>
                  </div>

                  {wicketForm.isOpen && (
                    <div className="grid grid-cols-2 gap-4 mt-3.5 bg-dark-950/60 p-4 rounded-xl border border-dark-850 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-dark-400 mb-1.5 uppercase">Dismissal Type</label>
                        <select
                          value={wicketForm.type}
                          onChange={(e) => setWicketForm({ ...wicketForm, type: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-800 rounded-lg p-2 text-white"
                        >
                          <option value="bowled">Bowled</option>
                          <option value="caught">Caught</option>
                          <option value="lbw">LBW</option>
                          <option value="runout">Run Out</option>
                          <option value="stumped">Stumped</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-dark-400 mb-1.5 uppercase">Out batsman</label>
                        <select
                          value={wicketForm.batsmanId}
                          onChange={(e) => setWicketForm({ ...wicketForm, batsmanId: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-800 rounded-lg p-2 text-white"
                        >
                          <option value={strikerId}>Striker ({getPlayerName(strikerId)})</option>
                          <option value={nonStrikerId}>Non-Striker ({getPlayerName(nonStrikerId)})</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Giant Submit button */}
                <button
                  onClick={submitCricketBall}
                  className="w-full neon-gradient-bg hover:opacity-95 text-dark-950 font-black text-base py-4 rounded-xl transition-all shadow-lg shadow-neon-yellow/20 uppercase tracking-widest active:scale-98"
                >
                  Confirm Ball Delivery
                </button>
              </div>

            </div>

            {/* Ball Logs sidebar on desktop */}
            <div className="space-y-4">
              <div className="glass-panel p-5 rounded-xl border border-dark-800 max-h-96 overflow-y-auto">
                <h3 className="text-xs font-extrabold uppercase text-neon-yellow border-b border-dark-800 pb-2 mb-3">Ball History Log</h3>
                <div className="space-y-2.5 text-xs">
                  {match.ballByBall && [...match.ballByBall].reverse().slice(0, 10).map((b, i) => (
                    <div key={i} className="flex justify-between items-center bg-dark-950/50 p-2 rounded border border-dark-850">
                      <div>
                        <span className="font-bold text-neon-yellow mr-2">{b.overNum}.{b.ballNum}</span>
                        <span className="text-white font-medium">{b.batsmanName} ({b.runs}R)</span>
                      </div>
                      <span className="text-[10px] text-dark-400">{b.extraType !== 'none' ? b.extraType : ''} {b.wicket ? 'W' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Kabaddi Scoring Panel */}
        {match.sport === 'kabaddi' && kState && (
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Kabaddi center controls */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Large Score & Timer Panel */}
              <div className="glass-panel p-6 rounded-xl border border-neon-yellow/20 bg-dark-900/10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-12 -mr-12 w-32 h-32 bg-neon-yellow/5 rounded-full blur-2xl" />

                <div className="flex items-center justify-center space-x-8 sm:space-x-12">
                  <div>
                    <h3 className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-1.5">{match.teamA.name}</h3>
                    <p className="text-5xl font-black text-white">{kState.scoreA}</p>
                  </div>
                  <div className="text-2xl font-bold text-neon-yellow/60">:</div>
                  <div>
                    <h3 className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-1.5">{match.teamB.name}</h3>
                    <p className="text-5xl font-black text-white">{kState.scoreB}</p>
                  </div>
                </div>

                {/* Match Clock timer controls */}
                <div className="mt-6 border-t border-dark-850/80 pt-5 max-w-sm mx-auto flex flex-col items-center">
                  <div className="flex items-center space-x-2 bg-dark-950/80 border border-dark-800 rounded-full px-5 py-2 mb-4">
                    <span className="h-2 w-2 bg-red-500 rounded-full animate-ping" />
                    <span className="text-2xl font-mono font-extrabold text-white tracking-widest">
                      {Math.floor(kState.timeRemaining / 60)}:{(kState.timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={toggleKabaddiTimer}
                      className={`flex items-center space-x-1.5 px-5 py-2 rounded-lg text-xs font-extrabold transition-all uppercase tracking-wider ${
                        kState.timerRunning
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                          : 'bg-neon-yellow text-dark-950 hover:opacity-90'
                      }`}
                    >
                      {kState.timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      <span>{kState.timerRunning ? 'Pause Clock' : 'Start Clock'}</span>
                    </button>
                    <button
                      onClick={resetKabaddiTimer}
                      className="border border-dark-800 hover:border-neon-yellow/20 text-dark-300 hover:text-neon-yellow p-2 rounded-lg"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-dark-850/60 text-center">
                  <Link
                    href={`/matches/${match.id}/kabaddi`}
                    target="_blank"
                    className="inline-flex items-center space-x-1.5 bg-neon-yellow/10 hover:bg-neon-yellow/20 text-[#fbbf24] border border-neon-yellow/20 hover:border-neon-yellow px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-md"
                  >
                    <Tv className="h-4 w-4 text-neon-yellow" />
                    <span>Launch PKL Broadcast Scoreboard</span>
                  </Link>
                </div>

              </div>

              {/* Point allocation matrix */}
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Team A Point Controls */}
                <div className="glass-panel p-5 rounded-xl border-neon-yellow/10 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase text-neon-yellow tracking-widest border-b border-dark-850 pb-2">
                    {match.teamA.name} Points
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-white">
                    <button
                      onClick={() => addKabaddiPoints('raid_success', match.teamA.id, 1, `Touch point scored by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded"
                    >
                      Raid Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('bonus', match.teamA.id, 1, `Bonus point secured by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded text-amber-450"
                    >
                      Bonus Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('raid_tackled', match.teamA.id, 1, `Tackle point secured by Defense.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded"
                    >
                      Tackle Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('super_tackle', match.teamA.id, 2, `Super Tackle completed on Raider!`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded text-neon-yellow"
                    >
                      Super Tackle (+2)
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => addKabaddiPoints('all_out', match.teamA.id, 2, `ALL OUT enforced on opponent!`)}
                      className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 text-xs font-bold py-2 rounded hover:bg-emerald-500/20"
                    >
                      All Out (+2)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('technical', match.teamA.id, 1, `Technical penalty awarded.`)}
                      className="w-full bg-dark-950 border border-dark-800 text-xs text-dark-300 py-2 rounded"
                    >
                      Technical (+1)
                    </button>
                  </div>
                </div>

                {/* Team B Point Controls */}
                <div className="glass-panel p-5 rounded-xl border-neon-yellow/10 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase text-neon-yellow tracking-widest border-b border-dark-850 pb-2">
                    {match.teamB.name} Points
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-white">
                    <button
                      onClick={() => addKabaddiPoints('raid_success', match.teamB.id, 1, `Touch point scored by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded"
                    >
                      Raid Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('bonus', match.teamB.id, 1, `Bonus point secured by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded text-amber-450"
                    >
                      Bonus Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('raid_tackled', match.teamB.id, 1, `Tackle point secured by Defense.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded"
                    >
                      Tackle Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('super_tackle', match.teamB.id, 2, `Super Tackle completed on Raider!`)}
                      className="bg-dark-950 border border-dark-800 hover:border-neon-yellow/30 p-2.5 rounded text-neon-yellow"
                    >
                      Super Tackle (+2)
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => addKabaddiPoints('all_out', match.teamB.id, 2, `ALL OUT enforced on opponent!`)}
                      className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-450 text-xs font-bold py-2 rounded hover:bg-emerald-500/20"
                    >
                      All Out (+2)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('technical', match.teamB.id, 1, `Technical penalty awarded.`)}
                      className="w-full bg-dark-950 border border-dark-800 text-xs text-dark-300 py-2 rounded"
                    >
                      Technical (+1)
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Actions Timeline sidebar */}
            <div className="space-y-4">
              <div className="glass-panel p-5 rounded-xl border border-dark-800 max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center border-b border-dark-850 pb-2 mb-3">
                  <h3 className="text-xs font-extrabold uppercase text-neon-yellow">Match Actions Timeline</h3>
                  <button onClick={undoKabaddiAction} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase">Undo</button>
                </div>
                <div className="space-y-2.5 text-xs">
                  {match.kabaddiActions && [...match.kabaddiActions].reverse().slice(0, 10).map((act, i) => (
                    <div key={i} className="bg-dark-950/50 p-2 rounded border border-dark-850">
                      <div className="flex justify-between">
                        <span className="font-bold text-neon-yellow">{Math.floor(act.timeRemaining / 60)}:{(act.timeRemaining % 60).toString().padStart(2, '0')}</span>
                        <span className="font-bold text-emerald-455">+{act.points} pts</span>
                      </div>
                      <p className="text-dark-300 text-[10px] mt-0.5">{act.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
