'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Shield, Clock, AlertCircle, Tv } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';


interface Match {
  id: string;
  supabaseId?: string;
  tournamentId: string;
  sport: 'cricket' | 'kabaddi';
  teamA: { id: string; name: string; logo: string };
  teamB: { id: string; name: string; logo: string };
  status: 'upcoming' | 'live' | 'completed';
  winnerId?: string;
  tossText?: string;
  date: string;
  controlToken?: string;
  kabaddiState?: {
    scoreA: number;
    scoreB: number;
    raidPointsA: number;
    tacklePointsA: number;
    allOutPointsA: number;
    extraPointsA: number;
    raidPointsB: number;
    tacklePointsB: number;
    allOutPointsB: number;
    extraPointsB: number;
    timeRemaining: number;
    half: 1 | 2;
    timerRunning: boolean;
    activeRaiderId?: string;
    raidTime?: number;
    raidTimerRunning?: boolean;
    doOrDie?: boolean;
    superTackle?: boolean;
    firstHalfDuration?: number;
    secondHalfDuration?: number;
    raidAudioPlayState?: 'playing' | 'paused' | 'stopped';
  };
  kabaddiActions?: Array<{
    timestamp: string;
    timeRemaining: number;
    type: 'raid_success' | 'raid_empty' | 'raid_tackled' | 'super_raid' | 'super_tackle' | 'all_out' | 'bonus' | 'technical';
    teamId: string;
    points: number;
    description: string;
  }>;
}

function KabaddiTVBroadcastContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.id as string;
  const isObsMode = searchParams.get('obs') === 'true' || searchParams.get('overlay') === 'true';

  const [match, setMatch] = useState<Match | null>(null);
  const matchRef = useRef<Match | null>(null);
  const tournamentNameVar = 'ರಣಭೈರೇಗೌಡ ಕಪ್';
  const [tournamentName, setTournamentName] = useState(tournamentNameVar);
  const [loading, setLoading] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Syncing states
  const [raidTime, setRaidTime] = useState(30);
  const [raidRunning, setRaidRunning] = useState(false);
  const [doOrDie, setDoOrDie] = useState(false);
  const [superTackle, setSuperTackle] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(2400);
  const [matchRunning, setMatchRunning] = useState(false);
  const [half, setHalf] = useState<1 | 2>(1);

  // Team names and logos
  const [kannadaNameA, setKannadaNameA] = useState('');
  const [englishNameA, setEnglishNameA] = useState('');
  const [kannadaNameB, setKannadaNameB] = useState('');
  const [englishNameB, setEnglishNameB] = useState('');
  const [logoA, setLogoA] = useState('/mascot_lion.png');
  const [logoB, setLogoB] = useState('/mascot_bull.png');

  // Helper to dynamically adjust team name font size to fit inside the background card banner box
  const getNameFontSize = (name: string, isKannada: boolean) => {
    if (!name) return isKannada ? '3.4cqh' : '2.2cqh';
    const len = name.length;
    if (isKannada) {
      if (len > 12) return '2.6cqh';
      if (len > 8) return '2.9cqh';
      return '3.4cqh';
    } else {
      if (len > 15) return '1.5cqh';
      if (len > 10) return '1.8cqh';
      return '2.2cqh';
    }
  };

  const [activeAlert, setActiveAlert] = useState<'doOrDie' | 'superTackle' | 'superRaid' | null>(null);
  const prevMatchRef = useRef<Match | null>(null);

  const raidIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Audio & Volume System
  const [volume, setVolume] = useState<'mute' | 'low' | 'medium' | 'high'>('high');
  const raidAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('broadcast_volume');
      if (stored === 'mute' || stored === 'low' || stored === 'medium' || stored === 'high') {
        setVolume(stored);
      }
    }
  }, []);

  const handleVolumeChange = (newVol: 'mute' | 'low' | 'medium' | 'high') => {
    setVolume(newVol);
    if (typeof window !== 'undefined') {
      localStorage.setItem('broadcast_volume', newVol);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio("https://bwohxfxdrsmanefxhqwq.supabase.co/storage/v1/object/public/audio/kabaddi%2030%20second%20raid%20song%20by%20Gaurav%20kumar%20_.mp3");
      audio.loop = false;
      raidAudioRef.current = audio;
    }
    return () => {
      if (raidAudioRef.current) {
        raidAudioRef.current.pause();
        raidAudioRef.current = null;
      }
    };
  }, []);

  // Initialize Audio
  const initAudio = () => {
    if (typeof window === 'undefined' || audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
        setAudioEnabled(true);
        console.log('AudioContext initialized successfully');
      }
    } catch (e) {
      console.warn('Failed to init AudioContext:', e);
    }
  };

  // Auto-init audio context in OBS mode to support autoplay
  useEffect(() => {
    if (isObsMode && !audioEnabled) {
      initAudio();
    }
  }, [isObsMode, audioEnabled]);

  // Audio alerts synth respects local volume
  const triggerAudioAlert = (type: 'tick' | 'warning' | 'buzzer') => {
    if (!audioEnabled || !audioContextRef.current) return;
    if (volume === 'mute') return;
    try {
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      let multiplier = 1.0;
      if (volume === 'low') multiplier = 0.15;
      else if (volume === 'medium') multiplier = 0.5;

      if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        gain.gain.setValueAtTime(0.12 * multiplier, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'warning') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1300, ctx.currentTime);
        gain.gain.setValueAtTime(0.2 * multiplier, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'buzzer') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, ctx.currentTime);
        gain.gain.setValueAtTime(0.35 * multiplier, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.35 * multiplier, ctx.currentTime + 0.9);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      }
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  };

  // Synchronize Audio playback based on Supabase and Local Volume state
  useEffect(() => {
    const audio = raidAudioRef.current;
    if (!audio || !match || !match.kabaddiState || !audioEnabled) return;

    const ks = match.kabaddiState;
    const playState = ks.raidAudioPlayState || (ks.raidTimerRunning ? 'playing' : 'stopped');
    const currentRaidTime = ks.raidTime !== undefined ? ks.raidTime : 30;

    // Apply Volume
    if (volume === 'mute') {
      audio.volume = 0;
    } else if (volume === 'low') {
      audio.volume = 0.15;
    } else if (volume === 'medium') {
      audio.volume = 0.5;
    } else {
      audio.volume = 1.0;
    }

    if (playState === 'playing' && currentRaidTime > 0) {
      const targetTime = 30 - currentRaidTime;
      if (audio.paused) {
        audio.currentTime = targetTime >= 0 ? targetTime : 0;
        audio.play().catch(e => console.warn('Audio play blocked:', e));
      } else {
        if (Math.abs(audio.currentTime - targetTime) > 1.5) {
          audio.currentTime = targetTime >= 0 ? targetTime : 0;
        }
      }
    } else if (playState === 'paused') {
      if (!audio.paused) {
        audio.pause();
      }
      const targetTime = 30 - currentRaidTime;
      if (Math.abs(audio.currentTime - targetTime) > 1.5) {
        audio.currentTime = targetTime >= 0 ? targetTime : 0;
      }
    } else {
      // Stopped
      if (!audio.paused) {
        audio.pause();
      }
      audio.currentTime = 0;
    }
  }, [match?.kabaddiState?.raidAudioPlayState, match?.kabaddiState?.raidTime, match?.kabaddiState?.raidTimerRunning, volume, audioEnabled]);

  // Load Data from Server
  const loadMatchData = async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}`);
      if (!res.ok) throw new Error('Failed to load match');
      const data: Match = await res.json();
      
      const oldMatch = prevMatchRef.current;
      prevMatchRef.current = data;

      if (data.kabaddiState) {
        const ks = data.kabaddiState;
        
        // 1. Do or Die trigger
        if (ks.doOrDie && (!oldMatch?.kabaddiState?.doOrDie)) {
          setActiveAlert('doOrDie');
          setTimeout(() => setActiveAlert(null), 4000);
        }
        
        // 2. Super Tackle trigger
        if (ks.superTackle && (!oldMatch?.kabaddiState?.superTackle)) {
          setActiveAlert('superTackle');
          setTimeout(() => setActiveAlert(null), 4000);
        }
      }

      // 3. Super Raid trigger
      if (data.kabaddiActions && data.kabaddiActions.length > 0) {
        const lastAction = data.kabaddiActions[data.kabaddiActions.length - 1];
        const oldLastAction = oldMatch?.kabaddiActions && oldMatch.kabaddiActions.length > 0
          ? oldMatch.kabaddiActions[oldMatch.kabaddiActions.length - 1]
          : null;
        
        if (lastAction && (!oldLastAction || oldLastAction.timestamp !== lastAction.timestamp || oldLastAction.description !== lastAction.description)) {
          if (lastAction.type === 'super_raid' || (lastAction.type === 'raid_success' && lastAction.points >= 3)) {
            setActiveAlert('superRaid');
            setTimeout(() => setActiveAlert(null), 5000);
          }
        }
      }

      setMatch(data);
      matchRef.current = data;

      if (data.kabaddiState) {
        const ks = data.kabaddiState;
        
        // Sync match clock & period
        setHalf(ks.half);
        setMatchRunning(ks.timerRunning);
        // Sync timeRemaining if match timer not running locally or if server changed it significantly
        setTimeRemaining(prev => {
          if (!ks.timerRunning || Math.abs(prev - ks.timeRemaining) > 5) {
            return ks.timeRemaining;
          }
          return prev;
        });

        // Sync statuses
        setDoOrDie(!!ks.doOrDie);
        setSuperTackle(!!ks.superTackle);

        // Sync raid clock
        setRaidRunning(!!ks.raidTimerRunning);
        setRaidTime(prev => {
          if (!ks.raidTimerRunning || ks.raidTime === undefined || Math.abs(prev - ks.raidTime) > 3) {
            return ks.raidTime !== undefined ? ks.raidTime : 30;
          }
          return prev;
        });
      }

      // Bilingual names parse
      if (data.teamA?.name) {
        const parts = data.teamA.name.split('|').map(s => s.trim());
        setKannadaNameA(parts[0] || '');
        setEnglishNameA(parts[1] || parts[0] || '');
      }
      if (data.teamB?.name) {
        const parts = data.teamB.name.split('|').map(s => s.trim());
        setKannadaNameB(parts[0] || '');
        setEnglishNameB(parts[1] || parts[0] || '');
      }

      setLogoA(data.teamA?.logo || '/mascot_lion.png');
      setLogoB(data.teamB?.logo || '/mascot_bull.png');

      if (data.tournamentId) {
        const tRes = await fetch('/api/tournaments');
        if (tRes.ok) {
          const tournaments = await tRes.json();
          const t = tournaments.find((x: any) => x.id === data.tournamentId);
          if (t?.name) setTournamentName(t.name);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!matchId) return;

    loadMatchData();

    let interval: NodeJS.Timeout | null = null;
    let channel: any = null;

    if (isSupabaseConfigured) {
      try {
        console.log('Subscribing to Supabase Realtime changes for TV Broadcast:', matchId);
        channel = supabase
          .channel(`match-${matchId}-broadcast`)
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
                updatedOriginalId === matchId ||
                (matchRef.current?.supabaseId && payload.new.id === matchRef.current.supabaseId)
              ) {
                console.log('Realtime update received on TV Broadcast:', payload.new);
                loadMatchData();
              }
            }
          )
          .subscribe();

        // Slow polling fallback (15s) in case of websocket interruptions
        interval = setInterval(loadMatchData, 15000);
      } catch (err) {
        console.error('Failed to subscribe to Supabase Realtime for TV Broadcast:', err);
        // Fall back to fast HTTP polling
        interval = setInterval(loadMatchData, 1500);
      }
    } else {
      console.log('Supabase not configured for TV Broadcast, using fast HTTP polling.');
      interval = setInterval(loadMatchData, 1500);
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
  }, [matchId]);


  // Local Raid Timer Countdown
  useEffect(() => {
    if (raidRunning) {
      raidIntervalRef.current = setInterval(() => {
        setRaidTime(prev => {
          if (prev <= 1) {
            setRaidRunning(false);
            clearInterval(raidIntervalRef.current!);
            return 0;
          }
          const nextVal = prev - 1;
          if (nextVal <= 5) {
            triggerAudioAlert('warning');
          } else {
            triggerAudioAlert('tick');
          }
          return nextVal;
        });
      }, 1000);
    } else {
      if (raidIntervalRef.current) clearInterval(raidIntervalRef.current);
    }
    return () => {
      if (raidIntervalRef.current) clearInterval(raidIntervalRef.current);
    };
  }, [raidRunning]);

  // Trigger buzzer when raidTime hits 0 (reaches completion)
  useEffect(() => {
    if (raidTime === 0) {
      triggerAudioAlert('buzzer');
    }
  }, [raidTime]);

  // Local Match Timer Countdown
  useEffect(() => {
    if (matchRunning) {
      matchIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setMatchRunning(false);
            clearInterval(matchIntervalRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (matchIntervalRef.current) clearInterval(matchIntervalRef.current);
    }
    return () => {
      if (matchIntervalRef.current) clearInterval(matchIntervalRef.current);
    };
  }, [matchRunning]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#020203] text-white font-sans">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em]" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#020203] p-8 text-center text-white">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold">Match scorecard not found</h2>
      </div>
    );
  }

  const kState = match.kabaddiState || { scoreA: 0, scoreB: 0 };

  return (
    <div 
      onClick={initAudio}
      className="h-screen w-screen text-white font-sans flex flex-col justify-between select-none relative overflow-hidden bg-black"
      style={{
        backgroundColor: isObsMode ? 'transparent' : '#000000'
      }}
    >
      {/* Subtle Hoverable Volume Control (TV/OBS Screen) */}
      <div className="absolute top-4 right-4 z-[90] opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center bg-black/80 border border-gold-500/25 p-1.5 rounded-xl space-x-1.5 text-[9px] font-bold">
        <span className="text-gold-450">🔊 VOL:</span>
        <button
          onClick={() => handleVolumeChange('mute')}
          className={`px-1.5 py-0.5 rounded cursor-pointer ${volume === 'mute' ? 'bg-red-500 text-white' : 'text-dark-300 hover:text-white'}`}
        >
          Mute
        </button>
        <button
          onClick={() => handleVolumeChange('low')}
          className={`px-1.5 py-0.5 rounded cursor-pointer ${volume === 'low' ? 'bg-gold-500 text-dark-950' : 'text-dark-300 hover:text-white'}`}
        >
          Low
        </button>
        <button
          onClick={() => handleVolumeChange('medium')}
          className={`px-1.5 py-0.5 rounded cursor-pointer ${volume === 'medium' ? 'bg-gold-500 text-dark-950' : 'text-dark-300 hover:text-white'}`}
        >
          Med
        </button>
        <button
          onClick={() => handleVolumeChange('high')}
          className={`px-1.5 py-0.5 rounded cursor-pointer ${volume === 'high' ? 'bg-gold-500 text-dark-950' : 'text-dark-300 hover:text-white'}`}
        >
          High
        </button>
      </div>
      {/* FULLSCREEN ANIMATION OVERLAYS FOR DO OR DIE, SUPER TACKLE, SUPER RAID */}
      {activeAlert && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-500">
          {activeAlert === 'doOrDie' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-red-950/90 to-black/95 border-2 border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.6)]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-shimmer" />
              <span className="text-6xl mb-2 animate-bounce">🔥</span>
              <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-widest text-[#f8c83a] text-shadow-[0_0_20px_rgba(248,200,58,0.8)] leading-none font-sans scale-in-out">
                DO OR DIE
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-red-500 mt-1 block">
                ರೈಡ್ ಅಥವಾ ಔಟ್
              </span>
              <p className="text-xs text-white/80 uppercase tracking-widest font-extrabold mt-3 border-t border-red-500/30 pt-3 leading-relaxed">
                Raider must score or he will be declared out!
              </p>
            </div>
          )}

          {activeAlert === 'superTackle' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-blue-950/90 to-black/95 border-2 border-blue-500 shadow-[0_0_100px_rgba(59,130,246,0.6)]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-shimmer" />
              <span className="text-6xl mb-2 animate-pulse">🛡️</span>
              <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-widest text-gold-400 text-shadow-[0_0_20px_rgba(234,179,8,0.8)] leading-none font-sans scale-in-out">
                SUPER TACKLE
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-blue-400 mt-1 block">
                ಸೂಪರ್ ಟ್ಯಾಕಲ್
              </span>
              <p className="text-xs text-white/80 uppercase tracking-widest font-extrabold mt-3 border-t border-blue-500/30 pt-3 leading-relaxed">
                Less than 4 defenders on court. Tackle scores 2 points!
              </p>
            </div>
          )}

          {activeAlert === 'superRaid' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-amber-950/90 to-black/95 border-2 border-[#f8c83a] shadow-[0_0_120px_rgba(248,200,58,0.7)]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-shimmer" />
              <span className="text-6xl mb-2 animate-spin-once">⚡</span>
              <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-widest text-white text-shadow-[0_0_25px_rgba(255,255,255,0.8)] leading-none font-sans scale-in-out">
                SUPER RAID!
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-[#f8c83a] mt-1 block">
                ಸೂಪರ್ ರೈಡ್
              </span>
              <p className="text-xs text-white/90 uppercase tracking-widest font-extrabold mt-3 border-t border-amber-500/30 pt-3 leading-relaxed">
                Brilliant raid! Raider scored 3 or more points!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 16:9 aspect ratio scoreboard display wrapper */}
      <div className="flex-grow w-full flex items-center justify-center overflow-hidden relative">
        <div className="aspect-video w-full h-full max-w-full max-h-full relative overflow-hidden select-none" style={{ containerType: 'size' }}>
          {/* Stadium Background Image Layer */}
          {!isObsMode && (
            <div 
              className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{
                backgroundImage: `url('/stadium_bg.jpg?v=12')`,
                zIndex: 0
              }}
            />
          )}
      {/* Dynamic CSS Styling Inject for High-Impact Broadcast graphics */}
      <style jsx global>{`
        .broadcast-score {
          font-family: 'Outfit', 'Arial Black', sans-serif;
          font-weight: 950;
        }
        .text-glow-blue {
          text-shadow: 0 0 35px rgba(59, 130, 246, 1), 0 0 70px rgba(59, 130, 246, 0.7);
        }
        .text-glow-red {
          text-shadow: 0 0 35px rgba(239, 68, 68, 1), 0 0 70px rgba(239, 68, 68, 0.7);
        }
        .text-glow-gold {
          text-shadow: 0 0 25px rgba(234, 179, 8, 1), 0 0 50px rgba(234, 179, 8, 0.6);
        }
        .glow-box-blue {
          box-shadow: 0 0 50px rgba(59, 130, 246, 0.45), inset 0 0 30px rgba(59, 130, 246, 0.35);
        }
        .glow-box-red {
          box-shadow: 0 0 50px rgba(239, 68, 68, 0.45), inset 0 0 30px rgba(239, 68, 68, 0.35);
        }
        .glow-box-gold {
          box-shadow: 0 0 40px rgba(234, 179, 8, 0.35), inset 0 0 25px rgba(234, 179, 8, 0.25);
        }
        @keyframes strobe {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.45; }
        }
        .stadium-strobe {
          position: absolute;
          width: 450px;
          height: 450px;
          background: radial-gradient(circle, rgba(234, 179, 8, 0.2) 0%, transparent 70%);
          filter: blur(50px);
          pointer-events: none;
          animation: strobe 4s infinite alternate;
        }
        @keyframes pulse-card {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.03); filter: brightness(1.15); }
        }
        .pulse-badge {
          animation: pulse-card 1.2s infinite ease-in-out;
        }
        @keyframes lightning-flash {
          0%, 94%, 96%, 100% { opacity: 0; }
          95%, 97% { opacity: 0.25; }
        }
        .lightning-flash-overlay {
          position: absolute;
          inset: 0;
          background: white;
          pointer-events: none;
          z-index: 5;
          animation: lightning-flash 7s infinite;
        }
        @keyframes fire-flicker {
          0%, 100% { transform: scale(1) translateY(0); opacity: 0.15; }
          50% { transform: scale(1.03) translateY(-8px); opacity: 0.35; }
        }
        .fire-bg-effect {
          position: absolute;
          bottom: -20px;
          width: 50vw;
          height: 30vh;
          background: radial-gradient(ellipse at bottom, rgba(239, 68, 68, 0.25) 0%, transparent 70%);
          filter: blur(40px);
          mix-blend-mode: screen;
          pointer-events: none;
          animation: fire-flicker 3s infinite ease-in-out;
        }
        /* TV broadcast score transitions animation */
        .score-anim-entry {
          animation: scale-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes scale-up {
          from { transform: scale(0.85); opacity: 0.8; }
          to { transform: scale(1); opacity: 1; }
        }
        
        /* FULLSCREEN EVENT ANIMATIONS */
        @keyframes scale-up-fade {
          0% { transform: scale(0.5); opacity: 0; }
          12% { transform: scale(1.08); opacity: 1; }
          18% { transform: scale(1); opacity: 1; }
          88% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0; }
        }
        .animate-scale-up-fade {
          animation: scale-up-fade 3.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2.5s infinite linear;
        }
        @keyframes bounce-scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .scale-in-out {
          animation: bounce-scale 1.5s infinite ease-in-out;
        }
        @keyframes spin-once {
          0% { transform: rotate(0deg) scale(0.5); }
          50% { transform: rotate(360deg) scale(1.25); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .animate-spin-once {
          animation: spin-once 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      {/* Atmospheric overlays */}
      {!isObsMode && (
        <>
          <div className="stadium-strobe top-10 left-10" />
          <div className="stadium-strobe top-10 right-10" style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)' }} />
          <div className="fire-bg-effect left-0" style={{ background: 'radial-gradient(ellipse at bottom, rgba(59, 130, 246, 0.35) 0%, transparent 75%)' }} />
          <div className="fire-bg-effect right-0" />
        </>
      )}

      {/* Audio Setup Banner (disappears on interaction) */}
      {!audioEnabled && !isObsMode && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center text-center cursor-pointer p-4 backdrop-blur-md transition-opacity duration-300">
          <div className="bg-dark-900 border-2 border-gold-500/30 p-8 rounded-3xl glow-box-gold max-w-md">
            <span className="block text-5xl mb-4">🔊</span>
            <h3 className="text-xl font-bold uppercase tracking-widest text-gold-400">ENABLE BROADCAST AUDIO</h3>
            <p className="text-xs text-dark-300 mt-2 leading-relaxed">
              Click anywhere on this screen to activate real-time score indicators, countdown beeps, and the Pro Kabaddi final buzzer sound.
            </p>
            <button className="mt-6 bg-gradient-to-r from-gold-500 to-amber-500 text-dark-950 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider">
              ACTIVATE SOUND
            </button>          </div>
        </div>
      )}

      {/* TV SCREEN CONTAINER (Full Screen Layout with Transparent Overlays inside 16:9 container) */}
      <div className="absolute inset-0 w-full h-full z-10 select-none">

        {/* Top Header Overlay: Transparent Tournament Name (No border / backdrop box) */}
        <div className="absolute left-[20%] w-[60%] top-[3%] text-center pointer-events-auto flex flex-col items-center">
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-widest text-[#f8c83a] text-glow-gold leading-none font-sans">
            {tournamentName}
          </h1>
          <p className="text-[10px] text-white/70 uppercase tracking-widest font-extrabold mt-1 block">
            ★ PKL LIVE BROADCAST SERVICE ★
          </p>
        </div>

        {/* 🦁 TRANSPARENT OVERLAY LAYERS FOR TEAMS & CORES */}
        <div className="absolute inset-0 z-25 pointer-events-none">
          
          {/* Left Team (Blue) Overlay - Positioned exactly over the blue card in background */}
          <div className="absolute left-[18.2%] top-[31.5%] w-[25%] h-[38%] pointer-events-auto text-center flex flex-col justify-between py-[1.8cqh] select-none">
            {/* Team details at the top */}
            <div className="flex flex-col items-center">
              <span className="text-[1.1cqh] text-blue-400 font-black uppercase tracking-widest block mb-[0.2cqh]">BLUE SIDE</span>
              <h2 
                className="font-black text-white leading-tight uppercase tracking-wide text-glow-blue px-[0.5cqw] truncate max-w-[80%] mx-auto"
                style={{ fontSize: getNameFontSize(kannadaNameA || 'ಕೊರಟಗೆರೆ ಕಿಂಗ್ಸ್', true) }}
              >
                {kannadaNameA || 'ಕೊರಟಗೆರೆ ಕಿಂಗ್ಸ್'}
              </h2>
              <span 
                className="text-blue-300 font-extrabold uppercase tracking-wider block mt-[0.1cqh] font-mono truncate max-w-[80%] mx-auto"
                style={{ fontSize: getNameFontSize(englishNameA || 'KORATAGERE KINGS', false) }}
              >
                {englishNameA || 'KORATAGERE KINGS'}
              </span>
            </div>

            {/* Massive Score vertically and horizontally centered in the remaining space */}
            <div className="score-anim-entry flex items-center justify-center flex-grow py-[0.5cqh]">
              <span className="text-[17cqh] font-black font-mono text-white text-glow-blue leading-none block broadcast-score">
                {kState.scoreA}
              </span>
            </div>

            {/* Points label at the bottom */}
            <div className="flex flex-col items-center">
              <span className="text-[1.8cqh] font-black text-blue-300 uppercase tracking-widest block">POINTS</span>
            </div>
          </div>

          {/* Right Team (Red) Overlay - Positioned exactly over the red card in background */}
          <div className="absolute left-[56.8%] top-[31.5%] w-[25%] h-[38%] pointer-events-auto text-center flex flex-col justify-between py-[1.8cqh] select-none">
            {/* Team details at the top */}
            <div className="flex flex-col items-center">
              <span className="text-[1.1cqh] text-red-400 font-black uppercase tracking-widest block mb-[0.2cqh]">RED SIDE</span>
              <h2 
                className="font-black text-white leading-tight uppercase tracking-wide text-glow-red px-[0.5cqw] truncate max-w-[80%] mx-auto"
                style={{ fontSize: getNameFontSize(kannadaNameB || 'ಹೊಲಾಲಿ ಟೈಗರ್ಸ್', true) }}
              >
                {kannadaNameB || 'ಹೊಲಾಲಿ ಟೈಗರ್ಸ್'}
              </h2>
              <span 
                className="text-red-300 font-extrabold uppercase tracking-wider block mt-[0.1cqh] font-mono truncate max-w-[80%] mx-auto"
                style={{ fontSize: getNameFontSize(englishNameB || 'HOLALE TIGERS', false) }}
              >
                {englishNameB || 'HOLALE TIGERS'}
              </span>
            </div>

            {/* Massive Score vertically and horizontally centered in the remaining space */}
            <div className="score-anim-entry flex items-center justify-center flex-grow py-[0.5cqh]">
              <span className="text-[17cqh] font-black font-mono text-white text-glow-red leading-none block broadcast-score">
                {kState.scoreB}
              </span>
            </div>

            {/* Points label at the bottom */}
            <div className="flex flex-col items-center">
              <span className="text-[1.8cqh] font-black text-red-300 uppercase tracking-widest block">POINTS</span>
            </div>
          </div>

          {/* Center Overlay: Raid Timer - Positioned exactly below the gold VS logo */}
          <div className="absolute left-[44%] w-[12%] top-[68%] text-center flex flex-col items-center justify-center pointer-events-auto">
            <div className={`transition-all duration-300 px-4 py-2.5 rounded-2xl ${
              raidTime <= 5 ? 'bg-red-950/60 border border-red-500/50 animate-pulse' : 'bg-black/45 border border-gold-500/20'
            }`}>
              <span className="text-[9px] font-black uppercase tracking-widest text-gold-500 block mb-0.5">RAID TIME</span>
              <span className={`text-3xl sm:text-4xl lg:text-5xl font-black font-mono leading-none block broadcast-score ${
                raidTime <= 5 ? 'text-red-500 text-shadow-[0_0_20px_rgba(239,68,68,0.95)]' : 'text-yellow-400 text-glow-gold'
              }`}>
                00:{raidTime.toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Center Overlay: Match Timer & Period - Positioned directly above the gold VS logo */}
          <div className="absolute left-[38%] w-[24%] top-[15%] text-center flex flex-col items-center justify-center gap-1.5 pointer-events-auto">
            {/* Period Badge */}
            <div className="bg-black/60 border border-gold-500/20 px-3 py-1 rounded-lg">
              <span className="text-[10px] font-black text-gold-400 uppercase tracking-widest block leading-none">
                {half === 1 ? '1ST HALF' : '2ND HALF'}
              </span>
            </div>

            {/* Match Clock */}
            <div className="bg-black/80 border border-gold-500/35 px-6 py-2.5 rounded-2xl shadow-2xl min-w-[170px] text-center">
              <span className="text-[9px] text-gold-450 font-black uppercase tracking-widest block mb-0.5">MATCH TIME</span>
              <span className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black font-mono text-white tracking-widest block leading-none text-shadow-[0_0_15px_rgba(255,255,255,0.7)]">
                {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:
                {(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Center Bottom Overlay: Do Or Die / Super Tackle statuses (floating text boxes) */}
          <div className="absolute left-[30%] w-[40%] bottom-[8%] flex justify-center items-center gap-6 pointer-events-auto">
            {doOrDie && (
              <div className="bg-amber-600 border border-amber-400 text-yellow-100 px-6 py-2 rounded-xl text-xs font-black tracking-widest uppercase shadow-xl shadow-amber-950/50 animate-pulse">
                🔥 DO OR DIE RAID (ರೈಡ್)
              </div>
            )}
            {superTackle && (
              <div className="bg-red-700 border border-red-500 text-red-100 px-6 py-2 rounded-xl text-xs font-black tracking-widest uppercase shadow-xl shadow-red-950/50 animate-pulse">
                🛡️ SUPER TACKLE ACTIVE
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  );
}

export default function KabaddiTVBroadcast() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#020203] text-white font-sans">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em]" />
      </div>
    }>
      <KabaddiTVBroadcastContent />
    </Suspense>
  );
}
