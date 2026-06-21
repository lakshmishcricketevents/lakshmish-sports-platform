'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Shield, Clock, AlertCircle, Tv, Volume2, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { KabaddiAudioEngine } from '@/lib/audio';


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
    raidingTeamId?: string;
    consecutiveEmptyRaidsA?: number;
    consecutiveEmptyRaidsB?: number;
    stadiumAmbience?: boolean;
    activeAnimation?: {
      type: 'safe_raid' | 'super_raid' | 'super_tackle' | 'all_out' | 'do_or_die' | 'timeout';
      timestamp: number;
    } | null;
    activePlayersA?: number;
    activePlayersB?: number;
    branding?: any;
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
  const tournamentNameVar = 'ಪರಮೇಶ್ವರ ಕಪ್ 2026';
  const [tournamentName, setTournamentName] = useState(tournamentNameVar);
  const [loading, setLoading] = useState(true);

  // Sponsor Logo Auto-Rotation
  const [activeSponsorIndex, setActiveSponsorIndex] = useState(0);
  const [sponsorFade, setSponsorFade] = useState(true);

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
    if (!name) return isKannada ? '4.8cqh' : '3.2cqh';
    const len = name.length;
    if (isKannada) {
      if (len > 12) return '3.6cqh';
      if (len > 8) return '4.0cqh';
      return '4.8cqh';
    } else {
      if (len > 15) return '2.2cqh';
      if (len > 10) return '2.6cqh';
      return '3.2cqh';
    }
  };

  const [activeAlert, setActiveAlert] = useState<'safe_raid' | 'super_raid' | 'super_tackle' | 'all_out' | 'do_or_die' | 'timeout' | null>(null);
  const prevMatchRef = useRef<Match | null>(null);

  const raidIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio & Volume System
  const [volume, setVolume] = useState<'mute' | 'low' | 'medium' | 'high'>('high');
  const audioEngineRef = useRef<KabaddiAudioEngine | null>(null);
  const lastAnimationTimeRef = useRef<number>(0);
  const [isAudioLocked, setIsAudioLocked] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('broadcast_volume');
      if (stored === 'mute' || stored === 'low' || stored === 'medium' || stored === 'high') {
        setVolume(stored);
      }
      audioEngineRef.current = new KabaddiAudioEngine();
    }
  }, []);

  useEffect(() => {
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(volume);
    }
  }, [volume]);

  const handleVolumeChange = (newVol: 'mute' | 'low' | 'medium' | 'high') => {
    setVolume(newVol);
    if (typeof window !== 'undefined') {
      localStorage.setItem('broadcast_volume', newVol);
    }
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(newVol);
      audioEngineRef.current.resume();
    }
  };

  useEffect(() => {
    if (audioEngineRef.current) {
      if (match?.kabaddiState?.stadiumAmbience && volume !== 'mute') {
        audioEngineRef.current.startAmbience();
      } else {
        audioEngineRef.current.stopAmbience();
      }
    }
  }, [match?.kabaddiState?.stadiumAmbience, volume]);

  useEffect(() => {
    const checkLock = setInterval(() => {
      if (audioEngineRef.current) {
        const ctx = (audioEngineRef.current as any).ctx;
        if (ctx && ctx.state === 'suspended' && volume !== 'mute') {
          setIsAudioLocked(true);
        } else {
          setIsAudioLocked(false);
        }
      }
    }, 1000);
    return () => clearInterval(checkLock);
  }, [volume]);

  const resumeAudio = () => {
    if (audioEngineRef.current) {
      audioEngineRef.current.resume();
    }
  };

  // Synchronize animations and play sounds
  useEffect(() => {
    const anim = match?.kabaddiState?.activeAnimation;
    if (anim && anim.timestamp > lastAnimationTimeRef.current) {
      lastAnimationTimeRef.current = anim.timestamp;
      
      // Ignore animations that are older than 10 seconds (e.g. triggered in a previous session or load)
      if (Date.now() - anim.timestamp > 10000) {
        return;
      }
      
      setActiveAlert(anim.type);
      
      let duration = 4000;
      if (anim.type === 'super_raid') duration = 5000;
      else if (anim.type === 'all_out') duration = 5000;
      else if (anim.type === 'timeout') duration = 3000;

      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, duration);

      if (audioEngineRef.current && volume !== 'mute') {
        audioEngineRef.current.resume();
        if (anim.type === 'do_or_die') {
          audioEngineRef.current.playDoOrDieAlert();
        } else if (anim.type === 'super_raid' || anim.type === 'super_tackle') {
          audioEngineRef.current.playCelebrationChord();
        } else if (anim.type === 'timeout') {
          audioEngineRef.current.playBuzzer();
        }
      }

      return () => clearTimeout(timer);
    }
  }, [match?.kabaddiState?.activeAnimation, volume]);

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
          setActiveAlert('do_or_die');
          setTimeout(() => setActiveAlert(null), 4000);
        }
        
        // 2. Super Tackle trigger
        if (ks.superTackle && (!oldMatch?.kabaddiState?.superTackle)) {
          setActiveAlert('super_tackle');
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
            setActiveAlert('super_raid');
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

      if (data.kabaddiState && (data.kabaddiState as any).branding?.tournamentName) {
        setTournamentName((data.kabaddiState as any).branding.tournamentName);
      } else if (data.tournamentId) {
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

  const branding = match?.kabaddiState?.branding || {};
  const profile = branding.profile || {};
  const sponsorLogos = branding.sponsorLogos || [];
  const sponsorNames = branding.sponsorNames || [];
  const sponsorSubtitles = branding.sponsorSubtitles || [];
  const activeSponsors = sponsorLogos
    .map((url: string, idx: number) => ({
      url,
      name: sponsorNames[idx] || '',
      subtitle: sponsorSubtitles[idx] || ''
    }))
    .filter((s: any) => !!s.url);
  const viewMode = searchParams.get('view') || '';

  const sponsorType = branding.sponsorType || 'carousel';
  const showPresentedBy = sponsorType === 'presented';
  const currentSponsorIdx = (sponsorType === 'single' || sponsorType === 'presented') ? 0 : activeSponsorIndex;
  const currentSponsor = activeSponsors[currentSponsorIdx] || activeSponsors[0] || null;
  const sponsorHeader = showPresentedBy ? 'PRESENTED BY' : 'ಹೆಚ್ಚಿನ ಪ್ರೋತ್ಸಾಹಕರು';

  const getPositionClass = (pos: string) => {
    const map = {
      'top-left': 'top-[20px] left-[20px]',
      'top-right': 'top-[20px] right-[20px]',
      'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'bottom-left': 'bottom-[20px] left-[20px]',
      'bottom-right': 'bottom-[20px] right-[20px]'
    };
    return map[pos as keyof typeof map] || 'top-[20px] left-[20px]';
  };

  useEffect(() => {
    const sType = branding.sponsorType || 'carousel';
    if (activeSponsors.length <= 1 || sType === 'single' || sType === 'presented') return;
    const interval = setInterval(() => {
      setSponsorFade(false);
      setTimeout(() => {
        setActiveSponsorIndex(prev => (prev + 1) % activeSponsors.length);
        setSponsorFade(true);
      }, 500);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSponsors.length, branding.sponsorType]);

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
          if (audioEngineRef.current && volume !== 'mute') {
            audioEngineRef.current.playTick(nextVal);
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
  }, [raidRunning, volume]);

  // Trigger buzzer when raidTime hits 0 (reaches completion)
  useEffect(() => {
    if (raidTime === 0 && audioEngineRef.current && volume !== 'mute') {
      audioEngineRef.current.playBuzzer();
    }
  }, [raidTime, volume]);

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

  const kState = match.kabaddiState || { scoreA: 0, scoreB: 0, activePlayersA: 7, activePlayersB: 7, raidingTeamId: undefined };
  const activePlayersA = kState.activePlayersA !== undefined ? kState.activePlayersA : 7;
  const activePlayersB = kState.activePlayersB !== undefined ? kState.activePlayersB : 7;

  const getWinProbability = () => {
    const scoreA = kState.scoreA || 0;
    const scoreB = kState.scoreB || 0;
    if (scoreA === 0 && scoreB === 0) return { probA: 50, probB: 50 };
    
    const diff = scoreA - scoreB;
    const timeRemainingVal = timeRemaining !== undefined ? timeRemaining : 2400;
    
    const timeFraction = (2400 - timeRemainingVal) / 2400;
    const weight = 1.2 + timeFraction * 3.8;
    
    let probA = 50 + diff * weight;
    probA = Math.max(5, Math.min(95, Math.round(probA)));
    const probB = 100 - probA;
    
    return { probA, probB };
  };

  const getLastRaidAction = () => {
    if (!match.kabaddiActions || match.kabaddiActions.length === 0) return null;
    const raidActionTypes = ['raid_success', 'bonus', 'raid_tackled', 'super_tackle', 'raid_empty'];
    for (let i = match.kabaddiActions.length - 1; i >= 0; i--) {
      const act = match.kabaddiActions[i];
      if (raidActionTypes.includes(act.type)) {
        return act;
      }
    }
    return null;
  };

  const formatLastRaidResult = (act: any) => {
    const teamName = act.teamId === match.teamA.id 
      ? (englishNameA.split(' ')[0] || 'BLUE') 
      : (englishNameB.split(' ')[0] || 'RED');
      
    if (act.type === 'raid_empty') {
      return `${teamName} - EMPTY RAID`;
    }
    if (act.type === 'raid_success') {
      return `${teamName} - SUCCESS (+${act.points} PTS)`;
    }
    if (act.type === 'bonus') {
      return `${teamName} - BONUS (+${act.points} PTS)`;
    }
    if (act.type === 'raid_tackled') {
      const defenderTeamName = act.teamId === match.teamA.id ? (englishNameB.split(' ')[0] || 'RED') : (englishNameA.split(' ')[0] || 'BLUE');
      return `${teamName} TACKLED (+1 PT TO ${defenderTeamName})`;
    }
    if (act.type === 'super_tackle') {
      const defenderTeamName = act.teamId === match.teamA.id ? (englishNameB.split(' ')[0] || 'RED') : (englishNameA.split(' ')[0] || 'BLUE');
      return `SUPER TACKLE (+2 PTS TO ${defenderTeamName})`;
    }
    return act.description;
  };

  const lastRaidAction = getLastRaidAction();

  return (
    <div 
      onClick={resumeAudio}
      className="h-screen w-screen text-white font-sans flex flex-col justify-between select-none relative overflow-hidden bg-black"
      style={{
        backgroundColor: isObsMode ? 'transparent' : '#000000'
      }}
    >
      {/* 🔊 TAP TO UNLOCK SOUNDS Indicator */}
      {isAudioLocked && (
        <button
          onClick={() => {
            if (audioEngineRef.current) {
              audioEngineRef.current.resume();
            }
            setIsAudioLocked(false);
          }}
          className="absolute top-4 left-4 z-[200] bg-[#EEF824] hover:bg-yellow-400 text-dark-950 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest animate-pulse flex items-center space-x-1.5 shadow-xl shadow-yellow-500/30 cursor-pointer border border-dark-900"
        >
          <Volume2 className="h-4 w-4 animate-bounce" />
          <span>Tap to Unlock Audio</span>
        </button>
      )}

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

      {/* FULLSCREEN ANIMATION OVERLAYS FOR DO OR DIE, SUPER TACKLE, SUPER RAID, ALL OUT, SAFE RAID, TIMEOUT */}
      {activeAlert && (
        <div 
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/75 transition-all duration-500"
          style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          
          {/* Close button at the top center to manually dismiss the overlay */}
          <button
            onClick={() => setActiveAlert(null)}
            className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white p-2 rounded-full transition-all duration-300 shadow-lg cursor-pointer flex items-center justify-center z-[110] active:scale-90"
            title="Dismiss Animation"
          >
            <X className="h-5 w-5" />
          </button>
          
          {activeAlert === 'do_or_die' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-red-950/90 to-black/95 border-4 border-[#EEF824] shadow-[0_0_120px_rgba(238,248,36,0.65)]">
              <div className="absolute inset-0 border-2 border-red-500 rounded-[22px] animate-pulse pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[#EEF824] to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[#EEF824] to-transparent animate-shimmer" />
              <span className="text-7xl mb-2 animate-bounce">🔥</span>
              <h2 className="text-5xl sm:text-6xl font-black uppercase tracking-widest text-[#EEF824] text-shadow-[0_0_30px_rgba(238,248,36,0.95)] leading-none font-sans scale-in-out">
                DO OR DIE!
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-red-500 mt-1 block">
                ರೈಡ್ ಅಥವಾ ಔಟ್
              </span>
              <p className="text-xs text-white/90 uppercase tracking-widest font-extrabold mt-4 border-t border-red-500/30 pt-3 leading-relaxed">
                Raider must score or he will be declared out!
              </p>
            </div>
          )}

          {activeAlert === 'super_tackle' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-blue-950/90 to-black/95 border-4 border-blue-500 shadow-[0_0_100px_rgba(59,130,246,0.65)]">
              <div className="absolute inset-0 border-2 border-[#EEF824] rounded-[22px] animate-pulse pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-shimmer" />
              <span className="text-7xl mb-2 animate-pulse">🛡️</span>
              <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-widest text-[#EEF824] text-shadow-[0_0_20px_rgba(238,248,36,0.85)] leading-none font-sans scale-in-out">
                SUPER TACKLE
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-blue-400 mt-1 block">
                ಸೂಪರ್ ಟ್ಯಾಕಲ್
              </span>
              <p className="text-xs text-white/90 uppercase tracking-widest font-extrabold mt-4 border-t border-blue-500/30 pt-3 leading-relaxed">
                Less than 4 defenders on court. Tackle scores 2 points!
              </p>
            </div>
          )}

          {activeAlert === 'super_raid' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-amber-955/90 to-black/95 border-4 border-[#EEF824] shadow-[0_0_120px_rgba(238,248,36,0.85)]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-shimmer" />
              <span className="text-7xl mb-2 animate-spin-once">⚡</span>
              <h2 className="text-5xl sm:text-6xl font-black uppercase tracking-widest text-white text-shadow-[0_0_30px_rgba(255,255,255,0.9)] leading-none font-sans scale-in-out">
                SUPER RAID!
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-[#EEF824] mt-1 block">
                ಸೂಪರ್ ರೈಡ್
              </span>
              <p className="text-xs text-white/90 uppercase tracking-widest font-extrabold mt-4 border-t border-amber-500/30 pt-3 leading-relaxed">
                Brilliant raid! Raider scored 3 or more points!
              </p>
            </div>
          )}

          {activeAlert === 'safe_raid' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-emerald-950/90 to-black/95 border-4 border-emerald-500 shadow-[0_0_80px_rgba(16,185,129,0.55)]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-shimmer" />
              <span className="text-7xl mb-2 animate-bounce">🛡️</span>
              <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-widest text-[#EEF824] text-shadow-[0_0_20px_rgba(238,248,36,0.85)] leading-none font-sans scale-in-out">
                SAFE RAID
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-emerald-400 mt-1 block">
                ಖಾಲಿ ರೈಡ್ ಯಶಸ್ವಿ
              </span>
              <p className="text-xs text-white/80 uppercase tracking-widest font-extrabold mt-4 border-t border-emerald-500/30 pt-3 leading-relaxed">
                Raider returned safely to own half!
              </p>
            </div>
          )}

          {activeAlert === 'all_out' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-red-955/95 to-black/98 border-4 border-red-500 shadow-[0_0_120px_rgba(239,68,68,0.8)]">
              <div className="absolute top-0 left-0 w-full h-2.5 bg-gradient-to-r from-transparent via-[#EEF824] to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-2.5 bg-gradient-to-r from-transparent via-[#EEF824] to-transparent animate-shimmer" />
              <span className="text-7xl mb-2 animate-spin-once">🔥</span>
              <h2 className="text-5xl sm:text-6xl font-black uppercase tracking-widest text-[#EEF824] text-shadow-[0_0_30px_rgba(238,248,36,0.95)] leading-none font-sans scale-in-out">
                ALL OUT!
              </h2>
              <span className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-red-500 mt-1 block">
                ಆಲ್ ಔಟ್
              </span>
              <p className="text-xs text-white font-extrabold mt-4 border-t border-red-500/40 pt-3 leading-relaxed">
                ALL PLAYERS ARE REVIVED AND BACK ON COURT!
              </p>
            </div>
          )}

          {activeAlert === 'timeout' && (
            <div className="flex flex-col items-center justify-center p-8 text-center animate-scale-up-fade relative overflow-hidden max-w-lg w-[85%] rounded-3xl bg-gradient-to-b from-dark-900 to-black border-4 border-[#EEF824] shadow-[0_0_80px_rgba(238,248,36,0.55)]">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-shimmer" />
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-shimmer" />
              <span className="text-6xl mb-2 animate-pulse">⏰</span>
              <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-widest text-[#EEF824] text-shadow-[0_0_20px_rgba(238,248,36,0.85)] leading-none font-sans scale-in-out">
                TIME OUT
              </h2>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white mt-1 block">
                ಸಮಯ ಮುಗಿದಿದೆ
              </span>
              <p className="text-xs text-white/80 uppercase tracking-widest font-extrabold mt-4 border-t border-dark-800 pt-3 leading-relaxed">
                Raid time has expired!
              </p>
            </div>
          )}

        </div>
      )}

      {/* 16:9 aspect ratio scoreboard display wrapper */}
      <div className="flex-grow w-full flex items-center justify-center overflow-hidden relative">
        <div className="aspect-video w-full h-full max-w-full max-h-full relative overflow-hidden select-none" style={{ containerType: 'size' }}>
          {/* Stadium Background Image Layer */}
          {!isObsMode && viewMode !== 'led' && viewMode !== 'score' && (
            <div 
              className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{
                backgroundImage: `url('${branding.backgroundImage || '/stadium_bg.jpg?v=12'}')`,
                zIndex: 0
              }}
            />
          )}
          {viewMode === 'led' && (
            <div className="absolute inset-0 w-full h-full bg-black pointer-events-none" style={{ zIndex: 0 }} />
          )}
      {/* Dynamic CSS Styling Inject for High-Impact Broadcast graphics */}
      <style jsx global>{`
        :root {
          --primary-accent: ${branding.primaryColor || '#facc15'};
          --secondary-accent: ${branding.secondaryColor || '#000000'};
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
        .player-dot-indicator {
          width: 1.15cqw;
          height: 1.15cqw;
          border-radius: 50%;
          display: inline-block;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .blue-active {
          background-color: #3b82f6;
          box-shadow: 0 0 16px #3b82f6, 0 0 32px rgba(59, 130, 246, 0.95);
          animation: pulse-glow-blue 1.2s infinite ease-in-out;
        }
        .red-active {
          background-color: #ef4444;
          box-shadow: 0 0 16px #ef4444, 0 0 32px rgba(239, 68, 68, 0.95);
          animation: pulse-glow-red 1.2s infinite ease-in-out;
        }
        .inactive-dot {
          background-color: #111827;
          border: 1px solid rgba(255, 255, 255, 0.05);
          opacity: 0.15;
          transform: scale(0.65);
          box-shadow: none !important;
        }
        @keyframes pulse-glow-blue {
          0%, 100% {
            box-shadow: 0 0 10px #3b82f6, 0 0 20px rgba(59, 130, 246, 0.6);
            opacity: 0.85;
            transform: scale(0.95);
          }
          50% {
            box-shadow: 0 0 22px #3b82f6, 0 0 40px rgba(59, 130, 246, 1);
            opacity: 1;
            transform: scale(1.2);
          }
        }
        @keyframes pulse-glow-red {
          0%, 100% {
            box-shadow: 0 0 10px #ef4444, 0 0 20px rgba(239, 68, 68, 0.6);
            opacity: 0.85;
            transform: scale(0.95);
          }
          50% {
            box-shadow: 0 0 22px #ef4444, 0 0 40px rgba(239, 68, 68, 1);
            opacity: 1;
            transform: scale(1.2);
          }
        }
        .raiding-highlight-blue {
          border: 3.5px solid var(--primary-accent) !important;
          box-shadow: 0 0 25px var(--primary-accent), inset 0 0 15px var(--primary-accent) !important;
          background-color: rgba(30, 41, 59, 0.25) !important;
          animation: border-pulse-yellow-blue-card 1s infinite ease-in-out !important;
          border-radius: 20px !important;
          transform: scale(1.03) !important;
          z-index: 40 !important;
        }
        .raiding-highlight-red {
          border: 3.5px solid var(--primary-accent) !important;
          box-shadow: 0 0 14px var(--primary-accent), inset 0 0 9px var(--primary-accent) !important;
          background-color: rgba(30, 41, 59, 0.25) !important;
          animation: border-pulse-yellow-red-card 1s infinite ease-in-out !important;
          border-radius: 20px !important;
          transform: scale(1.03) !important;
          z-index: 40 !important;
        }
        @keyframes border-pulse-yellow-blue-card {
          0%, 100% {
            box-shadow: 0 0 15px var(--primary-accent), inset 0 0 10px var(--primary-accent);
            border-color: var(--primary-accent);
            transform: scale(1.03);
          }
          50% {
            box-shadow: 0 0 35px var(--primary-accent), inset 0 0 20px var(--primary-accent);
            border-color: var(--primary-accent);
            transform: scale(1.05);
          }
        }
        @keyframes border-pulse-yellow-red-card {
          0%, 100% {
            box-shadow: 0 0 9px var(--primary-accent), inset 0 0 6px var(--primary-accent);
            border-color: var(--primary-accent);
            transform: scale(1.03);
          }
          50% {
            box-shadow: 0 0 22px var(--primary-accent), inset 0 0 12px var(--primary-accent);
            border-color: var(--primary-accent);
            transform: scale(1.05);
          }
        }
        .brand-logo-glow {
          filter: drop-shadow(0 0 12px #FFD700);
        }
        .gold-sports-title {
          color: var(--primary-accent);
          font-weight: 950;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          text-shadow: 
            2px 2px 0 #000,
            -2px 2px 0 #000,
            2px -2px 0 #000,
            -2px -2px 0 #000,
            0px 0px 10px var(--primary-accent);
        }
        .premium-floating-banner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4px 12px;
          margin-bottom: 20px;
        }
        .presenter-sub-text {
          font-family: 'Outfit', sans-serif;
          font-size: 1.15cqh;
          font-weight: 800;
          color: #FFF4A3;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.95);
          margin-bottom: 4px;
          opacity: 0.95;
        }
        .championship-title-main {
          font-family: 'Noto Sans Kannada', 'Outfit', sans-serif;
          font-size: 5.3cqh;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          line-height: 1.1;
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
        }
        .championship-title-main .outline-text {
          color: #000000;
          -webkit-text-stroke: 7px #000000;
          text-shadow: 
            0px 0px 25px rgba(255, 215, 0, 0.85),
            0px 8px 15px rgba(0, 0, 0, 0.8);
          display: inline-flex;
          align-items: center;
          gap: 0.15em;
          animation: luxury-glow-pulse 4s infinite ease-in-out;
        }
        .championship-title-main .fill-text {
          position: absolute;
          inset: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.15em;
          background: linear-gradient(
            to bottom,
            #FFF4A3 0%,
            #FFD700 35%,
            #C8860D 70%,
            #FFF4A3 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shine-sweep 6s infinite linear;
          pointer-events: none;
        }
        .trophy-icon {
          display: inline-block;
          font-size: 0.9em;
          filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.8));
          vertical-align: middle;
          -webkit-text-fill-color: initial;
        }
        @keyframes luxury-glow-pulse {
          0%, 100% {
            text-shadow: 
              0px 0px 18px rgba(255, 215, 0, 0.65),
              0px 6px 12px rgba(0, 0, 0, 0.7);
          }
          50% {
            text-shadow: 
              0px 0px 32px rgba(255, 215, 0, 0.95),
              0px 10px 18px rgba(0, 0, 0, 0.85);
          }
        }
        @keyframes shine-sweep {
          0% {
            background-position: 0% center;
          }
          100% {
            background-position: 200% center;
          }
        }
        .raiding-badge-pulse {
          animation: bg-blink-yellow-orange 0.8s infinite alternate ease-in-out !important;
          color: #000000 !important;
          font-weight: 950 !important;
          box-shadow: 0 0 15px var(--primary-accent) !important;
        }
        @keyframes bg-blink-yellow-orange {
          0% {
            background-color: var(--primary-accent);
            box-shadow: 0 0 10px var(--primary-accent);
            transform: translate(-50%, 0) scale(1);
          }
          100% {
            background-color: #f97316;
            box-shadow: 0 0 22px rgba(249, 115, 22, 0.85);
            transform: translate(-50%, 0) scale(1.08);
          }
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

      {/* TV SCREEN CONTAINER (Full Screen Layout with Transparent Overlays inside 16:9 container) */}
      <div className="absolute inset-0 w-full h-full z-10 select-none">
        
        {/* 1. Lakshmish Logo */}
        {branding.showLakshmishLogo !== false && (
          <div 
            className={`absolute z-30 pointer-events-none transition-all duration-300 ${
              branding.layout?.logo ? '' : getPositionClass(branding.logoPosition || 'top-left')
            }`}
            style={
              branding.layout?.logo
                ? {
                    left: `${branding.layout.logo.x}%`,
                    top: `${branding.layout.logo.y}%`,
                    transform: `scale(${branding.layout.logo.scale || 1.0})`,
                    transformOrigin: 'top-left',
                    position: 'absolute'
                  }
                : {
                    transform: `scale(${(branding.logoSize || 100) / 100})`,
                    transformOrigin: branding.logoPosition || 'top-left'
                  }
            }
          >
            <img 
              src={branding.lakshmishLogo || '/transparent_lakshmish_logo.png'} 
              alt="Lakshmish Logo" 
              className="h-16 w-auto object-contain brand-logo-glow mix-blend-screen" 
            />
          </div>
        )}

        {/* 2. Sponsor Logo (Kannada Sponsor Appreciation Card) */}
        {branding.showSponsorLogo !== false && currentSponsor && (
          <div 
            className={`absolute z-30 pointer-events-none transition-all duration-300 ${
              branding.layout?.sponsor ? '' : getPositionClass(branding.sponsorPosition || 'top-right')
            }`}
            style={
              branding.layout?.sponsor
                ? {
                    left: `${branding.layout.sponsor.x}%`,
                    top: `${branding.layout.sponsor.y}%`,
                    transform: `scale(${branding.layout.sponsor.scale || 1.0})`,
                    transformOrigin: 'top-right',
                    position: 'absolute'
                  }
                : {
                    transform: `scale(${(branding.sponsorSize || 100) / 100})`,
                    transformOrigin: branding.sponsorPosition || 'top-right'
                  }
            }
          >
            <div className={`px-4 py-3 flex flex-col items-center justify-center min-w-[140px] max-w-[170px] transition-all duration-500 ${sponsorFade ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
              <span className="text-[12px] text-yellow-400 font-extrabold uppercase tracking-wider text-center block font-sans">
                {sponsorHeader}
              </span>
              
              <div className="w-12 border-t border-yellow-500/35 my-1.5" />
              
              <div 
                className={`relative overflow-hidden mb-2 bg-dark-950 flex items-center justify-center ${
                  branding.sponsorBorderShape === 'square' ? 'rounded-lg' : 'rounded-full'
                }`}
                style={{
                  width: '4rem',
                  height: '4rem',
                  border: `${branding.sponsorBorderThickness !== undefined ? branding.sponsorBorderThickness : 3}px solid ${branding.sponsorBorderColor || '#eab308'}`,
                  boxShadow: branding.sponsorGlow !== false 
                    ? `0 0 15px ${branding.sponsorBorderColor || '#eab308'}aa` 
                    : 'none'
                }}
              >
                <img 
                  src={currentSponsor.url} 
                  alt="Sponsor Photo" 
                  className="h-full w-full object-cover" 
                />
              </div>
              
              <span className="text-[13px] text-white font-extrabold text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] block font-sans max-w-[140px] truncate leading-tight">
                {currentSponsor.name || 'ಪ್ರೋತ್ಸಾಹಕರು'}
              </span>
              {currentSponsor.subtitle && (
                <span className="text-[10px] text-yellow-500/90 font-bold text-center block font-sans mt-0.5 max-w-[140px] truncate leading-none">
                  {currentSponsor.subtitle}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 3. Match Intro Screen or Normal Scoreboards */}
        {viewMode === 'intro' ? (
          <div className="absolute inset-0 flex flex-col justify-between p-[4cqw] bg-gradient-to-br from-black via-slate-950 to-zinc-900 border-4 border-yellow-500/20 rounded-3xl z-40">
            {/* Presenter & Title */}
            <div className="flex flex-col items-center text-center mt-[2cqh]">
              <span className="text-[1.2cqh] text-yellow-400 font-extrabold uppercase tracking-[0.25em] mb-[1cqh]">
                {branding.presenterText || 'LAKSHMISH CRICKET EVENTS PRESENTS'}
              </span>
              {branding.showTournamentLogo !== false && branding.tournamentLogo ? (
                <img 
                  src={branding.tournamentLogo} 
                  alt={branding.tournamentName || tournamentName} 
                  className="h-[12cqh] w-auto object-contain my-2" 
                />
              ) : (
                <h1 className="text-[4.5cqh] font-black uppercase gold-sports-title tracking-wider leading-none my-2">
                  🏆 {branding.tournamentName || tournamentName} 🏆
                </h1>
              )}
            </div>

            {/* Team Battle logos */}
            <div className="flex items-center justify-center space-x-[8cqw] my-[2cqh]">
              <div className="flex flex-col items-center text-center w-[30%]">
                <img src={logoA} alt={kannadaNameA} className="h-[18cqh] w-auto object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" />
                <h2 className="text-white text-[2.2cqh] font-black uppercase mt-3">{kannadaNameA || 'Team A'}</h2>
              </div>
              <div className="text-center font-black italic text-[8cqh] text-yellow-500 text-glow-gold">VS</div>
              <div className="flex flex-col items-center text-center w-[30%]">
                <img src={logoB} alt={kannadaNameB} className="h-[18cqh] w-auto object-contain drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                <h2 className="text-white text-[2.2cqh] font-black uppercase mt-3">{kannadaNameB || 'Team B'}</h2>
              </div>
            </div>

            {/* Details Profile */}
            <div className="flex flex-col items-center text-center mb-[2cqh] space-y-[1.5cqh]">
              <div className="bg-black/60 border border-yellow-500/20 px-[3cqw] py-[1.5cqh] rounded-2xl flex flex-col items-center space-y-[0.8cqh] min-w-[280px] sm:min-w-[450px]">
                {profile.venue && (
                  <span className="text-[1.2cqh] text-white/90 font-bold uppercase tracking-wider block">
                    📍 Venue: {profile.venue}
                  </span>
                )}
                {profile.organizer && (
                  <div className="flex items-center space-x-3.5 my-[0.5cqh]">
                    {profile.organizerPhoto && (
                      <img 
                        src={profile.organizerPhoto} 
                        alt="Organizer" 
                        className="h-[5.5cqh] w-[5.5cqh] rounded-full border-2 border-yellow-500/40 object-cover shadow-[0_0_12px_rgba(234,179,8,0.25)]" 
                      />
                    )}
                    <div className="flex flex-col text-left">
                      <span className="text-[1.25cqh] text-white font-extrabold uppercase tracking-wider block leading-snug">
                        🤝 Organizer: {profile.organizer}
                      </span>
                      {profile.contactNumber && (
                        <span className="text-[1cqh] text-white/60 font-mono tracking-wide block leading-none mt-1">
                          📞 Tel: {profile.contactNumber}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {profile.dates && (
                  <span className="text-[1.2cqh] text-white/90 font-bold uppercase tracking-wider block pt-0.5">
                    📅 Dates: {profile.dates}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-yellow-400 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
                <span className="text-[1.2cqh] font-black uppercase tracking-[0.2em]">MATCH STARTING SOON</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Top Header Overlay: Premium Floating Championship Title */}
            {branding.showTournamentLogo !== false && (
              <div 
                className={`absolute z-35 pointer-events-none transition-all duration-300 ${
                  branding.layout?.banner ? '' : 'left-1/2 -translate-x-1/2 top-[20px]'
                }`}
                style={
                  branding.layout?.banner
                    ? {
                        left: `${branding.layout.banner.x}%`,
                        top: `${branding.layout.banner.y}%`,
                        transform: `translate(-50%, 0) scale(${branding.layout.banner.scale || 1.0})`,
                        transformOrigin: 'top center',
                        position: 'absolute'
                      }
                    : undefined
                }
              >
                <div className="premium-floating-banner">
                  <span className="presenter-sub-text">
                    {branding.presenterText || 'LAKSHMISH CRICKET EVENTS PRESENTS'}
                  </span>
                  <h1 className="championship-title-main">
                    <span className="outline-text">
                      <span className="trophy-icon">🏆</span>
                      {branding.tournamentName || tournamentName}
                      <span className="trophy-icon">🏆</span>
                    </span>
                    <span className="fill-text">
                      <span className="trophy-icon">🏆</span>
                      {branding.tournamentName || tournamentName}
                      <span className="trophy-icon">🏆</span>
                    </span>
                  </h1>
                </div>
              </div>
            )}

            {/* 🦁 TRANSPARENT OVERLAY LAYERS FOR TEAMS & CORES */}
            <div className="absolute inset-0 z-25 pointer-events-none" style={{ display: viewMode === 'score' ? 'none' : 'block' }}>
              
              {/* Left Team (Blue) Overlay - Positioned exactly over the blue card in background */}
              <div className={`absolute left-[18.2%] top-[31.5%] w-[25%] h-[38%] pointer-events-auto text-center flex flex-col justify-between py-[1.8cqh] select-none transition-all duration-300 ${
                kState.raidingTeamId === match.teamA.id ? 'raiding-highlight-blue' : 'border border-transparent'
              }`}>
                {/* Raiding Badge */}
                {kState.raidingTeamId === match.teamA.id && (
                  <div className="absolute -top-[3.2cqh] left-1/2 px-[1.5cqw] py-[0.3cqh] rounded-full text-[1.1cqh] tracking-widest flex items-center space-x-[0.3cqw] z-30 raiding-badge-pulse">
                    <span className="text-[0.8cqh]">▶</span>
                    <span>RAIDING</span>
                  </div>
                )}
                {/* Team details at the top */}
                <div className="flex flex-col items-center">
                  <span className="text-[1.1cqh] text-blue-400 font-black uppercase tracking-widest block mb-[0.2cqh]">BLUE SIDE</span>
                  <h2 
                    className="font-black text-white leading-tight uppercase tracking-wide text-glow-blue px-[0.5cqw] truncate max-w-[95%] mx-auto"
                    style={{ fontSize: getNameFontSize(kannadaNameA || 'ಕೊರಟಗೆರೆ ಕಿಂಗ್ಸ್', true) }}
                  >
                    {kannadaNameA || 'ಕೊರಟಗೆರೆ ಕಿಂಗ್ಸ್'}
                  </h2>
                  <span 
                    className="text-blue-300 font-extrabold uppercase tracking-wider block mt-[0.1cqh] font-mono truncate max-w-[95%] mx-auto mb-[0.6cqh]"
                    style={{ fontSize: getNameFontSize(englishNameA || 'KORATAGERE KINGS', false) }}
                  >
                    {englishNameA || 'KORATAGERE KINGS'}
                  </span>
                  {/* 7 Player status dots moved under name */}
                  <div className="flex justify-center space-x-[0.5cqw] mb-[0.2cqh]">
                    {Array.from({ length: 7 }).map((_, idx) => {
                      const isActive = activePlayersA > idx;
                      return (
                        <span
                          key={idx}
                          className={`player-dot-indicator ${isActive ? 'blue-active' : 'inactive-dot'}`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Massive Score vertically and horizontally centered in the remaining space */}
                <div className="score-anim-entry flex flex-col items-center justify-center flex-grow py-[0.5cqh]">
                  <span className="text-[17cqh] font-black font-mono text-white text-glow-blue leading-none block broadcast-score">
                    {kState.scoreA}
                  </span>
                  <span className="text-[1.3cqh] font-black text-blue-300 uppercase tracking-wider mt-[0.4cqh] block">
                    ACTIVE PLAYERS: {activePlayersA}/7
                  </span>
                </div>

                {/* Points label at the bottom */}
                <div className="flex flex-col items-center">
                  <span className="text-[1.8cqh] font-black text-blue-300 uppercase tracking-widest block">POINTS</span>
                </div>
              </div>

              {/* Right Team (Red) Overlay - Positioned exactly over the red card in background */}
              <div className={`absolute left-[56.8%] top-[31.5%] w-[25%] h-[38%] pointer-events-auto text-center flex flex-col justify-between py-[1.8cqh] select-none transition-all duration-300 ${
                kState.raidingTeamId === match.teamB.id ? 'raiding-highlight-red' : 'border border-transparent'
              }`}>
                {/* Raiding Badge */}
                {kState.raidingTeamId === match.teamB.id && (
                  <div className="absolute -top-[3.2cqh] left-1/2 px-[1.5cqw] py-[0.3cqh] rounded-full text-[1.1cqh] tracking-widest flex items-center space-x-[0.3cqw] z-30 raiding-badge-pulse">
                    <span className="text-[0.8cqh]">▶</span>
                    <span>RAIDING</span>
                  </div>
                )}
                {/* Team details at the top */}
                <div className="flex flex-col items-center">
                  <span className="text-[1.1cqh] text-red-400 font-black uppercase tracking-widest block mb-[0.2cqh]">RED SIDE</span>
                  <h2 
                    className="font-black text-white leading-tight uppercase tracking-wide text-glow-red px-[0.5cqw] truncate max-w-[95%] mx-auto"
                    style={{ fontSize: getNameFontSize(kannadaNameB || 'ಹೊಲಾಲಿ ಟೈಗರ್ಸ್', true) }}
                  >
                    {kannadaNameB || 'ಹೊಲಾಲಿ ಟೈಗರ್ಸ್'}
                  </h2>
                  <span 
                    className="text-red-300 font-extrabold uppercase tracking-wider block mt-[0.1cqh] font-mono truncate max-w-[95%] mx-auto mb-[0.6cqh]"
                    style={{ fontSize: getNameFontSize(englishNameB || 'HOLALE TIGERS', false) }}
                  >
                    {englishNameB || 'HOLALE TIGERS'}
                  </span>
                  {/* 7 Player status dots moved under name */}
                  <div className="flex justify-center space-x-[0.5cqw] mb-[0.2cqh]">
                    {Array.from({ length: 7 }).map((_, idx) => {
                      const isActive = activePlayersB > idx;
                      return (
                        <span
                          key={idx}
                          className={`player-dot-indicator ${isActive ? 'red-active' : 'inactive-dot'}`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Massive Score vertically and horizontally centered in the remaining space */}
                <div className="score-anim-entry flex flex-col items-center justify-center flex-grow py-[0.5cqh]">
                  <span className="text-[17cqh] font-black font-mono text-white text-glow-red leading-none block broadcast-score">
                    {kState.scoreB}
                  </span>
                  <span className="text-[1.3cqh] font-black text-red-300 uppercase tracking-wider mt-[0.4cqh] block">
                    ACTIVE PLAYERS: {activePlayersB}/7
                  </span>
                </div>

                {/* Points label at the bottom */}
                <div className="flex flex-col items-center">
                  <span className="text-[1.8cqh] font-black text-red-300 uppercase tracking-widest block">POINTS</span>
                </div>
              </div>
            </div>

            {/* Match Clock & Scorebar for score view parameter */}
            {viewMode === 'score' && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-[10%] bg-gradient-to-r from-blue-950/90 via-black/95 to-red-950/90 border border-gold-500/25 px-8 py-3 rounded-2xl flex items-center space-x-12 z-35 backdrop-blur shadow-2xl pointer-events-auto">
                {/* Team A */}
                <div className="flex items-center space-x-3">
                  <img src={logoA} alt={kannadaNameA} className="h-10 w-10 object-contain" />
                  <span className="text-sm font-black text-white">{englishNameA.substring(0, 4)}</span>
                  <span className="text-2xl font-black font-mono text-blue-400">{kState.scoreA}</span>
                </div>
                {/* Timer */}
                <div className="text-center">
                  <span className="text-[8px] text-gold-400 block font-bold">{half === 1 ? '1ST HALF' : '2ND HALF'}</span>
                  <span className="text-lg font-black font-mono text-white">
                    {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:
                    {(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                {/* Team B */}
                <div className="flex items-center space-x-3">
                  <span className="text-2xl font-black font-mono text-red-400">{kState.scoreB}</span>
                  <span className="text-sm font-black text-white">{englishNameB.substring(0, 4)}</span>
                  <img src={logoB} alt={kannadaNameB} className="h-10 w-10 object-contain" />
                </div>
              </div>
            )}

            {/* Center Overlay: Raid Timer - Positioned exactly below the gold VS logo */}
            {viewMode !== 'score' && (
              <div 
                className={`absolute z-35 pointer-events-none transition-all duration-300 ${
                  branding.layout?.raidTimer ? '' : 'left-[44%] w-[12%] top-[68%]'
                }`}
                style={
                  branding.layout?.raidTimer
                    ? {
                        left: `${branding.layout.raidTimer.x}%`,
                        top: `${branding.layout.raidTimer.y}%`,
                        transform: `scale(${branding.layout.raidTimer.scale || 1.0})`,
                        transformOrigin: 'top center',
                        position: 'absolute',
                        width: '12%'
                      }
                    : undefined
                }
              >
                <div className="text-center flex flex-col items-center justify-center w-full">
                  <div className={`transition-all duration-300 px-4 py-2.5 rounded-2xl w-full ${
                    raidTime <= 5
                      ? 'bg-red-950/60 border border-red-500/50 animate-pulse'
                      : raidTime <= 10
                      ? 'bg-orange-950/40 border border-orange-500/40 animate-pulse'
                      : 'bg-black/45 border border-gold-500/20'
                  }`}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-gold-500 block mb-0.5 font-sans">RAID TIME</span>
                    <span className={`text-3xl sm:text-4xl lg:text-5xl font-black font-mono leading-none block broadcast-score transition-colors duration-300 ${
                      raidTime <= 5
                        ? 'text-red-500 text-shadow-[0_0_20px_rgba(239,68,68,0.95)]'
                        : raidTime <= 10
                        ? 'text-orange-500 text-shadow-[0_0_20px_rgba(249,115,22,0.9)]'
                        : 'text-yellow-400 text-glow-gold'
                    }`}>
                      00:{raidTime.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Center Overlay: Match Timer & Period - Positioned directly above the gold VS logo */}
            {viewMode !== 'score' && (
              <div 
                className={`absolute z-35 pointer-events-none transition-all duration-300 ${
                  branding.layout?.timer ? '' : 'left-[38%] w-[24%] top-[14%]'
                }`}
                style={
                  branding.layout?.timer
                    ? {
                        left: `${branding.layout.timer.x}%`,
                        top: `${branding.layout.timer.y}%`,
                        transform: `scale(${branding.layout.timer.scale || 1.0})`,
                        transformOrigin: 'top center',
                        position: 'absolute',
                        width: '24%'
                      }
                    : undefined
                }
              >
                <div className="text-center flex flex-col items-center justify-center gap-1.5 w-full">
                  {/* Match Clock */}
                  <div className="backdrop-blur-md bg-black/60 border border-gold-500/30 px-6 py-2.5 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.5)] min-w-[170px] text-center w-full">
                    <span className="text-[1.0cqh] text-gold-400 font-extrabold uppercase tracking-widest block mb-1 font-sans">MATCH TIME</span>
                    <span className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black font-mono text-white tracking-widest block leading-none text-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                      {Math.floor(timeRemaining / 60).toString().padStart(2, '0')}:
                      {(timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>

                  {/* Period Badge */}
                  <div className="backdrop-blur-md bg-black/50 border border-gold-500/25 px-4 py-0.5 rounded-lg shadow-md flex items-center justify-center">
                    <span className="text-[1.1cqh] font-extrabold text-gold-450 uppercase tracking-[0.15em] leading-normal text-center font-sans">
                      {half === 1 ? '1ST HALF' : '2ND HALF'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Center Bottom Overlay: Do Or Die / Super Tackle statuses (floating text boxes) */}
            {viewMode !== 'score' && (
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
            )}

            {/* Winning Probability Bar */}
            {branding.showWinProbability !== false && viewMode !== 'score' && (
              <div className="absolute left-[35%] w-[30%] bottom-[14.5%] flex flex-col items-center justify-center pointer-events-auto transition-all duration-300">
                <span className="text-[0.9cqh] text-gold-400 font-extrabold uppercase tracking-[0.2em] mb-1 block leading-none text-shadow-[0_0_5px_rgba(0,0,0,0.5)]">
                  WIN PROBABILITY
                </span>
                <div className="w-full bg-black/60 border border-gold-500/20 backdrop-blur-md rounded-full p-1 shadow-lg flex items-center h-[2.8cqh]">
                  {/* Left Side (Blue Team) */}
                  <div 
                    className="bg-blue-650 h-full rounded-l-full flex items-center pl-3 transition-all duration-500 ease-out text-[1.1cqh] font-black text-white overflow-hidden whitespace-nowrap shadow-[inset_-10px_0_15px_rgba(0,0,0,0.2)]"
                    style={{ width: `${getWinProbability().probA}%` }}
                  >
                    {englishNameA.split(' ')[0]?.toUpperCase()} {getWinProbability().probA}%
                  </div>
                  {/* Right Side (Red Team) */}
                  <div 
                    className="bg-red-650 h-full rounded-r-full flex items-center justify-end pr-3 transition-all duration-500 ease-out text-[1.1cqh] font-black text-white overflow-hidden whitespace-nowrap shadow-[inset_10px_0_15px_rgba(0,0,0,0.2)]"
                    style={{ width: `${getWinProbability().probB}%` }}
                  >
                    {getWinProbability().probB}% {englishNameB.split(' ')[0]?.toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {/* Last Raid Result Indicator */}
            {branding.showLastRaidResult !== false && lastRaidAction && viewMode !== 'score' && (
              <div className="absolute left-[35%] w-[30%] bottom-[21%] flex justify-center items-center pointer-events-auto transition-all duration-300 animate-pulse">
                <div className="bg-gradient-to-r from-slate-900/95 to-black/98 border border-gold-500/25 px-5 py-1.5 rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.4)] flex items-center space-x-2">
                  <span className="text-[1.0cqh] text-yellow-400 font-black animate-bounce">⚡</span>
                  <span className="text-[1.0cqh] font-extrabold text-gold-450 uppercase tracking-[0.12em] block leading-none">
                    LAST RAID: {formatLastRaidResult(lastRaidAction)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
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
