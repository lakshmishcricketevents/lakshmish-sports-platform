'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Match } from '@/lib/db';
import { Play, Calendar, CheckCircle2, ChevronRight, Activity } from 'lucide-react';

export default function KabaddiMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch('/api/matches');
        const data = await res.json();
        if (Array.isArray(data)) {
          setMatches(data.filter(m => m.sport === 'kabaddi'));
        }
      } catch (err) {
        console.error('Failed to fetch kabaddi matches:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMatches();
    const timer = setInterval(fetchMatches, 5000);
    return () => clearInterval(timer);
  }, []);

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const completedMatches = matches.filter(m => m.status === 'completed');

  const filteredMatches = 
    filter === 'live' ? liveMatches :
    filter === 'upcoming' ? upcomingMatches :
    filter === 'completed' ? completedMatches : matches;

  // Sub-Navigation links
  const subLinks = [
    { href: '/kabaddi', label: 'Dashboard', active: false },
    { href: '/kabaddi/matches', label: 'Matches', active: true },
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

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Title */}
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">Kabaddi Match Center</h1>
          <p className="text-xs text-dark-450 uppercase font-semibold mt-1">Real-time match scoring and full schedules</p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 border-b border-dark-850 pb-4">
          {[
            { id: 'all', label: `All Matches (${matches.length})` },
            { id: 'live', label: `Live (${liveMatches.length})` },
            { id: 'upcoming', label: `Upcoming (${upcomingMatches.length})` },
            { id: 'completed', label: `Completed (${completedMatches.length})` }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                filter === btn.id
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-dark-900 border-dark-800 text-dark-300 hover:text-white hover:border-dark-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Matches Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
            <p className="mt-4 text-xs text-dark-400 uppercase font-bold tracking-widest">Loading match stats...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="glass-panel text-center py-16 rounded-2xl border border-dark-850">
            <Calendar className="h-10 w-10 text-dark-500 mx-auto mb-2" />
            <p className="text-dark-300 font-bold text-xs uppercase tracking-widest">No Matches Match Filter</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match) => {
              const nameA = match.teamA.name.split('|')[1]?.trim() || match.teamA.name;
              const nameB = match.teamB.name.split('|')[1]?.trim() || match.teamB.name;
              const isLive = match.status === 'live';
              const isCompleted = match.status === 'completed';

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className={`glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between cursor-pointer border ${
                    isLive 
                      ? 'border-red-500/25 bg-gradient-to-br from-dark-900 to-red-950/5' 
                      : 'border-purple-500/10'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 border-b border-dark-850 pb-2.5">
                      {isLive ? (
                        <span className="flex items-center space-x-1 bg-red-950/20 border border-red-500/35 px-2 py-0.5 rounded-full text-red-500 text-[8px] font-black uppercase tracking-wider animate-pulse">
                          <span className="h-1 w-1 bg-red-500 rounded-full" />
                          <span>LIVE</span>
                        </span>
                      ) : isCompleted ? (
                        <span className="bg-emerald-950/20 border border-emerald-500/20 text-emerald-450 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                          Completed
                        </span>
                      ) : (
                        <span className="bg-purple-950/20 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                          Upcoming
                        </span>
                      )}
                      <span className="text-[9px] text-dark-450 font-bold uppercase">{match.date}</span>
                    </div>

                    {/* Roster & Score */}
                    <div className="space-y-4">
                      {/* Team A */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <img src={match.teamA.logo} alt="" className="h-7 w-7 object-contain bg-dark-950 p-1 rounded-full border border-dark-800" />
                          <span className="text-xs font-black text-white uppercase tracking-wider truncate max-w-[150px]">{nameA}</span>
                        </div>
                        {isCompleted && match.winnerId === match.teamA.id && (
                          <span className="text-[9px] font-bold text-purple-400 uppercase">Winner</span>
                        )}
                      </div>

                      {/* Team B */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <img src={match.teamB.logo} alt="" className="h-7 w-7 object-contain bg-dark-950 p-1 rounded-full border border-dark-800" />
                          <span className="text-xs font-black text-white uppercase tracking-wider truncate max-w-[150px]">{nameB}</span>
                        </div>
                        {isCompleted && match.winnerId === match.teamB.id && (
                          <span className="text-[9px] font-bold text-purple-400 uppercase">Winner</span>
                        )}
                      </div>
                    </div>

                    {/* Stats summary if live/completed */}
                    {(isLive || isCompleted) && match.kabaddiState && (
                      <div className="mt-4 bg-dark-950/80 p-3 rounded-xl border border-dark-850 font-mono font-black">
                        <div className="text-white text-base text-center tracking-widest">
                          {match.kabaddiState.scoreA} <span className="text-purple-400 font-normal">:</span> {match.kabaddiState.scoreB}
                        </div>
                        <div className="text-[8px] text-dark-400 uppercase tracking-widest text-center mt-1.5 font-sans font-extrabold">
                          Half: {match.kabaddiState.half} • Time Remaining: {Math.floor(match.kabaddiState.timeRemaining / 60)}m
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dark-850 pt-3.5 mt-4 flex items-center justify-between">
                    <span className="text-[9px] text-dark-450 font-extrabold uppercase">Match ID: {match.id}</span>
                    <span className="text-[9px] text-purple-400 font-black uppercase flex items-center gap-0.5 hover:underline">
                      <span>Telemetry Feed</span>
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
