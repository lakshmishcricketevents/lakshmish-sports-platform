'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Play, Pause, RotateCcw, Shield, Undo2, Maximize2, Minimize2, Settings, Copy, Check, AlertCircle, ArrowLeft, Tv, QrCode } from 'lucide-react';
import Link from 'next/link';
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
    raidTime?: number;
    raidTimerRunning?: boolean;
    doOrDie?: boolean;
    superTackle?: boolean;
    firstHalfDuration?: number;
    secondHalfDuration?: number;
    raidAudioPlayState?: 'playing' | 'paused' | 'stopped';
  };
  kabaddiActions?: any[];
}

function KabaddiBroadcastScoreboardContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.id as string;
  const isObsMode = searchParams.get('obs') === 'true' || searchParams.get('overlay') === 'true';

  const [match, setMatch] = useState<Match | null>(null);
  const matchRef = useRef<Match | null>(null);
  const tournamentNameVar = 'ರಣಭೈರೇಗೌಡ ಕಪ್';
  const [tournamentName, setTournamentName] = useState(tournamentNameVar);
  const [loading, setLoading] = useState(true);
  const [activeAlert, setActiveAlert] = useState<'doOrDie' | 'superTackle' | 'superRaid' | null>(null);
  const prevMatchRef = useRef<Match | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlUrl, setControlUrl] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      const protocol = window.location.protocol;
      
      const isLocalhost = 
        hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '0.0.0.0';
        
      if (!isLocalhost) {
        setControlUrl(`${protocol}//${hostname}${port}/matches/${matchId}/kabaddi/control?token=${match?.controlToken || ''}`);
      } else {
        fetch('/api/cam/ip')
          .then(r => r.json())
          .then(d => {
            const ip = d.ip && d.ip !== 'localhost' ? d.ip : 'localhost';
            setControlUrl(`${protocol}//${ip}${port}/matches/${matchId}/kabaddi/control?token=${match?.controlToken || ''}`);
          })
          .catch(e => {
            console.warn('Failed to fetch local IP:', e);
            setControlUrl(`${protocol}//localhost${port}/matches/${matchId}/kabaddi/control?token=${match?.controlToken || ''}`);
          });
      }
    }
  }, [match?.controlToken, matchId]);

  // Local state for Raid Timer (30s countdown)
  const [raidTime, setRaidTime] = useState(30);
  const [raidRunning, setRaidRunning] = useState(false);
  const [doOrDie, setDoOrDie] = useState(false);
  const [superTackle, setSuperTackle] = useState(false);

  // Local state for Match Timer & refs
  const [timeRemaining, setTimeRemaining] = useState(2400);
  const [timerRunning, setTimerRunning] = useState(false);

  const isRaidTimerOwnerRef = useRef(false);
  const isMatchTimerOwnerRef = useRef(false);

  // Audio & Volume System
  const [volume, setVolume] = useState<'mute' | 'low' | 'medium' | 'high'>('medium');
  const raidAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('console_volume');
      if (stored === 'mute' || stored === 'low' || stored === 'medium' || stored === 'high') {
        setVolume(stored);
      }
    }
  }, []);

  const handleVolumeChange = (newVol: 'mute' | 'low' | 'medium' | 'high') => {
    setVolume(newVol);
    if (typeof window !== 'undefined') {
      localStorage.setItem('console_volume', newVol);
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

  // Synchronize Audio playback based on Supabase and Local Volume state
  useEffect(() => {
    const audio = raidAudioRef.current;
    if (!audio || !match || !match.kabaddiState) return;

    const ks = match.kabaddiState;
    const playState = ks.raidAudioPlayState || (raidRunning ? 'playing' : 'stopped');

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

    if (playState === 'playing' && raidTime > 0) {
      const targetTime = 30 - raidTime;
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
      const targetTime = 30 - raidTime;
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
  }, [match?.kabaddiState?.raidAudioPlayState, raidRunning, raidTime, volume]);

  // Local inputs for edit
  const [kannadaNameA, setKannadaNameA] = useState('');
  const [englishNameA, setEnglishNameA] = useState('');
  const [kannadaNameB, setKannadaNameB] = useState('');
  const [englishNameB, setEnglishNameB] = useState('');
  const [logoA, setLogoA] = useState('/mascot_lion.png');
  const [logoB, setLogoB] = useState('/mascot_bull.png');

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

  const raidIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load Initial Data
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

      // Sync states from database if not local owner
      if (data.kabaddiState) {
        const ks = data.kabaddiState;
        
        // Sync raid clock if not local owner
        if (!isRaidTimerOwnerRef.current) {
          setRaidRunning(!!ks.raidTimerRunning);
          setDoOrDie(!!ks.doOrDie);
          setSuperTackle(!!ks.superTackle);
          setRaidTime(prev => {
            if (!ks.raidTimerRunning || ks.raidTime === undefined || Math.abs(prev - ks.raidTime) > 3) {
              return ks.raidTime !== undefined ? ks.raidTime : 30;
            }
            return prev;
          });
        }

        // Sync match clock if not local owner
        if (!isMatchTimerOwnerRef.current) {
          setTimerRunning(!!ks.timerRunning);
          setTimeRemaining(prev => {
            if (!ks.timerRunning || Math.abs(prev - ks.timeRemaining) > 5) {
              return ks.timeRemaining;
            }
            return prev;
          });
        }
      }

      // Parse bilingual team names
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tournament details only when tournamentId is resolved
  useEffect(() => {
    if (match?.tournamentId) {
      fetch('/api/tournaments')
        .then(r => r.json())
        .then(tournaments => {
          const t = tournaments.find((x: any) => x.id === match.tournamentId);
          if (t?.name) setTournamentName(t.name);
        }).catch(e => console.warn(e));
    }
  }, [match?.tournamentId]);

  useEffect(() => {
    if (!matchId) return;

    loadMatchData();

    let interval: NodeJS.Timeout | null = null;
    let channel: any = null;

    if (isSupabaseConfigured) {
      try {
        console.log('Subscribing to Supabase Realtime changes for match:', matchId);
        channel = supabase
          .channel(`match-${matchId}-console`)
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
                console.log('Realtime update received:', payload.new);
                loadMatchData();
              }
            }
          )
          .subscribe();

        // Slow polling fallback (15s) in case of websocket interruptions
        interval = setInterval(loadMatchData, 15000);
      } catch (err) {
        console.error('Failed to subscribe to Supabase Realtime:', err);
        // Fall back to standard HTTP polling
        interval = setInterval(loadMatchData, 4000);
      }
    } else {
      console.log('Supabase not configured, using standard HTTP polling.');
      interval = setInterval(loadMatchData, 4000);
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

  // Audio Synthesizer Beeps (Web Audio API)
  const triggerAudioAlert = (type: 'tick' | 'warning' | 'buzzer') => {
    if (typeof window === 'undefined' || isObsMode) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'tick') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'warning') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'buzzer') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        osc.start();
        osc.stop(ctx.currentTime + 1.0);
      }
    } catch (e) {
      console.warn('Audio Context blocked or unsupported:', e);
    }
  };


  // Raid Timer Interval Control
  useEffect(() => {
    if (raidRunning) {
      raidIntervalRef.current = setInterval(() => {
        setRaidTime(prev => {
          if (prev <= 1) {
            setRaidRunning(false);
            clearInterval(raidIntervalRef.current!);
            
            if (isRaidTimerOwnerRef.current) {
              postRaidState({ raidTime: 0, raidRunning: false });
              
              // Auto-reset to 30 after 1.5 seconds delay
              setTimeout(() => {
                postRaidState({ raidTime: 30, raidRunning: false, doOrDie: false, superTackle: false });
              }, 1500);
            }

            return 0;
          }

          const nextTime = prev - 1;
          if (nextTime <= 5) {
            triggerAudioAlert('warning');
          } else {
            triggerAudioAlert('tick');
          }

          // Sync every 5 seconds to keep the TV broadcast screen aligned if we are the owner
          if (isRaidTimerOwnerRef.current && nextTime % 5 === 0) {
            fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'kabaddi_raid_state',
                payload: {
                  raidTime: nextTime,
                  raidTimerRunning: true,
                  doOrDie,
                  superTackle
                }
              })
            }).catch(e => console.warn(e));
          }

          return nextTime;
        });
      }, 1000);
    } else {
      if (raidIntervalRef.current) clearInterval(raidIntervalRef.current);
    }

    return () => {
      if (raidIntervalRef.current) clearInterval(raidIntervalRef.current);
    };
  }, [raidRunning, doOrDie, superTackle, matchId, match?.controlToken]);

  // Trigger buzzer when raidTime hits 0 (reaches completion)
  useEffect(() => {
    if (raidTime === 0) {
      triggerAudioAlert('buzzer');
    }
  }, [raidTime]);

  // Match Timer interval simulation (Runs locally when timerRunning is true)
  useEffect(() => {
    if (timerRunning) {
      matchIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            clearInterval(matchIntervalRef.current!);
            if (isMatchTimerOwnerRef.current) {
              postTimerUpdate(0, false);
            }
            return 0;
          }
          const nextTime = prev - 1;
          
          // Sync with server every 10 seconds if we are the owner
          if (isMatchTimerOwnerRef.current && nextTime % 10 === 0) {
            postTimerUpdate(nextTime, true);
          }
          return nextTime;
        });
      }, 1000);
    } else {
      if (matchIntervalRef.current) clearInterval(matchIntervalRef.current);
    }

    return () => {
      if (matchIntervalRef.current) clearInterval(matchIntervalRef.current);
    };
  }, [timerRunning, matchId]);

  // Server API posting helper
  const postTimerUpdate = async (timeRemaining: number, timerRunning: boolean) => {
    try {
      await fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kabaddi_timer',
          payload: { timeRemaining, timerRunning }
        })
      });
    } catch (e) {
      console.warn('Failed to sync match timer:', e);
    }
  };

  async function postRaidState(updates: { raidTime?: number; raidRunning?: boolean; doOrDie?: boolean; superTackle?: boolean }) {
    if (!match) return;
    isRaidTimerOwnerRef.current = true;
    const nextRaidTime = updates.raidTime !== undefined ? updates.raidTime : raidTime;
    const nextRaidRunning = updates.raidRunning !== undefined ? updates.raidRunning : raidRunning;
    const nextDoOrDie = updates.doOrDie !== undefined ? updates.doOrDie : doOrDie;
    const nextSuperTackle = updates.superTackle !== undefined ? updates.superTackle : superTackle;

    if (updates.raidTime !== undefined) setRaidTime(updates.raidTime);
    if (updates.raidRunning !== undefined) setRaidRunning(updates.raidRunning);
    if (updates.doOrDie !== undefined) setDoOrDie(updates.doOrDie);
    if (updates.superTackle !== undefined) setSuperTackle(updates.superTackle);

    try {
      await fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kabaddi_raid_state',
          payload: {
            raidTime: nextRaidTime,
            raidTimerRunning: nextRaidRunning,
            doOrDie: nextDoOrDie,
            superTackle: nextSuperTackle
          }
        })
      });
    } catch (e) {
      console.warn('Failed to sync raid state:', e);
    }
  }

  const addKabaddiPoints = async (type: string, teamId: string, points: number, desc?: string) => {
    if (!match) return;
    try {
      // Optimistic Update
      setMatch(prev => {
        if (!prev || !prev.kabaddiState) return prev;
        const state = { ...prev.kabaddiState };
        if (teamId === prev.teamA.id) {
          if (type === 'raid_success' || type === 'bonus') {
            state.scoreA += points;
          } else if (type === 'raid_tackled' || type === 'super_tackle') {
            state.scoreB += points;
          } else if (type === 'all_out') {
            state.scoreA += points;
          } else if (type === 'technical') {
            state.scoreA += points;
          }
        } else {
          if (type === 'raid_success' || type === 'bonus') {
            state.scoreB += points;
          } else if (type === 'raid_tackled' || type === 'super_tackle') {
            state.scoreA += points;
          } else if (type === 'all_out') {
            state.scoreB += points;
          } else if (type === 'technical') {
            state.scoreB += points;
          }
        }
        return { ...prev, kabaddiState: state };
      });

      const res = await fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kabaddi_points',
          payload: { type, teamId, points, description: desc }
        })
      });
      if (res.ok) {
        // Reset raid timer on successful raid score event
        isRaidTimerOwnerRef.current = true;
        setRaidTime(30);
        setRaidRunning(false);
        setDoOrDie(false);
        setSuperTackle(false);
      }
      loadMatchData();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleMatchTimer = async () => {
    if (!match) return;
    isMatchTimerOwnerRef.current = true;
    const nextRunning = !timerRunning;
    setTimerRunning(nextRunning);
    await postTimerUpdate(timeRemaining, nextRunning);
  };

  const resetMatchTimer = async () => {
    if (!match) return;
    isMatchTimerOwnerRef.current = true;
    setTimerRunning(false);
    setTimeRemaining(2400);
    await postTimerUpdate(2400, false);
  };

  const changeHalf = async (halfVal: 1 | 2) => {
    if (!match || !match.kabaddiState) return;
    try {
      const ks = match.kabaddiState;
      const firstHalfDuration = ks.firstHalfDuration !== undefined ? ks.firstHalfDuration : 1200;
      const secondHalfDuration = ks.secondHalfDuration !== undefined ? ks.secondHalfDuration : 1200;
      const nextTimeRemaining = halfVal === 1 ? firstHalfDuration : secondHalfDuration;

      isMatchTimerOwnerRef.current = true;
      setTimerRunning(false);
      setTimeRemaining(nextTimeRemaining);

      const payload = {
        kabaddiState: {
          ...match.kabaddiState,
          half: halfVal,
          timeRemaining: nextTimeRemaining,
          timerRunning: false
        }
      };
      await fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_general', payload })
      });
      loadMatchData();
    } catch (e) {
      console.error(e);
    }
  };

  const undoAction = async () => {
    try {
      isRaidTimerOwnerRef.current = false;
      isMatchTimerOwnerRef.current = false;
      const res = await fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kabaddi_undo' })
      });
      if (res.ok) {
        loadMatchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveTeamDetails = async () => {
    if (!match) return;
    try {
      const nameA = `${kannadaNameA.trim()} | ${englishNameA.trim()}`;
      const nameB = `${kannadaNameB.trim()} | ${englishNameB.trim()}`;

      const payload = {
        teamA: {
          ...match.teamA,
          name: nameA,
          logo: logoA
        },
        teamB: {
          ...match.teamB,
          name: nameB,
          logo: logoB
        }
      };

      const res = await fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_general', payload })
      });
      if (res.ok) {
        alert('Team details saved successfully!');
        loadMatchData();
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save team details.');
    }
  };

  // Full Screen API controls
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Clipboard copy for OBS browser source link
  const copyObsLink = () => {
    if (typeof window === 'undefined') return;
    const obsUrl = `${window.location.origin}/matches/${matchId}/kabaddi?obs=true`;
    navigator.clipboard.writeText(obsUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-950 text-white font-sans">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em]" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-dark-950 p-8 text-center text-white">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold">Match scorecard not found</h2>
        <Link href="/" className="mt-4 text-xs font-bold text-gold-450 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const kState = match.kabaddiState || {
    scoreA: 0, scoreB: 0, timeRemaining: 2400, half: 1, timerRunning: false,
    raidPointsA: 0, tacklePointsA: 0, allOutPointsA: 0, extraPointsA: 0,
    raidPointsB: 0, tacklePointsB: 0, allOutPointsB: 0, extraPointsB: 0
  };

  return (
    <div 
      className="h-screen w-screen text-white font-sans flex flex-col justify-between select-none relative overflow-hidden bg-black"
      style={{
        backgroundColor: isObsMode ? 'transparent' : '#000000'
      }}
    >
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
      
      {/* Custom Styles Inject for premium animations and graphics */}
      <style jsx global>{`
        body {
          margin: 0;
          overflow: ${isObsMode ? 'hidden' : 'auto'};
          background: ${isObsMode ? 'transparent !important' : '#020203'};
        }
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
        .timer-digital {
          font-family: 'Courier New', Courier, monospace;
          font-weight: bold;
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
          <div className="fire-bg-effect right-0" />
        </>
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
                {kState.half === 1 ? '1ST HALF' : '2ND HALF'}
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

      {/* ⚙️ Broadcast Controls & Toolbar (Hidden in OBS overlay) */}
      {!isObsMode && (
        <div className="bg-dark-950/90 border-t border-dark-850 p-4 relative z-30 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          
          {/* Left: Toolbar Nav */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/')}
              className="bg-dark-900 border border-dark-800 hover:border-gold-500/30 text-dark-300 hover:text-white p-2.5 rounded-xl transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowControlPanel(!showControlPanel)}
              className="bg-gold-500 text-dark-950 font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-gold-950/20 active:scale-95"
            >
              <Settings className="h-4 w-4" />
              <span>{showControlPanel ? 'Hide Controls' : 'Show Score Controller'}</span>
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-purple-950/20 active:scale-95"
            >
              <QrCode className="h-4 w-4" />
              <span>Mobile Scorer QR</span>
            </button>
          </div>

          {/* Center: Live Timer control bar */}
          <div className="flex items-center space-x-3 bg-dark-900/60 p-1.5 rounded-xl border border-dark-850">
            <button
              onClick={toggleMatchTimer}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1 ${
                timerRunning
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/25 text-emerald-450 border border-emerald-500/35'
              }`}
            >
              {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{timerRunning ? 'Pause Match' : 'Start Match'}</span>
            </button>
            <button
              onClick={resetMatchTimer}
              className="bg-dark-950 hover:bg-dark-800 text-dark-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-dark-850 text-xs font-bold uppercase"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-px bg-dark-800" />
            <button
              onClick={() => changeHalf(kState.half === 1 ? 2 : 1)}
              className="bg-dark-950 hover:bg-dark-800 text-gold-450 px-3 py-1.5 rounded-lg border border-dark-850 text-xs font-bold uppercase"
            >
              Switch Period
            </button>
          </div>

          {/* Right: Broadcast Utils */}
          <div className="flex items-center space-x-3">
            <Link
              href={`/matches/${matchId}/kabaddi/broadcast`}
              target="_blank"
              className="bg-gold-500 hover:bg-gold-600 text-dark-950 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-colors shadow-md shadow-gold-950/20"
            >
              <Tv className="h-4 w-4" />
              <span>Open TV Screen</span>
            </Link>
            <button
              onClick={copyObsLink}
              className="bg-dark-900 hover:bg-dark-800 border border-dark-800 hover:border-gold-500/30 text-dark-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-colors"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span>Copy OBS Source</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="bg-dark-900 hover:bg-dark-800 border border-dark-800 hover:border-gold-500/30 text-dark-300 hover:text-white p-2.5 rounded-xl transition-all"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4 text-gold-500" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

        </div>
      )}

      {/* 🛠️ Controller Sliding Panel Overlay */}
      {showControlPanel && !isObsMode && (
        <div className="fixed inset-0 bg-dark-950/80 z-50 flex justify-end backdrop-blur-sm animate-fadeIn">
          
          <div className="w-full max-w-lg bg-dark-900 border-l border-gold-500/20 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl animate-slideIn">
            
            {/* Control Panel Header */}
            <div className="flex justify-between items-center border-b border-dark-800 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-gold-500" />
                  <span>KABADDI SCORE CONTROLLER</span>
                </h3>
                <span className="text-[9px] text-dark-450 uppercase font-semibold">Live stream controller dashboard</span>
              </div>
              <button
                onClick={() => setShowControlPanel(false)}
                className="text-dark-400 hover:text-white text-xs font-extrabold uppercase bg-dark-950 px-3 py-1.5 rounded-lg border border-dark-850"
              >
                Close
              </button>
            </div>

            {/* Content: Forms & controls */}
            <div className="space-y-6 flex-grow pr-2">
              
              {/* 1. Edit team details (Kannada & English & Mascot) */}
              <div className="bg-dark-950 p-4 rounded-xl border border-dark-850 space-y-4">
                <span className="block text-[10px] text-gold-500 font-extrabold uppercase tracking-widest">Edit Team Identities</span>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Team A */}
                  <div className="space-y-2">
                    <label className="block text-[8px] font-bold text-blue-400 uppercase tracking-wider">Team A (Blue)</label>
                    <input
                      type="text"
                      placeholder="ಕನ್ನಡ ಹೆಸರು"
                      value={kannadaNameA}
                      onChange={(e) => setKannadaNameA(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded px-2.5 py-1 text-xs text-white placeholder-dark-500"
                    />
                    <input
                      type="text"
                      placeholder="English Name"
                      value={englishNameA}
                      onChange={(e) => setEnglishNameA(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded px-2.5 py-1 text-xs text-white placeholder-dark-500"
                    />
                    <select
                      value={logoA}
                      onChange={(e) => setLogoA(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="/mascot_lion.png">🦁 Lion (Blue)</option>
                      <option value="/mascot_bull.png">🐯 Bull (Red)</option>
                      <option value="https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&q=80&w=80">🔥 Eagle</option>
                    </select>
                  </div>

                  {/* Team B */}
                  <div className="space-y-2">
                    <label className="block text-[8px] font-bold text-red-400 uppercase tracking-wider">Team B (Red)</label>
                    <input
                      type="text"
                      placeholder="ಕನ್ನಡ ಹೆಸರು"
                      value={kannadaNameB}
                      onChange={(e) => setKannadaNameB(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded px-2.5 py-1 text-xs text-white placeholder-dark-500"
                    />
                    <input
                      type="text"
                      placeholder="English Name"
                      value={englishNameB}
                      onChange={(e) => setEnglishNameB(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded px-2.5 py-1 text-xs text-white placeholder-dark-500"
                    />
                    <select
                      value={logoB}
                      onChange={(e) => setLogoB(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="/mascot_bull.png">🐯 Bull (Red)</option>
                      <option value="/mascot_lion.png">🦁 Lion (Blue)</option>
                      <option value="https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&q=80&w=80">🔥 Eagle</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={saveTeamDetails}
                  className="w-full bg-gold-500 hover:opacity-95 text-dark-950 text-[10px] font-extrabold uppercase py-2 rounded-lg"
                >
                  Save Team Info
                </button>
              </div>

              {/* 2. Direct Score Actions */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Team A Scoring controls */}
                <div className="bg-dark-950 p-4 rounded-xl border border-blue-500/20 space-y-3">
                  <span className="block text-[9px] text-blue-400 font-extrabold uppercase tracking-widest">{englishNameA || 'Team A'} Points</span>
                  
                  <button
                    onClick={() => addKabaddiPoints('raid_success', match.teamA.id, 1, `Raid Point scored by ${englishNameA}`)}
                    className="w-full bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Raid Point (+1)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('bonus', match.teamA.id, 1, `Bonus Point secured by ${englishNameA}`)}
                    className="w-full bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Bonus Point (+1)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('raid_tackled', match.teamB.id, 1, `Tackle Point secured by ${englishNameA}`)}
                    className="w-full bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Tackle Point (+1)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('super_tackle', match.teamB.id, 2, `Super Tackle completed by ${englishNameA}!`)}
                    className="w-full bg-blue-900/40 hover:bg-blue-900/60 border border-blue-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Super Tackle (+2)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('all_out', match.teamA.id, 2, `ALL OUT Enforced by ${englishNameA}!`)}
                    className="w-full bg-[#eec750]/15 hover:bg-[#eec750]/25 border border-[#eec750]/30 text-[#eec750] text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    All Out (+2)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('technical', match.teamA.id, 1, `Technical Point awarded to ${englishNameA}`)}
                    className="w-full bg-dark-900 hover:bg-dark-800 text-dark-300 text-[10px] font-bold uppercase py-2 rounded-lg border border-dark-800"
                  >
                    Technical (+1)
                  </button>
                </div>

                {/* Team B Scoring controls */}
                <div className="bg-dark-950 p-4 rounded-xl border border-red-500/20 space-y-3">
                  <span className="block text-[9px] text-red-400 font-extrabold uppercase tracking-widest">{englishNameB || 'Team B'} Points</span>
                  
                  <button
                    onClick={() => addKabaddiPoints('raid_success', match.teamB.id, 1, `Raid Point scored by ${englishNameB}`)}
                    className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Raid Point (+1)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('bonus', match.teamB.id, 1, `Bonus Point secured by ${englishNameB}`)}
                    className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Bonus Point (+1)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('raid_tackled', match.teamA.id, 1, `Tackle Point secured by ${englishNameB}`)}
                    className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Tackle Point (+1)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('super_tackle', match.teamA.id, 2, `Super Tackle completed by ${englishNameB}!`)}
                    className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-500/30 text-white text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    Super Tackle (+2)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('all_out', match.teamB.id, 2, `ALL OUT Enforced by ${englishNameB}!`)}
                    className="w-full bg-[#eec750]/15 hover:bg-[#eec750]/25 border border-[#eec750]/30 text-[#eec750] text-[10px] font-bold uppercase py-2 rounded-lg transition-colors"
                  >
                    All Out (+2)
                  </button>
                  <button
                    onClick={() => addKabaddiPoints('technical', match.teamB.id, 1, `Technical Point awarded to ${englishNameB}`)}
                    className="w-full bg-dark-900 hover:bg-dark-800 text-dark-300 text-[10px] font-bold uppercase py-2 rounded-lg border border-dark-800"
                  >
                    Technical (+1)
                  </button>
                </div>

              </div>

              {/* 3. Raid Timer Controllers */}
              <div className="bg-dark-950 p-4 rounded-xl border border-dark-850 space-y-4">
                <span className="block text-[10px] text-gold-500 font-extrabold uppercase tracking-widest">Raid Timer Controllers</span>
                
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => postRaidState({ raidRunning: !raidRunning })}
                    className={`flex-grow py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 ${
                      raidRunning
                        ? 'bg-amber-500 text-dark-950 shadow-md shadow-amber-950/20'
                        : 'bg-emerald-500 text-dark-950 shadow-md shadow-emerald-950/20'
                    }`}
                  >
                    {raidRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    <span>{raidRunning ? 'Pause Raid' : 'Start Raid (00:30)'}</span>
                  </button>

                  <button
                    onClick={() => postRaidState({ raidTime: 30, raidRunning: false })}
                    className="bg-dark-900 hover:bg-dark-800 border border-dark-800 text-dark-300 hover:text-white p-2.5 rounded-lg"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                {/* Volume Control UI */}
                <div className="flex items-center justify-between border-t border-dark-850/60 pt-3 text-[10px] font-bold">
                  <span className="text-dark-400 uppercase tracking-widest text-[9px]">Raid Audio Volume</span>
                  <div className="flex items-center bg-dark-900 border border-dark-800 rounded-lg p-0.5 space-x-1">
                    <button
                      onClick={() => handleVolumeChange('mute')}
                      className={`px-2 py-1 rounded uppercase cursor-pointer text-[9px] ${volume === 'mute' ? 'bg-red-500 text-white' : 'text-dark-400 hover:text-white'}`}
                    >
                      Mute
                    </button>
                    <button
                      onClick={() => handleVolumeChange('low')}
                      className={`px-2 py-1 rounded uppercase cursor-pointer text-[9px] ${volume === 'low' ? 'bg-purple-600 text-white' : 'text-dark-400 hover:text-white'}`}
                    >
                      Low
                    </button>
                    <button
                      onClick={() => handleVolumeChange('medium')}
                      className={`px-2 py-1 rounded uppercase cursor-pointer text-[9px] ${volume === 'medium' ? 'bg-purple-600 text-white' : 'text-dark-400 hover:text-white'}`}
                    >
                      Med
                    </button>
                    <button
                      onClick={() => handleVolumeChange('high')}
                      className={`px-2 py-1 rounded uppercase cursor-pointer text-[9px] ${volume === 'high' ? 'bg-purple-600 text-white' : 'text-dark-400 hover:text-white'}`}
                    >
                      High
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => postRaidState({ doOrDie: !doOrDie })}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                      doOrDie
                        ? 'bg-amber-600/30 border-amber-500 text-[#fbbf24] animate-pulse'
                        : 'bg-dark-900 border-dark-850 text-dark-400'
                    }`}
                  >
                    Toggle Do Or Die
                  </button>
                  <button
                    onClick={() => postRaidState({ superTackle: !superTackle })}
                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                      superTackle
                        ? 'bg-red-650/30 border-red-500 text-[#ef4444] animate-pulse'
                        : 'bg-dark-900 border-dark-850 text-dark-400'
                    }`}
                  >
                    Toggle Super Tackle
                  </button>
                </div>
              </div>

            </div>

            {/* Footer undo / reset action buttons */}
            <div className="border-t border-dark-800 pt-4 mt-4 flex items-center justify-between gap-3">
              <button
                onClick={undoAction}
                className="bg-dark-950 hover:bg-dark-800 border border-red-500/20 text-red-400 hover:text-red-300 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 flex-grow"
              >
                <Undo2 className="h-4 w-4" />
                <span>Undo Last Event</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to reset scores?')) {
                    // Call reset scoring API or post score 0
                    isRaidTimerOwnerRef.current = true;
                    isMatchTimerOwnerRef.current = true;
                    setRaidTime(30);
                    setRaidRunning(false);
                    setDoOrDie(false);
                    setSuperTackle(false);
                    setTimerRunning(false);
                    setTimeRemaining(2400);
                    fetch(`/api/matches/${matchId}?token=${match?.controlToken}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'update_general', payload: { kabaddiState: {
                        scoreA: 0, scoreB: 0, raidPointsA: 0, tacklePointsA: 0, allOutPointsA: 0, extraPointsA: 0,
                        raidPointsB: 0, tacklePointsB: 0, allOutPointsB: 0, extraPointsB: 0,
                        timeRemaining: 2400, half: 1, timerRunning: false,
                        raidTime: 30, raidTimerRunning: false, doOrDie: false, superTackle: false
                      }, kabaddiActions: [] } })
                    }).then(() => loadMatchData());
                  }
                }}
                className="bg-dark-950 hover:bg-dark-800 border border-dark-800 text-dark-450 hover:text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase"
              >
                Reset All Scores
              </button>
            </div>

          </div>

        </div>
      )}

      {/* 📱 Mobile Scorer QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-dark-900 border-2 border-gold-500/35 p-6 rounded-3xl glow-border-gold w-full max-w-sm text-center relative">
            <button 
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-dark-400 hover:text-white font-bold text-xs bg-dark-950 px-2.5 py-1 rounded-lg border border-dark-850"
            >
              Close
            </button>
            <div className="flex flex-col items-center mt-2">
              <div className="p-3 bg-white rounded-2xl mb-4">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(controlUrl)}&color=09090b`} 
                  alt="Scorer QR Code" 
                  className="w-44 h-44 object-contain"
                />
              </div>
              <h3 className="text-sm font-black text-gold-500 uppercase tracking-widest leading-none">Mobile Scorer QR</h3>
              <span className="text-[9px] text-dark-450 uppercase font-semibold mt-1">Scan to score from your phone</span>
              
              <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[9px] text-amber-400 leading-normal text-left">
                <strong>⚠️ Wi-Fi Network Check:</strong> Both this laptop and your scanning mobile phone <strong>must</strong> be connected to the exact same Wi-Fi network!
              </div>

              <p className="text-[10px] text-dark-300 mt-3 bg-dark-950 p-2.5 rounded-xl border border-dark-850 break-all select-all leading-normal">
                {controlUrl}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function KabaddiBroadcastScoreboard() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#020203] text-white font-sans">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em]" />
      </div>
    }>
      <KabaddiBroadcastScoreboardContent />
    </Suspense>
  );
}
