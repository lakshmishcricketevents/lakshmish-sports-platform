'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Tournament } from '@/lib/db';
import { Trophy, Shield, HelpCircle, Activity } from 'lucide-react';

export default function TournamentsList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTournaments() {
      try {
        const res = await fetch('/api/tournaments');
        const data = await res.json();
        if (Array.isArray(data)) {
          setTournaments(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchTournaments();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gold-500/10 pb-4 mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Trophy className="h-8 w-8 text-gold-500" />
              <span>Tournaments <span className="gold-gradient-text">Hub</span></span>
            </h1>
            <p className="text-xs text-dark-400 mt-1">Manage and view active leagues, divisions, and tournament brackets</p>
          </div>
          <Link
            href="/admin"
            className="gold-gradient-bg hover:opacity-90 text-dark-950 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg shadow-md transition-all self-start sm:self-auto"
          >
            + New Tournament
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em]" />
            <p className="mt-4 text-sm text-dark-400">Loading tournaments...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="glass-panel text-center py-12 px-4 rounded-xl border border-dashed border-gold-500/20">
            <Trophy className="h-12 w-12 text-dark-500 mx-auto mb-3" />
            <p className="text-dark-300 font-medium text-sm">No tournaments registered yet.</p>
            <p className="text-xs text-dark-500 mt-1">Go to the Admin Console to launch your first league.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tourney) => (
              <div
                key={tourney.id}
                className="glass-panel glass-panel-hover rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Icon & Sport type */}
                  <div className="flex items-center justify-between mb-4">
                    <img
                      src={tourney.logo}
                      alt={tourney.name}
                      className="h-14 w-14 object-contain bg-dark-900/50 p-2 rounded-lg border border-gold-500/20 shadow-md shadow-gold-500/5"
                    />
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        tourney.sport === 'cricket'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      }`}>
                        {tourney.sport}
                      </span>
                      <span className="block text-[10px] text-emerald-400 mt-1.5 font-bold uppercase tracking-wider flex items-center justify-end gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        {tourney.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-1">{tourney.name}</h3>
                  
                  {/* Rules snippet */}
                  <div className="bg-dark-950/40 p-3 rounded-lg border border-dark-800 text-xs text-dark-300 mb-4 flex items-start space-x-2">
                    <HelpCircle className="h-4.5 w-4.5 text-gold-500/60 shrink-0 mt-0.5" />
                    <p className="line-clamp-2 leading-relaxed">{tourney.rules}</p>
                  </div>
                </div>

                {/* Footer details */}
                <div className="border-t border-dark-800 pt-4 flex items-center justify-between mt-2">
                  <span className="text-[11px] font-semibold text-dark-400 uppercase tracking-wider">
                    {tourney.teams.length} Teams Registered
                  </span>
                  
                  <Link
                    href={`/tournaments/${tourney.id}`}
                    className="text-xs font-bold text-gold-400 hover:text-gold-350 transition-all flex items-center gap-1"
                  >
                    <span>View Standings</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
