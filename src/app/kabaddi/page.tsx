'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match, Tournament, Player, Team } from '@/lib/db';
import { Play, Calendar, Trophy, Users, Award, ChevronRight, Star, Activity } from 'lucide-react';

export default function KabaddiDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [resMatches, resTournaments, resTeams, resPlayers] = await Promise.all([
          fetch('/api/matches').then(r => r.json()),
          fetch('/api/tournaments').then(r => r.json()),
          fetch('/api/teams').then(r => r.json()),
          fetch('/api/players').then(r => r.json())
        ]);
        
        if (Array.isArray(resMatches)) setMatches(resMatches.filter(m => m.sport === 'kabaddi'));
        if (Array.isArray(resTournaments)) setTournaments(resTournaments.filter(t => t.sport === 'kabaddi'));
        if (Array.isArray(resTeams)) setTeams(resTeams.filter(t => tournaments.some(tour => tour.teams.includes(t.id)) || true)); // Fallback is fine
        if (Array.isArray(resPlayers)) setPlayers(resPlayers.filter(p => p.stats?.kabaddi || p.role === 'Raider' || p.role === 'Defender' || p.role === 'All-Rounder (Kabaddi)'));
      } catch (err) {
        console.error('Failed to fetch kabaddi dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, []);

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');

  // Sub-Navigation links
  const subLinks = [
    { href: '/kabaddi', label: 'Dashboard', active: true },
    { href: '/kabaddi/matches', label: 'Matches', active: false },
    { href: '/kabaddi/teams', label: 'Teams', active: false },
    { href: '/kabaddi/players', label: 'Players', active: false },
    { href: '/kabaddi/tournaments', label: 'Standings', active: false },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0B1020] text-white">
      <Navbar />

      {/* Kabaddi Sub-header */}
      <div className="bg-dark-950/80 border-b border-purple-500/10 sticky top-16 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between py-3 gap-3">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span className="text-sm font-black uppercase tracking-widest text-purple-400">Kabaddi Arena</span>
            </div>
            
            <div className="flex space-x-1 sm:space-x-2 overflow-x-auto max-w-full">
              {subLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                    link.active
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/35 shadow-sm shadow-purple-500/10'
                      : 'text-dark-300 border-transparent hover:text-white hover:bg-purple-500/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl border border-purple-500/10 p-8 sm:p-12 bg-gradient-to-br from-dark-900 via-dark-950 to-[#0e122b] shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/15 border border-purple-500/25 px-2.5 py-1 rounded-full">
              Karnataka Premier Kabaddi
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mt-4 uppercase leading-none">
              Karnataka's Premier <br />
              <span className="purple-gradient-text">Kabaddi Hub</span>
            </h1>
            <p className="text-xs sm:text-sm text-dark-300 mt-4 leading-relaxed">
              Track real-time scores, raid points, tackle counts, super raids, and standings. Use our premium match dashboard with active scoring action feeds and 30-second raid timers.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {[
            { label: 'Total Matches', value: matches.length, icon: Play },
            { label: 'Franchise Teams', value: teams.length, icon: Users },
            { label: 'Active Leagues', value: tournaments.length, icon: Trophy },
            { label: 'Registered Raiders/Defenders', value: players.length, icon: Award }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="glass-panel border border-purple-500/10 rounded-2xl p-4 sm:p-5 flex items-center space-x-4 bg-dark-900/40">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 shadow-md">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-2xl font-black text-white leading-none font-mono">{stat.value}</div>
                  <div className="text-[9px] text-dark-400 font-extrabold uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Matches Section */}
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Live & Upcoming Matches */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-dark-850 pb-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4.5 w-4.5 text-purple-400" />
                <span>Live & Scheduled matches</span>
              </h2>
              <Link href="/kabaddi/matches" className="text-[10px] font-black uppercase text-purple-400 hover:underline">
                View All Matches →
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
              </div>
            ) : liveMatches.length === 0 && upcomingMatches.length === 0 ? (
              <div className="glass-panel text-center py-12 rounded-2xl border border-dark-850">
                <Calendar className="h-8 w-8 text-dark-500 mx-auto mb-2" />
                <p className="text-dark-300 font-bold text-xs uppercase tracking-widest">No Matches Scheduled</p>
                <p className="text-[9px] text-dark-450 mt-1 uppercase font-semibold">Check back later for Kabaddi tournament schedules</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Live matches first */}
                {liveMatches.map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="glass-panel glass-panel-hover rounded-2xl p-4 flex flex-col justify-between cursor-pointer border border-red-500/20 bg-gradient-to-r from-dark-900 to-red-950/5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 h-1.5 w-1.5 bg-red-500 rounded-full m-3 animate-ping" />
                    <div className="flex items-center justify-between mb-3 border-b border-dark-850 pb-2">
                      <span className="flex items-center space-x-1.5 text-red-550 text-[9px] font-black uppercase">
                        <span className="h-1 bg-red-500 rounded-full" />
                        <span>LIVE NOW</span>
                      </span>
                      <span className="text-[9px] text-dark-450 font-bold uppercase">{match.date}</span>
                    </div>

                    <div className="grid grid-cols-7 items-center gap-2">
                      <div className="col-span-3 flex items-center space-x-3">
                        <img src={match.teamA.logo} alt="" className="h-7 w-7 object-contain bg-dark-950 p-1 rounded-full border border-dark-800" />
                        <span className="text-[11px] font-black text-white uppercase tracking-wider truncate">{match.teamA.name.split('|')[1]?.trim() || match.teamA.name}</span>
                      </div>
                      <div className="col-span-1 text-center font-black text-purple-400/30 text-xs italic">VS</div>
                      <div className="col-span-3 flex items-center justify-end space-x-3">
                        <span className="text-[11px] font-black text-white uppercase tracking-wider truncate">{match.teamB.name.split('|')[1]?.trim() || match.teamB.name}</span>
                        <img src={match.teamB.logo} alt="" className="h-7 w-7 object-contain bg-dark-950 p-1 rounded-full border border-dark-800" />
                      </div>
                    </div>

                    {match.kabaddiState && (
                      <div className="mt-3 bg-dark-950/60 p-2 rounded-xl text-center border border-dark-850">
                        <div className="text-white text-base font-black font-mono tracking-widest">
                          {match.kabaddiState.scoreA} <span className="text-purple-400 font-normal">:</span> {match.kabaddiState.scoreB}
                          <span className="text-[10px] text-dark-455 font-normal ml-3 font-sans uppercase">
                            Half: {match.kabaddiState.half}
                          </span>
                        </div>
                      </div>
                    )}
                  </Link>
                ))}

                {/* Upcoming matches */}
                {upcomingMatches.slice(0, 3).map((match) => (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="glass-panel glass-panel-hover rounded-2xl p-4 flex flex-col justify-between cursor-pointer border border-purple-500/10 bg-dark-900/20"
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-dark-850 pb-2">
                      <span className="text-purple-400 text-[9px] font-black uppercase tracking-wider">UPCOMING FIXTURE</span>
                      <span className="text-[9px] text-dark-450 font-bold uppercase">{match.date}</span>
                    </div>

                    <div className="grid grid-cols-7 items-center gap-2">
                      <div className="col-span-3 flex items-center space-x-3">
                        <img src={match.teamA.logo} alt="" className="h-7 w-7 object-contain bg-dark-950 p-1 rounded-full border border-dark-800" />
                        <span className="text-[11px] font-black text-white uppercase tracking-wider truncate">{match.teamA.name.split('|')[1]?.trim() || match.teamA.name}</span>
                      </div>
                      <div className="col-span-1 text-center font-black text-purple-400/30 text-xs italic">VS</div>
                      <div className="col-span-3 flex items-center justify-end space-x-3">
                        <span className="text-[11px] font-black text-white uppercase tracking-wider truncate">{match.teamB.name.split('|')[1]?.trim() || match.teamB.name}</span>
                        <img src={match.teamB.logo} alt="" className="h-7 w-7 object-contain bg-dark-950 p-1 rounded-full border border-dark-800" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Active Leagues & Tournaments */}
          <div className="space-y-6">
            <div className="border-b border-dark-850 pb-3">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Trophy className="h-4.5 w-4.5 text-purple-400" />
                <span>Leagues & Standings</span>
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
              </div>
            ) : tournaments.length === 0 ? (
              <p className="text-xs text-dark-455 italic py-4 text-center">No active kabaddi leagues found.</p>
            ) : (
              <div className="space-y-3">
                {tournaments.map((tourney) => (
                  <div key={tourney.id} className="bg-dark-900/40 border border-dark-850 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <img src={tourney.logo} alt="" className="h-10 w-10 object-contain bg-dark-950 p-1 rounded-lg border border-dark-800" />
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider line-clamp-1">{tourney.name}</h4>
                        <span className="text-[9px] text-dark-400 uppercase font-semibold">{tourney.teams.length} Teams • Status: {tourney.status}</span>
                      </div>
                    </div>
                    <Link
                      href={`/kabaddi/tournaments`}
                      className="p-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-455 hover:bg-purple-500/20 rounded-lg"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Players List */}
        <div className="space-y-6">
          <div className="border-b border-dark-850 pb-3">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Star className="h-4.5 w-4.5 text-purple-400" />
              <span>MVP Leaders (Kabaddi)</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
            </div>
          ) : players.length === 0 ? (
            <p className="text-xs text-dark-450 italic py-4 text-center">No active players registered.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {players.slice(0, 4).map((player) => (
                <div key={player.id} className="glass-panel border border-purple-500/10 rounded-2xl p-4 bg-dark-900/40 flex items-center space-x-4">
                  <img
                    src={player.photo}
                    alt={player.name}
                    className="h-12 w-12 rounded-full object-cover bg-dark-950 border border-dark-800"
                  />
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">{player.name}</h4>
                    <span className="text-[9px] text-purple-400 font-extrabold uppercase">{player.role}</span>
                    <div className="text-[10px] text-dark-400 font-bold uppercase mt-1">
                      Raids: {player.stats?.kabaddi?.raidPoints || 0} • Tackles: {player.stats?.kabaddi?.tacklePoints || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      <Footer />
    </div>
  );
}
