'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Match, Sponsor } from '@/lib/db';
import { Tv, Clock } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';


export default function OBSOverlay() {
  const { id } = useParams() as { id: string };
  const [match, setMatch] = useState<Match | null>(null);
  const matchRef = useRef<Match | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [activeSponsorIdx, setActiveSponsorIdx] = useState(0);
  const [greenScreen, setGreenScreen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Poll Match details
  useEffect(() => {
    async function loadData() {
      try {
        const [resMatch, resSponsors] = await Promise.all([
          fetch(`/api/matches/${id}`).then(r => r.json()),
          fetch('/api/sponsors').then(r => r.json())
        ]);
        if (resMatch && !resMatch.error) {
          setMatch(resMatch);
          matchRef.current = resMatch;
        }
        if (Array.isArray(resSponsors)) setSponsors(resSponsors);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (!id) return;

    loadData();

    let interval: NodeJS.Timeout | null = null;
    let channel: any = null;

    if (isSupabaseConfigured) {
      try {
        console.log('Subscribing to Supabase Realtime changes for OBS Overlay:', id);
        channel = supabase
          .channel(`match-${id}-overlay`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'matches'
            },
            (payload) => {
              const updatedOriginalId = 
                payload.new.kabaddi_state?.originalId || 
                payload.new.cricket_state?.originalId;
              
              if (
                updatedOriginalId === id ||
                (matchRef.current?.supabaseId && payload.new.id === matchRef.current.supabaseId)
              ) {
                console.log('Realtime update received on OBS Overlay:', payload.new);
                loadData();
              }
            }
          )
          .subscribe();

        // Slow polling fallback (15s) for safety
        interval = setInterval(loadData, 15000);
      } catch (err) {
        console.error('Failed to subscribe to Supabase Realtime for OBS Overlay:', err);
        // Fall back to standard HTTP polling
        interval = setInterval(loadData, 2000);
      }
    } else {
      console.log('Supabase not configured for OBS Overlay, using standard HTTP polling.');
      interval = setInterval(loadData, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn('Failed to remove channel:', e);
        }
      }
    };
  }, [id]);

  // Sponsor cycling timer
  useEffect(() => {
    if (sponsors.length > 1) {
      const cycle = setInterval(() => {
        setActiveSponsorIdx(prev => (prev + 1) % sponsors.length);
      }, 8000);
      return () => clearInterval(cycle);
    }
  }, [sponsors]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-950 text-white font-mono text-xs">
        Connecting to scorer overlay...
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-950 text-red-400 font-mono text-xs">
        Scoreboard feed offline
      </div>
    );
  }

  const isCricket = match.sport === 'cricket';
  const cState = match.cricketState;
  const kState = match.kabaddiState;
  const activeSponsor = sponsors[activeSponsorIdx];

  return (
    <div
      className={`w-screen h-screen relative overflow-hidden transition-colors duration-300 font-sans ${
        greenScreen ? 'bg-[#00ff00]' : 'bg-transparent'
      }`}
    >
      {/* Floating control helper (hide in OBS via crop or custom CSS) */}
      <div className="absolute top-4 left-4 z-50 flex items-center space-x-2 bg-dark-950/80 border border-gold-500/20 px-3 py-1.5 rounded-lg text-[10px] text-white font-bold opacity-30 hover:opacity-100 transition-opacity">
        <Tv className="h-3.5 w-3.5 text-gold-500" />
        <span>OBS Overlay Active</span>
        <button
          onClick={() => setGreenScreen(!greenScreen)}
          className="ml-2 bg-gold-500 text-dark-950 px-2 py-0.5 rounded text-[8px] uppercase font-extrabold"
        >
          Toggle Green Screen
        </button>
      </div>

      {/* Broadcast Graphics Wrapper (Lower Third) */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-5xl">
        <div className="glass-panel border-gold-500/30 rounded-xl overflow-hidden shadow-2xl relative bg-dark-950/90 text-white border-2">
          
          {/* Main Lower Third grid */}
          <div className="grid grid-cols-12 items-center divide-x divide-gold-500/10 py-3.5 px-6">
            
            {/* 1. Left: Platform logo & Sponsor slot */}
            <div className="col-span-3 flex items-center space-x-3 pr-2.5">
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-widest uppercase gold-gradient-text">LCE LIVE</span>
                <span className="text-[8px] font-bold text-dark-400 tracking-wider uppercase -mt-0.5">Lakshmish Events</span>
              </div>
              
              {/* Rotating Sponsor Logo */}
              {activeSponsor && (
                <div className="border-l border-dark-800 pl-3 flex items-center space-x-1.5 animate-pulse">
                  <img src={activeSponsor.logo} alt="" className="w-5.5 h-5.5 object-contain" />
                  <span className="text-[9px] font-black text-white uppercase truncate max-w-[80px]">
                    {activeSponsor.name}
                  </span>
                </div>
              )}
            </div>

            {/* 2. Middle: Live score & match indicator */}
            <div className="col-span-5 flex items-center justify-center space-x-4 px-3">
              
              {/* Team A */}
              <div className="flex items-center space-x-2 w-1/3 justify-end">
                <span className="text-xs font-black truncate max-w-[90px]">{match.teamA.name}</span>
                <img src={match.teamA.logo} alt="" className="w-5 h-5 object-contain" />
              </div>

              {/* Live Score block */}
              <div className="bg-dark-950 border border-gold-500/20 px-4 py-1.5 rounded-lg text-center flex flex-col justify-center shrink-0 min-w-[120px]">
                {isCricket && cState ? (
                  <div>
                    <span className="text-base font-extrabold text-white">
                      {cState.runs}-{cState.wickets}
                    </span>
                    <span className="block text-[8px] text-dark-400 font-bold uppercase tracking-wider -mt-0.5">
                      {cState.overs}.{cState.balls} Overs
                    </span>
                  </div>
                ) : kState ? (
                  <div>
                    <span className="text-base font-extrabold text-white tracking-widest">
                      {kState.scoreA} <span className="text-gold-500 font-normal">:</span> {kState.scoreB}
                    </span>
                    <span className="block text-[8px] text-dark-400 font-bold uppercase tracking-wider -mt-0.5 flex items-center justify-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-gold-500" />
                      <span>{Math.floor(kState.timeRemaining / 60)}:{(kState.timeRemaining % 60).toString().padStart(2, '0')}</span>
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest">OFFLINE</span>
                )}
              </div>

              {/* Team B */}
              <div className="flex items-center space-x-2 w-1/3 justify-start">
                <img src={match.teamB.logo} alt="" className="w-5 h-5 object-contain" />
                <span className="text-xs font-black truncate max-w-[90px]">{match.teamB.name}</span>
              </div>

            </div>

            {/* 3. Right: Active stats (Batsman vs Bowler or kabaddi raid notes) */}
            <div className="col-span-4 flex items-center justify-between pl-4 text-xs">
              {isCricket && cState ? (
                <div className="w-full flex justify-between gap-2">
                  {/* Batsman */}
                  <div className="text-left">
                    <p className="font-extrabold text-white truncate max-w-[100px] flex items-center gap-1">
                      <span>{cState.batsmenStats.find(b => b.playerId === cState.strikerId)?.name?.split(' ')[0] || 'Batsman'}</span>
                      <span className="text-gold-500 text-[9px]">★</span>
                    </p>
                    <p className="text-[10px] text-gold-400 font-bold mt-0.5">
                      {cState.batsmenStats.find(b => b.playerId === cState.strikerId)?.runs || 0}
                      <span className="text-[9px] text-dark-400 font-normal">({cState.batsmenStats.find(b => b.playerId === cState.strikerId)?.balls || 0})</span>
                    </p>
                  </div>

                  {/* Bowler */}
                  <div className="text-right">
                    <p className="font-bold text-dark-300 truncate max-w-[100px]">
                      {cState.bowlerStats.find(b => b.playerId === cState.currentBowlerId)?.name?.split(' ')[0] || 'Bowler'}
                    </p>
                    <p className="text-[10px] text-dark-400 mt-0.5">
                      {cState.bowlerStats.find(b => b.playerId === cState.currentBowlerId)?.wickets || 0}W - {cState.bowlerStats.find(b => b.playerId === cState.currentBowlerId)?.runs || 0}R
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full text-center">
                  <p className="text-[9px] font-extrabold text-gold-450 uppercase tracking-widest">Live Action Ticker</p>
                  <p className="text-[10px] text-white truncate font-medium mt-0.5">
                    {match.kabaddiActions && match.kabaddiActions.length > 0
                      ? match.kabaddiActions[match.kabaddiActions.length - 1].description
                      : match.tossText || 'Scoring session active'}
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Scrolling Ticker Line at bottom */}
          <div className="bg-gold-500/10 border-t border-gold-500/20 py-1 px-6 flex justify-between items-center text-[9px] text-gold-400 font-bold">
            <span className="uppercase tracking-widest flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-ping" />
              <span>Broadcast Scoreboard Feed</span>
            </span>
            <span className="truncate max-w-[70%] font-semibold text-white">
              {match.tossText || 'Lakshmish Cricket Events Tournament League'}
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
