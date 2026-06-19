'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Tournament, Match, Team } from '@/lib/db';
import { Trophy, Calendar, Users, ArrowLeft, Shield } from 'lucide-react';
import Link from 'next/link';

export default function TournamentDetails() {
  const router = useRouter();
  const { id } = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'standings' | 'fixtures' | 'teams'>('standings');

  useEffect(() => {
    async function loadData() {
      try {
        const [resTournaments, resMatches, resTeams] = await Promise.all([
          fetch('/api/tournaments').then(r => r.json()),
          fetch('/api/matches').then(r => r.json()),
          fetch('/api/teams').then(r => r.json())
        ]);

        const tourney = resTournaments.find((t: any) => t.id === id);
        if (tourney) {
          setTournament(tourney);
        }
        
        if (Array.isArray(resMatches)) {
          setMatches(resMatches.filter((m: any) => m.tournamentId === id));
        }

        if (Array.isArray(resTeams)) {
          setTeams(resTeams.filter((t: any) => tourney?.teams?.includes(t.id)));
        }
      } catch (err) {
        console.error('Error fetching tournament details:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-grow flex flex-col items-center justify-center p-8">
          <p className="text-xl font-bold text-red-400">Tournament not found</p>
          <button onClick={() => router.push('/tournaments')} className="mt-4 text-xs font-bold text-gold-450 hover:underline">
            Back to Tournaments
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const isCricket = tournament.sport === 'cricket';

  // Sort standings by points, then NRR or Score Diff
  const sortedStandings = [...(tournament.pointsTable || [])].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (isCricket) {
      return (b.netRunRate || 0) - (a.netRunRate || 0);
    } else {
      return (b.scoreDiff || 0) - (a.scoreDiff || 0);
    }
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back navigation */}
        <button
          onClick={() => router.push('/tournaments')}
          className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-dark-400 hover:text-gold-400 transition-all mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Tournaments</span>
        </button>

        {/* Hero Banner Card */}
        <div className="glass-panel border-gold-500/20 p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold-950/20 via-dark-950 to-dark-950">
          <div className="flex items-center space-x-5">
            <img
              src={tournament.logo}
              alt={tournament.name}
              className="h-16 w-16 object-contain bg-dark-900/50 p-2 rounded-xl border border-gold-500/20"
            />
            <div>
              <span className={`inline-block px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                isCricket ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
              }`}>
                {tournament.sport}
              </span>
              <h1 className="text-xl sm:text-3xl font-extrabold text-white mt-1.5">{tournament.name}</h1>
              <p className="text-xs text-dark-400 mt-1">{tournament.rules}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 bg-dark-900/40 p-4 rounded-xl border border-dark-800 self-stretch md:self-auto justify-center">
            <div className="text-center px-4 border-r border-dark-800">
              <span className="block text-2xl font-bold text-white">{teams.length}</span>
              <span className="text-[10px] text-dark-400 uppercase font-semibold">Teams</span>
            </div>
            <div className="text-center px-4">
              <span className="block text-2xl font-bold text-gold-500">{matches.length}</span>
              <span className="text-[10px] text-dark-400 uppercase font-semibold">Matches</span>
            </div>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex border-b border-dark-800 mb-6 space-x-6">
          {(['standings', 'fixtures', 'teams'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`pb-3 text-xs font-bold uppercase tracking-wider relative transition-all ${
                activeSubTab === tab ? 'text-gold-400' : 'text-dark-400 hover:text-white'
              }`}
            >
              <span className="flex items-center space-x-2">
                {tab === 'standings' && <Trophy className="h-4 w-4" />}
                {tab === 'fixtures' && <Calendar className="h-4 w-4" />}
                {tab === 'teams' && <Users className="h-4 w-4" />}
                <span>{tab}</span>
              </span>
              {activeSubTab === tab && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 gold-gradient-bg" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        {activeSubTab === 'standings' && (
          <div className="glass-panel rounded-xl overflow-hidden border border-gold-500/10">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-dark-800">
                <thead className="bg-dark-950/60 text-[10px] font-extrabold uppercase tracking-widest text-gold-450/80">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left w-16">Rank</th>
                    <th scope="col" className="px-6 py-4 text-left">Team</th>
                    <th scope="col" className="px-6 py-4 text-center">Played</th>
                    <th scope="col" className="px-6 py-4 text-center">Won</th>
                    <th scope="col" className="px-6 py-4 text-center">Lost</th>
                    <th scope="col" className="px-6 py-4 text-center">Tied</th>
                    {isCricket ? (
                      <th scope="col" className="px-6 py-4 text-center">NRR</th>
                    ) : (
                      <th scope="col" className="px-6 py-4 text-center">Score Diff</th>
                    )}
                    <th scope="col" className="px-6 py-4 text-center text-gold-400 font-extrabold">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800/60 bg-dark-950/20 text-xs">
                  {sortedStandings.map((entry, index) => (
                    <tr
                      key={entry.teamId}
                      className={`hover:bg-gold-500/[0.02] transition-colors ${
                        index < 2 ? 'bg-gold-500/[0.01]' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-center text-dark-400">
                        {index === 0 ? (
                          <span className="text-gold-400 text-sm">🥇</span>
                        ) : index === 1 ? (
                          <span className="text-dark-300 text-sm">🥈</span>
                        ) : (
                          index + 1
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-white flex items-center space-x-3">
                        <img src={entry.logo} alt={entry.teamName} className="h-6 w-6 object-contain" />
                        <span>{entry.teamName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-dark-300">{entry.played}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-emerald-400">{entry.won}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-red-400">{entry.lost}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-medium text-dark-400">{entry.tied}</td>
                      {isCricket ? (
                        <td className={`px-6 py-4 whitespace-nowrap text-center font-bold ${
                          (entry.netRunRate || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {(entry.netRunRate || 0) > 0 ? `+${entry.netRunRate}` : entry.netRunRate}
                        </td>
                      ) : (
                        <td className={`px-6 py-4 whitespace-nowrap text-center font-bold ${
                          (entry.scoreDiff || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {(entry.scoreDiff || 0) > 0 ? `+${entry.scoreDiff}` : entry.scoreDiff}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center font-extrabold text-gold-450 bg-gold-500/5 text-sm">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'fixtures' && (
          <div className="grid md:grid-cols-2 gap-6">
            {matches.length === 0 ? (
              <div className="col-span-2 glass-panel text-center py-12 px-4 rounded-xl">
                <Calendar className="h-10 w-10 text-dark-500 mx-auto mb-2" />
                <p className="text-dark-400 text-sm">No matches scheduled for this tournament yet.</p>
              </div>
            ) : (
              matches.map((match) => (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="glass-panel glass-panel-hover p-4 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div className="flex-grow">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-dark-900 border border-dark-800 text-dark-400">
                        {match.sport}
                      </span>
                      {match.status === 'live' && (
                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                          <span className="h-1 w-1 bg-red-500 rounded-full" />
                          <span>LIVE</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pr-4 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <img src={match.teamA.logo} alt="" className="w-5 h-5 object-contain" />
                          <span className="text-xs font-bold text-white truncate max-w-[140px]">{match.teamA.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <img src={match.teamB.logo} alt="" className="w-5 h-5 object-contain" />
                          <span className="text-xs font-bold text-white truncate max-w-[140px]">{match.teamB.name}</span>
                        </div>
                      </div>

                      {/* Score Summary */}
                      <div className="text-right">
                        {match.status === 'completed' ? (
                          <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Completed</div>
                        ) : match.status === 'live' ? (
                          isCricket ? (
                            <span className="text-sm font-extrabold text-white">
                              {match.cricketState?.runs}/{match.cricketState?.wickets}
                            </span>
                          ) : (
                            <span className="text-sm font-extrabold text-white">
                              {match.kabaddiState?.scoreA} : {match.kabaddiState?.scoreB}
                            </span>
                          )
                        ) : (
                          <span className="text-dark-400 text-xs">{match.date}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-gold-500 text-sm font-bold pl-2">→</div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'teams' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.length === 0 ? (
              <div className="col-span-3 glass-panel text-center py-12 px-4 rounded-xl">
                <Users className="h-10 w-10 text-dark-500 mx-auto mb-2" />
                <p className="text-dark-400 text-sm">No teams registered in this tournament.</p>
              </div>
            ) : (
              teams.map((team) => (
                <div key={team.id} className="glass-panel p-5 rounded-xl border border-gold-500/10 flex flex-col justify-between">
                  <div className="flex items-center space-x-4 mb-4">
                    <img src={team.logo} alt={team.name} className="h-12 w-12 object-contain bg-dark-900/40 p-1.5 rounded-full border border-dark-800" />
                    <div>
                      <h3 className="font-bold text-white text-base truncate max-w-[160px]">{team.name}</h3>
                      <p className="text-[10px] text-dark-400 uppercase tracking-widest font-semibold">Franchise Team</p>
                    </div>
                  </div>
                  
                  <div className="bg-dark-950/40 p-3 rounded-lg border border-dark-800 text-xs text-dark-300 space-y-1 mb-2">
                    <div className="flex justify-between">
                      <span className="text-dark-400">Squad Size:</span>
                      <span className="font-bold text-white">{team.players.length} Players</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Purse Remaining:</span>
                      <span className="font-bold text-gold-450">₹{team.purse} Lakhs</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
