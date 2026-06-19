'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Player, Team, AuctionState } from '@/lib/db';
import { Gavel, Award, Users, TrendingUp, AlertCircle, RefreshCw, Trophy, Shield } from 'lucide-react';

export default function AuctionHub() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [auction, setAuction] = useState<AuctionState & { player?: Player | null }>({
    currentBidPlayerId: null,
    currentHighestBid: 0,
    currentHighestBidTeamId: null,
    status: 'idle',
    bids: [],
    player: null
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if session is admin
    const auth = localStorage.getItem('lce_admin_auth');
    if (auth === 'true') {
      setIsAdmin(true);
    }
    fetchAuctionData();
    const interval = setInterval(fetchAuctionData, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, []);

  async function fetchAuctionData() {
    try {
      const [resAuction, resPlayers, resTeams] = await Promise.all([
        fetch('/api/auction').then(r => r.json()),
        fetch('/api/players').then(r => r.json()),
        fetch('/api/teams').then(r => r.json())
      ]);

      if (resAuction && !resAuction.error) {
        setAuction(resAuction);
      }
      if (Array.isArray(resPlayers)) setPlayers(resPlayers);
      if (Array.isArray(resTeams)) setTeams(resTeams);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handlePlaceBid = async (teamId: string) => {
    if (auction.status !== 'bidding') return;
    const increment = auction.currentHighestBid < 200 ? 10 : 20; // Auto-increments
    const newBid = auction.currentHighestBid + increment;

    try {
      const res = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'place_bid',
          payload: { teamId, bidAmount: newBid }
        })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      fetchAuctionData();
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Actions
  const handleSetPlayer = async (playerId: string) => {
    try {
      await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_player',
          payload: { playerId }
        })
      });
      fetchAuctionData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkSold = async () => {
    try {
      await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_sold' })
      });
      fetchAuctionData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkUnsold = async () => {
    try {
      await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_unsold' })
      });
      fetchAuctionData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetAuction = async () => {
    if (!confirm('Are you sure you want to reset the current player bidding?')) return;
    try {
      await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      fetchAuctionData();
    } catch (err) {
      console.error(err);
    }
  };

  const getTeamName = (teamId?: string | null) => {
    if (!teamId) return 'None';
    return teams.find(t => t.id === teamId)?.name || 'Team';
  };

  // Filter out players already sold to some team
  const unsoldPlayers = players.filter(p => !p.soldToTeamId);

  return (
    <div className="flex flex-col min-h-screen bg-dark-950">
      <Navbar />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Title */}
        <div className="flex items-center justify-between border-b border-gold-500/10 pb-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Gavel className="h-8 w-8 text-gold-500" />
              <span>Player <span className="gold-gradient-text">Auction Room</span></span>
            </h1>
            <p className="text-xs text-dark-400 mt-1">Live player bidding room, budget purse calculations, and squad additions</p>
          </div>
          <button
            onClick={fetchAuctionData}
            className="p-2 bg-dark-900 border border-dark-800 hover:border-gold-500/25 rounded-lg text-dark-350 hover:text-gold-400 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent" />
            <p className="mt-4 text-xs text-dark-400">Loading live auction state...</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Left Column: Player Card & Live Bidding Board */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Main Auction Block */}
              {auction.status === 'idle' ? (
                <div className="glass-panel p-8 text-center rounded-2xl border border-dashed border-gold-500/20">
                  <Gavel className="h-14 w-14 text-dark-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">Bidding Block Empty</h3>
                  <p className="text-xs text-dark-450 mt-1.5 max-w-xs mx-auto">
                    No active player is currently put up for auction. {isAdmin ? 'Select an unsold player from the panel below to begin.' : 'Wait for the administrator to open bidding.'}
                  </p>
                </div>
              ) : (
                <div className="glass-panel rounded-2xl border border-gold-500/20 overflow-hidden bg-gradient-to-b from-dark-900 to-dark-950">
                  {/* Status Banner */}
                  <div className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 ${
                    auction.status === 'sold'
                      ? 'bg-emerald-500/20 text-emerald-450 border-b border-emerald-500/30'
                      : auction.status === 'unsold'
                      ? 'bg-red-500/20 text-red-450 border-b border-red-500/30'
                      : 'bg-gold-500/15 text-gold-400 border-b border-gold-500/30 animate-pulse-gold'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${auction.status === 'sold' ? 'bg-emerald-400' : auction.status === 'unsold' ? 'bg-red-450' : 'bg-gold-500'}`} />
                    <span>Live Bid Status: {auction.status}</span>
                  </div>

                  <div className="p-6 grid sm:grid-cols-2 gap-6 items-center">
                    {/* Player Image & Profile */}
                    <div className="flex flex-col items-center text-center">
                      <img
                        src={auction.player?.photo}
                        alt=""
                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-full border-2 border-gold-500 glow-gold shadow-lg bg-dark-950 mb-3"
                      />
                      <h2 className="text-xl font-extrabold text-white">{auction.player?.name}</h2>
                      <span className="bg-gold-500/15 border border-gold-500/25 text-gold-400 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest mt-1.5">
                        {auction.player?.role}
                      </span>
                    </div>

                    {/* Bid Center */}
                    <div className="bg-dark-950/60 border border-dark-850 p-5 rounded-xl text-center space-y-4">
                      <div>
                        <span className="text-[9px] font-extrabold uppercase text-dark-400 tracking-wider">Current Highest Bid</span>
                        <p className="text-4xl font-extrabold text-gold-400 tracking-tight mt-1">
                          ₹{auction.currentHighestBid} <span className="text-xs text-gold-500 font-bold">Lakhs</span>
                        </p>
                      </div>

                      <div className="border-t border-dark-850 pt-3">
                        <span className="text-[9px] font-extrabold uppercase text-dark-450 tracking-wider">Current Bid Leader</span>
                        <p className="text-sm font-bold text-white mt-1">
                          {auction.currentHighestBidTeamId ? getTeamName(auction.currentHighestBidTeamId) : 'Base Price'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manual Bid Placing (Client-side control) */}
                  {auction.status === 'bidding' && (
                    <div className="p-5 border-t border-dark-850/60 bg-dark-950/20">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-dark-400 mb-3">Submit Franchise Bid</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {teams.map(team => (
                          <button
                            key={team.id}
                            onClick={() => handlePlaceBid(team.id)}
                            disabled={team.purse < auction.currentHighestBid}
                            className="bg-dark-950 hover:border-gold-500/40 border border-dark-800 disabled:opacity-30 disabled:hover:border-dark-850 text-white px-3 py-2 rounded text-xs font-bold transition-all truncate"
                          >
                            Bid for {team.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bids history logs */}
              {auction.status !== 'idle' && (
                <div className="glass-panel p-5 rounded-xl border border-dark-850 max-h-56 overflow-y-auto">
                  <h3 className="text-xs font-extrabold uppercase text-gold-450 border-b border-dark-800 pb-2 mb-3">Live Bidding Timeline</h3>
                  <div className="space-y-2">
                    {auction.bids.length === 0 ? (
                      <p className="text-xs text-dark-500 text-center py-2">No bids recorded yet. Starting at base price.</p>
                    ) : (
                      [...auction.bids].reverse().map((bid, i) => (
                        <div key={i} className="flex justify-between items-center text-xs bg-dark-950/45 border border-dark-850 p-2.5 rounded">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-dark-400 text-[10px]">{bid.timestamp}</span>
                            <span className="font-bold text-white">{bid.teamName}</span>
                          </div>
                          <span className="font-bold text-gold-400">₹{bid.bidAmount} Lakhs</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Admin Panel Selector */}
              {isAdmin && (
                <div className="glass-panel p-6 rounded-xl border border-gold-500/25 bg-gold-500/[0.01] space-y-4">
                  <h2 className="text-sm font-extrabold text-gold-400 uppercase tracking-widest flex items-center gap-2 border-b border-dark-800 pb-2.5">
                    <Shield className="h-4.5 w-4.5" />
                    <span>Admin Auction Controller</span>
                  </h2>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleMarkSold}
                      disabled={auction.status !== 'bidding' || !auction.currentHighestBidTeamId}
                      className="bg-emerald-500 text-dark-950 disabled:opacity-40 px-4 py-2 rounded text-xs font-extrabold uppercase tracking-wider"
                    >
                      Mark SOLD
                    </button>
                    <button
                      onClick={handleMarkUnsold}
                      disabled={auction.status !== 'bidding'}
                      className="bg-red-500 text-white disabled:opacity-40 px-4 py-2 rounded text-xs font-extrabold uppercase tracking-wider"
                    >
                      Mark UNSOLD
                    </button>
                    <button
                      onClick={handleResetAuction}
                      className="border border-dark-800 hover:border-gold-500/20 text-dark-300 hover:text-gold-400 px-4 py-2 rounded text-xs font-bold"
                    >
                      Reset Bid State
                    </button>
                  </div>

                  {/* Unsold list selector */}
                  <div>
                    <label className="block text-[9px] font-extrabold uppercase tracking-widest text-dark-400 mb-2">Set Unsold Player to Bidding Block</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-40 overflow-y-auto pr-1">
                      {unsoldPlayers.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleSetPlayer(p.id)}
                          className="bg-dark-950 hover:bg-dark-900 border border-dark-800 hover:border-gold-500/20 text-white px-2.5 py-1.5 rounded text-[11px] font-bold text-left truncate flex items-center space-x-2"
                        >
                          <img src={p.photo} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                          <span className="truncate">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: Franchise budgets & rosters summary */}
            <div className="space-y-6">
              <div className="glass-panel p-5 rounded-xl border border-dark-800">
                <h3 className="text-xs font-extrabold uppercase text-gold-450 border-b border-dark-800 pb-3 mb-4 flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>Franchise Purses</span>
                </h3>

                <div className="space-y-3">
                  {teams.map(team => (
                    <div key={team.id} className="bg-dark-950/50 border border-dark-850 p-3 rounded-lg flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img src={team.logo} alt="" className="w-6 h-6 object-contain" />
                        <div>
                          <h4 className="text-xs font-bold text-white truncate max-w-[120px]">{team.name}</h4>
                          <span className="text-[9px] text-dark-450 uppercase font-semibold">{team.players.length} Players</span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="block text-xs font-extrabold text-gold-450">₹{team.purse} L</span>
                        <span className="text-[9px] text-dark-450 uppercase font-semibold">Remaining</span>
                      </div>
                    </div>
                  ))}
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
