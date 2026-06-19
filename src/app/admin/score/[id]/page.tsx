'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match, Player, Team } from '@/lib/db';
import { Play, Pause, RotateCcw, Shield, RotateCw, Undo2, Award, CheckCircle2, ChevronRight, User, Tv } from 'lucide-react';
import Link from 'next/link';

export default function ScorerConsole() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Cricket Selection Panel
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [wicketForm, setWicketForm] = useState({
    isOpen: false,
    type: 'bowled',
    batsmanId: ''
  });
  const [runsInput, setRunsInput] = useState(0);
  const [extraInput, setExtraInput] = useState<'none' | 'wide' | 'noball' | 'legbye' | 'bye'>('none');

  // Timer Ref for Kabaddi
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check local storage authorization
    const auth = localStorage.getItem('lce_admin_auth');
    if (auth !== 'true') {
      router.push('/admin');
    }
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
          // Set initial selectors from state
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
            // Stop timer at 0
            clearInterval(timerRef.current!);
            postTimerUpdate(0, false);
            return {
              ...prev,
              kabaddiState: { ...prev.kabaddiState, timeRemaining: 0, timerRunning: false }
            };
          }

          // Throttle updates: write to server every 10 seconds to save operations, or handle locally
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
      setWicketForm({ isOpen: false, type: 'bowled', batsmanId: '' });
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
      
      // Update points table automatically in the background
      const tournamentRes = await fetch('/api/tournaments');
      const tournaments = await tournamentRes.json();
      const currentTourney = tournaments.find((t: any) => t.id === match.tournamentId);

      if (currentTourney) {
        // Recalculate standings table based on won match
        const newTable = currentTourney.pointsTable.map((teamEntry: any) => {
          if (teamEntry.teamId === match.teamA.id || teamEntry.teamId === match.teamB.id) {
            const isTeamA = teamEntry.teamId === match.teamA.id;
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

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-dark-950">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col min-h-screen">
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

  // Roster lists for selectors
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
    <div className="flex flex-col min-h-screen bg-dark-950">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Match Header Info */}
        <div className="glass-panel p-5 border-gold-500/20 rounded-xl mb-8 flex flex-wrap justify-between items-center bg-gradient-to-r from-dark-900 to-dark-950 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-gold-450 tracking-widest">Live Scoring Interface</span>
            <h1 className="text-lg font-bold text-white mt-1">
              {match.teamA.name} <span className="text-gold-500">vs</span> {match.teamB.name}
            </h1>
            <p className="text-xs text-dark-400">Active Ground Scoring Engine Console</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={undoCricketAction}
              className="flex items-center space-x-1 border border-dark-800 hover:border-gold-500/30 text-dark-300 hover:text-gold-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
            >
              <Undo2 className="h-4 w-4" />
              <span>Undo Last Ball</span>
            </button>

            <button
              onClick={completeMatch}
              className="flex items-center space-x-1.5 bg-emerald-500 text-dark-950 px-4 py-1.5 rounded-lg text-xs font-extrabold shadow-lg shadow-emerald-500/10 hover:opacity-90 transition-all"
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
              <div className="glass-panel p-5 rounded-xl border-gold-500/20 bg-dark-900/20 text-center">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase text-gold-450 tracking-wider">Innings {cState.innings} Status</span>
                  <span className="text-xs text-dark-400 font-bold">{cState.overs}.{cState.balls} Overs</span>
                </div>
                <p className="text-5xl font-extrabold text-white my-3">
                  {cState.runs}<span className="text-gold-500">/</span>{cState.wickets}
                </p>
                {cState.targetRuns && (
                  <p className="text-xs text-gold-400 font-bold">
                    Target Score: {cState.targetRuns} | Need {cState.targetRuns - cState.runs} runs to win
                  </p>
                )}
              </div>

              {/* Set striker/non-striker/bowler panel */}
              <div className="glass-panel p-5 rounded-xl border-dark-800 space-y-4">
                <h3 className="text-xs font-extrabold uppercase text-gold-400 tracking-widest border-b border-dark-800 pb-2">Active Field Selections</h3>
                
                <div className="grid sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-dark-450 mb-1.5">Striker</label>
                    <select
                      value={strikerId}
                      onChange={(e) => setStrikerId(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-850 rounded px-2 py-1.5 text-white"
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
                      className="w-full bg-dark-950 border border-dark-850 rounded px-2 py-1.5 text-white"
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
                      className="w-full bg-dark-950 border border-dark-850 rounded px-2 py-1.5 text-white"
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
                    className="bg-dark-900 border border-gold-500/20 text-gold-400 text-xs px-4 py-2 rounded font-bold hover:bg-dark-850"
                  >
                    Apply Players
                  </button>
                  <button
                    onClick={swapCricketInnings}
                    className="bg-gold-500/10 border border-gold-500/30 text-gold-450 text-xs px-4 py-2 rounded font-bold hover:bg-gold-500/20"
                  >
                    Swap Innings
                  </button>
                </div>
              </div>

              {/* Input Score Panel */}
              <div className="glass-panel p-5 rounded-xl border-gold-500/15 space-y-4">
                <h3 className="text-xs font-extrabold uppercase text-gold-450 tracking-widest">Input Ball Delivery</h3>
                
                {/* Runs Selector */}
                <div>
                  <label className="block text-[9px] font-bold uppercase text-dark-400 mb-2">Runs Off Bat / Ball</label>
                  <div className="grid grid-cols-6 gap-2">
                    {[0, 1, 2, 3, 4, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setRunsInput(num)}
                        className={`py-2 rounded-lg font-extrabold text-sm border transition-all ${
                          runsInput === num
                            ? 'gold-gradient-bg text-dark-950 border-gold-500 shadow-md'
                            : 'bg-dark-950 text-white border-dark-800 hover:border-gold-500/30'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Extras Checklist */}
                <div>
                  <label className="block text-[9px] font-bold uppercase text-dark-400 mb-2">Extras Type</label>
                  <div className="grid grid-cols-5 gap-2">
                    {(['none', 'wide', 'noball', 'legbye', 'bye'] as const).map((ext) => (
                      <button
                        key={ext}
                        onClick={() => setExtraInput(ext)}
                        className={`py-1.5 rounded text-xs font-bold border transition-all uppercase tracking-wider ${
                          extraInput === ext
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                            : 'bg-dark-950 text-dark-300 border-dark-800'
                        }`}
                      >
                        {ext}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wickets Toggle */}
                <div className="border-t border-dark-850 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Wicket Fall on this Ball?</span>
                    <button
                      type="button"
                      onClick={() => setWicketForm(prev => ({ ...prev, isOpen: !prev.isOpen, batsmanId: strikerId }))}
                      className={`px-3 py-1 rounded text-xs font-bold border uppercase tracking-wider ${
                        wicketForm.isOpen
                          ? 'bg-red-500 border-red-500 text-white'
                          : 'bg-dark-950 text-red-400 border-red-500/30'
                      }`}
                    >
                      {wicketForm.isOpen ? 'Yes, Wicket Panel Active' : 'No Wicket'}
                    </button>
                  </div>

                  {wicketForm.isOpen && (
                    <div className="grid grid-cols-2 gap-4 mt-3 bg-dark-950/60 p-3 rounded-lg border border-dark-850 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-dark-400 mb-1">Dismissal Type</label>
                        <select
                          value={wicketForm.type}
                          onChange={(e) => setWicketForm({ ...wicketForm, type: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-800 rounded px-2 py-1 text-white"
                        >
                          <option value="bowled">Bowled</option>
                          <option value="caught">Caught</option>
                          <option value="lbw">LBW</option>
                          <option value="runout">Run Out</option>
                          <option value="stumped">Stumped</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold text-dark-400 mb-1">Batsman Out</label>
                        <select
                          value={wicketForm.batsmanId}
                          onChange={(e) => setWicketForm({ ...wicketForm, batsmanId: e.target.value })}
                          className="w-full bg-dark-900 border border-dark-800 rounded px-2 py-1 text-white"
                        >
                          <option value={strikerId}>Striker ({getPlayerName(strikerId)})</option>
                          <option value={nonStrikerId}>Non-Striker ({getPlayerName(nonStrikerId)})</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={submitCricketBall}
                  className="w-full gold-gradient-bg hover:opacity-95 text-dark-950 font-extrabold text-sm py-3 rounded-lg transition-all"
                >
                  Confirm Ball Delivery
                </button>
              </div>

            </div>

            {/* Ball Logs sidebar on desktop */}
            <div className="space-y-4">
              <div className="glass-panel p-5 rounded-xl border border-dark-800 max-h-96 overflow-y-auto">
                <h3 className="text-xs font-extrabold uppercase text-gold-450 border-b border-dark-800 pb-2 mb-3">Ball History Log</h3>
                <div className="space-y-2.5 text-xs">
                  {match.ballByBall && [...match.ballByBall].reverse().slice(0, 10).map((b, i) => (
                    <div key={i} className="flex justify-between items-center bg-dark-950/50 p-2 rounded border border-dark-850">
                      <div>
                        <span className="font-bold text-gold-500 mr-2">{b.overNum}.{b.ballNum}</span>
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
              <div className="glass-panel p-6 rounded-xl border border-gold-500/20 bg-dark-900/10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-12 -mr-12 w-32 h-32 bg-gold-500/5 rounded-full blur-2xl" />

                <div className="flex items-center justify-center space-x-8 sm:space-x-12">
                  <div>
                    <h3 className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-1.5">{match.teamA.name}</h3>
                    <p className="text-5xl font-extrabold text-white">{kState.scoreA}</p>
                  </div>
                  <div className="text-2xl font-bold text-gold-500/60">:</div>
                  <div>
                    <h3 className="text-xs font-bold text-dark-400 uppercase tracking-widest mb-1.5">{match.teamB.name}</h3>
                    <p className="text-5xl font-extrabold text-white">{kState.scoreB}</p>
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
                          : 'bg-gold-500 text-dark-950 hover:opacity-90'
                      }`}
                    >
                      {kState.timerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      <span>{kState.timerRunning ? 'Pause Clock' : 'Start Clock'}</span>
                    </button>
                    <button
                      onClick={resetKabaddiTimer}
                      className="border border-dark-800 hover:border-gold-500/20 text-dark-300 hover:text-gold-400 p-2 rounded-lg"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-dark-850/60 text-center">
                  <Link
                    href={`/matches/${match.id}/kabaddi`}
                    target="_blank"
                    className="inline-flex items-center space-x-1.5 bg-gold-500/10 hover:bg-gold-500/20 text-[#fbbf24] border border-[#eec750]/30 hover:border-gold-500 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-md"
                  >
                    <Tv className="h-4 w-4 text-gold-500" />
                    <span>Launch PKL Broadcast Scoreboard</span>
                  </Link>
                </div>

              </div>

              {/* Point allocation matrix */}
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Team A Point Controls */}
                <div className="glass-panel p-5 rounded-xl border-gold-500/10 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase text-gold-400 tracking-widest border-b border-dark-850 pb-2">
                    {match.teamA.name} Points
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-white">
                    <button
                      onClick={() => addKabaddiPoints('raid_success', match.teamA.id, 1, `Touch point scored by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded"
                    >
                      Raid Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('bonus', match.teamA.id, 1, `Bonus point secured by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded text-amber-400"
                    >
                      Bonus Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('raid_tackled', match.teamA.id, 1, `Tackle point secured by Defense.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded"
                    >
                      Tackle Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('super_tackle', match.teamA.id, 2, `Super Tackle completed on Raider!`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded text-gold-400"
                    >
                      Super Tackle (+2)
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => addKabaddiPoints('all_out', match.teamA.id, 2, `ALL OUT enforced on opponent!`)}
                      className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-2 rounded hover:bg-emerald-500/20"
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
                <div className="glass-panel p-5 rounded-xl border-gold-500/10 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase text-gold-400 tracking-widest border-b border-dark-850 pb-2">
                    {match.teamB.name} Points
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-white">
                    <button
                      onClick={() => addKabaddiPoints('raid_success', match.teamB.id, 1, `Touch point scored by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded"
                    >
                      Raid Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('bonus', match.teamB.id, 1, `Bonus point secured by Raider.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded text-amber-400"
                    >
                      Bonus Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('raid_tackled', match.teamB.id, 1, `Tackle point secured by Defense.`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded"
                    >
                      Tackle Point (+1)
                    </button>
                    <button
                      onClick={() => addKabaddiPoints('super_tackle', match.teamB.id, 2, `Super Tackle completed on Raider!`)}
                      className="bg-dark-950 border border-dark-800 hover:border-gold-500/30 p-2.5 rounded text-gold-400"
                    >
                      Super Tackle (+2)
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => addKabaddiPoints('all_out', match.teamB.id, 2, `ALL OUT enforced on opponent!`)}
                      className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-2 rounded hover:bg-emerald-500/20"
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
                  <h3 className="text-xs font-extrabold uppercase text-gold-450">Match Actions Timeline</h3>
                  <button onClick={undoKabaddiAction} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase">Undo</button>
                </div>
                <div className="space-y-2.5 text-xs">
                  {match.kabaddiActions && [...match.kabaddiActions].reverse().slice(0, 10).map((act, i) => (
                    <div key={i} className="bg-dark-950/50 p-2 rounded border border-dark-850">
                      <div className="flex justify-between">
                        <span className="font-bold text-gold-500">{Math.floor(act.timeRemaining / 60)}:{(act.timeRemaining % 60).toString().padStart(2, '0')}</span>
                        <span className="font-bold text-emerald-400">+{act.points} pts</span>
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
const getPlayerName = (playerId: string, playersList: Player[] = []) => {
  return playersList.find(p => p.id === playerId)?.name || 'Player';
};
