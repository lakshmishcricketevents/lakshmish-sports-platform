'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match, Tournament, Sponsor, Player } from '@/lib/db';
import { Play, Calendar, CheckCircle2, TrendingUp, Trophy, Users, Award, Shield } from 'lucide-react';

export default function Dashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'completed'>('live');

  // Real-time polling
  useEffect(() => {
    async function fetchData() {
      try {
        const [resMatches, resTournaments, resSponsors, resPlayers] = await Promise.all([
          fetch('/api/matches').then(r => r.json()),
          fetch('/api/tournaments').then(r => r.json()),
          fetch('/api/sponsors').then(r => r.json()),
          fetch('/api/players').then(r => r.json())
        ]);
        
        if (Array.isArray(resMatches)) setMatches(resMatches);
        if (Array.isArray(resTournaments)) setTournaments(resTournaments);
        if (Array.isArray(resSponsors)) setSponsors(resSponsors);
        if (Array.isArray(resPlayers)) setPlayers(resPlayers);
      } catch (err) {
        console.error('Failed to poll dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const timer = setInterval(fetchData, 4000); // Poll every 4s for real-time look
    return () => clearInterval(timer);
  }, []);

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const completedMatches = matches.filter(m => m.status === 'completed');

  const filteredMatches = 
    activeTab === 'live' ? liveMatches :
    activeTab === 'upcoming' ? upcomingMatches : completedMatches;

  // Stats calculation
  const totalTournaments = tournaments.length;
  const liveCount = liveMatches.length;
  const completedCount = completedMatches.length;
  const totalPlayersCount = players.length;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-2xl glass-panel glow-gold border border-gold-500/30 p-6 sm:p-10 mb-8 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-950/40 via-dark-950 to-dark-950">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-gold-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-gold-500/10 border border-gold-500/30 rounded-full text-gold-400 text-xs font-semibold mb-4 uppercase tracking-wider">
              <Award className="h-4.5 w-4.5" />
              <span>Premium Live Sports Experience</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
              LAKSHMISH <span className="gold-gradient-text">CRICKET EVENTS</span>
            </h1>
            <p className="text-sm sm:text-base text-dark-300 mb-6 leading-relaxed">
              Experience local sports tournaments with the intensity of the IPL. Featuring real-time ball-by-ball scoreboards, live player bidding auctions, pro kabaddi statistics, and dynamic OBS overlays.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/tournaments"
                className="gold-gradient-bg hover:opacity-90 text-dark-950 px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-gold-500/20 transition-all"
              >
                Explore Tournaments
              </Link>
              <Link
                href="/auction"
                className="bg-dark-900 border border-gold-500/30 hover:border-gold-500/60 text-gold-400 px-6 py-2.5 rounded-lg text-sm font-bold transition-all"
              >
                Enter Auction Hub
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-4 rounded-xl flex items-center space-x-4">
            <div className="p-3 bg-gold-500/10 rounded-lg text-gold-400">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalTournaments}</p>
              <p className="text-xs text-dark-400 uppercase tracking-wider font-semibold">Tournaments</p>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex items-center space-x-4">
            <div className="p-3 bg-red-500/10 rounded-lg text-red-400">
              <Play className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{liveCount}</p>
              <p className="text-xs text-dark-400 uppercase tracking-wider font-semibold">Live Matches</p>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{completedCount}</p>
              <p className="text-xs text-dark-400 uppercase tracking-wider font-semibold">Completed</p>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-xl flex items-center space-x-4">
            <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalPlayersCount}</p>
              <p className="text-xs text-dark-400 uppercase tracking-wider font-semibold">Players</p>
            </div>
          </div>
        </div>

        {/* Match Center */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gold-500/10 pb-4 mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Play className="h-5 w-5 text-gold-500" />
                <span>Match Center</span>
              </h2>
              <p className="text-xs text-dark-400 mt-0.5">Real-time score updates from active events</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-2 bg-dark-900/60 p-1 rounded-lg border border-gold-500/15">
              {(['live', 'upcoming', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab
                      ? 'gold-gradient-bg text-dark-950 shadow-md'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800/55'
                  }`}
                >
                  {tab} {tab === 'live' && liveCount > 0 && <span className="ml-1 px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[9px] animate-bounce">{liveCount}</span>}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
              <p className="mt-4 text-sm text-dark-400">Loading scoring console data...</p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="glass-panel text-center py-12 px-4 rounded-xl border border-dashed border-gold-500/20">
              <Calendar className="h-10 w-10 text-dark-500 mx-auto mb-3" />
              <p className="text-dark-300 font-medium text-sm">No {activeTab} matches currently scheduled.</p>
              <p className="text-xs text-dark-500 mt-1">Check back later or register a new fixture in the Admin Panel.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {filteredMatches.map((match) => {
                const isCricket = match.sport === 'cricket';
                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="glass-panel glass-panel-hover rounded-xl p-5 flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-4 border-b border-dark-800 pb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isCricket ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                          {match.sport}
                        </span>
                        {match.status === 'live' && (
                          <span className="flex items-center space-x-1 text-red-500 text-[10px] font-bold uppercase animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            <span>LIVE</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-dark-400">{match.date}</span>
                    </div>

                    {/* Team Display */}
                    <div className="grid grid-cols-7 items-center gap-2 mb-4">
                      {/* Team A */}
                      <div className="col-span-3 text-center">
                        <img
                          src={match.teamA.logo}
                          alt={match.teamA.name}
                          className="h-12 w-12 mx-auto object-contain bg-dark-900/50 p-1.5 rounded-full border border-dark-800 mb-2"
                        />
                        <p className="text-xs font-bold text-white truncate max-w-full">{match.teamA.name}</p>
                      </div>

                      {/* VS Divider */}
                      <div className="col-span-1 text-center font-bold text-gold-500/60 italic text-sm">VS</div>

                      {/* Team B */}
                      <div className="col-span-3 text-center">
                        <img
                          src={match.teamB.logo}
                          alt={match.teamB.name}
                          className="h-12 w-12 mx-auto object-contain bg-dark-900/50 p-1.5 rounded-full border border-dark-800 mb-2"
                        />
                        <p className="text-xs font-bold text-white truncate max-w-full">{match.teamB.name}</p>
                      </div>
                    </div>

                    {/* Score Summary */}
                    <div className="bg-dark-950/40 p-3 rounded-lg border border-gold-500/5 mb-3 text-center">
                      {isCricket ? (
                        match.cricketState ? (
                          <div>
                            <p className="text-lg font-bold text-white">
                              {match.cricketState.runs}/{match.cricketState.wickets}
                              <span className="text-xs text-dark-400 ml-2">({match.cricketState.overs}.{match.cricketState.balls} Ov)</span>
                            </p>
                            {match.cricketState.targetRuns && (
                              <p className="text-[11px] text-gold-400 mt-1 font-semibold">
                                Target: {match.cricketState.targetRuns} | Need {match.cricketState.targetRuns - match.cricketState.runs} runs
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-dark-400">Match Scheduled</p>
                        )
                      ) : (
                        match.kabaddiState ? (
                          <div>
                            <p className="text-xl font-extrabold text-white tracking-widest">
                              {match.kabaddiState.scoreA} <span className="text-gold-500 font-normal">:</span> {match.kabaddiState.scoreB}
                            </p>
                            <p className="text-[10px] text-dark-400 mt-1 uppercase font-bold tracking-wider">
                              Half {match.kabaddiState.half} | {Math.floor(match.kabaddiState.timeRemaining / 60)}:{(match.kabaddiState.timeRemaining % 60).toString().padStart(2, '0')}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-dark-400">Match Scheduled</p>
                        )
                      )}
                    </div>

                    <div className="text-center text-xs font-semibold text-gold-400 truncate mt-1">
                      {match.tossText || 'Click to view scoreboard details'}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Dynamic Leaderboards section */}
        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          
          {/* Top Batsmen */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold-400 mb-4 flex items-center gap-2 border-b border-dark-800 pb-2">
              <TrendingUp className="h-4 w-4" />
              <span>Top Run Scorers</span>
            </h3>
            <div className="space-y-3">
              {players.filter(p => p.stats.cricket).sort((a,b) => (b.stats.cricket?.runs || 0) - (a.stats.cricket?.runs || 0)).slice(0, 3).map((player, i) => (
                <div key={player.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-gold-500/80 w-4">#{i+1}</span>
                    <img src={player.photo} alt={player.name} className="h-8 w-8 rounded-full object-cover border border-dark-800" />
                    <div>
                      <p className="font-bold text-white">{player.name}</p>
                      <p className="text-[10px] text-dark-400">{player.role}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-white text-sm bg-dark-900 px-2 py-1 rounded border border-dark-800">{player.stats.cricket?.runs} runs</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Bowlers */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold-400 mb-4 flex items-center gap-2 border-b border-dark-800 pb-2">
              <Shield className="h-4 w-4" />
              <span>Leading Wicket Takers</span>
            </h3>
            <div className="space-y-3">
              {players.filter(p => p.stats.cricket).sort((a,b) => (b.stats.cricket?.wickets || 0) - (a.stats.cricket?.wickets || 0)).slice(0, 3).map((player, i) => (
                <div key={player.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-gold-500/80 w-4">#{i+1}</span>
                    <img src={player.photo} alt={player.name} className="h-8 w-8 rounded-full object-cover border border-dark-800" />
                    <div>
                      <p className="font-bold text-white">{player.name}</p>
                      <p className="text-[10px] text-dark-400">{player.role}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-white text-sm bg-dark-900 px-2 py-1 rounded border border-dark-800">{player.stats.cricket?.wickets} wkts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kabaddi Raiders */}
          <div className="glass-panel rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold-400 mb-4 flex items-center gap-2 border-b border-dark-800 pb-2">
              <Award className="h-4 w-4" />
              <span>MVP Kabaddi Raiders</span>
            </h3>
            <div className="space-y-3">
              {players.filter(p => p.stats.kabaddi).sort((a,b) => (b.stats.kabaddi?.raidPoints || 0) - (a.stats.kabaddi?.raidPoints || 0)).slice(0, 3).map((player, i) => (
                <div key={player.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-gold-500/80 w-4">#{i+1}</span>
                    <img src={player.photo} alt={player.name} className="h-8 w-8 rounded-full object-cover border border-dark-800" />
                    <div>
                      <p className="font-bold text-white">{player.name}</p>
                      <p className="text-[10px] text-dark-400">{player.role}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-white text-sm bg-dark-900 px-2 py-1 rounded border border-dark-800">{player.stats.kabaddi?.raidPoints} pts</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Sponsor Showcase */}
        {sponsors.length > 0 && (
          <div className="glass-panel rounded-xl p-6 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gold-500/60 mb-4">Official Platform Sponsors</p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              {sponsors.map(sponsor => (
                <a
                  key={sponsor.id}
                  href={sponsor.link}
                  className="grayscale hover:grayscale-0 opacity-40 hover:opacity-100 transition-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="flex items-center space-x-2">
                    <img src={sponsor.logo} alt={sponsor.name} className="h-8 w-8 object-contain" />
                    <span className="text-white text-xs font-bold font-sans uppercase tracking-wider">{sponsor.name}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
