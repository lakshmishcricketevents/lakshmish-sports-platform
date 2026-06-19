'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Player, Team } from '@/lib/db';
import { Award, Star, Search, DollarSign } from 'lucide-react';

export default function CricketPlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'All' | 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchPlayersData() {
      try {
        const [resPlayers, resTeams] = await Promise.all([
          fetch('/api/players').then(r => r.json()),
          fetch('/api/teams').then(r => r.json())
        ]);
        
        if (Array.isArray(resPlayers)) {
          // Filter to only include cricket players
          const cricketPlayers = resPlayers.filter(p => 
            p.stats?.cricket || 
            ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'].includes(p.role)
          );
          setPlayers(cricketPlayers);
        }
        if (Array.isArray(resTeams)) {
          setTeams(resTeams);
        }
      } catch (err) {
        console.error('Failed to fetch players details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchPlayersData();
  }, []);

  const filteredPlayers = players.filter((player) => {
    const matchesRole = roleFilter === 'All' || player.role === roleFilter;
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  // Sub-Navigation links
  const subLinks = [
    { href: '/cricket', label: 'Dashboard', active: false },
    { href: '/cricket/matches', label: 'Matches', active: false },
    { href: '/cricket/teams', label: 'Teams', active: false },
    { href: '/cricket/players', label: 'Players', active: true },
    { href: '/cricket/tournaments', label: 'Standings', active: false },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0B1020] text-white">
      <Navbar />

      {/* Cricket Sub-header */}
      <div className="bg-dark-950/80 border-b border-purple-500/10 sticky top-16 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between py-3 gap-3">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span className="text-sm font-black uppercase tracking-widest text-purple-400">Cricket Arena</span>
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
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Player Statistics & Registry</h1>
            <p className="text-xs text-dark-450 uppercase font-semibold mt-1">Track runs, wickets, strike-rates, and market valuations</p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search player name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-900 border border-dark-800 text-xs rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-dark-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 border-b border-dark-850 pb-4">
          {[
            { id: 'All', label: 'All Roles' },
            { id: 'Batsman', label: 'Batsmen' },
            { id: 'Bowler', label: 'Bowlers' },
            { id: 'All-Rounder', label: 'All-Rounders' },
            { id: 'Wicketkeeper', label: 'Wicketkeepers' }
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => setRoleFilter(role.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                roleFilter === role.id
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-dark-900 border-dark-800 text-dark-300 hover:text-white hover:border-dark-700'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>

        {/* Players Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
            <p className="mt-4 text-xs text-dark-400 uppercase font-bold tracking-widest">Loading stats...</p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="glass-panel text-center py-16 rounded-2xl border border-dark-850">
            <Award className="h-10 w-10 text-dark-500 mx-auto mb-2" />
            <p className="text-dark-300 font-bold text-xs uppercase tracking-widest">No Players Match Filters</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredPlayers.map((player) => {
              const owningTeam = teams.find(t => t.players.includes(player.id));
              const runs = player.stats?.cricket?.runs || 0;
              const wickets = player.stats?.cricket?.wickets || 0;
              const strikeRate = player.stats?.cricket?.strikeRate || 0;
              const matchesPlayed = player.stats?.cricket?.matches || 0;

              return (
                <div
                  key={player.id}
                  className="glass-panel border border-purple-500/10 rounded-2xl p-4.5 bg-dark-900/10 shadow-lg flex flex-col justify-between"
                >
                  <div>
                    {/* Headshot & Team Info */}
                    <div className="flex items-center space-x-3 mb-4">
                      <img
                        src={player.photo}
                        alt={player.name}
                        className="h-12 w-12 rounded-full object-cover bg-dark-950 border border-dark-800"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">{player.name}</h4>
                        <span className="text-[9px] text-purple-400 font-extrabold uppercase block mt-0.5">{player.role}</span>
                        {owningTeam ? (
                          <span className="text-[8px] text-dark-400 font-bold uppercase truncate block mt-0.5 max-w-[130px]">
                            Roster: {owningTeam.name}
                          </span>
                        ) : (
                          <span className="text-[8px] text-purple-450 font-bold uppercase block mt-0.5">
                            Unsold (Free Agent)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats List */}
                    <div className="bg-dark-950/60 p-3 rounded-xl border border-dark-850 space-y-1.5 font-mono text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-dark-400 uppercase font-sans font-extrabold text-[8px]">Matches</span>
                        <span className="text-white font-black">{matchesPlayed}</span>
                      </div>
                      <div className="flex justify-between border-t border-dark-900 pt-1.5">
                        <span className="text-dark-400 uppercase font-sans font-extrabold text-[8px]">Runs Scored</span>
                        <span className="text-white font-black">{runs}</span>
                      </div>
                      <div className="flex justify-between border-t border-dark-900 pt-1.5">
                        <span className="text-dark-400 uppercase font-sans font-extrabold text-[8px]">Wickets Taken</span>
                        <span className="text-white font-black">{wickets}</span>
                      </div>
                      <div className="flex justify-between border-t border-dark-900 pt-1.5">
                        <span className="text-dark-400 uppercase font-sans font-extrabold text-[8px]">Strike Rate</span>
                        <span className="text-white font-black">{strikeRate}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Auction details footer */}
                  <div className="border-t border-dark-850 mt-4 pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-[8px] text-dark-450 font-extrabold uppercase block leading-none">MVP Value</span>
                      <span className="text-[10px] text-white font-black mt-0.5 block font-mono">{player.mvpPoints} Pts</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[8px] text-dark-450 font-extrabold uppercase block leading-none">Base Value</span>
                      <span className="text-[10px] text-purple-450 font-black mt-0.5 block font-mono flex items-center justify-end">
                        <DollarSign className="h-2.5 w-2.5" />
                        <span>{player.auctionBaseValue}L</span>
                      </span>
                    </div>
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
