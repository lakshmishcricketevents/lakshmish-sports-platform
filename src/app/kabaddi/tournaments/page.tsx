'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Tournament, Team } from '@/lib/db';
import { Trophy, Shield, Calendar, Award } from 'lucide-react';

export default function KabaddiTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTournamentsData() {
      try {
        const res = await fetch('/api/tournaments');
        const data = await res.json();
        if (Array.isArray(data)) {
          setTournaments(data.filter(t => t.sport === 'kabaddi'));
        }
      } catch (err) {
        console.error('Failed to fetch tournaments info:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTournamentsData();
  }, []);

  // Sub-Navigation links
  const subLinks = [
    { href: '/kabaddi', label: 'Dashboard', active: false },
    { href: '/kabaddi/matches', label: 'Matches', active: false },
    { href: '/kabaddi/teams', label: 'Teams', active: false },
    { href: '/kabaddi/players', label: 'Players', active: false },
    { href: '/kabaddi/tournaments', label: 'Standings', active: true },
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

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">Leagues, Standings & Standings</h1>
          <p className="text-xs text-dark-450 uppercase font-semibold mt-1">Tournament points tables and score differences</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
            <p className="mt-4 text-xs text-dark-400 uppercase font-bold tracking-widest">Loading points tables...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="glass-panel text-center py-12 px-4 rounded-xl border border-purple-500/10">
            <Trophy className="h-10 w-10 text-dark-500 mx-auto mb-2" />
            <p className="text-dark-300 font-bold text-xs uppercase tracking-widest">No Active Kabaddi Leagues Found</p>
          </div>
        ) : (
          <div className="space-y-10">
            {tournaments.map((tourney) => {
              // Sort points table by points (descending), then by score difference (descending)
              const sortedPointsTable = [...(tourney.pointsTable || [])].sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return (b.scoreDiff || 0) - (a.scoreDiff || 0);
              });

              return (
                <div key={tourney.id} className="glass-panel border border-purple-500/10 rounded-2xl p-5 sm:p-7 bg-dark-900/20 shadow-xl space-y-6">
                  
                  {/* Tournament Title & Status */}
                  <div className="flex items-center justify-between border-b border-dark-850 pb-4">
                    <div className="flex items-center space-x-3.5">
                      <img src={tourney.logo} alt="" className="h-12 w-12 object-contain bg-dark-950 p-1.5 rounded-xl border border-dark-850" />
                      <div>
                        <h2 className="text-base font-black uppercase text-white tracking-wide">{tourney.name}</h2>
                        <span className="text-[9px] text-dark-400 uppercase font-bold">Rules: {tourney.rules}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                        <span className="h-1 w-1 bg-purple-500 rounded-full animate-pulse" />
                        {tourney.status}
                      </span>
                    </div>
                  </div>

                  {/* Points Table */}
                  <div className="overflow-x-auto border border-dark-850 rounded-xl">
                    <table className="min-w-full divide-y divide-dark-850 text-left text-xs text-white">
                      <thead className="bg-dark-950/60 text-[9px] font-extrabold uppercase tracking-widest text-dark-400">
                        <tr>
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Franchise</th>
                          <th className="px-4 py-3 text-center">Played</th>
                          <th className="px-4 py-3 text-center">Won</th>
                          <th className="px-4 py-3 text-center">Lost</th>
                          <th className="px-4 py-3 text-center">Tied</th>
                          <th className="px-4 py-3 text-center">Score Diff</th>
                          <th className="px-4 py-3 text-center text-purple-400">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-900 bg-dark-950/20">
                        {sortedPointsTable.map((row, index) => (
                          <tr key={row.teamId} className="hover:bg-dark-900/35 transition-colors">
                            <td className="px-4 py-3.5 font-bold font-mono text-dark-450">{index + 1}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center space-x-2.5">
                                <img src={row.logo} alt="" className="h-6 w-6 object-contain" />
                                <span className="font-black uppercase tracking-wider">{row.teamName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono font-bold">{row.played}</td>
                            <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-450">{row.won}</td>
                            <td className="px-4 py-3.5 text-center font-mono font-bold text-red-450">{row.lost}</td>
                            <td className="px-4 py-3.5 text-center font-mono font-bold text-dark-400">{row.tied}</td>
                            <td className={`px-4 py-3.5 text-center font-mono font-bold ${
                              (row.scoreDiff || 0) >= 0 ? 'text-emerald-450' : 'text-red-450'
                            }`}>
                              {(row.scoreDiff || 0) > 0 ? `+${row.scoreDiff}` : row.scoreDiff}
                            </td>
                            <td className="px-4 py-3.5 text-center font-mono font-black text-purple-400 text-sm">{row.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
