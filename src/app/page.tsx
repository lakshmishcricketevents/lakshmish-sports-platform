'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match, Tournament, Sponsor, Player } from '@/lib/db';
import { Play, Calendar, CheckCircle2, Trophy, Users, Award, Shield, ChevronRight, Zap, Radio, CheckSquare } from 'lucide-react';

export default function Dashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Stats for categories
  const cricketMatches = matches.filter(m => m.sport === 'cricket');
  const cricketTeams = tournaments.filter(t => t.sport === 'cricket').reduce((acc, t) => acc + (t.teams?.length || 0), 0);
  const cricketPlayers = players.filter(p => p.stats?.cricket);
  const cricketTournaments = tournaments.filter(t => t.sport === 'cricket');

  const kabaddiMatches = matches.filter(m => m.sport === 'kabaddi');
  const kabaddiTeams = tournaments.filter(t => t.sport === 'kabaddi').reduce((acc, t) => acc + (t.teams?.length || 0), 0);
  const kabaddiPlayers = players.filter(p => p.stats?.kabaddi);
  const kabaddiTournaments = tournaments.filter(t => t.sport === 'kabaddi');

  return (
    <div className="flex flex-col min-h-screen bg-brand-navy text-white">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* 1. HERO SECTION */}
        <div className="relative overflow-hidden rounded-3xl border border-purple-500/10 p-8 sm:p-14 bg-gradient-to-br from-dark-900 via-dark-950 to-[#0e122b] shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-[10px] font-black uppercase tracking-wider mb-5">
              <Award className="h-4 w-4" />
              <span>Lakshmish Sports Hub</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-4 uppercase leading-none">
              Lakshmish <span className="purple-gradient-text">Cricket Events</span>
            </h1>
            
            <h2 className="text-lg sm:text-2xl font-bold text-slate-300 mb-5 leading-normal">
              Karnataka's Premier Sports Broadcasting Platform
            </h2>
            
            <p className="text-xs sm:text-sm text-dark-300 mb-8 leading-relaxed max-w-xl">
              Experience local sports tournaments with state-of-the-art live scoreboards, match telemetry, and team statistics. Track live feeds for cricket run rates and Kabaddi countdowns cleanly on all mobile screens.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link
                href="/cricket"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white px-7 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all transform active:scale-95 shadow-lg shadow-purple-500/20 flex items-center space-x-2"
              >
                <span>Cricket Arena</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/kabaddi"
                className="bg-dark-900 border border-purple-500/25 hover:border-purple-500/50 text-purple-400 px-7 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all transform active:scale-95 flex items-center space-x-2"
              >
                <span>Kabaddi Arena</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2. LIVE NOW SECTION */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 border-b border-dark-850 pb-3">
            <span className="flex items-center space-x-1.5 bg-red-950/30 border border-red-500/30 px-2.5 py-0.5 rounded-full text-red-500 text-[10px] font-black uppercase animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span>LIVE NOW</span>
            </span>
            <p className="text-xs text-dark-400 font-bold uppercase tracking-wider">Matches Currently In Play</p>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
            </div>
          ) : liveMatches.length === 0 ? (
            <div className="glass-panel text-center py-10 px-4 rounded-2xl border border-dark-850">
              <Calendar className="h-8 w-8 text-dark-500 mx-auto mb-2" />
              <p className="text-dark-300 font-bold text-xs uppercase tracking-widest">No Matches Currently Live</p>
              <p className="text-[10px] text-dark-450 mt-1 uppercase font-semibold">Check upcoming tabs in category pages for future schedules</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {liveMatches.map((match) => {
                const isCricket = match.sport === 'cricket';
                const nameA = match.teamA.name.includes('|') ? match.teamA.name.split('|')[1].trim() : match.teamA.name;
                const nameB = match.teamB.name.includes('|') ? match.teamB.name.split('|')[1].trim() : match.teamB.name;

                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="glass-panel glass-panel-hover rounded-2xl p-4.5 flex flex-col justify-between cursor-pointer border border-purple-500/10 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-dark-850 pb-2.5">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        isCricket ? 'bg-amber-500/10 text-amber-400' : 'bg-orange-500/10 text-orange-400'
                      }`}>
                        {match.sport}
                      </span>
                      <span className="text-[9px] text-dark-450 font-bold uppercase">{match.date}</span>
                    </div>

                    <div className="grid grid-cols-7 items-center gap-2 mb-4">
                      {/* Team A */}
                      <div className="col-span-3 text-center">
                        <img
                          src={match.teamA.logo}
                          alt=""
                          className="h-10 w-10 mx-auto object-contain bg-dark-950 p-1.5 rounded-full border border-dark-850 mb-1"
                        />
                        <span className="text-[11px] font-black text-white uppercase tracking-wider block truncate max-w-[120px] mx-auto">{nameA}</span>
                      </div>

                      {/* VS */}
                      <div className="col-span-1 text-center font-black text-purple-400/40 text-xs italic">VS</div>

                      {/* Team B */}
                      <div className="col-span-3 text-center">
                        <img
                          src={match.teamB.logo}
                          alt=""
                          className="h-10 w-10 mx-auto object-contain bg-dark-950 p-1.5 rounded-full border border-dark-850 mb-1"
                        />
                        <span className="text-[11px] font-black text-white uppercase tracking-wider block truncate max-w-[120px] mx-auto">{nameB}</span>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="bg-dark-950/60 p-2.5 rounded-xl border border-dark-850 text-center font-mono font-black">
                      {isCricket ? (
                        match.cricketState ? (
                          <div className="text-white text-base">
                            {match.cricketState.runs}/{match.cricketState.wickets}
                            <span className="text-xs text-dark-450 font-normal ml-1.5">({match.cricketState.overs}.{match.cricketState.balls} Ov)</span>
                          </div>
                        ) : (
                          <span className="text-xs text-dark-400">Scoring updates pending</span>
                        )
                      ) : (
                        match.kabaddiState ? (
                          <div className="text-white text-lg tracking-widest">
                            {match.kabaddiState.scoreA} <span className="text-purple-400 font-normal">:</span> {match.kabaddiState.scoreB}
                          </div>
                        ) : (
                          <span className="text-xs text-dark-400">Scoring updates pending</span>
                        )
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. SPORTS CATEGORIES */}
        <div className="grid md:grid-cols-2 gap-8 select-none">
          
          {/* Cricket Card */}
          <div className="relative overflow-hidden rounded-2xl border border-purple-500/10 p-6 bg-gradient-to-b from-dark-900 to-dark-950 shadow-xl flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center space-x-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-amber-400 text-[9px] font-black uppercase tracking-wider mb-4">
                <span>Cricket League</span>
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Cricket Hub</h3>
              <p className="text-xs text-dark-400 leading-relaxed mb-6">
                Explore schedules, standings, franchise lineups, batsman score records, and bowling economy logs.
              </p>
              
              <div className="grid grid-cols-2 gap-4 border-t border-dark-850 pt-4 mb-6 text-[11px] font-bold text-dark-350">
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Active Tournaments</span>
                  <span className="text-white font-black">{cricketTournaments.length} Cups</span>
                </div>
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Franchise Teams</span>
                  <span className="text-white font-black">{cricketTeams} Rosters</span>
                </div>
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Matches fixtures</span>
                  <span className="text-white font-black">{cricketMatches.length} Fixtures</span>
                </div>
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Registered Batsmen</span>
                  <span className="text-white font-black">{cricketPlayers.length} Athletes</span>
                </div>
              </div>
            </div>

            <Link
              href="/cricket"
              className="w-full text-center py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
            >
              Enter Cricket Dashboard
            </Link>
          </div>

          {/* Kabaddi Card */}
          <div className="relative overflow-hidden rounded-2xl border border-purple-500/10 p-6 bg-gradient-to-b from-dark-900 to-dark-950 shadow-xl flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center space-x-1 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full text-orange-400 text-[9px] font-black uppercase tracking-wider mb-4">
                <span>Pro Kabaddi</span>
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Kabaddi Hub</h3>
              <p className="text-xs text-dark-400 leading-relaxed mb-6">
                Inspect live raid clocks, team sub-points, raid successes, super tackles, and defender standings.
              </p>
              
              <div className="grid grid-cols-2 gap-4 border-t border-dark-850 pt-4 mb-6 text-[11px] font-bold text-dark-350">
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Active Tournaments</span>
                  <span className="text-white font-black">{kabaddiTournaments.length} Leagues</span>
                </div>
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Franchise Teams</span>
                  <span className="text-white font-black">{kabaddiTeams} Squads</span>
                </div>
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Matches Scheduled</span>
                  <span className="text-white font-black">{kabaddiMatches.length} Matches</span>
                </div>
                <div>
                  <span className="text-[9px] text-dark-500 uppercase tracking-widest block">Registered Raiders</span>
                  <span className="text-white font-black">{kabaddiPlayers.length} Athletes</span>
                </div>
              </div>
            </div>

            <Link
              href="/kabaddi"
              className="w-full text-center py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
            >
              Enter Kabaddi Dashboard
            </Link>
          </div>

        </div>

        {/* 4. FEATURED TOURNAMENTS */}
        <div className="space-y-4">
          <div className="border-b border-dark-850 pb-3">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="h-5 w-5 text-purple-400" />
              <span>Featured Tournaments</span>
            </h2>
            <p className="text-[10px] text-dark-450 uppercase font-semibold mt-0.5">Important local cups & leagues</p>
          </div>

          {tournaments.length === 0 ? (
            <p className="text-center text-xs text-dark-500 py-6">No active championships registered.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.slice(0, 3).map((tour) => (
                <Link
                  key={tour.id}
                  href={`/${tour.sport}/tournaments`}
                  className="glass-panel glass-panel-hover rounded-2xl p-5 border border-purple-500/10 shadow-lg flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center mb-3">
                    <img 
                      src={tour.logo} 
                      alt="" 
                      className="w-10 h-10 object-contain bg-dark-950 p-1 rounded-xl border border-dark-850" 
                    />
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {tour.sport}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1 line-clamp-1">{tour.name}</h3>
                    <p className="text-[10px] text-dark-450 uppercase font-semibold leading-normal line-clamp-2">{tour.rules}</p>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-[9px] font-black uppercase tracking-widest text-purple-400">
                    <span>View Brackets & Standings</span>
                    <ChevronRight className="w-4 h-4 text-purple-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 5. TOP PLAYERS */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Cricket MVP */}
          <div className="glass-panel rounded-2xl p-5 border border-purple-500/10">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2 border-b border-dark-850 pb-2.5">
              <Trophy className="h-4 w-4 text-purple-500" />
              <span>Leading Run Scorers (Cricket)</span>
            </h3>
            
            <div className="space-y-3.5">
              {players.filter(p => p.stats?.cricket).length === 0 ? (
                <p className="text-center text-xs text-dark-500 py-4">No stats profiles found</p>
              ) : (
                players
                  .filter(p => p.stats?.cricket)
                  .sort((a,b) => (b.stats.cricket?.runs || 0) - (a.stats.cricket?.runs || 0))
                  .slice(0, 3)
                  .map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between text-xs transition-all hover:bg-dark-900/30 p-1 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-black text-purple-400 w-3 text-center">#{idx + 1}</span>
                        <img src={p.photo} alt="" className="w-8 h-8 rounded-full object-cover border border-dark-800" />
                        <div>
                          <p className="font-black text-white uppercase text-[11px] tracking-wide">{p.name}</p>
                          <p className="text-[8px] text-dark-450 font-black uppercase">{p.role}</p>
                        </div>
                      </div>
                      <span className="font-mono font-black text-white text-[11px] bg-dark-950 px-2 py-0.5 rounded border border-dark-850">
                        {p.stats.cricket?.runs} <span className="text-[8px] text-dark-450 font-normal uppercase">Runs</span>
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Kabaddi MVP */}
          <div className="glass-panel rounded-2xl p-5 border border-purple-500/10">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2 border-b border-dark-850 pb-2.5">
              <Award className="h-4 w-4 text-purple-500" />
              <span>Leading Raiders (Kabaddi)</span>
            </h3>
            
            <div className="space-y-3.5">
              {players.filter(p => p.stats?.kabaddi).length === 0 ? (
                <p className="text-center text-xs text-dark-500 py-4">No stats profiles found</p>
              ) : (
                players
                  .filter(p => p.stats?.kabaddi)
                  .sort((a,b) => (b.stats.kabaddi?.raidPoints || 0) - (a.stats.kabaddi?.raidPoints || 0))
                  .slice(0, 3)
                  .map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between text-xs transition-all hover:bg-dark-900/30 p-1 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-black text-purple-400 w-3 text-center">#{idx + 1}</span>
                        <img src={p.photo} alt="" className="w-8 h-8 rounded-full object-cover border border-dark-800" />
                        <div>
                          <p className="font-black text-white uppercase text-[11px] tracking-wide">{p.name}</p>
                          <p className="text-[8px] text-dark-450 font-black uppercase">{p.role}</p>
                        </div>
                      </div>
                      <span className="font-mono font-black text-white text-[11px] bg-dark-950 px-2 py-0.5 rounded border border-dark-850">
                        {p.stats.kabaddi?.raidPoints} <span className="text-[8px] text-dark-450 font-normal uppercase">Pts</span>
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

        </div>

        {/* 6. SPONSORS SECTION */}
        {sponsors.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 text-center overflow-hidden border border-purple-500/10 shadow-lg relative select-none">
            <p className="text-[8px] font-black uppercase tracking-widest text-purple-400 mb-4">Official Event & Corporate Sponsors</p>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
              {sponsors.map((sp) => (
                <a
                  key={sp.id}
                  href={sp.link}
                  className="flex items-center space-x-2.5 opacity-55 hover:opacity-100 transition-all grayscale hover:grayscale-0"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src={sp.logo} alt="" className="h-6 w-6 object-contain" />
                  <span className="text-white text-xs font-black uppercase tracking-wide">{sp.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 7. ABOUT SECTION */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-purple-500/10 shadow-lg">
          <div className="border-b border-dark-850 pb-3 mb-5 text-center sm:text-left">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Broadcasting Infrastructure Features</h3>
            <p className="text-[9px] text-dark-450 uppercase font-semibold mt-0.5">Everything you need to broadcast a tournament</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="mx-auto sm:mx-0 w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Radio className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Live Scoring</h4>
              <p className="text-[11px] text-dark-400 leading-relaxed">
                Automated scorers register run metrics and raid ticks directly from mobile phones on court, refreshing spectators within milliseconds.
              </p>
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="mx-auto sm:mx-0 w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Play className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Live Commentary</h4>
              <p className="text-[11px] text-dark-400 leading-relaxed">
                Dynamic ball-by-ball description lines generated dynamically during the match feed update commentators in real-time.
              </p>
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="mx-auto sm:mx-0 w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">WebRTC Broadcasting</h4>
              <p className="text-[11px] text-dark-400 leading-relaxed">
                Connect mobile cameras via WebRTC signal links to render high-definition streams inside the admin broadcast switcher dashboard.
              </p>
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="mx-auto sm:mx-0 w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <CheckSquare className="h-4 w-4" />
              </div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Tournament Management</h4>
              <p className="text-[11px] text-dark-400 leading-relaxed">
                Create teams, register players, initialize tournament brackets, and auto-calculate standings and net run rates cleanly.
              </p>
            </div>

          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
