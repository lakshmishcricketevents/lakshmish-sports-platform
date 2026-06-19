'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Play, Pause, RotateCcw, Undo2, Wifi, WifiOff, AlertTriangle, ShieldAlert, Award, ArrowLeft, Settings, X } from 'lucide-react';
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
}

const PRESET_LOGOS = [
  { name: 'Lion', url: '/mascot_lion.png' },
  { name: 'Bull', url: '/mascot_bull.png' },
  { name: 'Shield', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%233b82f6' stroke='%2360a5fa' stroke-width='4'><rect width='100' height='100' fill='%231e293b'/><path d='M50 15 L80 30 L80 60 C80 75 50 85 50 85 C50 85 20 75 20 60 L20 30 Z'/></svg>" },
  { name: 'Viking', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%2364748b' stroke='%2394a3b8' stroke-width='4'><rect width='100' height='100' fill='%231e293b'/><path d='M50 20 C35 20 30 35 30 50 L70 50 C70 35 65 20 50 20 Z'/><path d='M30 50 L20 40 L15 50 L30 55 Z' fill='%23cbd5e1'/><path d='M70 50 L80 40 L85 50 L70 55 Z' fill='%23cbd5e1'/></svg>" },
  { name: 'Sword', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' stroke='%23cbd5e1' stroke-width='6' stroke-linecap='round'><rect width='100' height='100' fill='%231e293b'/><path d='M70 30 L30 70 M60 20 L80 40 M25 75 L15 85'/></svg>" },
  { name: 'Spartan', url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ef4444' stroke='%23f87171' stroke-width='4'><rect width='100' height='100' fill='%231e293b'/><circle cx='50' cy='50' r='30'/></svg>" }
];

function MobileKabaddiControllerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = params.id as string;
  const token = searchParams.get('token') || '';

  const [match, setMatch] = useState<Match | null>(null);
  const matchRef = useRef<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tourName, setTourName] = useState('ರಣಭೈರೇಗೌಡ ಕಪ್');
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  // Local state mirror for timers & statuses
  const [raidTime, setRaidTime] = useState(30);
  const [raidRunning, setRaidRunning] = useState(false);
  const [doOrDie, setDoOrDie] = useState(false);
  const [superTackle, setSuperTackle] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(2400);
  const [timerRunning, setTimerRunning] = useState(false);

  const isRaidTimerOwnerRef = useRef(false);
  const isMatchTimerOwnerRef = useRef(false);

  // Audio & Volume System
  const [volume, setVolume] = useState<'mute' | 'low' | 'medium' | 'high'>('mute');
  const handleVolumeChange = (newVol: 'mute' | 'low' | 'medium' | 'high') => {
    setVolume(newVol);
  };
  const triggerAudioAlert = (type: 'tick' | 'warning' | 'buzzer') => {
    // Audio playback completely disabled on mobile controller to avoid scorer interference
  };

  // Edit modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTourName, setEditTourName] = useState('');
  const [editTeamANameEng, setEditTeamANameEng] = useState('');
  const [editTeamANameKan, setEditTeamANameKan] = useState('');
  const [editTeamBNameEng, setEditTeamBNameEng] = useState('');
  const [editTeamBNameKan, setEditTeamBNameKan] = useState('');
  const [editLogoA, setEditLogoA] = useState('');
  const [editLogoB, setEditLogoB] = useState('');
  const [editScoreA, setEditScoreA] = useState(0);
  const [editScoreB, setEditScoreB] = useState(0);
  const [editMatchMinutes, setEditMatchMinutes] = useState(20);
  const [editMatchSeconds, setEditMatchSeconds] = useState(0);
  const [editFirstHalfMin, setEditFirstHalfMin] = useState(20);
  const [editFirstHalfSec, setEditFirstHalfSec] = useState(0);
  const [editSecondHalfMin, setEditSecondHalfMin] = useState(20);
  const [editSecondHalfSec, setEditSecondHalfSec] = useState(0);
  const [editRaidTime, setEditRaidTime] = useState(30);
  const [editHalf, setEditHalf] = useState<1 | 2>(1);
  const [editDoOrDie, setEditDoOrDie] = useState(false);
  const [editSuperTackle, setEditSuperTackle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const raidIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load Match Data from Server
  const loadMatchData = async () => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/matches/${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch match details');
      const data: Match = await res.json();
      setMatch(data);
      matchRef.current = data;
      setIsSynced(true);
      setErrorMsg('');

      if (data.kabaddiState) {
        const ks = data.kabaddiState;
        setDoOrDie(!!ks.doOrDie);
        setSuperTackle(!!ks.superTackle);

        // Sync raid clock if not local owner
        if (!isRaidTimerOwnerRef.current) {
          setRaidRunning(!!ks.raidTimerRunning);
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
    } catch (e) {
      console.error(e);
      setIsSynced(false);
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
          if (t?.name) setTourName(t.name);
        }).catch(e => console.warn(e));
    }
  }, [match?.tournamentId]);

  useEffect(() => {
    setIsHydrated(true);
    const timeoutTimer = setTimeout(() => {
      setLoadTimedOut(true);
    }, 4000);
    return () => clearTimeout(timeoutTimer);
  }, []);

  useEffect(() => {
    if (isHydrated && !matchId) {
      setLoading(false);
    }
  }, [isHydrated, matchId]);

  useEffect(() => {
    if (!matchId) return;

    loadMatchData();

    let interval: NodeJS.Timeout | null = null;
    let channel: any = null;

    if (isSupabaseConfigured) {
      try {
        console.log('Subscribing to Supabase Realtime changes for Mobile Controller:', matchId);
        channel = supabase
          .channel(`match-${matchId}-control`)
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
                console.log('Realtime update received on Mobile Controller:', payload.new);
                loadMatchData();
              }
            }
          )
          .subscribe();

        // Slow polling fallback (15s) in case of websocket interruptions
        interval = setInterval(loadMatchData, 15000);
      } catch (err) {
        console.error('Failed to subscribe to Supabase Realtime for Mobile Controller:', err);
        // Fall back to standard HTTP polling
        interval = setInterval(loadMatchData, 2000);
      }
    } else {
      console.log('Supabase not configured for Mobile Controller, using standard HTTP polling.');
      interval = setInterval(loadMatchData, 2000);
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

  // Local Raid Clock Tick
  useEffect(() => {
    if (raidRunning) {
      raidIntervalRef.current = setInterval(() => {
        setRaidTime(prev => {
          if (prev <= 1) {
            setRaidRunning(false);
            clearInterval(raidIntervalRef.current!);
            
            if (isRaidTimerOwnerRef.current) {
              // Sync final state to database (0 seconds) to trigger buzzer on other screens
              fetch(`/api/matches/${matchId}?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'kabaddi_raid_state',
                  payload: {
                    raidTime: 0,
                    raidTimerRunning: false,
                    doOrDie,
                    superTackle
                  }
                })
              }).catch(e => console.warn('Failed to sync raid time end:', e));

              // Then automatically reset to 30 seconds after 1.5 seconds delay so it is ready for the next raid
              setTimeout(() => {
                fetch(`/api/matches/${matchId}?token=${token}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'kabaddi_raid_state',
                    payload: {
                      raidTime: 30,
                      raidTimerRunning: false,
                      doOrDie: false,
                      superTackle: false
                    }
                  })
                }).catch(e => console.warn('Failed to auto-reset raid time:', e));
              }, 1500);
            }

            return 0;
          }

          const nextTime = prev - 1;

          // Sync every 5 seconds to keep other screens aligned if we are the owner
          if (isRaidTimerOwnerRef.current && nextTime % 5 === 0) {
            fetch(`/api/matches/${matchId}?token=${token}`, {
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
            }).catch(e => console.warn('Failed to sync raid time:', e));
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
  }, [raidRunning, doOrDie, superTackle, matchId, token]);

  // Local Match Timer Countdown
  useEffect(() => {
    if (timerRunning) {
      matchIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            clearInterval(matchIntervalRef.current!);
            if (isMatchTimerOwnerRef.current) {
              postAction('kabaddi_timer', { timeRemaining: 0, timerRunning: false });
            }
            return 0;
          }
          const nextTime = prev - 1;
          if (isMatchTimerOwnerRef.current && nextTime % 10 === 0) {
            fetch(`/api/matches/${matchId}?token=${token}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'kabaddi_timer',
                payload: { timeRemaining: nextTime, timerRunning: true }
              })
            }).catch(e => console.warn(e));
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
  }, [timerRunning, matchId, token]);

  // Call Server Action
  const postAction = async (action: string, payload: any) => {
    if (!matchId || !token) {
      setErrorMsg('Missing security token. Access denied.');
      return;
    }
    try {
      const res = await fetch(`/api/matches/${matchId}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Server rejected scoring update');
        setIsSynced(false);
        return;
      }
      setIsSynced(true);
      setErrorMsg('');
      loadMatchData();
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error. Check Wi-Fi connection.');
      setIsSynced(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!match) return;
    setEditTourName(tourName);
    
    const partsA = match.teamA?.name ? match.teamA.name.split('|').map(s => s.trim()) : [];
    setEditTeamANameKan(partsA[0] || '');
    setEditTeamANameEng(partsA[1] || partsA[0] || '');
    
    const partsB = match.teamB?.name ? match.teamB.name.split('|').map(s => s.trim()) : [];
    setEditTeamBNameKan(partsB[0] || '');
    setEditTeamBNameEng(partsB[1] || partsB[0] || '');
    
    setEditLogoA(match.teamA?.logo || '/mascot_lion.png');
    setEditLogoB(match.teamB?.logo || '/mascot_bull.png');
    
    const ks = match.kabaddiState || {
      scoreA: 0,
      scoreB: 0,
      timeRemaining: 2400,
      half: 1 as 1 | 2,
      raidTime: 30,
      doOrDie: false,
      superTackle: false,
      firstHalfDuration: 1200,
      secondHalfDuration: 1200
    };
    
    setEditScoreA(ks.scoreA);
    setEditScoreB(ks.scoreB);
    setEditMatchMinutes(Math.floor(ks.timeRemaining / 60));
    setEditMatchSeconds(ks.timeRemaining % 60);
    
    const firstHalfDuration = ks.firstHalfDuration !== undefined ? ks.firstHalfDuration : 1200;
    const secondHalfDuration = ks.secondHalfDuration !== undefined ? ks.secondHalfDuration : 1200;
    setEditFirstHalfMin(Math.floor(firstHalfDuration / 60));
    setEditFirstHalfSec(firstHalfDuration % 60);
    setEditSecondHalfMin(Math.floor(secondHalfDuration / 60));
    setEditSecondHalfSec(secondHalfDuration % 60);

    setEditRaidTime(ks.raidTime !== undefined ? ks.raidTime : 30);
    setEditHalf(ks.half);
    setEditDoOrDie(!!ks.doOrDie);
    setEditSuperTackle(!!ks.superTackle);
    
    setIsEditModalOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!match) return;
    setIsSaving(true);
    setErrorMsg('');
    try {
      const nameA = `${editTeamANameKan.trim()} | ${editTeamANameEng.trim()}`;
      const nameB = `${editTeamBNameKan.trim()} | ${editTeamBNameEng.trim()}`;
      
      const firstHalfDuration = (Number(editFirstHalfMin) || 0) * 60 + (Number(editFirstHalfSec) || 0);
      const secondHalfDuration = (Number(editSecondHalfMin) || 0) * 60 + (Number(editSecondHalfSec) || 0);

      const ks = match.kabaddiState || { timeRemaining: 2400, half: 1 };
      const currentMatchMinutes = Math.floor(ks.timeRemaining / 60);
      const currentMatchSeconds = ks.timeRemaining % 60;
      
      let nextTimeRemaining = ks.timeRemaining;
      if (Number(editMatchMinutes) !== currentMatchMinutes || Number(editMatchSeconds) !== currentMatchSeconds) {
        nextTimeRemaining = (Number(editMatchMinutes) || 0) * 60 + (Number(editMatchSeconds) || 0);
      } else if (editHalf !== ks.half) {
        nextTimeRemaining = editHalf === 1 ? firstHalfDuration : secondHalfDuration;
      }

      isMatchTimerOwnerRef.current = true;
      isRaidTimerOwnerRef.current = true;
      setTimerRunning(false);
      setTimeRemaining(nextTimeRemaining);
      setRaidRunning(false);
      setRaidTime(Number(editRaidTime) || 30);

      const payload = {
        tournamentName: editTourName,
        teamA: {
          ...match.teamA,
          name: nameA,
          logo: editLogoA
        },
        teamB: {
          ...match.teamB,
          name: nameB,
          logo: editLogoB
        },
        kabaddiState: {
          ...match.kabaddiState,
          scoreA: Number(editScoreA) || 0,
          scoreB: Number(editScoreB) || 0,
          timeRemaining: nextTimeRemaining,
          half: editHalf,
          raidTime: Number(editRaidTime) || 30,
          doOrDie: editDoOrDie,
          superTackle: editSuperTackle,
          firstHalfDuration: firstHalfDuration,
          secondHalfDuration: secondHalfDuration
        }
      };

      await postAction('update_general', payload);
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetScores = async () => {
    if (!confirm('Are you absolutely sure you want to reset all scores, sub-points, and action history for this match? This cannot be undone.')) {
      return;
    }
    setIsSaving(true);
    setErrorMsg('');
    try {
      isRaidTimerOwnerRef.current = true;
      isMatchTimerOwnerRef.current = true;
      setRaidRunning(false);
      setRaidTime(30);
      setTimerRunning(false);
      setTimeRemaining(2400);

      const payload = {
        kabaddiState: {
          ...match?.kabaddiState,
          scoreA: 0,
          scoreB: 0,
          raidPointsA: 0,
          tacklePointsA: 0,
          allOutPointsA: 0,
          extraPointsA: 0,
          raidPointsB: 0,
          tacklePointsB: 0,
          allOutPointsB: 0,
          extraPointsB: 0,
          timerRunning: false,
          raidTime: 30,
          raidTimerRunning: false,
          doOrDie: false,
          superTackle: false
        },
        kabaddiActions: []
      };

      await postAction('update_general', payload);
      setEditScoreA(0);
      setEditScoreB(0);
      setEditDoOrDie(false);
      setEditSuperTackle(false);
      setEditRaidTime(30);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to reset scores');
    } finally {
      setIsSaving(false);
    }
  };

  // Scorer Controls Wrapper
  const handleAddPoints = (type: string, teamId: string, points: number, desc: string) => {
    postAction('kabaddi_points', { type, teamId, points, description: desc });
  };

  const handleRaidState = (updates: { raidTime?: number; raidRunning?: boolean; doOrDie?: boolean; superTackle?: boolean }) => {
    isRaidTimerOwnerRef.current = true;
    const nextRaidTime = updates.raidTime !== undefined ? updates.raidTime : raidTime;
    const nextRaidRunning = updates.raidRunning !== undefined ? updates.raidRunning : raidRunning;
    const nextDoOrDie = updates.doOrDie !== undefined ? updates.doOrDie : doOrDie;
    const nextSuperTackle = updates.superTackle !== undefined ? updates.superTackle : superTackle;

    if (updates.raidTime !== undefined) setRaidTime(updates.raidTime);
    if (updates.raidRunning !== undefined) setRaidRunning(updates.raidRunning);
    if (updates.doOrDie !== undefined) setDoOrDie(updates.doOrDie);
    if (updates.superTackle !== undefined) setSuperTackle(updates.superTackle);

    postAction('kabaddi_raid_state', {
      raidTime: nextRaidTime,
      raidTimerRunning: nextRaidRunning,
      doOrDie: nextDoOrDie,
      superTackle: nextSuperTackle
    });
  };

  const handleMatchTimerToggle = () => {
    if (!match || !match.kabaddiState) return;
    isMatchTimerOwnerRef.current = true;
    const nextRunning = !timerRunning;
    setTimerRunning(nextRunning);
    postAction('kabaddi_timer', {
      timeRemaining: timeRemaining,
      timerRunning: nextRunning
    });
  };

  const handleSwitchPeriod = () => {
    if (!match || !match.kabaddiState) return;
    isMatchTimerOwnerRef.current = true;
    const nextHalf = match.kabaddiState.half === 1 ? 2 : 1;
    const ks = match.kabaddiState;
    const firstHalfDuration = ks.firstHalfDuration !== undefined ? ks.firstHalfDuration : 1200;
    const secondHalfDuration = ks.secondHalfDuration !== undefined ? ks.secondHalfDuration : 1200;
    const nextTimeRemaining = nextHalf === 1 ? firstHalfDuration : secondHalfDuration;

    setTimerRunning(false);
    setTimeRemaining(nextTimeRemaining);

    postAction('update_general', {
      kabaddiState: {
        ...match.kabaddiState,
        half: nextHalf,
        timeRemaining: nextTimeRemaining,
        timerRunning: false
      }
    });
  };

  const handleUndo = () => {
    if (confirm('Undo last scoring event?')) {
      postAction('kabaddi_undo', {});
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#08080c] text-white p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4" />
        <p className="text-xs text-dark-450 uppercase tracking-widest font-extrabold">Loading Score Controller...</p>
        
        {loadTimedOut && (
          <div className="mt-6 p-4 bg-dark-900 border border-dark-800 rounded-2xl max-w-xs text-left text-[10px] text-dark-300 space-y-2">
            <p className="text-red-400 font-bold uppercase tracking-wider">Troubleshooting Diagnostics:</p>
            <p>• <strong>Match ID:</strong> {matchId || 'Not resolved yet'}</p>
            <p>• <strong>Security Token:</strong> {token ? 'Present (Verified)' : 'Missing/Empty'}</p>
            <p>• <strong>Network Host:</strong> {typeof window !== 'undefined' ? window.location.host : 'Unknown'}</p>
            <p className="text-dark-450 mt-2 leading-relaxed">If the loading screen persists, make sure the URL contains a valid match ID and secure token scanned from the laptop scorer screen.</p>
          </div>
        )}
      </div>
    );
  }

  // Error boundary: Missing token or error response
  if (!token || errorMsg.includes('Invalid') || errorMsg.includes('Unauthorized') || errorMsg.includes('expired')) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#08080c] text-white p-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold uppercase tracking-wider text-red-400">Security Protection</h2>
        <p className="text-xs text-dark-300 mt-2 leading-relaxed max-w-xs">
          {errorMsg || 'Unauthorized score control. You must scan the secure QR code displayed on the laptop Admin Console to access score controls.'}
        </p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-[#08080c] text-white p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4 animate-pulse" />
        <h2 className="text-xl font-bold uppercase tracking-wider text-yellow-400">Match Not Found</h2>
      </div>
    );
  }

  const kState = match?.kabaddiState || { scoreA: 0, scoreB: 0, timeRemaining: 2400, half: 1, timerRunning: false };
  const teamAName = match?.teamA?.name 
    ? (match.teamA.name.includes('|') 
        ? match.teamA.name.split('|').map(s => s.trim())[1] || match.teamA.name 
        : match.teamA.name)
    : 'Team A';
  const teamBName = match?.teamB?.name 
    ? (match.teamB.name.includes('|') 
        ? match.teamB.name.split('|').map(s => s.trim())[1] || match.teamB.name 
        : match.teamB.name)
    : 'Team B';

  return (
    <div className="h-screen max-h-screen bg-[#08080d] text-white font-sans flex flex-col justify-between p-3 max-w-md mx-auto relative select-none overflow-hidden">
      
      {/* 📱 TOP BAR: Sync status and details */}
      <div className="flex items-center justify-between border-b border-dark-850 pb-2 flex-shrink-0">
        <div className="flex items-center space-x-2">
          {isSynced ? (
            <div className="flex items-center space-x-1 text-emerald-450 bg-emerald-950/35 border border-emerald-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
              <Wifi className="h-3 w-3 animate-pulse" />
              <span>LIVE SYNC</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-red-400 bg-red-950/35 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
              <WifiOff className="h-3 w-3" />
              <span>OFFLINE</span>
            </div>
          )}

          {/* Volume Control UI */}
          <div className="flex items-center bg-dark-950/80 border border-dark-800 rounded-lg p-0.5 space-x-0.5 text-[8px] font-bold">
            <span className="px-1 text-dark-400 text-[10px]">🔊</span>
            <button
              onClick={() => handleVolumeChange('mute')}
              className={`px-1 py-0.5 rounded uppercase cursor-pointer ${volume === 'mute' ? 'bg-red-500 text-white' : 'text-dark-450 hover:text-white'}`}
            >
              Mute
            </button>
            <button
              onClick={() => handleVolumeChange('low')}
              className={`px-1 py-0.5 rounded uppercase cursor-pointer ${volume === 'low' ? 'bg-purple-600 text-white' : 'text-dark-450 hover:text-white'}`}
            >
              Low
            </button>
            <button
              onClick={() => handleVolumeChange('medium')}
              className={`px-1 py-0.5 rounded uppercase cursor-pointer ${volume === 'medium' ? 'bg-purple-600 text-white' : 'text-dark-450 hover:text-white'}`}
            >
              Med
            </button>
            <button
              onClick={() => handleVolumeChange('high')}
              className={`px-1 py-0.5 rounded uppercase cursor-pointer ${volume === 'high' ? 'bg-purple-600 text-white' : 'text-dark-450 hover:text-white'}`}
            >
              High
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-right">
            <span className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest block truncate max-w-[150px]">{tourName}</span>
            <span className="text-[8px] text-dark-450 font-bold block">MOBILE CONTROLLER</span>
          </div>
          <button
            onClick={handleOpenEditModal}
            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all active:scale-90 cursor-pointer"
            title="Edit Match Details"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-900/35 border border-red-500/30 text-red-400 p-2 rounded-xl text-[10px] font-semibold text-center mt-1 flex-shrink-0">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 📊 SCORE HEADS-UP DISPLAY WITH DIRECT ADJUSTMENTS */}
      <div className="grid grid-cols-2 gap-3 bg-dark-900/40 p-3 border border-dark-850 rounded-2xl my-2 flex-shrink-0 text-center">
        
        {/* Team A (Blue) */}
        <div className="flex flex-col items-center border-r border-dark-850/60 pr-1.5">
          <span className="text-[9px] text-blue-400 font-extrabold uppercase tracking-wider mb-0.5">BLUE SIDE</span>
          <h3 className="text-xs font-black text-white truncate max-w-[130px] uppercase mb-1">{teamAName}</h3>
          <div className="flex items-center space-x-2.5 bg-blue-950/20 border border-blue-500/20 px-2.5 py-1.5 rounded-xl">
            <button
              onClick={() => handleAddPoints('technical', match.teamA.id, -1, `Direct point correction: -1 to ${teamAName}`)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-950 border border-blue-500/40 text-blue-400 font-black text-lg active:scale-90 select-none cursor-pointer"
            >
              -
            </button>
            <span className="text-3xl sm:text-4xl font-mono font-black text-white min-w-[36px] text-center select-none">
              {kState.scoreA}
            </span>
            <button
              onClick={() => handleAddPoints('technical', match.teamA.id, 1, `Direct point correction: +1 to ${teamAName}`)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500 text-dark-950 font-black text-lg active:scale-90 select-none cursor-pointer shadow-lg shadow-blue-500/30"
            >
              +
            </button>
          </div>
        </div>

        {/* Team B (Red) */}
        <div className="flex flex-col items-center pl-1.5">
          <span className="text-[9px] text-red-400 font-extrabold uppercase tracking-wider mb-0.5">RED SIDE</span>
          <h3 className="text-xs font-black text-white truncate max-w-[130px] uppercase mb-1">{teamBName}</h3>
          <div className="flex items-center space-x-2.5 bg-red-950/20 border border-red-500/20 px-2.5 py-1.5 rounded-xl">
            <button
              onClick={() => handleAddPoints('technical', match.teamB.id, -1, `Direct point correction: -1 to ${teamBName}`)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-950 border border-red-500/40 text-red-400 font-black text-lg active:scale-90 select-none cursor-pointer"
            >
              -
            </button>
            <span className="text-3xl sm:text-4xl font-mono font-black text-white min-w-[36px] text-center select-none">
              {kState.scoreB}
            </span>
            <button
              onClick={() => handleAddPoints('technical', match.teamB.id, 1, `Direct point correction: +1 to ${teamBName}`)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500 text-dark-950 font-black text-lg active:scale-90 select-none cursor-pointer shadow-lg shadow-red-500/30"
            >
              +
            </button>
          </div>
        </div>

      </div>

      {/* ⚡ QUICK SCORING ACTIONS PANEL */}
      <div className="grid grid-cols-2 gap-3 flex-grow my-1">
        
        {/* Blue Scoring Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleAddPoints('raid_success', match.teamA.id, 1, `Raid Point scored by ${teamAName}`)}
            className="w-full bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Raid Success (+1)
          </button>
          <button
            onClick={() => handleAddPoints('bonus', match.teamA.id, 1, `Bonus Point secured by ${teamAName}`)}
            className="w-full bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Bonus (+1)
          </button>
          <button
            onClick={() => handleAddPoints('raid_tackled', match.teamB.id, 1, `Tackle Point secured by ${teamAName}`)}
            className="w-full bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Tackle (+1)
          </button>
          <button
            onClick={() => handleAddPoints('super_tackle', match.teamB.id, 2, `Super Tackle completed by ${teamAName}!`)}
            className="w-full bg-blue-900/35 hover:bg-blue-900/55 border border-blue-500/40 text-blue-300 text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Super Tackle (+2)
          </button>
          <button
            onClick={() => handleAddPoints('all_out', match.teamA.id, 2, `ALL OUT Enforced by ${teamAName}!`)}
            className="w-full bg-[#f8c83a]/15 hover:bg-[#f8c83a]/25 border border-[#f8c83a]/30 text-[#f8c83a] text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            All Out (+2)
          </button>
        </div>

        {/* Red Scoring Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleAddPoints('raid_success', match.teamB.id, 1, `Raid Point scored by ${teamBName}`)}
            className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Raid Success (+1)
          </button>
          <button
            onClick={() => handleAddPoints('bonus', match.teamB.id, 1, `Bonus Point secured by ${teamBName}`)}
            className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Bonus (+1)
          </button>
          <button
            onClick={() => handleAddPoints('raid_tackled', match.teamA.id, 1, `Tackle Point secured by ${teamBName}`)}
            className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Tackle (+1)
          </button>
          <button
            onClick={() => handleAddPoints('super_tackle', match.teamA.id, 2, `Super Tackle completed by ${teamBName}!`)}
            className="w-full bg-red-900/35 hover:bg-red-900/55 border border-red-500/40 text-red-300 text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            Super Tackle (+2)
          </button>
          <button
            onClick={() => handleAddPoints('all_out', match.teamB.id, 2, `ALL OUT Enforced by ${teamBName}!`)}
            className="w-full bg-[#f8c83a]/15 hover:bg-[#f8c83a]/25 border border-[#f8c83a]/30 text-[#f8c83a] text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
          >
            All Out (+2)
          </button>
        </div>

      </div>

      {/* ⏰ TIMER & STATUS CONTROLLERS */}
      <div className="bg-dark-900/40 border border-dark-850 p-2.5 rounded-2xl space-y-2.5 my-2 flex-shrink-0">
        
        {/* Row 1: Raid Timer controls */}
        <div className="flex items-center justify-between border-b border-dark-850/50 pb-2">
          <div className="flex items-center space-x-3">
            <span className="text-[8px] text-gold-500 font-extrabold uppercase tracking-widest">Raid Clock</span>
            <span className={`text-xl font-black font-mono leading-none ${
              raidTime <= 5 ? 'text-red-500 animate-pulse' : 'text-[#facc15]'
            }`}>
              00:{raidTime.toString().padStart(2, '0')}
            </span>
          </div>
          
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleRaidState({ raidRunning: !raidRunning })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 active:scale-95 cursor-pointer ${
                raidRunning
                  ? 'bg-amber-500 text-dark-950 shadow-md shadow-amber-500/20'
                  : 'bg-emerald-500 text-dark-950 shadow-md shadow-emerald-500/20'
              }`}
            >
              {raidRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{raidRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              onClick={() => handleRaidState({ raidTime: 30, raidRunning: false })}
              className="bg-dark-950 border border-dark-850 p-1.5 rounded-lg text-dark-300 active:scale-90 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Row 2: Match Timer & Period */}
        <div className="flex items-center justify-between border-b border-dark-850/50 pb-2">
          <div className="flex items-center space-x-3">
            <span className="text-[8px] text-dark-450 font-extrabold uppercase tracking-widest">Match Time</span>
            <span className="text-sm font-black font-mono">
              {Math.floor(kState.timeRemaining / 60).toString().padStart(2, '0')}:
              {(kState.timeRemaining % 60).toString().padStart(2, '0')}
            </span>
            <span className="text-[8px] text-purple-400 font-bold">({kState.half === 1 ? '1st Half' : '2nd Half'})</span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleMatchTimerToggle}
              className={`px-2.5 py-1.2 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center space-x-1 active:scale-95 cursor-pointer ${
                kState.timerRunning
                  ? 'bg-amber-500/25 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {kState.timerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <span>{kState.timerRunning ? 'Pause' : 'Start'}</span>
            </button>
            <button
              onClick={handleSwitchPeriod}
              className="bg-dark-950 border border-dark-850 px-2 py-1.2 rounded-lg text-[9px] font-bold uppercase active:scale-95 text-gold-450 cursor-pointer"
            >
              Half
            </button>
          </div>
        </div>

        {/* Row 3: Do or Die / Super Tackle Toggles */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleRaidState({ doOrDie: !doOrDie })}
            className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border cursor-pointer ${
              doOrDie
                ? 'bg-amber-600/30 border-amber-500 text-yellow-400 animate-pulse shadow-md shadow-amber-500/10'
                : 'bg-dark-950 border-dark-850 text-dark-400'
            }`}
          >
            Do Or Die
          </button>
          <button
            onClick={() => handleRaidState({ superTackle: !superTackle })}
            className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border cursor-pointer ${
              superTackle
                ? 'bg-red-650/30 border-red-500 text-red-400 animate-pulse shadow-md shadow-red-500/10'
                : 'bg-dark-950 border-dark-850 text-dark-400'
            }`}
          >
            Super Tackle
          </button>
        </div>

      </div>

      {/* ↩️ UNDO PANEL */}
      <button
        onClick={handleUndo}
        className="w-full bg-red-950/20 border border-red-500/25 hover:border-red-500/40 text-red-400 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center space-x-2 active:scale-95 flex-shrink-0 cursor-pointer"
      >
        <Undo2 className="h-4.5 w-4.5" />
        <span>Undo Last Scorer Event</span>
      </button>

      {/* ⚙️ MATCH SETTINGS MODAL OVERLAY */}
      {isEditModalOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col justify-end transition-all duration-300">
          <div className="bg-[#0b0b14] border-t border-dark-800 rounded-t-3xl max-h-[85vh] overflow-y-auto flex flex-col p-4 space-y-4 shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <div className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-purple-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Match Configuration</h2>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 bg-dark-900 border border-dark-800 rounded-lg text-dark-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-left">
              
              {/* 1. Tournament Name */}
              <div className="space-y-1">
                <label className="text-[10px] text-dark-400 font-extrabold uppercase tracking-wider block">Tournament Name</label>
                <input
                  type="text"
                  value={editTourName}
                  onChange={(e) => setEditTourName(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Enter tournament name..."
                />
              </div>

              {/* 2. Team A English & Kannada Names */}
              <div className="bg-blue-950/10 border border-blue-900/35 p-3 rounded-2xl space-y-3">
                <span className="text-[9px] text-blue-400 font-extrabold uppercase tracking-wider block">Team A (Blue Side)</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">English Name</label>
                    <input
                      type="text"
                      value={editTeamANameEng}
                      onChange={(e) => setEditTeamANameEng(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Kannada Name</label>
                    <input
                      type="text"
                      value={editTeamANameKan}
                      onChange={(e) => setEditTeamANameKan(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Team A Logo Selector */}
                <div className="space-y-2">
                  <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Select Logo / Mascot</label>
                  <div className="grid grid-cols-6 gap-1">
                    {PRESET_LOGOS.map((logo) => (
                      <button
                        key={logo.name}
                        onClick={() => setEditLogoA(logo.url)}
                        className={`p-1 rounded-lg border aspect-square flex items-center justify-center bg-dark-900 transition-all cursor-pointer ${
                          editLogoA === logo.url
                            ? 'border-blue-500 ring-1 ring-blue-500/50 scale-105'
                            : 'border-dark-800 hover:border-dark-700'
                        }`}
                        title={logo.name}
                      >
                        <img src={logo.url} alt={logo.name} className="w-full h-full object-contain rounded" />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-500 font-bold uppercase tracking-wider block">Or Paste Custom Logo URL</label>
                    <input
                      type="text"
                      value={editLogoA}
                      onChange={(e) => setEditLogoA(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* 3. Team B English & Kannada Names */}
              <div className="bg-red-950/10 border border-red-900/35 p-3 rounded-2xl space-y-3">
                <span className="text-[9px] text-red-400 font-extrabold uppercase tracking-wider block">Team B (Red Side)</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">English Name</label>
                    <input
                      type="text"
                      value={editTeamBNameEng}
                      onChange={(e) => setEditTeamBNameEng(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Kannada Name</label>
                    <input
                      type="text"
                      value={editTeamBNameKan}
                      onChange={(e) => setEditTeamBNameKan(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Team B Logo Selector */}
                <div className="space-y-2">
                  <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Select Logo / Mascot</label>
                  <div className="grid grid-cols-6 gap-1">
                    {PRESET_LOGOS.map((logo) => (
                      <button
                        key={logo.name}
                        onClick={() => setEditLogoB(logo.url)}
                        className={`p-1 rounded-lg border aspect-square flex items-center justify-center bg-dark-900 transition-all cursor-pointer ${
                          editLogoB === logo.url
                            ? 'border-red-500 ring-1 ring-red-500/50 scale-105'
                            : 'border-dark-800 hover:border-dark-700'
                        }`}
                        title={logo.name}
                      >
                        <img src={logo.url} alt={logo.name} className="w-full h-full object-contain rounded" />
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-500 font-bold uppercase tracking-wider block">Or Paste Custom Logo URL</label>
                    <input
                      type="text"
                      value={editLogoB}
                      onChange={(e) => setEditLogoB(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-red-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* 4. Match Time, Raid Time & Half */}
              <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-3">
                <span className="text-[9px] text-purple-400 font-extrabold uppercase tracking-wider block">Timing & Period</span>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Match Min</label>
                    <input
                      type="number"
                      value={editMatchMinutes}
                      onChange={(e) => setEditMatchMinutes(Number(e.target.value))}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Match Sec</label>
                    <input
                      type="number"
                      value={editMatchSeconds}
                      onChange={(e) => setEditMatchSeconds(Number(e.target.value))}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Raid Clock</label>
                    <input
                      type="number"
                      value={editRaidTime}
                      onChange={(e) => setEditRaidTime(Number(e.target.value))}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Custom Half Duration Settings */}
                <div className="grid grid-cols-2 gap-3 border-t border-dark-850/40 pt-2.5">
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">1st Half Max Time</label>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        value={editFirstHalfMin}
                        onChange={(e) => setEditFirstHalfMin(Number(e.target.value))}
                        className="w-full bg-dark-900 border border-dark-800 rounded-xl px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-purple-500"
                        placeholder="Min"
                        title="1st Half Minutes"
                      />
                      <input
                        type="number"
                        value={editFirstHalfSec}
                        onChange={(e) => setEditFirstHalfSec(Number(e.target.value))}
                        className="w-full bg-dark-900 border border-dark-800 rounded-xl px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-purple-500"
                        placeholder="Sec"
                        title="1st Half Seconds"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">2nd Half Max Time</label>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        value={editSecondHalfMin}
                        onChange={(e) => setEditSecondHalfMin(Number(e.target.value))}
                        className="w-full bg-dark-900 border border-dark-800 rounded-xl px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-purple-500"
                        placeholder="Min"
                        title="2nd Half Minutes"
                      />
                      <input
                        type="number"
                        value={editSecondHalfSec}
                        onChange={(e) => setEditSecondHalfSec(Number(e.target.value))}
                        className="w-full bg-dark-900 border border-dark-800 rounded-xl px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-purple-500"
                        placeholder="Sec"
                        title="2nd Half Seconds"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Match Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setEditHalf(1)}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editHalf === 1
                          ? 'bg-purple-600 text-white font-extrabold shadow-lg shadow-purple-500/20'
                          : 'bg-dark-900 border border-dark-800 text-dark-400'
                      }`}
                    >
                      1st Half
                    </button>
                    <button
                      onClick={() => setEditHalf(2)}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editHalf === 2
                          ? 'bg-purple-600 text-white font-extrabold shadow-lg shadow-purple-500/20'
                          : 'bg-dark-900 border border-dark-800 text-dark-400'
                      }`}
                    >
                      2nd Half
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. Custom Starting Scores */}
              <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-3">
                <span className="text-[9px] text-purple-400 font-extrabold uppercase tracking-wider block">Starting / Base Scores</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] text-blue-400 font-bold uppercase tracking-wider block">Team A Score</label>
                    <input
                      type="number"
                      value={editScoreA}
                      onChange={(e) => setEditScoreA(Number(e.target.value))}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-red-400 font-bold uppercase tracking-wider block">Team B Score</label>
                    <input
                      type="number"
                      value={editScoreB}
                      onChange={(e) => setEditScoreB(Number(e.target.value))}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Do or Die & Super Tackle Status Toggles */}
              <div className="grid grid-cols-2 gap-3 bg-dark-900/40 border border-dark-850 p-3 rounded-2xl">
                <div className="flex flex-col justify-between">
                  <label className="text-[9px] text-amber-500 font-extrabold uppercase tracking-wider block mb-1">Do Or Die Raid</label>
                  <button
                    onClick={() => setEditDoOrDie(!editDoOrDie)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      editDoOrDie
                        ? 'bg-amber-600/30 border border-amber-500 text-yellow-400 font-extrabold shadow-md shadow-amber-500/15'
                        : 'bg-dark-900 border border-dark-800 text-dark-400'
                    }`}
                  >
                    {editDoOrDie ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex flex-col justify-between">
                  <label className="text-[9px] text-red-400 font-extrabold uppercase tracking-wider block mb-1">Super Tackle Status</label>
                  <button
                    onClick={() => setEditSuperTackle(!editSuperTackle)}
                    className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      editSuperTackle
                        ? 'bg-red-650/30 border border-red-500 text-red-400 font-extrabold shadow-md shadow-red-500/15'
                        : 'bg-dark-900 border border-dark-800 text-dark-400'
                    }`}
                  >
                    {editSuperTackle ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="pt-2 flex flex-col space-y-2 border-t border-dark-800">
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-purple-500/25 cursor-pointer flex items-center justify-center space-x-2"
              >
                {isSaving ? (
                  <div className="h-4 w-4 border-2 border-solid border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
              
              <button
                onClick={handleResetScores}
                disabled={isSaving}
                className="w-full py-2.5 bg-red-950/20 hover:bg-red-950/45 border border-red-500/30 disabled:opacity-50 text-red-400 text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>Reset Match Scores</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default function MobileKabaddiController() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#08080c] text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent" />
      </div>
    }>
      <MobileKabaddiControllerContent />
    </Suspense>
  );
}
