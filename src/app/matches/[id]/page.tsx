'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match, Player } from '@/lib/db';
import { Play, ArrowLeft, Tv, Award, AlertCircle, Clock, Shield } from 'lucide-react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

function safeParse(val: any) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return val;
}

function mapFromDbClient(dbMatch: any, originalIdFallback: string): Match {
  const parsedKabaddiState = safeParse(dbMatch.kabaddi_state);
  const parsedCricketState = safeParse(dbMatch.cricket_state);
  
  const originalId = 
    (parsedKabaddiState && parsedKabaddiState.originalId) || 
    (parsedCricketState && parsedCricketState.originalId) || 
    originalIdFallback || 
    dbMatch.id;

  return {
    id: originalId,
    supabaseId: dbMatch.id,
    tournamentId: dbMatch.tournament_id,
    sport: dbMatch.sport,
    teamA: safeParse(dbMatch.team_a),
    teamB: safeParse(dbMatch.team_b),
    status: dbMatch.status,
    winnerId: dbMatch.winner_id,
    tossText: dbMatch.toss_text,
    date: dbMatch.date,
    controlToken: dbMatch.control_token,
    cricketState: parsedCricketState,
    kabaddiState: parsedKabaddiState,
    kabaddiActions: safeParse(dbMatch.kabaddi_actions) || [],
    ballByBall: safeParse(dbMatch.ball_by_ball) || []
  };
}

