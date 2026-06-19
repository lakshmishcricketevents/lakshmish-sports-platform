'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Team, Tournament, Player } from '@/lib/db';
import { Users, Shield, User, DollarSign, Activity } from 'lucide-react';

export default function KabaddiTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeamsData() {
      try {
        const [resTeams, resTournaments, resPlayers] = await Promise.all([
          fetch('/api/teams').then(r => r.json()),
          fetch('/api/tournaments').then(r => r.json()),
          fetch('/api/players').then(r => r.json())
        ]);
        
        let filteredTournaments = [];
        if (Array.isArray(resTournaments)) {
          filteredTournaments = resTournaments.filter(t => t.sport === 'kabaddi');
          setTournaments(filteredTournaments);
        }

        if (Array.isArray(resTeams)) {
          // A team is a kabaddi team if it's registered in a kabaddi tournament
          // or if it is specifically Golden Warriors
          const kabaddiTeamIds = new Set(filteredTournaments.flatMap(t => t.teams));
          const filteredTeams = resTeams.filter(team => 
            kabaddiTeamIds.has(team.id) || 
            team.name === 'Golden Warriors' ||
            team.id === 't4'
          );
          setTeams(filteredTeams);
        }

        if (Array.isArray(resPlayers)) {
          setPlayers(resPlayers);
        }
      } catch (err) {
        console.error('Failed to fetch teams info:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTeamsData();
  }, []);

  // Sub-Navigation links
  const subLinks = [
    { href: '/kabaddi', label: 'Dashboard', active: false },
    { href: '/kabaddi/matches', label: 'Matches', active: false },
    { href: '/kabaddi/teams', label: 'Teams', active: true },
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
        
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">Franchise Rosters & Squads</h1>
          <p className="text-xs text-dark-450 uppercase font-semibold mt-1">Franchise balances, rosters, and team stats</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
            <p className="mt-4 text-xs text-dark-400 uppercase font-bold tracking-widest">Loading squads...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="glass-panel text-center py-12 px-4 rounded-xl border border-purple-500/10">
            <Users className="h-10 w-10 text-dark-500 mx-auto mb-2" />
            <p className="text-dark-300 font-bold text-xs uppercase tracking-widest">No Franchise Teams Found</p>
          </div>
        ) : (
          <div className="space-y-10">
            {teams.map((team) => {
              const captain = players.find(p => p.id === team.captainId);
              const viceCaptain = players.find(p => p.id === team.viceCaptainId);
              const rosterPlayers = players.filter(p => team.players.includes(p.id));
              const league = tournaments.find(t => t.teams.includes(team.id));

              return (
                <div key={team.id} className="glass-panel border border-purple-500/10 rounded-2xl p-6 sm:p-8 bg-dark-900/20 shadow-xl space-y-6">
                  
                  {/* Team Title & Banner info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-dark-850 pb-4 gap-4">
                    <div className="flex items-center space-x-4">
                      <img src={team.logo} alt="" className="h-16 w-16 object-contain bg-dark-950 p-2 rounded-xl border border-dark-850 shadow-inner" />
                      <div>
                        <h2 className="text-xl font-black uppercase text-white tracking-wide">{team.name}</h2>
                        {league && (
                          <span className="text-[10px] text-purple-400 font-black uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded mt-1 inline-block">
                            {league.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats & Purse */}
                    <div className="flex flex-wrap gap-4 sm:gap-6 bg-dark-950/60 px-4 py-3 rounded-xl border border-dark-850 font-mono text-center">
                      <div>
                        <div className="text-[9px] text-dark-400 font-extrabold uppercase tracking-wider mb-0.5">Purse</div>
                        <div className="text-xs font-black text-purple-400 flex items-center justify-center gap-0.5">
                          <DollarSign className="h-3 w-3" />
                          <span>{team.purse}L</span>
                        </div>
                      </div>
                      <div className="border-l border-dark-850 pl-4">
                        <div className="text-[9px] text-dark-400 font-extrabold uppercase tracking-wider mb-0.5">Played</div>
                        <div className="text-xs font-black text-white">{team.stats.matchesPlayed}</div>
                      </div>
                      <div className="border-l border-dark-850 pl-4">
                        <div className="text-[9px] text-dark-400 font-extrabold uppercase tracking-wider mb-0.5">Won</div>
                        <div className="text-xs font-black text-emerald-450">{team.stats.won}</div>
                      </div>
                      <div className="border-l border-dark-850 pl-4">
                        <div className="text-[9px] text-dark-400 font-extrabold uppercase tracking-wider mb-0.5">Lost</div>
                        <div className="text-xs font-black text-red-450">{team.stats.lost}</div>
                      </div>
                      <div className="border-l border-dark-850 pl-4">
                        <div className="text-[9px] text-dark-400 font-extrabold uppercase tracking-wider mb-0.5">Points</div>
                        <div className="text-xs font-black text-purple-450">{team.stats.points}</div>
                      </div>
                    </div>
                  </div>

                  {/* Leader designations */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 bg-dark-950/40 p-3.5 rounded-xl border border-dark-850">
                      <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
                        <Shield className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-[9px] text-dark-455 font-extrabold uppercase tracking-wider">Captain</div>
                        <div className="text-xs font-black text-white uppercase tracking-wider">{captain ? captain.name : 'Not Assigned'}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 bg-dark-950/40 p-3.5 rounded-xl border border-dark-850">
                      <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="text-[9px] text-dark-455 font-extrabold uppercase tracking-wider">Vice Captain</div>
                        <div className="text-xs font-black text-white uppercase tracking-wider">{viceCaptain ? viceCaptain.name : 'Not Assigned'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Squad Roster */}
                  <div>
                    <h3 className="text-xs font-black uppercase text-dark-400 tracking-wider mb-3">Registered Squad Roster ({rosterPlayers.length})</h3>
                    {rosterPlayers.length === 0 ? (
                      <p className="text-xs text-dark-450 italic py-2">No players assigned to this roster.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rosterPlayers.map((player) => (
                          <div key={player.id} className="flex items-center space-x-3 bg-dark-950/20 border border-dark-850/80 p-3 rounded-xl hover:border-purple-500/20 transition-all">
                            <img src={player.photo} alt={player.name} className="h-10 w-10 rounded-full object-cover bg-dark-950 border border-dark-800" />
                            <div>
                              <div className="text-xs font-black text-white uppercase tracking-wider">{player.name}</div>
                              <div className="text-[9px] font-extrabold text-purple-400 uppercase tracking-wider">{player.role}</div>
                              <div className="text-[9px] text-dark-400 font-bold uppercase mt-0.5">
                                Raid Pts: {player.stats?.kabaddi?.raidPoints || 0} • Tackle Pts: {player.stats?.kabaddi?.tacklePoints || 0}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