export default function MatchScoreboard() {
  const router = useRouter();
  const params = useParams();
  const matchId = params.id as string;

  const [match, setMatch] = useState<Match | null>(null);
  const matchRef = useRef<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'ballbyball' | 'info'>('scorecard');

  useEffect(() => {
    async function loadMatchData() {
      try {
        const [resMatch, resPlayers] = await Promise.all([
          fetch(`/api/matches/${matchId}`).then(r => r.json()),
          fetch('/api/players').then(r => r.json())
        ]);
        
        if (resMatch && !resMatch.error) {
          setMatch(resMatch);
          matchRef.current = resMatch;
        }
        if (Array.isArray(resPlayers)) {
          setPlayers(resPlayers);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (!matchId) return;

    loadMatchData();

    let interval: NodeJS.Timeout | null = null;
    let channel: any = null;

    if (isSupabaseConfigured) {
      try {
        console.log('Subscribing to Supabase Realtime changes for Match Details:', matchId);
        channel = supabase
          .channel(`match-${matchId}-details`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'matches'
            },
            (payload) => {
              const updatedOriginalId = 
                payload.new.kabaddi_state?.originalId || 
                payload.new.cricket_state?.originalId;
              
              if (
                updatedOriginalId === matchId ||
                (matchRef.current?.supabaseId && payload.new.id === matchRef.current.supabaseId)
              ) {
                console.log('Realtime update received on Match Details (Instant UI Sync):', payload.new);
                const mappedMatch = mapFromDbClient(payload.new, matchId);
                setMatch(mappedMatch);
                matchRef.current = mappedMatch;
              }
            }
          )
          .subscribe();

        // Slow polling fallback (15s) for safety
        interval = setInterval(loadMatchData, 15000);
      } catch (err) {
        console.error('Failed to subscribe to Supabase Realtime for Match Details:', err);
        // Fall back to standard HTTP polling
        interval = setInterval(loadMatchData, 4000);
      }
    } else {
      console.log('Supabase not configured for Match Details, using standard HTTP polling.');
      interval = setInterval(loadMatchData, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn('Failed to remove channel:', e);
        }
      }
    };
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#05070f]">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-neon-yellow border-r-transparent align-[-0.125em]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col min-h-screen bg-[#05070f]">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8">
          <AlertCircle className="h-12 w-12 text-red-400 mb-2" />
          <p className="text-xl font-bold text-white">Match scorecard not found</p>
          <button onClick={() => router.push('/')} className="mt-4 text-xs font-bold text-neon-yellow hover:underline">
            Back to Dashboard
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const isCricket = match.sport === 'cricket';
  const cState = match.cricketState;
  const kState = match.kabaddiState;

  // Run rates helper
  const calculateCRR = () => {
    if (!cState) return '0.00';
    const totalBalls = (cState.overs * 6) + cState.balls;
    if (totalBalls === 0) return '0.00';
    return ((cState.runs / totalBalls) * 6).toFixed(2);
  };

  const calculateRRR = () => {
    if (!cState || !cState.targetRuns) return null;
    const remainingRuns = cState.targetRuns - cState.runs;
    const remainingBalls = (20 * 6) - ((cState.overs * 6) + cState.balls); // Assuming T20 20 overs
    if (remainingBalls <= 0) return remainingRuns > 0 ? 'Req. Run Rate: High' : '0.00';
    return ((remainingRuns / remainingBalls) * 6).toFixed(2);
  };

  const getPlayerName = (playerId?: string) => {
    if (!playerId) return 'Player';
    return players.find(p => p.id === playerId)?.name || 'Player';
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#05070f] text-white">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Navigation & OBS Overlay Shortcut */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-dark-400 hover:text-neon-yellow transition-all self-start"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Match Center</span>
          </button>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/overlay/${match.id}`}
              target="_blank"
              className="flex items-center space-x-2 bg-neon-yellow/10 border border-neon-yellow/30 hover:border-neon-yellow/60 text-neon-yellow px-4 py-2 rounded-lg text-xs font-bold transition-all neon-glow"
            >
              <Tv className="h-4 w-4" />
              <span>Open Streaming Overlay</span>
            </Link>
            
            <Link
              href={`/admin/score/${match.id}`}
              className="flex items-center space-x-2 bg-red-950/20 border border-red-500/30 hover:border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            >
              <Shield className="h-4 w-4" />
              <span>Scoring Admin Panel</span>
            </Link>
          </div>
        </div>

        {/* Live Score Hero Panel */}
        <div className="glass-panel border-neon-yellow/20 neon-glow rounded-2xl p-6 mb-8 bg-gradient-to-br from-[#0e1227] via-[#05070f] to-[#05070f] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-32 h-32 bg-neon-yellow/5 rounded-full blur-2xl" />

          {/* Sport Status Badge */}
          <div className="flex items-center justify-center space-x-3 mb-4">
            <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/20">
              {match.sport}
            </span>
            {match.status === 'live' ? (
              <span className="flex items-center space-x-1 text-red-500 text-[10px] font-bold uppercase animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span>LIVE UPDATES</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">{match.status}</span>
            )}
          </div>

          {/* Main Scoring Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 items-center gap-6 md:gap-4 my-2">
            
            {/* Team A Panel */}
            <div className="md:col-span-2 text-center flex flex-col items-center">
              <img
                src={match.teamA.logo}
                alt={match.teamA.name}
                className="h-16 w-16 md:h-20 md:w-20 object-contain bg-dark-950/60 p-2.5 rounded-full border border-dark-800 mb-3 shadow-md"
              />
              <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-full">{match.teamA.name}</h2>
              <span className="text-[10px] tracking-widest text-dark-400 uppercase font-semibold">Home Franchise</span>
            </div>

            {/* Score Center Panel */}
            <div className="md:col-span-3 text-center py-2 px-4 bg-dark-950/40 rounded-xl border border-dark-850 self-stretch flex flex-col justify-center">
              {isCricket && cState ? (
                <div>
                  <p className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                    {cState.runs}<span className="text-neon-yellow">/</span>{cState.wickets}
                  </p>
                  <p className="text-xs sm:text-sm text-dark-300 font-semibold mt-2">
                    {cState.overs}.{cState.balls} Overs
                  </p>
                  
                  <div className="flex justify-center space-x-4 mt-3 text-xs border-t border-dark-800/60 pt-3">
                    <p className="text-dark-400">CRR: <span className="font-bold text-white">{calculateCRR()}</span></p>
                    {calculateRRR() && (
                      <p className="text-neon-yellow">RRR: <span className="font-bold">{calculateRRR()}</span></p>
                    )}
                  </div>
                </div>
              ) : kState ? (
                <div>
                  <div className="flex items-center justify-center space-x-6 sm:space-x-8">
                    <span className="text-4xl sm:text-6xl font-black text-white">{kState.scoreA}</span>
                    <span className="text-xl sm:text-2xl font-bold text-neon-yellow/70">:</span>
                    <span className="text-4xl sm:text-6xl font-black text-white">{kState.scoreB}</span>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-2 text-xs text-dark-300 mt-4 bg-dark-900/60 py-1.5 px-4 rounded-full max-w-xs mx-auto border border-dark-800">
                    <Clock className="h-4 w-4 text-neon-yellow" />
                    <span className="font-mono tracking-wider text-white">
                      Half {kState.half} | {Math.floor(kState.timeRemaining / 60)}:{(kState.timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  <div className="mt-4 text-center">
                    <Link
                      href={`/matches/${matchId}/kabaddi`}
                      className="inline-flex items-center space-x-1.5 bg-neon-yellow/10 hover:bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/20 hover:border-neon-yellow px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-md"
                    >
                      <Tv className="h-4 w-4 text-neon-yellow" />
                      <span>Open PKL Broadcast Scoreboard</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-base text-dark-400 font-bold uppercase tracking-widest">Match Scheduled</p>
                  <p className="text-xs text-dark-500 mt-1">{match.date}</p>
                </div>
              )}
            </div>

            {/* Team B Panel */}
            <div className="md:col-span-2 text-center flex flex-col items-center">
              <img
                src={match.teamB.logo}
                alt={match.teamB.name}
                className="h-16 w-16 md:h-20 md:w-20 object-contain bg-dark-950/60 p-2.5 rounded-full border border-dark-800 mb-3 shadow-md"
              />
              <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-full">{match.teamB.name}</h2>
              <span className="text-[10px] tracking-widest text-dark-400 uppercase font-semibold">Away Franchise</span>
            </div>

          </div>

          {/* Toss & Bottom Text Banner */}
          <div className="text-center text-xs font-bold text-neon-yellow neon-text-glow border-t border-dark-850 mt-6 pt-4">
            {match.tossText || 'Toss Information Pending'}
          </div>

        </div>

        {/* Cricket Live Extras / Partnerships Section */}
        {isCricket && cState && match.status === 'live' && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Batsmen On Crease */}
            <div className="glass-panel p-5 rounded-xl border-neon-yellow/10 flex flex-col justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-neon-yellow/70 border-b border-dark-800 pb-2 mb-3">Batsmen on Crease</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className={`font-bold flex items-center gap-1.5 ${cState.strikerId ? 'text-white' : 'text-dark-400'}`}>
                    {cState.strikerId ? getPlayerName(cState.strikerId) : 'Select Striker'}
                    {cState.strikerId && <span className="text-neon-yellow text-[10px] font-bold animate-pulse">★</span>}
                  </span>
                  <span className="font-bold text-white">
                    {cState.batsmenStats.find(b => b.playerId === cState.strikerId)?.runs || 0}
                    <span className="text-dark-400 font-normal">({cState.batsmenStats.find(b => b.playerId === cState.strikerId)?.balls || 0})</span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-dark-800/40 pt-2">
                  <span className={`font-medium ${cState.nonStrikerId ? 'text-dark-200' : 'text-dark-450'}`}>
                    {cState.nonStrikerId ? getPlayerName(cState.nonStrikerId) : 'Select Non-Striker'}
                  </span>
                  <span className="font-medium text-dark-200">
                    {cState.batsmenStats.find(b => b.playerId === cState.nonStrikerId)?.runs || 0}
                    <span className="text-dark-450">({cState.batsmenStats.find(b => b.playerId === cState.nonStrikerId)?.balls || 0})</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Bowler / Partnership */}
            <div className="glass-panel p-5 rounded-xl border-neon-yellow/10 flex flex-col justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-neon-yellow/70 border-b border-dark-800 pb-2 mb-3">Active Bowler & Partnership</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-dark-400">Current Bowler:</span>
                  <span className="font-bold text-white flex items-center gap-2">
                    {cState.currentBowlerId ? getPlayerName(cState.currentBowlerId) : 'Bowler'}
                    <span className="bg-dark-900 px-1.5 py-0.5 rounded text-[10px] text-dark-300">
                      {cState.bowlerStats.find(b => b.playerId === cState.currentBowlerId)?.wickets || 0}W - {cState.bowlerStats.find(b => b.playerId === cState.currentBowlerId)?.runs || 0}R
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-dark-800/40 pt-2">
                  <span className="text-dark-400">Partnership:</span>
                  <span className="font-bold text-white">
                    {cState.partnership.runs} runs <span className="text-dark-400 font-normal">({cState.partnership.balls} balls)</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-dark-800 mb-6 space-x-6">
          {(['scorecard', 'ballbyball', 'info'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-xs font-bold uppercase tracking-wider relative transition-all ${
                activeTab === tab ? 'text-neon-yellow neon-text-glow' : 'text-dark-400 hover:text-white'
              }`}
            >
              <span>
                {tab === 'scorecard' && (isCricket ? 'Scorecard' : 'Match Stats')}
                {tab === 'ballbyball' && (isCricket ? 'Ball-By-Ball' : 'Raid Timeline')}
                {tab === 'info' && 'Match Info'}
              </span>
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 neon-gradient-bg neon-glow" />
              )}
            </button>
          ))}
        </div>

        {/* Scorecard Tab Content */}
        {activeTab === 'scorecard' && (
          <div className="space-y-6">
            {isCricket && cState ? (
              <div className="space-y-6">
                
                {/* Innings Batsmen table */}
                <div className="glass-panel rounded-xl overflow-hidden border border-neon-yellow/10">
                  <div className="px-5 py-3.5 bg-dark-950/60 border-b border-dark-800 flex justify-between items-center">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-neon-yellow">
                      Innings {cState.innings} Batting Card
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-dark-800">
                      <thead className="bg-dark-950/30 text-[9px] font-bold uppercase tracking-wider text-dark-400">
                        <tr>
                          <th className="px-6 py-3 text-left">Batsman</th>
                          <th className="px-6 py-3 text-left">Status</th>
                          <th className="px-6 py-3 text-center w-20">Runs</th>
                          <th className="px-6 py-3 text-center w-20">Balls</th>
                          <th className="px-6 py-3 text-center w-16">4s</th>
                          <th className="px-6 py-3 text-center w-16">6s</th>
                          <th className="px-6 py-3 text-center w-24">Strike Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-800/40 text-xs">
                        {cState.batsmenStats.map((b) => (
                          <tr key={b.playerId} className="hover:bg-dark-900/30">
                            <td className="px-6 py-3.5 font-bold text-white flex items-center space-x-1.5">
                              <span>{b.name}</span>
                              {b.playerId === cState.strikerId && <span className="text-neon-yellow animate-pulse">★</span>}
                            </td>
                            <td className="px-6 py-3.5 text-dark-400 font-medium italic">
                              {b.out ? (b.howOut || 'out') : 'not out'}
                            </td>
                            <td className="px-6 py-3.5 text-center font-extrabold text-white">{b.runs}</td>
                            <td className="px-6 py-3.5 text-center font-medium text-dark-300">{b.balls}</td>
                            <td className="px-6 py-3.5 text-center font-medium text-dark-400">{b.fours}</td>
                            <td className="px-6 py-3.5 text-center font-medium text-dark-400">{b.sixes}</td>
                            <td className="px-6 py-3.5 text-center font-bold text-neon-yellow">
                              {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bowlers table */}
                <div className="glass-panel rounded-xl overflow-hidden border border-neon-yellow/10">
                  <div className="px-5 py-3.5 bg-dark-950/60 border-b border-dark-800">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-neon-yellow">
                      Innings {cState.innings} Bowling Card
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-dark-800">
                      <thead className="bg-dark-950/30 text-[9px] font-bold uppercase tracking-wider text-dark-400">
                        <tr>
                          <th className="px-6 py-3 text-left">Bowler</th>
                          <th className="px-6 py-3 text-center w-24">Overs</th>
                          <th className="px-6 py-3 text-center w-20">Maidens</th>
                          <th className="px-6 py-3 text-center w-20">Runs</th>
                          <th className="px-6 py-3 text-center w-20">Wickets</th>
                          <th className="px-6 py-3 text-center w-24">Economy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-800/40 text-xs">
                        {cState.bowlerStats.map((b) => (
                          <tr key={b.playerId} className="hover:bg-dark-900/30">
                            <td className="px-6 py-3.5 font-bold text-white">{b.name}</td>
                            <td className="px-6 py-3.5 text-center font-bold text-white">{b.overs}</td>
                            <td className="px-6 py-3.5 text-center font-medium text-dark-300">{b.maidens}</td>
                            <td className="px-6 py-3.5 text-center font-medium text-red-400">{b.runs}</td>
                            <td className="px-6 py-3.5 text-center font-extrabold text-emerald-450">{b.wickets}</td>
                            <td className="px-6 py-3.5 text-center font-bold text-neon-yellow">
                              {b.overs > 0 ? (b.runs / b.overs).toFixed(2) : '0.00'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Fall of Wickets */}
                {cState.fallOfWickets.length > 0 && (
                  <div className="glass-panel p-5 rounded-xl border-neon-yellow/10">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-neon-yellow border-b border-dark-800 pb-2.5 mb-3">Fall of Wickets</h3>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {cState.fallOfWickets.map((f, i) => (
                        <div key={i} className="bg-dark-900/60 border border-dark-850 px-3 py-1.5 rounded-lg flex flex-col">
                          <span className="font-extrabold text-white">{f.score}/{f.wickets}</span>
                          <span className="text-[10px] text-dark-400 mt-0.5">{f.batsmanName} ({f.overs}.{f.balls} Ov)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : kState ? (
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Team A stats */}
                <div className="glass-panel rounded-xl p-5 border border-neon-yellow/10">
                  <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-3 mb-4 flex items-center justify-between">
                    <span>{match.teamA.name} Stats</span>
                    <span className="text-neon-yellow font-extrabold text-lg">{kState.scoreA}</span>
                  </h3>
                  
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b border-dark-900">
                      <span className="text-dark-400">Raid Points:</span>
                      <span className="font-bold text-white">{kState.raidPointsA}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dark-900">
                      <span className="text-dark-400">Tackle Points:</span>
                      <span className="font-bold text-white">{kState.tacklePointsA}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dark-900">
                      <span className="text-dark-400">All Out Points:</span>
                      <span className="font-bold text-white">{kState.allOutPointsA}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-dark-400">Extras / Technical:</span>
                      <span className="font-bold text-white">{kState.extraPointsA}</span>
                    </div>
                  </div>
                </div>

                {/* Team B stats */}
                <div className="glass-panel rounded-xl p-5 border border-neon-yellow/10">
                  <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-3 mb-4 flex items-center justify-between">
                    <span>{match.teamB.name} Stats</span>
                    <span className="text-neon-yellow font-extrabold text-lg">{kState.scoreB}</span>
                  </h3>
                  
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1 border-b border-dark-900">
                      <span className="text-dark-400">Raid Points:</span>
                      <span className="font-bold text-white">{kState.raidPointsB}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dark-900">
                      <span className="text-dark-400">Tackle Points:</span>
                      <span className="font-bold text-white">{kState.tacklePointsB}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-dark-900">
                      <span className="text-dark-400">All Out Points:</span>
                      <span className="font-bold text-white">{kState.allOutPointsB}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-dark-400">Extras / Technical:</span>
                      <span className="font-bold text-white">{kState.extraPointsB}</span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="glass-panel text-center py-12 px-4 rounded-xl">
                <p className="text-dark-400 text-sm">Match stats will become available when live scoring starts.</p>
              </div>
            )}
          </div>
        )}

        {/* Ball By Ball / Raid Timeline Tab Content */}
        {activeTab === 'ballbyball' && (
          <div className="glass-panel p-5 rounded-xl border-neon-yellow/10 max-h-[500px] overflow-y-auto">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-neon-yellow border-b border-dark-800 pb-3 mb-5">
              {isCricket ? 'Live Commentary Feed' : 'Raid Action Timeline'}
            </h3>

            {isCricket ? (
              (!match.ballByBall || match.ballByBall.length === 0) ? (
                <p className="text-xs text-dark-500 text-center py-4">No balls bowled in this innings yet.</p>
              ) : (
                <div className="space-y-4">
                  {[...match.ballByBall].reverse().map((ball, i) => (
                    <div key={i} className="flex items-start space-x-4 text-xs border-b border-dark-900 pb-3 last:border-0 last:pb-0">
                      <div className="flex-shrink-0 bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/25 px-2 py-1 rounded text-center w-14 font-extrabold">
                        {ball.overNum}.{ball.ballNum}
                      </div>
                      <div className="flex-grow">
                        <p className="font-bold text-white">{ball.bowlerName} to {ball.batsmanName}</p>
                        <p className="text-dark-300 mt-1">{ball.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          ball.runs === 4 || ball.runs === 6
                            ? 'bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/35'
                            : ball.wicket
                            ? 'bg-red-500/15 text-red-400 border border-red-500/35'
                            : 'bg-dark-900 text-dark-350'
                        }`}>
                          {ball.wicket ? 'W' : `${ball.runs} Runs`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              (!match.kabaddiActions || match.kabaddiActions.length === 0) ? (
                <p className="text-xs text-dark-500 text-center py-4">No raids completed in this match yet.</p>
              ) : (
                <div className="space-y-4">
                  {[...match.kabaddiActions].reverse().map((act, i) => (
                    <div key={i} className="flex items-start space-x-4 text-xs border-b border-dark-900 pb-3 last:border-0 last:pb-0">
                      <div className="flex-shrink-0 bg-dark-900 border border-dark-800 text-dark-400 px-2 py-1 rounded text-center font-mono w-16">
                        {Math.floor(act.timeRemaining / 60)}:{(act.timeRemaining % 60).toString().padStart(2, '0')}
                      </div>
                      <div className="flex-grow">
                        <p className="font-bold text-white uppercase tracking-wider text-[10px] text-neon-yellow">{act.type.replace('_', ' ')}</p>
                        <p className="text-dark-300 mt-0.5">{act.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-right font-extrabold text-emerald-450 text-sm">
                        +{act.points} pts
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Match Info Tab */}
        {activeTab === 'info' && (
          <div className="glass-panel p-5 rounded-xl border border-neon-yellow/10 space-y-4 text-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-neon-yellow border-b border-dark-800 pb-2 mb-3">Event Metadata</h3>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <div className="flex justify-between py-1 border-b border-dark-900">
                  <span className="text-dark-450">Tournament ID:</span>
                  <span className="font-bold text-white">{match.tournamentId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-900">
                  <span className="text-dark-450">Sport Format:</span>
                  <span className="font-bold text-neon-yellow capitalize">{match.sport}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-dark-450">Scheduled Date:</span>
                  <span className="font-bold text-white">{match.date}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between py-1 border-b border-dark-900">
                  <span className="text-dark-450">Status:</span>
                  <span className="font-bold text-white uppercase">{match.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-900">
                  <span className="text-dark-450">Toss Selection:</span>
                  <span className="font-bold text-white">{match.tossText || 'Pending'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neon-yellow">Match Winner:</span>
                  <span className="font-bold text-emerald-450">{match.winnerId ? (match.winnerId === match.teamA.id ? match.teamA.name : match.teamB.name) : 'Unresolved'}</span>
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
