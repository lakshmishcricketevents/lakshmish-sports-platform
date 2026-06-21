'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Play, Pause, RotateCcw, Undo2, Wifi, WifiOff, AlertTriangle, ShieldAlert, Award, ArrowLeft, Settings, X, Volume2, Upload, Copy, Lock, Unlock, Download, Image, FileUp, FileDown, Eye, Check, Scissors, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
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
  const [tourName, setTourName] = useState('ಪರಮೇಶ್ವರ ಕಪ್ 2026');
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  // Local state mirror for timers & statuses
  const [raidTime, setRaidTime] = useState(30);
  const [raidRunning, setRaidRunning] = useState(false);
  const [doOrDie, setDoOrDie] = useState(false);
  const [superTackle, setSuperTackle] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(2400);
  const [timerRunning, setTimerRunning] = useState(false);

  const [showSuperRaidA, setShowSuperRaidA] = useState(false);
  const [showSuperRaidB, setShowSuperRaidB] = useState(false);

  const isRaidTimerOwnerRef = useRef(true);
  const isMatchTimerOwnerRef = useRef(true);

  // Audio Engine Refs and States
  const audioEngineRef = useRef<KabaddiAudioEngine | null>(null);
  const lastAnimationTimeRef = useRef<number>(0);

  // Audio & Volume System
  const [volume, setVolume] = useState<'mute' | 'low' | 'medium' | 'high'>('mute');
  const handleVolumeChange = (newVol: 'mute' | 'low' | 'medium' | 'high') => {
    setVolume(newVol);
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(newVol);
      audioEngineRef.current.resume();
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioEngineRef.current = new KabaddiAudioEngine();
    }
  }, []);

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
    const anim = match?.kabaddiState?.activeAnimation;
    if (anim && anim.timestamp > lastAnimationTimeRef.current) {
      lastAnimationTimeRef.current = anim.timestamp;
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
    }
  }, [match?.kabaddiState?.activeAnimation, volume]);

  const triggerAudioAlert = (type: 'tick' | 'warning' | 'buzzer') => {
    // Left empty for compatibility, audio is played via engines directly
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
  const [editActivePlayersA, setEditActivePlayersA] = useState(7);
  const [editActivePlayersB, setEditActivePlayersB] = useState(7);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-Save controls
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const debouncedSaveTextRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedSaveSliderRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedConfigRef = useRef<string>('');
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Branding tab state management
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'branding' | 'profile'>('general');
  const [editShowLakshmish, setEditShowLakshmish] = useState(true);
  const [editShowTournamentLogo, setEditShowTournamentLogo] = useState(true);
  const [editShowSponsorLogo, setEditShowSponsorLogo] = useState(true);
  const [editShowWinProbability, setEditShowWinProbability] = useState(true);
  const [editShowLastRaidResult, setEditShowLastRaidResult] = useState(true);
  const [editPresenterText, setEditPresenterText] = useState('LAKSHMISH CRICKET EVENTS PRESENTS');
  const [editBrandingTourLogo, setEditBrandingTourLogo] = useState('');
  const [editBrandingLakshmishLogo, setEditBrandingLakshmishLogo] = useState('/transparent_lakshmish_logo.png');
  const [editSponsorLogos, setEditSponsorLogos] = useState<string[]>(['', '', '', '', '']);
  const [editSponsorNames, setEditSponsorNames] = useState<string[]>(['', '', '', '', '']);
  const [editSponsorSubtitles, setEditSponsorSubtitles] = useState<string[]>(['', '', '', '', '']);
  const [editBrandingBgImage, setEditBrandingBgImage] = useState('');
  const [editLogoPos, setEditLogoPos] = useState<'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'>('top-left');
  const [editLogoSize, setEditLogoSize] = useState(100);
  const [editSponsorPos, setEditSponsorPos] = useState<'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'>('top-right');
  const [editSponsorSize, setEditSponsorSize] = useState(100);
  const [editPrimaryColor, setEditPrimaryColor] = useState('#facc15');
  const [editSecondaryColor, setEditSecondaryColor] = useState('#000000');
  const [editSponsorBorderColor, setEditSponsorBorderColor] = useState('#eab308');
  const [editSponsorBorderShape, setEditSponsorBorderShape] = useState<'circle' | 'square'>('circle');
  const [editSponsorBorderThickness, setEditSponsorBorderThickness] = useState(3);
  const [editSponsorGlow, setEditSponsorGlow] = useState(true);
  const [editSponsorType, setEditSponsorType] = useState<'single' | 'presented' | 'carousel'>('carousel');
  const [editLayout, setEditLayout] = useState<any>(null);
  
  // Profile settings
  const [editVenue, setEditVenue] = useState('');
  const [editOrganizer, setEditOrganizer] = useState('');
  const [editContactNumber, setEditContactNumber] = useState('');
  const [editDates, setEditDates] = useState('');

  // Presets & Locking
  const [editPresets, setEditPresets] = useState<any[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [editIsLocked, setEditIsLocked] = useState(false);

  // Preview management
  const [previewSize, setPreviewSize] = useState<'desktop' | 'mobile' | 'led'>('desktop');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);
  const [activeUploadSlot, setActiveUploadSlot] = useState<string | null>(null);

  // Cropper states
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropSrc, setCropSrc] = useState<string>('');
  const [cropType, setCropType] = useState<'lakshmish' | 'tournament' | 'sponsor' | 'bg' | 'organizer'>('lakshmish');
  const [cropIndex, setCropIndex] = useState<number | undefined>(undefined);
  const [cropPreset, setCropPreset] = useState<'1:1' | '16:9' | 'circle' | '4:5' | '3:4'>('1:1');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropRotation, setCropRotation] = useState(0);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStartCrop, setDragStartCrop] = useState({ x: 0, y: 0 });
  const [dragOffsetStartCrop, setDragOffsetStartCrop] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

  // Organizer photo state
  const [editOrganizerPhoto, setEditOrganizerPhoto] = useState('');
  
  // Sponsor preview state
  const [previewSponsorUrl, setPreviewSponsorUrl] = useState<string | null>(null);


  const raidIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    const textRef = debouncedSaveTextRef;
    const sliderRef = debouncedSaveSliderRef;
    const retryRef = retryTimeoutRef;
    return () => {
      if (textRef.current) clearTimeout(textRef.current);
      if (sliderRef.current) clearTimeout(sliderRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

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
            
            if (audioEngineRef.current && volume !== 'mute') {
              audioEngineRef.current.playBuzzer();
            }

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

          // Play tick/warning sound on scorer console if unmuted
          if (audioEngineRef.current && volume !== 'mute') {
            audioEngineRef.current.playTick(nextTime);
          }

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
  }, [raidRunning, doOrDie, superTackle, matchId, token, volume]);

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
  const postAction = async (action: string, payload: any): Promise<boolean> => {
    if (!matchId || !token) {
      setErrorMsg('Missing security token. Access denied.');
      return false;
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
        return false;
      }
      setIsSynced(true);
      setErrorMsg('');
      loadMatchData();
      return true;
    } catch (e) {
      console.error(e);
      setErrorMsg('Network error. Check Wi-Fi connection.');
      setIsSynced(false);
      return false;
    }
  };

  // Branding Image Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'lakshmish' | 'tournament' | 'sponsor' | 'bg', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActiveUploadSlot(type + (index !== undefined ? `-${index}` : ''));
    setErrorMsg('');

    try {
      // 1. Try uploading to Supabase Storage if configured
      if (isSupabaseConfigured) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const folderMap = {
          lakshmish: 'lakshmish-logo',
          tournament: 'tournament-logo',
          sponsor: 'sponsor-logo',
          bg: 'backgrounds'
        };
        const folder = folderMap[type];
        const fileName = `${Date.now()}_${cleanName}`;
        const filePath = `${folder}/${fileName}`;

        const { data, error } = await supabase.storage
          .from('branding-assets')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
          console.warn('Supabase upload failed, falling back to local server:', error.message);
        } else {
          const { data: getUrlData } = supabase.storage.from('branding-assets').getPublicUrl(filePath);
          const publicUrl = getUrlData?.publicUrl || '';
          
          if (type === 'lakshmish') setEditBrandingLakshmishLogo(publicUrl);
          else if (type === 'tournament') setEditBrandingTourLogo(publicUrl);
          else if (type === 'bg') setEditBrandingBgImage(publicUrl);
          else if (type === 'sponsor' && index !== undefined) {
            const newSponsors = [...editSponsorLogos];
            newSponsors[index] = publicUrl;
            setEditSponsorLogos(newSponsors);
          }
          setActiveUploadSlot(null);
          return;
        }
      }

      // 2. Local fallback upload if Supabase fails or not configured
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      if (type === 'lakshmish') setEditBrandingLakshmishLogo(data.url);
      else if (type === 'tournament') setEditBrandingTourLogo(data.url);
      else if (type === 'bg') setEditBrandingBgImage(data.url);
      else if (type === 'sponsor' && index !== undefined) {
        const newSponsors = [...editSponsorLogos];
        newSponsors[index] = data.url;
        setEditSponsorLogos(newSponsors);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setErrorMsg(`Upload failed: ${err.message || 'Check connection'}`);
    } finally {
      setActiveUploadSlot(null);
    }
  };

  // Select file for crop
  const handleSelectFileForCrop = (e: React.ChangeEvent<HTMLInputElement>, type: 'lakshmish' | 'tournament' | 'sponsor' | 'bg' | 'organizer', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setCropSrc(src);
      setCropType(type);
      setCropIndex(index);
      
      if (type === 'sponsor') {
        setCropPreset('1:1');
      } else if (type === 'tournament') {
        setCropPreset('1:1');
      } else if (type === 'organizer') {
        setCropPreset('4:5');
      } else if (type === 'bg') {
        setCropPreset('16:9');
      } else {
        setCropPreset('1:1');
      }
      
      setCropZoom(1);
      setCropRotation(0);
      setCropOffset({ x: 0, y: 0 });
      
      const img = document.createElement('img');
      img.onload = () => {
        let fitW = 300;
        let fitH = 300;
        if (img.naturalWidth >= img.naturalHeight) {
          fitW = 300;
          fitH = 300 * (img.naturalHeight / img.naturalWidth);
        } else {
          fitH = 300;
          fitW = 300 * (img.naturalWidth / img.naturalHeight);
        }
        setImgDimensions({
          width: fitW,
          height: fitH,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        });
        setShowCropModal(true);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Crop existing image
  const handleCropExistingImage = (url: string, type: 'lakshmish' | 'tournament' | 'sponsor' | 'bg' | 'organizer', index?: number) => {
    if (!url) return;
    setCropSrc(url);
    setCropType(type);
    setCropIndex(index);
    
    if (type === 'sponsor') {
      setCropPreset('1:1');
    } else if (type === 'tournament') {
      setCropPreset('1:1');
    } else if (type === 'organizer') {
      setCropPreset('4:5');
    } else if (type === 'bg') {
      setCropPreset('16:9');
    } else {
      setCropPreset('1:1');
    }
    
    setCropZoom(1);
    setCropRotation(0);
    setCropOffset({ x: 0, y: 0 });
    
    const img = document.createElement('img');
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let fitW = 300;
      let fitH = 300;
      if (img.naturalWidth >= img.naturalHeight) {
        fitW = 300;
        fitH = 300 * (img.naturalHeight / img.naturalWidth);
      } else {
        fitH = 300;
        fitW = 300 * (img.naturalWidth / img.naturalHeight);
      }
      setImgDimensions({
        width: fitW,
        height: fitH,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
      setShowCropModal(true);
    };
    img.onerror = () => {
      alert("Failed to load existing image for cropping. External images might be blocked by browser CORS policy. Please download the image and upload/replace it instead.");
    };
    img.src = url;
  };

  // Upload cropped file
  const uploadCroppedFile = async (file: File, type: 'lakshmish' | 'tournament' | 'sponsor' | 'bg' | 'organizer'): Promise<string> => {
    if (isSupabaseConfigured) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const folderMap = {
        lakshmish: 'lakshmish-logo',
        tournament: 'tournament-logo',
        sponsor: 'sponsor-logo',
        bg: 'backgrounds',
        organizer: 'organizers'
      };
      const folder = folderMap[type];
      const fileName = `${Date.now()}_${cleanName}`;
      const filePath = `${folder}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('branding-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.warn('Supabase upload failed, falling back to local server:', error.message);
      } else {
        const { data: getUrlData } = supabase.storage.from('branding-assets').getPublicUrl(filePath);
        return getUrlData?.publicUrl || '';
      }
    }

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  };

  // Save cropped canvas image
  const handleSaveCrop = async () => {
    let cropW = 250;
    let cropH = 250;
    let outW = 400;
    let outH = 400;
    
    if (cropPreset === '16:9') {
      cropW = 280;
      cropH = 157.5;
      outW = 800;
      outH = 450;
    } else if (cropPreset === '4:5') {
      cropW = 200;
      cropH = 250;
      outW = 400;
      outH = 500;
    } else if (cropPreset === '3:4') {
      cropW = 187.5;
      cropH = 250;
      outW = 375;
      outH = 500;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const img = document.createElement('img');
    img.crossOrigin = "anonymous";
    
    const scaleK = outW / cropW;
    
    const uploadPromise = new Promise<string>((resolve, reject) => {
      img.onload = async () => {
        try {
          if (cropPreset === 'circle') {
            ctx.beginPath();
            ctx.arc(outW / 2, outH / 2, outW / 2, 0, 2 * Math.PI);
            ctx.clip();
          }
          
          ctx.translate(outW / 2 + cropOffset.x * scaleK, outH / 2 + cropOffset.y * scaleK);
          ctx.rotate((cropRotation * Math.PI) / 180);
          ctx.scale(cropZoom, cropZoom);
          
          let fitW = 300;
          let fitH = 300;
          if (img.naturalWidth >= img.naturalHeight) {
            fitW = 300;
            fitH = 300 * (img.naturalHeight / img.naturalWidth);
          } else {
            fitH = 300;
            fitW = 300 * (img.naturalWidth / img.naturalHeight);
          }
          
          const drawW = fitW * scaleK;
          const drawH = fitH * scaleK;
          
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          
          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error('Failed to capture canvas'));
              return;
            }
            try {
              const fileType = cropPreset === 'circle' ? 'image/png' : 'image/jpeg';
              const fileExt = cropPreset === 'circle' ? '.png' : '.jpg';
              const file = new File([blob], `cropped_${Date.now()}${fileExt}`, { type: fileType });
              
              const url = await uploadCroppedFile(file, cropType);
              resolve(url);
            } catch (err) {
              reject(err);
            }
          }, cropPreset === 'circle' ? 'image/png' : 'image/jpeg', 0.9);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        reject(new Error('Failed to load image. If this is a remote URL, CORS settings might block access. Try uploading a local file.'));
      };
      img.src = cropSrc;
    });
    
    setErrorMsg('');
    setShowCropModal(false);
    setActiveUploadSlot(cropType + (cropIndex !== undefined ? `-${cropIndex}` : ''));
    
    try {
      const uploadedUrl = await uploadPromise;
      if (cropType === 'lakshmish') {
        setEditBrandingLakshmishLogo(uploadedUrl);
        if (autoSaveEnabled) saveConfigurationRealTime({ brandingLakshmishLogo: uploadedUrl });
      } else if (cropType === 'tournament') {
        setEditBrandingTourLogo(uploadedUrl);
        if (autoSaveEnabled) saveConfigurationRealTime({ brandingTourLogo: uploadedUrl });
      } else if (cropType === 'bg') {
        setEditBrandingBgImage(uploadedUrl);
        if (autoSaveEnabled) saveConfigurationRealTime({ brandingBgImage: uploadedUrl });
      } else if (cropType === 'organizer') {
        setEditOrganizerPhoto(uploadedUrl);
        if (autoSaveEnabled) saveConfigurationRealTime({ organizerPhoto: uploadedUrl });
      } else if (cropType === 'sponsor' && cropIndex !== undefined) {
        const newSponsors = [...editSponsorLogos];
        newSponsors[cropIndex] = uploadedUrl;
        setEditSponsorLogos(newSponsors);
        if (autoSaveEnabled) saveConfigurationRealTime({ sponsorLogos: newSponsors });
      }
    } catch (err: any) {
      console.error('Cropping upload error:', err);
      setErrorMsg(`Cropping upload failed: ${err.message || 'Check connection'}`);
    } finally {
      setActiveUploadSlot(null);
    }
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    setIsDraggingCrop(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStartCrop({ x: clientX, y: clientY });
    setDragOffsetStartCrop({ x: cropOffset.x, y: cropOffset.y });
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingCrop) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragStartCrop.x;
    const dy = clientY - dragStartCrop.y;
    setCropOffset({
      x: dragOffsetStartCrop.x + dx,
      y: dragOffsetStartCrop.y + dy
    });
  };

  const handlePointerUp = () => {
    setIsDraggingCrop(false);
  };

  const getAvailablePresets = () => {
    if (cropType === 'sponsor') {
      return [
        { label: 'Square (1:1)', value: '1:1' },
        { label: 'Wide (16:9)', value: '16:9' },
        { label: 'Circle', value: 'circle' }
      ];
    }
    if (cropType === 'tournament') {
      return [
        { label: 'Square (1:1)', value: '1:1' },
        { label: 'Circle', value: 'circle' }
      ];
    }
    if (cropType === 'organizer') {
      return [
        { label: 'Portrait (4:5)', value: '4:5' },
        { label: 'ID Card (3:4)', value: '3:4' },
        { label: 'Circle', value: 'circle' }
      ];
    }
    if (cropType === 'bg') {
      return [
        { label: 'Wide (16:9)', value: '16:9' }
      ];
    }
    return [
      { label: 'Square (1:1)', value: '1:1' },
      { label: 'Circle', value: 'circle' }
    ];
  };

  // Branding Preset Handlers
  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const preset = {
      name: newPresetName.trim(),
      showLakshmishLogo: editShowLakshmish,
      showTournamentLogo: editShowTournamentLogo,
      showSponsorLogo: editShowSponsorLogo,
      showWinProbability: editShowWinProbability,
      showLastRaidResult: editShowLastRaidResult,
      presenterText: editPresenterText,
      tournamentName: editTourName,
      tournamentLogo: editBrandingTourLogo,
      lakshmishLogo: editBrandingLakshmishLogo,
      sponsorLogos: editSponsorLogos,
      sponsorNames: editSponsorNames,
      sponsorSubtitles: editSponsorSubtitles,
      backgroundImage: editBrandingBgImage,
      logoPosition: editLogoPos,
      logoSize: editLogoSize,
      sponsorPosition: editSponsorPos,
      sponsorSize: editSponsorSize,
      primaryColor: editPrimaryColor,
      secondaryColor: editSecondaryColor,
      sponsorBorderColor: editSponsorBorderColor,
      sponsorBorderShape: editSponsorBorderShape,
      sponsorBorderThickness: editSponsorBorderThickness,
      sponsorGlow: editSponsorGlow,
      sponsorType: editSponsorType,
      layout: editLayout
    };

    const updatedPresets = [...editPresets.filter(p => p.name !== preset.name), preset];
    setEditPresets(updatedPresets);
    setNewPresetName('');
    localStorage.setItem('lakshmish_branding_presets', JSON.stringify(updatedPresets));
    if (autoSaveEnabled) {
      saveConfigurationRealTime({ presets: updatedPresets });
    }
  };

  const handleLoadPreset = (preset: any) => {
    if (editIsLocked) return;
    setEditShowLakshmish(preset.showLakshmishLogo !== undefined ? preset.showLakshmishLogo : true);
    setEditShowTournamentLogo(preset.showTournamentLogo !== undefined ? preset.showTournamentLogo : true);
    setEditShowSponsorLogo(preset.showSponsorLogo !== undefined ? preset.showSponsorLogo : true);
    setEditShowWinProbability(preset.showWinProbability !== undefined ? preset.showWinProbability : true);
    setEditShowLastRaidResult(preset.showLastRaidResult !== undefined ? preset.showLastRaidResult : true);
    setEditPresenterText(preset.presenterText || 'LAKSHMISH CRICKET EVENTS PRESENTS');
    setEditBrandingTourLogo(preset.tournamentLogo || '');
    setEditBrandingLakshmishLogo(preset.lakshmishLogo || '/transparent_lakshmish_logo.png');
    setEditSponsorLogos(preset.sponsorLogos && preset.sponsorLogos.length > 0 ? [...preset.sponsorLogos] : ['', '', '', '', '']);
    setEditSponsorNames(preset.sponsorNames && preset.sponsorNames.length > 0 ? [...preset.sponsorNames] : ['', '', '', '', '']);
    setEditSponsorSubtitles(preset.sponsorSubtitles && preset.sponsorSubtitles.length > 0 ? [...preset.sponsorSubtitles] : ['', '', '', '', '']);
    setEditBrandingBgImage(preset.backgroundImage || '');
    setEditLogoPos(preset.logoPosition || 'top-left');
    setEditLogoSize(preset.logoSize !== undefined ? preset.logoSize : 100);
    setEditSponsorPos(preset.sponsorPosition || 'top-right');
    setEditSponsorSize(preset.sponsorSize !== undefined ? preset.sponsorSize : 100);
    setEditPrimaryColor(preset.primaryColor || '#facc15');
    setEditSecondaryColor(preset.secondaryColor || '#000000');
    setEditSponsorBorderColor(preset.sponsorBorderColor || '#eab308');
    setEditSponsorBorderShape(preset.sponsorBorderShape || 'circle');
    setEditSponsorBorderThickness(preset.sponsorBorderThickness !== undefined ? preset.sponsorBorderThickness : 3);
    setEditSponsorGlow(preset.sponsorGlow !== undefined ? preset.sponsorGlow : true);
    setEditSponsorType(preset.sponsorType || 'carousel');
    setEditLayout(preset.layout || null);

    if (autoSaveEnabled) {
      saveConfigurationRealTime({
        showLakshmish: preset.showLakshmishLogo !== undefined ? preset.showLakshmishLogo : true,
        showTournamentLogo: preset.showTournamentLogo !== undefined ? preset.showTournamentLogo : true,
        showSponsorLogo: preset.showSponsorLogo !== undefined ? preset.showSponsorLogo : true,
        showWinProbability: preset.showWinProbability !== undefined ? preset.showWinProbability : true,
        showLastRaidResult: preset.showLastRaidResult !== undefined ? preset.showLastRaidResult : true,
        presenterText: preset.presenterText || 'LAKSHMISH CRICKET EVENTS PRESENTS',
        brandingTourLogo: preset.tournamentLogo || '',
        brandingLakshmishLogo: preset.lakshmishLogo || '/transparent_lakshmish_logo.png',
        sponsorLogos: preset.sponsorLogos && preset.sponsorLogos.length > 0 ? [...preset.sponsorLogos] : ['', '', '', '', ''],
        sponsorNames: preset.sponsorNames && preset.sponsorNames.length > 0 ? [...preset.sponsorNames] : ['', '', '', '', ''],
        sponsorSubtitles: preset.sponsorSubtitles && preset.sponsorSubtitles.length > 0 ? [...preset.sponsorSubtitles] : ['', '', '', '', ''],
        brandingBgImage: preset.backgroundImage || '',
        logoPos: preset.logoPosition || 'top-left',
        logoSize: preset.logoSize !== undefined ? preset.logoSize : 100,
        sponsorPos: preset.sponsorPosition || 'top-right',
        sponsorSize: preset.sponsorSize !== undefined ? preset.sponsorSize : 100,
        primaryColor: preset.primaryColor || '#facc15',
        secondaryColor: preset.secondaryColor || '#000000',
        sponsorBorderColor: preset.sponsorBorderColor || '#eab308',
        sponsorBorderShape: preset.sponsorBorderShape || 'circle',
        sponsorBorderThickness: preset.sponsorBorderThickness !== undefined ? preset.sponsorBorderThickness : 3,
        sponsorGlow: preset.sponsorGlow !== undefined ? preset.sponsorGlow : true,
        sponsorType: preset.sponsorType || 'carousel',
        layout: preset.layout || null
      });
    }
  };

  const handleDeletePreset = (name: string) => {
    const updated = editPresets.filter(p => p.name !== name);
    setEditPresets(updated);
    localStorage.setItem('lakshmish_branding_presets', JSON.stringify(updated));
    if (autoSaveEnabled) {
      saveConfigurationRealTime({ presets: updated });
    }
  };

  const handleRestoreDefaults = () => {
    if (editIsLocked) return;
    setEditShowLakshmish(true);
    setEditShowTournamentLogo(true);
    setEditShowSponsorLogo(true);
    setEditShowWinProbability(true);
    setEditShowLastRaidResult(true);
    setEditPresenterText('LAKSHMISH CRICKET EVENTS PRESENTS');
    setEditTourName('PARMESHWARA CUP 2026');
    setEditBrandingTourLogo('');
    setEditBrandingLakshmishLogo('/transparent_lakshmish_logo.png');
    setEditSponsorLogos(['', '', '', '', '']);
    setEditSponsorNames(['', '', '', '', '']);
    setEditSponsorSubtitles(['', '', '', '', '']);
    setEditBrandingBgImage('');
    setEditLogoPos('top-left');
    setEditLogoSize(100);
    setEditSponsorPos('top-right');
    setEditSponsorSize(100);
    setEditPrimaryColor('#facc15');
    setEditSecondaryColor('#000000');
    setEditSponsorBorderColor('#eab308');
    setEditSponsorBorderShape('circle');
    setEditSponsorBorderThickness(3);
    setEditSponsorGlow(true);
    setEditSponsorType('carousel');
    setEditLayout(null);
    setEditIsLocked(false);

    if (autoSaveEnabled) {
      saveConfigurationRealTime({
        showLakshmish: true,
        showTournamentLogo: true,
        showSponsorLogo: true,
        showWinProbability: true,
        showLastRaidResult: true,
        presenterText: 'LAKSHMISH CRICKET EVENTS PRESENTS',
        tournamentName: 'PARMESHWARA CUP 2026',
        brandingTourLogo: '',
        brandingLakshmishLogo: '/transparent_lakshmish_logo.png',
        sponsorLogos: ['', '', '', '', ''],
        sponsorNames: ['', '', '', '', ''],
        sponsorSubtitles: ['', '', '', '', ''],
        brandingBgImage: '',
        logoPos: 'top-left',
        logoSize: 100,
        sponsorPos: 'top-right',
        sponsorSize: 100,
        primaryColor: '#facc15',
        secondaryColor: '#000000',
        sponsorBorderColor: '#eab308',
        sponsorBorderShape: 'circle',
        sponsorBorderThickness: 3,
        sponsorGlow: true,
        sponsorType: 'carousel',
        layout: null,
        isLocked: false
      });
    }
  };

  // Layout Template Handlers
  const handleApplyTemplate = (type: 'kabaddi' | 'pkl' | 'lakshmish_premium' | 'led_wall') => {
    if (editIsLocked) return;
    let templateLayout: any = null;
    let showL = true;
    let showT = true;
    let showS = true;
    let primC = '#facc15';
    let secC = '#000000';
    let bgImg = '';
    let logoSz = 100;
    let sponsorSz = 100;
    let logoP: any = 'top-left';
    let sponsorP: any = 'top-right';

    if (type === 'kabaddi') {
      templateLayout = {
        logo: { x: 2, y: 2, scale: 1.0 },
        sponsor: { x: 86, y: 2, scale: 1.0 },
        banner: { x: 50, y: 0, scale: 1.0 },
        timer: { x: 38, y: 14, scale: 1.0 },
        raidTimer: { x: 44, y: 68, scale: 1.0 }
      };
    } else if (type === 'pkl') {
      showL = true;
      showT = true;
      showS = true;
      primC = '#f97316';
      secC = '#000000';
      bgImg = '';
      logoSz = 95;
      sponsorSz = 95;
      templateLayout = {
        logo: { x: 2, y: 2, scale: 0.95 },
        sponsor: { x: 88, y: 2, scale: 0.95 },
        banner: { x: 50, y: 2, scale: 0.9 },
        timer: { x: 38, y: 84, scale: 1.1 },
        raidTimer: { x: 44, y: 72, scale: 1.25 }
      };
    } else if (type === 'lakshmish_premium') {
      showL = true;
      showT = true;
      showS = true;
      primC = '#f8c83a';
      secC = '#0b0b14';
      bgImg = '';
      logoSz = 115;
      sponsorSz = 110;
      logoP = 'top-left';
      sponsorP = 'top-right';
      templateLayout = {
        logo: { x: 4, y: 4, scale: 1.15 },
        sponsor: { x: 82, y: 4, scale: 1.1 },
        banner: { x: 50, y: 0, scale: 1.05 },
        timer: { x: 38, y: 14, scale: 1.0 },
        raidTimer: { x: 44, y: 68, scale: 1.0 }
      };
    } else if (type === 'led_wall') {
      showL = false;
      showT = true;
      showS = false;
      primC = '#f8c83a';
      secC = '#000000';
      bgImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='black'/></svg>";
      logoSz = 135;
      sponsorSz = 130;
      templateLayout = {
        logo: { x: 1, y: 1, scale: 1.35 },
        sponsor: { x: 89, y: 1, scale: 1.3 },
        banner: { x: 50, y: 0, scale: 1.2 },
        timer: { x: 35, y: 12, scale: 1.2 },
        raidTimer: { x: 43, y: 65, scale: 1.35 }
      };
    }

    setEditShowLakshmish(showL);
    setEditShowTournamentLogo(showT);
    setEditShowSponsorLogo(showS);
    setEditPrimaryColor(primC);
    setEditSecondaryColor(secC);
    setEditLogoPos(logoP);
    setEditSponsorPos(sponsorP);
    setEditBrandingBgImage(bgImg);
    setEditLogoSize(logoSz);
    setEditSponsorSize(sponsorSz);
    setEditLayout(templateLayout);

    if (autoSaveEnabled) {
      saveConfigurationRealTime({
        showLakshmish: showL,
        showTournamentLogo: showT,
        showSponsorLogo: showS,
        primaryColor: primC,
        secondaryColor: secC,
        logoPos: logoP,
        sponsorPos: sponsorP,
        brandingBgImage: bgImg,
        logoSize: logoSz,
        sponsorSize: sponsorSz,
        layout: templateLayout
      });
    }
  };

  // Export / Import Branding Package helpers
  const handleExportBranding = () => {
    const config = {
      showLakshmishLogo: editShowLakshmish,
      showTournamentLogo: editShowTournamentLogo,
      showSponsorLogo: editShowSponsorLogo,
      showWinProbability: editShowWinProbability,
      showLastRaidResult: editShowLastRaidResult,
      presenterText: editPresenterText,
      tournamentName: editTourName,
      tournamentLogo: editBrandingTourLogo,
      lakshmishLogo: editBrandingLakshmishLogo,
      sponsorLogos: editSponsorLogos,
      sponsorNames: editSponsorNames,
      backgroundImage: editBrandingBgImage,
      logoPosition: editLogoPos,
      logoSize: editLogoSize,
      sponsorPosition: editSponsorPos,
      sponsorSize: editSponsorSize,
      primaryColor: editPrimaryColor,
      secondaryColor: editSecondaryColor,
      sponsorBorderColor: editSponsorBorderColor,
      sponsorBorderShape: editSponsorBorderShape,
      sponsorBorderThickness: editSponsorBorderThickness,
      sponsorGlow: editSponsorGlow,
      sponsorType: editSponsorType,
      layout: editLayout,
      profile: {
        venue: editVenue,
        organizer: editOrganizer,
        contactNumber: editContactNumber,
        dates: editDates,
        organizerPhoto: editOrganizerPhoto
      }
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `branding_${editTourName.replace(/\s+/g, '_') || 'config'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBranding = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editIsLocked) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        if (json.showLakshmishLogo !== undefined) setEditShowLakshmish(!!json.showLakshmishLogo);
        if (json.showTournamentLogo !== undefined) setEditShowTournamentLogo(!!json.showTournamentLogo);
        if (json.showSponsorLogo !== undefined) setEditShowSponsorLogo(!!json.showSponsorLogo);
        if (json.showWinProbability !== undefined) setEditShowWinProbability(!!json.showWinProbability);
        if (json.showLastRaidResult !== undefined) setEditShowLastRaidResult(!!json.showLastRaidResult);
        if (json.presenterText !== undefined) setEditPresenterText(json.presenterText || '');
        if (json.tournamentName !== undefined) setEditTourName(json.tournamentName || '');
        if (json.tournamentLogo !== undefined) setEditBrandingTourLogo(json.tournamentLogo || '');
        if (json.lakshmishLogo !== undefined) setEditBrandingLakshmishLogo(json.lakshmishLogo || '/transparent_lakshmish_logo.png');
        if (json.sponsorLogos && Array.isArray(json.sponsorLogos)) setEditSponsorLogos([...json.sponsorLogos]);
        if (json.sponsorNames && Array.isArray(json.sponsorNames)) setEditSponsorNames([...json.sponsorNames]);
        if (json.sponsorSubtitles && Array.isArray(json.sponsorSubtitles)) setEditSponsorSubtitles([...json.sponsorSubtitles]);
        if (json.backgroundImage !== undefined) setEditBrandingBgImage(json.backgroundImage || '');
        if (json.logoPosition !== undefined) setEditLogoPos(json.logoPosition);
        if (json.logoSize !== undefined) setEditLogoSize(Number(json.logoSize));
        if (json.sponsorPosition !== undefined) setEditSponsorPos(json.sponsorPosition);
        if (json.sponsorSize !== undefined) setEditSponsorSize(Number(json.sponsorSize));
        if (json.primaryColor !== undefined) setEditPrimaryColor(json.primaryColor);
        if (json.secondaryColor !== undefined) setEditSecondaryColor(json.secondaryColor);
        if (json.sponsorBorderColor !== undefined) setEditSponsorBorderColor(json.sponsorBorderColor);
        if (json.sponsorBorderShape !== undefined) setEditSponsorBorderShape(json.sponsorBorderShape);
        if (json.sponsorBorderThickness !== undefined) setEditSponsorBorderThickness(Number(json.sponsorBorderThickness));
        if (json.sponsorGlow !== undefined) setEditSponsorGlow(!!json.sponsorGlow);
        if (json.sponsorType !== undefined) setEditSponsorType(json.sponsorType);
        if (json.layout !== undefined) setEditLayout(json.layout);
        
        if (json.profile) {
          setEditVenue(json.profile.venue || '');
          setEditOrganizer(json.profile.organizer || '');
          setEditContactNumber(json.profile.contactNumber || '');
          setEditDates(json.profile.dates || '');
          setEditOrganizerPhoto(json.profile.organizerPhoto || '');
        }

        if (autoSaveEnabled) {
          saveConfigurationRealTime({
            showLakshmish: json.showLakshmishLogo !== undefined ? !!json.showLakshmishLogo : editShowLakshmish,
            showTournamentLogo: json.showTournamentLogo !== undefined ? !!json.showTournamentLogo : editShowTournamentLogo,
            showSponsorLogo: json.showSponsorLogo !== undefined ? !!json.showSponsorLogo : editShowSponsorLogo,
            showWinProbability: json.showWinProbability !== undefined ? !!json.showWinProbability : editShowWinProbability,
            showLastRaidResult: json.showLastRaidResult !== undefined ? !!json.showLastRaidResult : editShowLastRaidResult,
            presenterText: json.presenterText !== undefined ? json.presenterText : editPresenterText,
            tournamentName: json.tournamentName !== undefined ? json.tournamentName : editTourName,
            brandingTourLogo: json.tournamentLogo !== undefined ? json.tournamentLogo : editBrandingTourLogo,
            brandingLakshmishLogo: json.lakshmishLogo !== undefined ? json.lakshmishLogo : editBrandingLakshmishLogo,
            sponsorLogos: json.sponsorLogos && Array.isArray(json.sponsorLogos) ? [...json.sponsorLogos] : editSponsorLogos,
            sponsorNames: json.sponsorNames && Array.isArray(json.sponsorNames) ? [...json.sponsorNames] : editSponsorNames,
            sponsorSubtitles: json.sponsorSubtitles && Array.isArray(json.sponsorSubtitles) ? [...json.sponsorSubtitles] : editSponsorSubtitles,
            brandingBgImage: json.backgroundImage !== undefined ? json.backgroundImage : editBrandingBgImage,
            logoPos: json.logoPosition !== undefined ? json.logoPosition : editLogoPos,
            logoSize: json.logoSize !== undefined ? Number(json.logoSize) : editLogoSize,
            sponsorPos: json.sponsorPosition !== undefined ? json.sponsorPosition : editSponsorPos,
            sponsorSize: json.sponsorSize !== undefined ? Number(json.sponsorSize) : editSponsorSize,
            primaryColor: json.primaryColor !== undefined ? json.primaryColor : editPrimaryColor,
            secondaryColor: json.secondaryColor !== undefined ? json.secondaryColor : editSecondaryColor,
            sponsorBorderColor: json.sponsorBorderColor !== undefined ? json.sponsorBorderColor : editSponsorBorderColor,
            sponsorBorderShape: json.sponsorBorderShape !== undefined ? json.sponsorBorderShape : editSponsorBorderShape,
            sponsorBorderThickness: json.sponsorBorderThickness !== undefined ? Number(json.sponsorBorderThickness) : editSponsorBorderThickness,
            sponsorGlow: json.sponsorGlow !== undefined ? !!json.sponsorGlow : editSponsorGlow,
            sponsorType: json.sponsorType !== undefined ? json.sponsorType : editSponsorType,
            layout: json.layout !== undefined ? json.layout : editLayout,
            venue: json.profile?.venue !== undefined ? json.profile.venue : editVenue,
            organizer: json.profile?.organizer !== undefined ? json.profile.organizer : editOrganizer,
            contactNumber: json.profile?.contactNumber !== undefined ? json.profile.contactNumber : editContactNumber,
            dates: json.profile?.dates !== undefined ? json.profile.dates : editDates,
            organizerPhoto: json.profile?.organizerPhoto !== undefined ? json.profile.organizerPhoto : editOrganizerPhoto
          });
        }
      } catch (err) {
        alert('Invalid JSON branding package file.');
      }
    };
    reader.readAsText(file);
  };

  // Link copy helper
  const handleCopyLink = (type: 'broadcast' | 'led' | 'score' | 'intro') => {
    const baseUrl = window.location.origin;
    const urlMap = {
      broadcast: `/matches/${matchId}/kabaddi/broadcast`,
      led: `/matches/${matchId}/kabaddi/broadcast?view=led`,
      score: `/matches/${matchId}/kabaddi/broadcast?view=score`,
      intro: `/matches/${matchId}/kabaddi/broadcast?view=intro`
    };
    const fullUrl = baseUrl + urlMap[type];
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl)
        .then(() => {
          setCopiedLinkType(type);
          setTimeout(() => setCopiedLinkType(null), 2000);
        })
        .catch((err) => {
          console.error('Failed to copy text using navigator.clipboard: ', err);
          fallbackCopyText(fullUrl, type);
        });
    } else {
      fallbackCopyText(fullUrl, type);
    }
  };

  const fallbackCopyText = (text: string, type: 'broadcast' | 'led' | 'score' | 'intro') => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopiedLinkType(type);
        setTimeout(() => setCopiedLinkType(null), 2000);
      } else {
        alert('Could not copy link automatically. Please copy it manually: ' + text);
      }
    } catch (err) {
      console.error('Fallback copy failed: ', err);
      alert('Could not copy link automatically. Please copy it manually: ' + text);
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
      secondHalfDuration: 1200,
      activePlayersA: 7,
      activePlayersB: 7
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
    setEditActivePlayersA(ks.activePlayersA !== undefined ? ks.activePlayersA : 7);
    setEditActivePlayersB(ks.activePlayersB !== undefined ? ks.activePlayersB : 7);
    
    // Initialize branding state
    const branding = (ks as any).branding || {};
    const profile = branding.profile || {};

    setEditShowLakshmish(branding.showLakshmishLogo !== undefined ? branding.showLakshmishLogo : true);
    setEditShowTournamentLogo(branding.showTournamentLogo !== undefined ? branding.showTournamentLogo : true);
    setEditShowSponsorLogo(branding.showSponsorLogo !== undefined ? branding.showSponsorLogo : true);
    setEditShowWinProbability(branding.showWinProbability !== undefined ? branding.showWinProbability : true);
    setEditShowLastRaidResult(branding.showLastRaidResult !== undefined ? branding.showLastRaidResult : true);
    setEditPresenterText(branding.presenterText || 'LAKSHMISH CRICKET EVENTS PRESENTS');
    setEditBrandingTourLogo(branding.tournamentLogo || '');
    setEditBrandingLakshmishLogo(branding.lakshmishLogo || '/transparent_lakshmish_logo.png');
    setEditSponsorLogos(branding.sponsorLogos && branding.sponsorLogos.length > 0 ? [...branding.sponsorLogos] : ['', '', '', '', '']);
    setEditSponsorNames(branding.sponsorNames && branding.sponsorNames.length > 0 ? [...branding.sponsorNames] : ['', '', '', '', '']);
    setEditSponsorSubtitles(branding.sponsorSubtitles && branding.sponsorSubtitles.length > 0 ? [...branding.sponsorSubtitles] : ['', '', '', '', '']);
    setEditBrandingBgImage(branding.backgroundImage || '');
    setEditLogoPos(branding.logoPosition || 'top-left');
    setEditLogoSize(branding.logoSize !== undefined ? branding.logoSize : 100);
    setEditSponsorPos(branding.sponsorPosition || 'top-right');
    setEditSponsorSize(branding.sponsorSize !== undefined ? branding.sponsorSize : 100);
    setEditPrimaryColor(branding.primaryColor || '#facc15');
    setEditSecondaryColor(branding.secondaryColor || '#000000');
    setEditSponsorBorderColor(branding.sponsorBorderColor || '#eab308');
    setEditSponsorBorderShape(branding.sponsorBorderShape || 'circle');
    setEditSponsorBorderThickness(branding.sponsorBorderThickness !== undefined ? branding.sponsorBorderThickness : 3);
    setEditSponsorGlow(branding.sponsorGlow !== undefined ? branding.sponsorGlow : true);
    setEditSponsorType(branding.sponsorType || 'carousel');
    setEditLayout(branding.layout || null);
    setEditIsLocked(!!branding.isLocked);

    setEditVenue(profile.venue || '');
    setEditOrganizer(profile.organizer || '');
    setEditContactNumber(profile.contactNumber || '');
    setEditDates(profile.dates || '');
    setEditOrganizerPhoto(profile.organizerPhoto || '');

    setEditPresets(branding.presets || []);
    setActiveModalTab('general');

    setIsEditModalOpen(true);
  };

  const saveConfigurationRealTime = async (overrides: any = {}) => {
    if (!match || !autoSaveEnabled) return;
    
    // Clear any pending retry timeout since we are starting a new sync attempt.
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    try {
      const tourName = overrides.tournamentName !== undefined ? overrides.tournamentName : editTourName;
      
      const teamANameEng = overrides.teamANameEng !== undefined ? overrides.teamANameEng : editTeamANameEng;
      const teamANameKan = overrides.teamANameKan !== undefined ? overrides.teamANameKan : editTeamANameKan;
      const nameA = `${teamANameKan.trim()} | ${teamANameEng.trim()}`;
      
      const teamBNameEng = overrides.teamBNameEng !== undefined ? overrides.teamBNameEng : editTeamBNameEng;
      const teamBNameKan = overrides.teamBNameKan !== undefined ? overrides.teamBNameKan : editTeamBNameKan;
      const nameB = `${teamBNameKan.trim()} | ${teamBNameEng.trim()}`;

      const logoA = overrides.logoA !== undefined ? overrides.logoA : editLogoA;
      const logoB = overrides.logoB !== undefined ? overrides.logoB : editLogoB;

      // Always pull live scoring/timing values directly from current match state,
      // NOT the modal's local edit state, to prevent accidental rollback of active gameplay scores/timers.
      const ks = match.kabaddiState || { 
        scoreA: 0, 
        scoreB: 0, 
        activePlayersA: 7, 
        activePlayersB: 7, 
        timeRemaining: 2400, 
        half: 1, 
        raidTime: 30, 
        doOrDie: false, 
        superTackle: false,
        firstHalfDuration: 1200,
        secondHalfDuration: 1200
      };

      const showLakshmish = overrides.showLakshmish !== undefined ? overrides.showLakshmish : editShowLakshmish;
      const showTournamentLogo = overrides.showTournamentLogo !== undefined ? overrides.showTournamentLogo : editShowTournamentLogo;
      const showSponsorLogo = overrides.showSponsorLogo !== undefined ? overrides.showSponsorLogo : editShowSponsorLogo;
      const showWinProbability = overrides.showWinProbability !== undefined ? overrides.showWinProbability : editShowWinProbability;
      const showLastRaidResult = overrides.showLastRaidResult !== undefined ? overrides.showLastRaidResult : editShowLastRaidResult;
      
      const presenterText = overrides.presenterText !== undefined ? overrides.presenterText : editPresenterText;
      const tourLogo = overrides.brandingTourLogo !== undefined ? overrides.brandingTourLogo : editBrandingTourLogo;
      const lakshmishLogo = overrides.brandingLakshmishLogo !== undefined ? overrides.brandingLakshmishLogo : editBrandingLakshmishLogo;
      const sponsorLogos = overrides.sponsorLogos !== undefined ? overrides.sponsorLogos : editSponsorLogos;
      const sponsorNames = overrides.sponsorNames !== undefined ? overrides.sponsorNames : editSponsorNames;
      const sponsorSubtitles = overrides.sponsorSubtitles !== undefined ? overrides.sponsorSubtitles : editSponsorSubtitles;
      const bgImage = overrides.brandingBgImage !== undefined ? overrides.brandingBgImage : editBrandingBgImage;

      const logoPos = overrides.logoPos !== undefined ? overrides.logoPos : editLogoPos;
      const logoSize = overrides.logoSize !== undefined ? overrides.logoSize : editLogoSize;
      const sponsorPos = overrides.sponsorPos !== undefined ? overrides.sponsorPos : editSponsorPos;
      const sponsorSize = overrides.sponsorSize !== undefined ? overrides.sponsorSize : editSponsorSize;

      const primaryColor = overrides.primaryColor !== undefined ? overrides.primaryColor : editPrimaryColor;
      const secondaryColor = overrides.secondaryColor !== undefined ? overrides.secondaryColor : editSecondaryColor;
      const sponsorBorderColor = overrides.sponsorBorderColor !== undefined ? overrides.sponsorBorderColor : editSponsorBorderColor;
      const sponsorBorderShape = overrides.sponsorBorderShape !== undefined ? overrides.sponsorBorderShape : editSponsorBorderShape;
      const sponsorBorderThickness = overrides.sponsorBorderThickness !== undefined ? overrides.sponsorBorderThickness : editSponsorBorderThickness;
      const sponsorGlow = overrides.sponsorGlow !== undefined ? overrides.sponsorGlow : editSponsorGlow;
      const sponsorType = overrides.sponsorType !== undefined ? overrides.sponsorType : editSponsorType;
      const layout = overrides.layout !== undefined ? overrides.layout : editLayout;
      const isLocked = overrides.isLocked !== undefined ? overrides.isLocked : editIsLocked;
      const presets = overrides.presets !== undefined ? overrides.presets : editPresets;

      const venue = overrides.venue !== undefined ? overrides.venue : editVenue;
      const organizer = overrides.organizer !== undefined ? overrides.organizer : editOrganizer;
      const contactNumber = overrides.contactNumber !== undefined ? overrides.contactNumber : editContactNumber;
      const dates = overrides.dates !== undefined ? overrides.dates : editDates;
      const organizerPhoto = overrides.organizerPhoto !== undefined ? overrides.organizerPhoto : editOrganizerPhoto;

      // Build a signature of branding and config settings to prevent duplicate saves.
      const configString = JSON.stringify({
        tournamentName: tourName,
        teamAName: nameA,
        teamALogo: logoA,
        teamBName: nameB,
        teamBLogo: logoB,
        branding: {
          showLakshmishLogo: showLakshmish,
          showTournamentLogo: showTournamentLogo,
          showSponsorLogo: showSponsorLogo,
          showWinProbability: showWinProbability,
          showLastRaidResult: showLastRaidResult,
          tournamentName: tourName,
          presenterText: presenterText,
          tournamentLogo: tourLogo,
          lakshmishLogo: lakshmishLogo,
          sponsorLogos: sponsorLogos,
          sponsorNames: sponsorNames,
          sponsorSubtitles: sponsorSubtitles,
          backgroundImage: bgImage,
          logoPosition: logoPos,
          logoSize: logoSize,
          sponsorPosition: sponsorPos,
          sponsorSize: sponsorSize,
          primaryColor: primaryColor,
          secondaryColor: secondaryColor,
          sponsorBorderColor: sponsorBorderColor,
          sponsorBorderShape: sponsorBorderShape,
          sponsorBorderThickness: sponsorBorderThickness,
          sponsorGlow: sponsorGlow,
          sponsorType: sponsorType,
          layout: layout,
          presets: presets,
          profile: {
            venue: venue,
            organizer: organizer,
            contactNumber: contactNumber,
            dates: dates,
            organizerPhoto: organizerPhoto
          }
        }
      });

      // Prevent duplicate saves to DB
      if (configString === lastSavedConfigRef.current) {
        return;
      }

      setIsSyncing(true);

      const payload = {
        tournamentName: tourName,
        teamA: {
          ...match.teamA,
          name: nameA,
          logo: logoA
        },
        teamB: {
          ...match.teamB,
          name: nameB,
          logo: logoB
        },
        kabaddiState: {
          ...ks, // Live engine state values are kept untouched
          branding: {
            showLakshmishLogo: showLakshmish,
            showTournamentLogo: showTournamentLogo,
            showSponsorLogo: showSponsorLogo,
            showWinProbability: showWinProbability,
            showLastRaidResult: showLastRaidResult,
            tournamentName: tourName,
            presenterText: presenterText,
            tournamentLogo: tourLogo,
            lakshmishLogo: lakshmishLogo,
            sponsorLogos: sponsorLogos,
            sponsorNames: sponsorNames,
            sponsorSubtitles: sponsorSubtitles,
            backgroundImage: bgImage,
            logoPosition: logoPos,
            logoSize: logoSize,
            sponsorPosition: sponsorPos,
            sponsorSize: sponsorSize,
            primaryColor: primaryColor,
            secondaryColor: secondaryColor,
            sponsorBorderColor: sponsorBorderColor,
            sponsorBorderShape: sponsorBorderShape,
            sponsorBorderThickness: sponsorBorderThickness,
            sponsorGlow: sponsorGlow,
            sponsorType: sponsorType,
            layout: layout,
            isLocked: isLocked,
            presets: presets,
            profile: {
              venue: venue,
              organizer: organizer,
              contactNumber: contactNumber,
              dates: dates,
              organizerPhoto: organizerPhoto
            }
          }
        }
      };

      const success = await postAction('update_general', payload);
      if (success) {
        setSyncFailed(false);
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(timeStr);
        lastSavedConfigRef.current = configString;
      } else {
        setSyncFailed(true);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          saveConfigurationRealTime(overrides);
        }, 2000);
      }
    } catch (err) {
      console.error('Auto-save error:', err);
      setSyncFailed(true);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        saveConfigurationRealTime(overrides);
      }, 2000);
    } finally {
      setIsSyncing(false);
    }
  };

  const debouncedSave = (overrides: any, delay: number) => {
    if (!autoSaveEnabled) return;
    
    // Choose correct ref based on delay or types
    const refToUse = delay === 300 ? debouncedSaveSliderRef : debouncedSaveTextRef;
    
    if (refToUse.current) {
      clearTimeout(refToUse.current);
    }
    
    refToUse.current = setTimeout(() => {
      saveConfigurationRealTime(overrides);
    }, delay);
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
          activePlayersA: editActivePlayersA !== undefined ? Number(editActivePlayersA) : 7,
          activePlayersB: editActivePlayersB !== undefined ? Number(editActivePlayersB) : 7,
          timeRemaining: nextTimeRemaining,
          half: editHalf,
          raidTime: Number(editRaidTime) || 30,
          doOrDie: editDoOrDie,
          superTackle: editSuperTackle,
          firstHalfDuration: firstHalfDuration,
          secondHalfDuration: secondHalfDuration,
          branding: {
            showLakshmishLogo: editShowLakshmish,
            showTournamentLogo: editShowTournamentLogo,
            showSponsorLogo: editShowSponsorLogo,
            showWinProbability: editShowWinProbability,
            showLastRaidResult: editShowLastRaidResult,
            tournamentName: editTourName,
            presenterText: editPresenterText,
            tournamentLogo: editBrandingTourLogo,
            lakshmishLogo: editBrandingLakshmishLogo,
            sponsorLogos: editSponsorLogos,
            sponsorNames: editSponsorNames,
            sponsorSubtitles: editSponsorSubtitles,
            backgroundImage: editBrandingBgImage,
            logoPosition: editLogoPos,
            logoSize: editLogoSize,
            sponsorPosition: editSponsorPos,
            sponsorSize: editSponsorSize,
            primaryColor: editPrimaryColor,
            secondaryColor: editSecondaryColor,
            sponsorBorderColor: editSponsorBorderColor,
            sponsorBorderShape: editSponsorBorderShape,
            sponsorBorderThickness: editSponsorBorderThickness,
            sponsorGlow: editSponsorGlow,
            sponsorType: editSponsorType,
            layout: editLayout,
            isLocked: editIsLocked,
            presets: editPresets,
            profile: {
              venue: editVenue,
              organizer: editOrganizer,
              contactNumber: editContactNumber,
              dates: editDates,
              organizerPhoto: editOrganizerPhoto
            }
          }
        }
      };

      const success = await postAction('update_general', payload);
      if (success) {
        setIsEditModalOpen(false);
      }
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
          superTackle: false,
          activePlayersA: 7,
          activePlayersB: 7
        },
        kabaddiActions: []
      };

      await postAction('update_general', payload);
      setEditScoreA(0);
      setEditScoreB(0);
      setEditDoOrDie(false);
      setEditSuperTackle(false);
      setEditRaidTime(30);
      setEditActivePlayersA(7);
      setEditActivePlayersB(7);
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

  const kState = match?.kabaddiState || { scoreA: 0, scoreB: 0, timeRemaining: 2400, half: 1, timerRunning: false } as NonNullable<Match['kabaddiState']>;
  const activePlayersA = kState.activePlayersA !== undefined ? kState.activePlayersA : 7;
  const activePlayersB = kState.activePlayersB !== undefined ? kState.activePlayersB : 7;
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
    <div className="min-h-screen bg-[#08080d] text-white font-sans flex flex-col justify-between p-3 max-w-md mx-auto relative select-none overflow-y-auto pb-6">
      
      {/* 📱 TOP BAR: Sync status and details */}
      <div className="flex flex-col border-b border-dark-850 pb-2 flex-shrink-0 space-y-2">
        {/* Row 1: Sync Status and Settings/Title */}
        <div className="flex items-center justify-between">
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

          <div className="flex items-center space-x-1.5">
            <div className="text-right">
              <span className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest block truncate max-w-[125px] sm:max-w-[180px]">{tourName}</span>
              <span className="text-[7.5px] text-dark-450 font-bold block">MOBILE CONTROLLER</span>
            </div>
            <button
              onClick={handleOpenEditModal}
              className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all active:scale-90 cursor-pointer flex-shrink-0"
              title="Edit Match Details"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Row 2: Audio Controls and Ambience */}
        <div className="flex items-center justify-between pt-1 border-t border-dark-850/30">
          {/* Volume Control UI */}
          <div className="flex items-center bg-dark-950/80 border border-dark-800 rounded-lg p-0.5 space-x-0.5 text-[8px] font-bold">
            <span className="px-1 text-dark-400 text-[10px]">🔊</span>
            <button
              onClick={() => handleVolumeChange('mute')}
              className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${volume === 'mute' ? 'bg-[#EEF824] text-dark-950 font-extrabold shadow' : 'text-dark-450 hover:text-white'}`}
            >
              Mute
            </button>
            <button
              onClick={() => handleVolumeChange('low')}
              className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${volume === 'low' ? 'bg-[#EEF824] text-dark-950 font-extrabold shadow' : 'text-dark-450 hover:text-white'}`}
            >
              Low
            </button>
            <button
              onClick={() => handleVolumeChange('medium')}
              className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${volume === 'medium' ? 'bg-[#EEF824] text-dark-950 font-extrabold shadow' : 'text-dark-450 hover:text-white'}`}
            >
              Med
            </button>
            <button
              onClick={() => handleVolumeChange('high')}
              className={`px-1.5 py-0.5 rounded uppercase cursor-pointer ${volume === 'high' ? 'bg-[#EEF824] text-dark-950 font-extrabold shadow' : 'text-dark-450 hover:text-white'}`}
            >
              High
            </button>
          </div>
          
          {/* Stadium Ambience Toggle */}
          <button
            onClick={() => postAction('kabaddi_raid_state', { stadiumAmbience: !kState.stadiumAmbience })}
            className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center space-x-0.5 ${
              kState.stadiumAmbience
                ? 'bg-[#EEF824] text-dark-950 border-[#EEF824] shadow-md shadow-yellow-500/25 font-extrabold'
                : 'text-dark-400 border-dark-800 hover:text-white'
            }`}
          >
            <span>📢 AMBIENCE</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-900/35 border border-red-500/30 text-red-400 p-2 rounded-xl text-[10px] font-semibold text-center mt-1 flex-shrink-0">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 📊 SCORE HEADS-UP DISPLAY WITH DIRECT ADJUSTMENTS */}
      <div className="grid grid-cols-2 gap-3 bg-dark-900/40 p-2 border border-dark-850 rounded-2xl my-2 flex-shrink-0 text-center">
        
        {/* Team A (Blue) */}
        <div 
          onClick={() => postAction('kabaddi_raid_state', { raidingTeamId: match.teamA.id })}
          className={`flex flex-col items-center border-r border-dark-850/60 pr-1.5 p-2 rounded-xl transition-all cursor-pointer ${
            kState.raidingTeamId === match.teamA.id
              ? 'bg-blue-950/25 border border-[#EEF824] shadow-[0_0_12px_rgba(238,248,36,0.25)]'
              : 'border border-transparent opacity-85 hover:opacity-100'
          }`}
        >
          <div className="flex items-center space-x-1 mb-0.5">
            <span className="text-[9px] text-blue-400 font-extrabold uppercase tracking-wider">BLUE SIDE</span>
            {kState.raidingTeamId === match.teamA.id ? (
              <span className="bg-[#EEF824] text-dark-950 font-black px-1.5 py-0.2 rounded text-[7px] animate-pulse">⚡ RAID</span>
            ) : (
              <span className="bg-dark-800 text-dark-400 font-bold px-1.5 py-0.2 rounded text-[7px]">🛡️ DEF</span>
            )}
          </div>
          <h3 className="text-xs font-black text-white truncate max-w-[130px] uppercase mb-1">{teamAName}</h3>
          <div className="flex items-center space-x-2.5 bg-blue-950/20 border border-blue-500/20 px-2.5 py-1.5 rounded-xl">
            <button
              onClick={(e) => { e.stopPropagation(); handleAddPoints('technical', match.teamA.id, -1, `Direct point correction: -1 to ${teamAName}`); }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-950 border border-blue-500/40 text-blue-400 font-black text-lg active:scale-90 select-none cursor-pointer"
            >
              -
            </button>
            <span className="text-3xl sm:text-4xl font-mono font-black text-white min-w-[36px] text-center select-none">
              {kState.scoreA}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddPoints('technical', match.teamA.id, 1, `Direct point correction: +1 to ${teamAName}`); }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500 text-dark-950 font-black text-lg active:scale-90 select-none cursor-pointer shadow-lg shadow-blue-500/30"
            >
              +
            </button>
          </div>

          {/* Roster Controls */}
          <div className="mt-2.5 pt-2 border-t border-dark-850/40 w-full">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[8px] text-dark-400 font-extrabold uppercase">Court Players:</span>
              <span className="text-[10px] font-mono font-black text-blue-400">{activePlayersA}/7</span>
            </div>
            <div className="flex gap-1 justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  postAction('kabaddi_roster_update', { teamId: match.teamA.id, activeCount: activePlayersA - 1 });
                }}
                disabled={activePlayersA <= 0}
                className="flex-1 py-1 rounded bg-dark-950 hover:bg-dark-850 border border-blue-500/25 hover:border-blue-500/40 text-blue-400 text-[9px] font-black uppercase active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              >
                OUT
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  postAction('kabaddi_roster_update', { teamId: match.teamA.id, activeCount: activePlayersA + 1 });
                }}
                disabled={activePlayersA >= 7}
                className="flex-1 py-1 rounded bg-blue-500 text-dark-950 text-[9px] font-black uppercase active:scale-95 transition-all cursor-pointer shadow shadow-blue-500/20 disabled:opacity-30 disabled:pointer-events-none"
              >
                REVIVE
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  postAction('kabaddi_roster_update', { teamId: match.teamA.id, activeCount: 7 });
                }}
                className="px-1 py-1 rounded bg-dark-900 border border-dark-800 text-dark-450 hover:text-white text-[8px] font-bold active:scale-95 transition-all cursor-pointer"
                title="Reset court roster to 7"
              >
                7
              </button>
            </div>
          </div>
        </div>

        {/* Team B (Red) */}
        <div 
          onClick={() => postAction('kabaddi_raid_state', { raidingTeamId: match.teamB.id })}
          className={`flex flex-col items-center pl-1.5 p-2 rounded-xl transition-all cursor-pointer ${
            kState.raidingTeamId === match.teamB.id
              ? 'bg-red-950/25 border border-[#EEF824] shadow-[0_0_12px_rgba(238,248,36,0.25)]'
              : 'border border-transparent opacity-85 hover:opacity-100'
          }`}
        >
          <div className="flex items-center space-x-1 mb-0.5">
            <span className="text-[9px] text-red-400 font-extrabold uppercase tracking-wider">RED SIDE</span>
            {kState.raidingTeamId === match.teamB.id ? (
              <span className="bg-[#EEF824] text-dark-950 font-black px-1.5 py-0.2 rounded text-[7px] animate-pulse">⚡ RAID</span>
            ) : (
              <span className="bg-dark-800 text-dark-400 font-bold px-1.5 py-0.2 rounded text-[7px]">🛡️ DEF</span>
            )}
          </div>
          <h3 className="text-xs font-black text-white truncate max-w-[130px] uppercase mb-1">{teamBName}</h3>
          <div className="flex items-center space-x-2.5 bg-red-950/20 border border-red-500/20 px-2.5 py-1.5 rounded-xl">
            <button
              onClick={(e) => { e.stopPropagation(); handleAddPoints('technical', match.teamB.id, -1, `Direct point correction: -1 to ${teamBName}`); }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-950 border border-red-500/40 text-red-400 font-black text-lg active:scale-90 select-none cursor-pointer"
            >
              -
            </button>
            <span className="text-3xl sm:text-4xl font-mono font-black text-white min-w-[36px] text-center select-none">
              {kState.scoreB}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddPoints('technical', match.teamB.id, 1, `Direct point correction: +1 to ${teamBName}`); }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-red-500 text-dark-950 font-black text-lg active:scale-90 select-none cursor-pointer shadow-lg shadow-red-500/30"
            >
              +
            </button>
          </div>

          {/* Roster Controls */}
          <div className="mt-2.5 pt-2 border-t border-dark-850/40 w-full">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[8px] text-dark-400 font-extrabold uppercase">Court Players:</span>
              <span className="text-[10px] font-mono font-black text-red-400">{activePlayersB}/7</span>
            </div>
            <div className="flex gap-1 justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  postAction('kabaddi_roster_update', { teamId: match.teamB.id, activeCount: activePlayersB - 1 });
                }}
                disabled={activePlayersB <= 0}
                className="flex-1 py-1 rounded bg-dark-950 hover:bg-dark-850 border border-red-500/25 hover:border-red-500/40 text-red-400 text-[9px] font-black uppercase active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              >
                OUT
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  postAction('kabaddi_roster_update', { teamId: match.teamB.id, activeCount: activePlayersB + 1 });
                }}
                disabled={activePlayersB >= 7}
                className="flex-1 py-1 rounded bg-red-500 text-dark-950 text-[9px] font-black uppercase active:scale-95 transition-all cursor-pointer shadow shadow-red-500/20 disabled:opacity-30 disabled:pointer-events-none"
              >
                REVIVE
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  postAction('kabaddi_roster_update', { teamId: match.teamB.id, activeCount: 7 });
                }}
                className="px-1 py-1 rounded bg-dark-900 border border-dark-800 text-dark-450 hover:text-white text-[8px] font-bold active:scale-95 transition-all cursor-pointer"
                title="Reset court roster to 7"
              >
                7
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ⚡ QUICK SCORING ACTIONS PANEL */}
      <div className="flex flex-col flex-grow my-1">
        <div className="grid grid-cols-2 gap-3">
          
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
              className={`w-full text-xs font-black py-3 rounded-xl transition-all uppercase tracking-wide cursor-pointer ${activePlayersB < 6 ? 'opacity-40 bg-dark-900 border border-dark-800 text-dark-500 cursor-not-allowed' : 'bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30 text-white active:scale-95'}`}
              disabled={activePlayersB < 6}
            >
              Bonus (+1)
            </button>
            {showSuperRaidA ? (
              <div className="flex bg-dark-955 border border-yellow-500/30 p-1 rounded-xl items-center justify-between gap-1 flex-wrap">
                {[3, 4, 5, 6].map(pts => (
                  <button
                    key={pts}
                    onClick={() => {
                      handleAddPoints('raid_success', match.teamA.id, pts, `Super Raid! +${pts} points scored by ${teamAName}`);
                      setShowSuperRaidA(false);
                    }}
                    className="flex-grow bg-[#EEF824] hover:bg-yellow-400 text-dark-950 font-black text-[10px] py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer text-center"
                  >
                    +{pts}
                  </button>
                ))}
                <button
                  onClick={() => setShowSuperRaidA(false)}
                  className="text-red-400 hover:text-red-300 font-extrabold text-[9px] px-1 py-1.5 bg-dark-900 rounded"
                >
                  X
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSuperRaidA(true)}
                className="w-full bg-gradient-to-r from-yellow-600/80 to-amber-600/80 hover:from-yellow-500 hover:to-amber-500 border border-yellow-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
              >
                ⭐ Super Raid (+3+)
              </button>
            )}
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
              className={`w-full text-xs font-black py-3 rounded-xl transition-all uppercase tracking-wide cursor-pointer ${activePlayersA < 6 ? 'opacity-40 bg-dark-900 border border-dark-800 text-dark-500 cursor-not-allowed' : 'bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-white active:scale-95'}`}
              disabled={activePlayersA < 6}
            >
              Bonus (+1)
            </button>
            {showSuperRaidB ? (
              <div className="flex bg-dark-955 border border-yellow-500/30 p-1 rounded-xl items-center justify-between gap-1 flex-wrap">
                {[3, 4, 5, 6].map(pts => (
                  <button
                    key={pts}
                    onClick={() => {
                      handleAddPoints('raid_success', match.teamB.id, pts, `Super Raid! +${pts} points scored by ${teamBName}`);
                      setShowSuperRaidB(false);
                    }}
                    className="flex-grow bg-[#EEF824] hover:bg-yellow-400 text-dark-950 font-black text-[10px] py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer text-center"
                  >
                    +{pts}
                  </button>
                ))}
                <button
                  onClick={() => setShowSuperRaidB(false)}
                  className="text-red-400 hover:text-red-300 font-extrabold text-[9px] px-1 py-1.5 bg-dark-900 rounded"
                >
                  X
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSuperRaidB(true)}
                className="w-full bg-gradient-to-r from-yellow-600/80 to-amber-600/80 hover:from-yellow-500 hover:to-amber-500 border border-yellow-500/30 text-white text-xs font-black py-3 rounded-xl active:scale-95 transition-all uppercase tracking-wide cursor-pointer"
              >
                ⭐ Super Raid (+3+)
              </button>
            )}
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

        <button
          onClick={() => postAction('kabaddi_safe_raid', {})}
          className="w-full mt-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/30 text-white text-xs font-black py-3.5 rounded-xl active:scale-95 transition-all uppercase tracking-widest cursor-pointer shadow-lg shadow-emerald-950/20"
        >
          🛡️ Safe Raid (ಖಾಲಿ ರೈಡ್)
        </button>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col justify-end transition-all duration-300">
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

            {/* Live Sync Status Panel */}
            <div className="bg-dark-950/85 border border-dark-850 p-2.5 rounded-2xl flex items-center justify-between font-sans">
              <div className="flex items-center space-x-2">
                {!autoSaveEnabled ? (
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-dark-600 block"></span>
                    <div>
                      <span className="text-[10px] text-dark-400 font-extrabold uppercase tracking-wide block">LIVE SYNC PAUSED</span>
                      <span className="text-[8px] text-dark-450 block">Tap Apply Changes below to save manually</span>
                    </div>
                  </div>
                ) : syncFailed ? (
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-450 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <div>
                      <span className="text-[10px] text-red-400 font-extrabold uppercase tracking-wide block">🔴 Sync Failed</span>
                      <span className="text-[8px] text-dark-450 block font-mono animate-pulse">Retrying...</span>
                    </div>
                  </div>
                ) : isSyncing ? (
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-450 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                    </span>
                    <div>
                      <span className="text-[10px] text-yellow-400 font-extrabold uppercase tracking-wide block">🟡 SYNCING...</span>
                      <span className="text-[8px] text-dark-450 block font-mono">Uploading changes to server</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <div>
                      <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wide block">🟢 LIVE SYNC ACTIVE</span>
                      <span className="text-[8px] text-dark-450 block font-mono">
                        Last Sync: {lastSyncTime ? lastSyncTime : 'Just Now'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-[9px] text-dark-400 font-black uppercase">Auto Save</span>
                <button
                  type="button"
                  onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                  className={`relative inline-flex h-5.5 w-9.5 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoSaveEnabled ? 'bg-purple-600' : 'bg-dark-850'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      autoSaveEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-dark-800/80 mb-2">
              <button
                type="button"
                onClick={() => setActiveModalTab('general')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  activeModalTab === 'general'
                    ? 'border-purple-500 text-white'
                    : 'border-transparent text-dark-450 hover:text-white'
                }`}
              >
                General Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('branding')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  activeModalTab === 'branding'
                    ? 'border-purple-500 text-white'
                    : 'border-transparent text-dark-450 hover:text-white'
                }`}
              >
                Branding Config
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('profile')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                  activeModalTab === 'profile'
                    ? 'border-purple-500 text-white'
                    : 'border-transparent text-dark-450 hover:text-white'
                }`}
              >
                Profile & Details
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-950/40 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-xs font-semibold text-center flex-shrink-0 animate-pulse">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Modal Body */}
            <div className="space-y-4 text-left">
              {activeModalTab === 'general' && (
                <>
                  {/* 1. Tournament Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-dark-400 font-extrabold uppercase tracking-wider block">Tournament Name</label>
                    <input
                      type="text"
                      value={editTourName}
                      onChange={(e) => {
                        setEditTourName(e.target.value);
                        if (autoSaveEnabled) debouncedSave({ tournamentName: e.target.value }, 600);
                      }}
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
                          onChange={(e) => {
                            setEditTeamANameEng(e.target.value);
                            if (autoSaveEnabled) debouncedSave({ teamANameEng: e.target.value }, 600);
                          }}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Kannada Name</label>
                        <input
                          type="text"
                          value={editTeamANameKan}
                          onChange={(e) => {
                            setEditTeamANameKan(e.target.value);
                            if (autoSaveEnabled) debouncedSave({ teamANameKan: e.target.value }, 600);
                          }}
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
                            type="button"
                            onClick={() => {
                              setEditLogoA(logo.url);
                              if (autoSaveEnabled) saveConfigurationRealTime({ logoA: logo.url });
                            }}
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
                          onChange={(e) => {
                            setEditLogoA(e.target.value);
                            if (autoSaveEnabled) debouncedSave({ logoA: e.target.value }, 600);
                          }}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Team B English & Kannada Names */}
                  <div className="bg-red-950/10 border border-red-900/35 p-3 rounded-2xl space-y-3">
                    <span className="text-[9px] text-red-450 font-extrabold uppercase tracking-wider block">Team B (Red Side)</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">English Name</label>
                        <input
                          type="text"
                          value={editTeamBNameEng}
                          onChange={(e) => {
                            setEditTeamBNameEng(e.target.value);
                            if (autoSaveEnabled) debouncedSave({ teamBNameEng: e.target.value }, 600);
                          }}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Kannada Name</label>
                        <input
                          type="text"
                          value={editTeamBNameKan}
                          onChange={(e) => {
                            setEditTeamBNameKan(e.target.value);
                            if (autoSaveEnabled) debouncedSave({ teamBNameKan: e.target.value }, 600);
                          }}
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
                            type="button"
                            onClick={() => {
                              setEditLogoB(logo.url);
                              if (autoSaveEnabled) saveConfigurationRealTime({ logoB: logo.url });
                            }}
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
                          onChange={(e) => {
                            setEditLogoB(e.target.value);
                            if (autoSaveEnabled) debouncedSave({ logoB: e.target.value }, 600);
                          }}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1 text-xs text-white focus:outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Match Time & Period Configuration */}
                  <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-3">
                    <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Match Clock & Half Configuration</span>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-450 font-bold uppercase block">Current Minutes</label>
                        <input
                          type="number"
                          value={editMatchMinutes}
                          onChange={(e) => setEditMatchMinutes(Number(e.target.value))}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-450 font-bold uppercase block">Current Seconds</label>
                        <input
                          type="number"
                          value={editMatchSeconds}
                          onChange={(e) => setEditMatchSeconds(Number(e.target.value))}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-450 font-bold uppercase block">Raid Clock (s)</label>
                        <input
                          type="number"
                          value={editRaidTime}
                          onChange={(e) => setEditRaidTime(Number(e.target.value))}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-dark-800/40">
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-500 font-bold uppercase block">1st Half Duration (m)</label>
                        <input
                          type="number"
                          value={editFirstHalfMin}
                          onChange={(e) => setEditFirstHalfMin(Number(e.target.value))}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-dark-500 font-bold uppercase block">2nd Half Duration (m)</label>
                        <input
                          type="number"
                          value={editSecondHalfMin}
                          onChange={(e) => setEditSecondHalfMin(Number(e.target.value))}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Match Half Period</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditHalf(1)}
                          className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            editHalf === 1
                              ? 'bg-yellow-500 text-dark-950 font-black shadow-md shadow-yellow-500/20'
                              : 'bg-dark-950 border border-dark-800 text-dark-400 hover:text-white'
                          }`}
                        >
                          1st Half
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditHalf(2)}
                          className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            editHalf === 2
                              ? 'bg-yellow-500 text-dark-950 font-black shadow-md shadow-yellow-500/20'
                              : 'bg-dark-950 border border-dark-800 text-dark-400 hover:text-white'
                          }`}
                        >
                          2nd Half
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 5. Custom Score & Active Player Counts */}
                  <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-3">
                    <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Manual Score & Court Roster Correction</span>
                    
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] text-blue-400 font-bold uppercase tracking-wider block">Team A Court Players (0-7)</label>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={editActivePlayersA}
                          onChange={(e) => setEditActivePlayersA(Math.max(0, Math.min(7, Number(e.target.value))))}
                          className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white text-center focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] text-red-400 font-bold uppercase tracking-wider block">Team B Court Players (0-7)</label>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={editActivePlayersB}
                          onChange={(e) => setEditActivePlayersB(Math.max(0, Math.min(7, Number(e.target.value))))}
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
                        type="button"
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
                        type="button"
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
                </>
              )}

              {activeModalTab === 'branding' && (
                <>
                  {/* Branding lock selector */}
                  <div className="bg-dark-900/40 border border-dark-800 p-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-white font-extrabold uppercase block">Lock Branding Configuration</span>
                      <span className="text-[8px] text-dark-450 block">Freeze all layout controls to prevent accidental shifts</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditIsLocked(!editIsLocked)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        editIsLocked ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-dark-950 border-dark-800 text-dark-400 hover:text-white'
                      }`}
                    >
                      {editIsLocked ? <Lock className="h-4.5 w-4.5" /> : <Unlock className="h-4.5 w-4.5" />}
                    </button>
                  </div>

                  <div className={editIsLocked ? 'opacity-40 pointer-events-none' : ''}>
                    {/* Templates Selector */}
                    <div className="space-y-1 bg-dark-900/20 border border-dark-850 p-2.5 rounded-2xl">
                      <label className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block mb-1">Apply Layout Template</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate('kabaddi')}
                          className="py-1.5 bg-dark-950 hover:bg-dark-850 border border-dark-800 text-white rounded-xl text-[9px] font-black uppercase cursor-pointer"
                        >
                          🏆 Classic
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate('pkl')}
                          className="py-1.5 bg-dark-950 hover:bg-dark-850 border border-dark-800 text-orange-500 rounded-xl text-[9px] font-black uppercase cursor-pointer"
                        >
                          🏆 PKL Style
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate('lakshmish_premium')}
                          className="py-1.5 bg-dark-950 hover:bg-dark-850 border border-dark-800 text-yellow-500 rounded-xl text-[9px] font-black uppercase cursor-pointer"
                        >
                          🏆 Premium
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate('led_wall')}
                          className="py-1.5 bg-dark-950 hover:bg-dark-850 border border-dark-800 text-amber-500 rounded-xl text-[9px] font-black uppercase cursor-pointer"
                        >
                          📺 LED Wall Mode
                        </button>
                      </div>
                    </div>

                    {/* LogoVisibility toggles */}
                    <div className="bg-dark-900/30 border border-dark-850 p-3 rounded-2xl space-y-2">
                      <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Visibility Toggles</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = !editShowLakshmish;
                            setEditShowLakshmish(next);
                            if (autoSaveEnabled) saveConfigurationRealTime({ showLakshmish: next });
                          }}
                          className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            editShowLakshmish ? 'bg-purple-600/30 border border-purple-500 text-white font-extrabold' : 'bg-dark-950 border border-dark-800 text-dark-400'
                          }`}
                        >
                          Lakshmish Logo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !editShowTournamentLogo;
                            setEditShowTournamentLogo(next);
                            if (autoSaveEnabled) saveConfigurationRealTime({ showTournamentLogo: next });
                          }}
                          className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            editShowTournamentLogo ? 'bg-purple-600/30 border border-purple-500 text-white font-extrabold' : 'bg-dark-950 border border-dark-800 text-dark-400'
                          }`}
                        >
                          Tournament Name
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !editShowSponsorLogo;
                            setEditShowSponsorLogo(next);
                            if (autoSaveEnabled) saveConfigurationRealTime({ showSponsorLogo: next });
                          }}
                          className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            editShowSponsorLogo ? 'bg-purple-600/30 border border-purple-500 text-white font-extrabold' : 'bg-dark-950 border border-dark-800 text-dark-400'
                          }`}
                        >
                          Sponsor Box
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !editShowWinProbability;
                            setEditShowWinProbability(next);
                            if (autoSaveEnabled) saveConfigurationRealTime({ showWinProbability: next });
                          }}
                          className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            editShowWinProbability ? 'bg-purple-600/30 border border-purple-500 text-white font-extrabold' : 'bg-dark-950 border border-dark-800 text-dark-400'
                          }`}
                        >
                          Win Prob Bar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !editShowLastRaidResult;
                            setEditShowLastRaidResult(next);
                            if (autoSaveEnabled) saveConfigurationRealTime({ showLastRaidResult: next });
                          }}
                          className={`py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            editShowLastRaidResult ? 'bg-purple-600/30 border border-purple-500 text-white font-extrabold' : 'bg-dark-950 border border-dark-800 text-dark-400'
                          }`}
                        >
                          Last Raid Result
                        </button>
                      </div>
                    </div>

                    {/* Presenter Text Input */}
                    <div className="space-y-1">
                      <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Presenter Text</label>
                      <input
                        type="text"
                        value={editPresenterText}
                        onChange={(e) => {
                          setEditPresenterText(e.target.value);
                          if (autoSaveEnabled) debouncedSave({ presenterText: e.target.value }, 600);
                        }}
                        className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        placeholder="LAKSHMISH CRICKET EVENTS PRESENTS"
                      />
                    </div>

                    {/* Lakshmish Logo configuration */}
                    <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-2">
                      <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Lakshmish Events Logo</span>
                      
                      <div className="flex items-center space-x-2">
                        <div className="h-10 w-10 bg-dark-950 border border-dark-800 rounded flex items-center justify-center p-1">
                          {editBrandingLakshmishLogo ? (
                            <img src={editBrandingLakshmishLogo} alt="Lakshmish" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <Image className="h-5 w-5 text-dark-500" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditBrandingLakshmishLogo('/transparent_lakshmish_logo.png');
                                if (autoSaveEnabled) saveConfigurationRealTime({ brandingLakshmishLogo: '/transparent_lakshmish_logo.png' });
                              }}
                              className="px-2 py-1 bg-dark-950 hover:bg-dark-850 border border-dark-800 rounded text-[8px] font-bold text-white cursor-pointer"
                            >
                              Lakshmish Default
                            </button>
                            {editBrandingLakshmishLogo && (
                              <button
                                type="button"
                                onClick={() => handleCropExistingImage(editBrandingLakshmishLogo, 'lakshmish')}
                                className="px-2 py-1 bg-dark-800 hover:bg-dark-700 text-white rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer"
                              >
                                <Scissors className="h-2.5 w-2.5" />
                                <span>Crop</span>
                              </button>
                            )}
                            <label className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[8px] font-bold cursor-pointer flex items-center space-x-1">
                              <Upload className="h-2.5 w-2.5" />
                              <span>{activeUploadSlot === 'lakshmish' ? 'Uploading...' : (editBrandingLakshmishLogo ? 'Replace' : 'Upload File')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleSelectFileForCrop(e, 'lakshmish')}
                                className="hidden"
                              />
                            </label>
                            {editBrandingLakshmishLogo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditBrandingLakshmishLogo('');
                                  if (autoSaveEnabled) saveConfigurationRealTime({ brandingLakshmishLogo: '' });
                                }}
                                className="px-2 py-1 bg-red-950/40 hover:bg-red-950 text-red-400 rounded text-[8px] font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={editBrandingLakshmishLogo}
                            onChange={(e) => {
                              setEditBrandingLakshmishLogo(e.target.value);
                              if (autoSaveEnabled) debouncedSave({ brandingLakshmishLogo: e.target.value }, 600);
                            }}
                            placeholder="Or paste image URL..."
                            className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Position & Size */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dark-800/40">
                        <div className="space-y-1">
                          <label className="text-[7.5px] text-dark-450 font-bold uppercase block">Position</label>
                          <select
                            value={editLogoPos}
                            onChange={(e: any) => {
                              setEditLogoPos(e.target.value);
                              if (autoSaveEnabled) saveConfigurationRealTime({ logoPos: e.target.value });
                            }}
                            className="w-full bg-dark-950 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                          >
                            <option value="top-left">Top Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="center">Center</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-right">Bottom Right</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[7.5px] text-dark-450 font-bold">
                            <span className="uppercase">Size Scale</span>
                            <span>{editLogoSize}%</span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="200"
                            value={editLogoSize}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditLogoSize(val);
                              if (autoSaveEnabled) debouncedSave({ logoSize: val }, 300);
                            }}
                            className="w-full accent-purple-500 h-1 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tournament Logo configuration */}
                    <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-2">
                      <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Tournament Custom Logo</span>
                      <div className="flex items-center space-x-2">
                        <div className="h-10 w-10 bg-dark-950 border border-dark-800 rounded flex items-center justify-center p-1">
                          {editBrandingTourLogo ? (
                            <img src={editBrandingTourLogo} alt="Tournament" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <Image className="h-5 w-5 text-dark-500" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {editBrandingTourLogo && (
                              <button
                                type="button"
                                onClick={() => handleCropExistingImage(editBrandingTourLogo, 'tournament')}
                                className="px-2 py-1 bg-dark-800 hover:bg-dark-700 text-white rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer"
                              >
                                <Scissors className="h-2.5 w-2.5" />
                                <span>Crop</span>
                              </button>
                            )}
                            <label className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[8px] font-bold cursor-pointer flex items-center space-x-1">
                              <Upload className="h-2.5 w-2.5" />
                              <span>{activeUploadSlot === 'tournament' ? 'Uploading...' : (editBrandingTourLogo ? 'Replace' : 'Upload Logo')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleSelectFileForCrop(e, 'tournament')}
                                className="hidden"
                              />
                            </label>
                            {editBrandingTourLogo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditBrandingTourLogo('');
                                  if (autoSaveEnabled) saveConfigurationRealTime({ brandingTourLogo: '' });
                                }}
                                className="px-2 py-1 bg-red-950/40 hover:bg-red-950 text-red-400 rounded text-[8px] font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={editBrandingTourLogo}
                            onChange={(e) => {
                              setEditBrandingTourLogo(e.target.value);
                              if (autoSaveEnabled) debouncedSave({ brandingTourLogo: e.target.value }, 600);
                            }}
                            placeholder="Paste custom logo URL..."
                            className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sponsor Logos List (up to 5) */}
                    <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Sponsor Logos (Auto-Rotates)</span>
                        <span className="text-[7px] text-dark-400 block font-mono">Max 5 slots (cycles every 10s)</span>
                      </div>
                      
                      <div className="space-y-2.5">
                        {editSponsorLogos.map((url, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 border border-dark-850 p-2.5 rounded-xl bg-dark-950/50">
                            <div className="flex items-center space-x-2.5">
                              <span className="text-[9.5px] font-black text-dark-450">{idx + 1}</span>
                              <div className="h-10 w-10 bg-dark-950 border border-dark-800 rounded-lg flex items-center justify-center p-1 relative overflow-hidden">
                                {url ? (
                                  <img src={url} alt={`Sponsor ${idx + 1}`} className="max-w-full max-h-full object-contain" />
                                ) : (
                                  <span className="text-[8px] text-dark-600 font-bold uppercase">Empty</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex-grow flex flex-col space-y-1.5 w-full sm:w-auto">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                                <input
                                  type="text"
                                  value={url}
                                  onChange={(e) => {
                                    const newSponsors = [...editSponsorLogos];
                                    newSponsors[idx] = e.target.value;
                                    setEditSponsorLogos(newSponsors);
                                    if (autoSaveEnabled) debouncedSave({ sponsorLogos: newSponsors }, 600);
                                  }}
                                  placeholder="Logo URL..."
                                  className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2 py-1 text-[9.5px] text-white focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={editSponsorNames[idx] || ''}
                                  onChange={(e) => {
                                    const newNames = [...editSponsorNames];
                                    newNames[idx] = e.target.value;
                                    setEditSponsorNames(newNames);
                                    if (autoSaveEnabled) debouncedSave({ sponsorNames: newNames }, 600);
                                  }}
                                  placeholder="Sponsor Name"
                                  className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2 py-1 text-[9.5px] text-white focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={editSponsorSubtitles[idx] || ''}
                                  onChange={(e) => {
                                    const newSubtitles = [...editSponsorSubtitles];
                                    newSubtitles[idx] = e.target.value;
                                    setEditSponsorSubtitles(newSubtitles);
                                    if (autoSaveEnabled) debouncedSave({ sponsorSubtitles: newSubtitles }, 600);
                                  }}
                                  placeholder="Designation/Title"
                                  className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2 py-1 text-[9.5px] text-white focus:outline-none"
                                />
                              </div>
                              
                              <div className="flex flex-wrap gap-1">
                                {url && (
                                  <button
                                    type="button"
                                    onClick={() => handleCropExistingImage(url, 'sponsor', idx)}
                                    className="px-2 py-0.5 bg-dark-800 hover:bg-dark-700 text-white rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Scissors className="h-2 w-2" />
                                    <span>Crop</span>
                                  </button>
                                )}
                                
                                <label className="px-2 py-0.5 bg-purple-600/90 hover:bg-purple-600 text-white rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer">
                                  <Upload className="h-2 w-2" />
                                  <span>{url ? 'Replace' : 'Upload'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSelectFileForCrop(e, 'sponsor', idx)}
                                    className="hidden"
                                  />
                                </label>
                                
                                {url && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewSponsorUrl(url)}
                                      className="px-2 py-0.5 bg-dark-850 hover:bg-dark-750 text-dark-300 rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer"
                                    >
                                      <Eye className="h-2 w-2" />
                                      <span>Preview</span>
                                    </button>
                                    
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newSponsors = [...editSponsorLogos];
                                        newSponsors[idx] = '';
                                        setEditSponsorLogos(newSponsors);
                                        if (autoSaveEnabled) saveConfigurationRealTime({ sponsorLogos: newSponsors });
                                      }}
                                      className="px-2 py-0.5 bg-red-950/40 hover:bg-red-950 text-red-400 rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer"
                                    >
                                      <X className="h-2 w-2" />
                                      <span>Remove</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Sponsor Positioning */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-dark-800/40">
                        <div className="space-y-1">
                          <label className="text-[7.5px] text-dark-450 font-bold uppercase block">Sponsor Position</label>
                          <select
                            value={editSponsorPos}
                            onChange={(e: any) => {
                              setEditSponsorPos(e.target.value);
                              if (autoSaveEnabled) saveConfigurationRealTime({ sponsorPos: e.target.value });
                            }}
                            className="w-full bg-dark-950 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                          >
                            <option value="top-left">Top Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="center">Center</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-right">Bottom Right</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[7.5px] text-dark-450 font-bold">
                            <span className="uppercase">Sponsor Size</span>
                            <span>{editSponsorSize}%</span>
                          </div>
                          <input
                            type="range"
                            min="50"
                            max="200"
                            value={editSponsorSize}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditSponsorSize(val);
                              if (autoSaveEnabled) debouncedSave({ sponsorSize: val }, 300);
                            }}
                            className="w-full accent-purple-500 h-1 cursor-pointer"
                          />
                        </div>
                      </div>

                      {/* Sponsor Mode Customization */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-dark-800/40 font-sans">
                        <div className="space-y-1 col-span-2">
                          <label className="text-[7.5px] text-dark-450 font-bold uppercase block">Sponsor Mode</label>
                          <select
                            value={editSponsorType}
                            onChange={(e: any) => {
                              setEditSponsorType(e.target.value);
                              if (autoSaveEnabled) saveConfigurationRealTime({ sponsorType: e.target.value });
                            }}
                            className="w-full bg-dark-950 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                          >
                            <option value="carousel">🔄 Sponsor Carousel (Cycles 10s)</option>
                            <option value="single">👤 Single Sponsor (Kannada Appreciation Card)</option>
                            <option value="presented">🎁 Presented By Logo (English Title)</option>
                          </select>
                        </div>
                      </div>

                      {/* Sponsor Border Customization */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-dark-800/40 font-sans">
                        <div className="space-y-1">
                          <label className="text-[7.5px] text-dark-450 font-bold uppercase block">Sponsor Frame Shape</label>
                          <select
                            value={editSponsorBorderShape}
                            onChange={(e: any) => {
                              setEditSponsorBorderShape(e.target.value as any);
                              if (autoSaveEnabled) saveConfigurationRealTime({ sponsorBorderShape: e.target.value });
                            }}
                            className="w-full bg-dark-950 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                          >
                            <option value="circle">Circle Frame</option>
                            <option value="square">Square Frame</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7.5px] text-dark-450 font-bold uppercase block">Sponsor Border Color</label>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="color"
                              value={editSponsorBorderColor}
                              onChange={(e) => {
                                setEditSponsorBorderColor(e.target.value);
                                if (autoSaveEnabled) debouncedSave({ sponsorBorderColor: e.target.value }, 300);
                              }}
                              className="w-7 h-5 rounded border border-dark-700 bg-transparent cursor-pointer"
                            />
                            <input
                              type="text"
                              value={editSponsorBorderColor}
                              onChange={(e) => {
                                setEditSponsorBorderColor(e.target.value);
                                if (autoSaveEnabled) debouncedSave({ sponsorBorderColor: e.target.value }, 300);
                              }}
                              className="w-full bg-dark-950 border border-dark-800 rounded-lg px-1.5 py-0.5 text-[9px] text-white focus:outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Color Preset Circles */}
                      <div className="flex items-center space-x-2 pt-1 font-sans">
                        <span className="text-[7px] text-dark-450 font-bold uppercase">Presets:</span>
                        <div className="flex space-x-1.5">
                          {[
                            { color: '#eab308', name: 'Gold' },
                            { color: '#ef4444', name: 'Red' },
                            { color: '#3b82f6', name: 'Blue' },
                            { color: '#10b981', name: 'Green' },
                            { color: '#000000', name: 'Black' }
                          ].map((item) => (
                            <button
                              key={item.color}
                              type="button"
                              onClick={() => {
                                setEditSponsorBorderColor(item.color);
                                if (autoSaveEnabled) saveConfigurationRealTime({ sponsorBorderColor: item.color });
                              }}
                              className={`w-3.5 h-3.5 rounded-full border cursor-pointer hover:scale-110 active:scale-95 transition-all ${
                                editSponsorBorderColor.toLowerCase() === item.color.toLowerCase()
                                  ? 'border-white scale-110 shadow shadow-white/30'
                                  : 'border-dark-850'
                              }`}
                              style={{ backgroundColor: item.color }}
                              title={item.name}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Border Thickness & Glow switch */}
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-dark-800/40 font-sans">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[7.5px] text-dark-450 font-bold">
                            <span className="uppercase">Border Thickness</span>
                            <span>{editSponsorBorderThickness}px</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={editSponsorBorderThickness}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditSponsorBorderThickness(val);
                              if (autoSaveEnabled) debouncedSave({ sponsorBorderThickness: val }, 300);
                            }}
                            className="w-full accent-purple-500 h-1 cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7.5px] text-dark-450 font-bold uppercase block">Glow Effect</label>
                          <div className="flex items-center h-7">
                            <button
                              type="button"
                              onClick={() => {
                                const next = !editSponsorGlow;
                                setEditSponsorGlow(next);
                                if (autoSaveEnabled) saveConfigurationRealTime({ sponsorGlow: next });
                              }}
                              className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                editSponsorGlow
                                  ? 'bg-emerald-600/25 border border-emerald-500 text-emerald-400'
                                  : 'bg-dark-950 border border-dark-800 text-dark-400 hover:text-white'
                              }`}
                            >
                              {editSponsorGlow ? '✨ Glow ON' : '⚫ Glow OFF'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Custom Background image */}
                    <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-2">
                      <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Custom Background Override</span>
                      <div className="flex items-center space-x-2">
                        <div className="h-10 w-10 bg-dark-950 border border-dark-800 rounded flex items-center justify-center p-1">
                          {editBrandingBgImage ? (
                            <img src={editBrandingBgImage} alt="Background" className="max-w-full max-h-full object-cover" />
                          ) : (
                            <Image className="h-5 w-5 text-dark-500" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {editBrandingBgImage && (
                              <button
                                type="button"
                                onClick={() => handleCropExistingImage(editBrandingBgImage, 'bg')}
                                className="px-2 py-1 bg-dark-800 hover:bg-dark-700 text-white rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer"
                              >
                                <Scissors className="h-2.5 w-2.5" />
                                <span>Crop</span>
                              </button>
                            )}
                            <label className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[8px] font-bold cursor-pointer flex items-center space-x-1">
                              <Upload className="h-2.5 w-2.5" />
                              <span>{activeUploadSlot === 'bg' ? 'Uploading...' : (editBrandingBgImage ? 'Replace' : 'Upload Image')}</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleSelectFileForCrop(e, 'bg')}
                                className="hidden"
                              />
                            </label>
                            {editBrandingBgImage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditBrandingBgImage('');
                                  if (autoSaveEnabled) saveConfigurationRealTime({ brandingBgImage: '' });
                                }}
                                className="px-2 py-1 bg-red-950/40 hover:bg-red-950 text-red-400 rounded text-[8px] font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={editBrandingBgImage}
                            onChange={(e) => {
                              setEditBrandingBgImage(e.target.value);
                              if (autoSaveEnabled) debouncedSave({ brandingBgImage: e.target.value }, 600);
                            }}
                            placeholder="Custom background image URL..."
                            className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Color Overrides */}
                    <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-2">
                      <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Branding Accent Colors</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between bg-dark-950 border border-dark-800 p-2 rounded-xl">
                          <span className="text-[9px] text-dark-400 font-bold uppercase">Primary Accent</span>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="color"
                              value={editPrimaryColor}
                              onChange={(e) => {
                                setEditPrimaryColor(e.target.value);
                                if (autoSaveEnabled) debouncedSave({ primaryColor: e.target.value }, 300);
                              }}
                              className="w-6 h-6 border-0 bg-transparent rounded cursor-pointer"
                            />
                            <span className="text-[9px] font-mono text-white">{editPrimaryColor}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-dark-950 border border-dark-800 p-2 rounded-xl">
                          <span className="text-[9px] text-dark-400 font-bold uppercase">Secondary Accent</span>
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="color"
                              value={editSecondaryColor}
                              onChange={(e) => {
                                setEditSecondaryColor(e.target.value);
                                if (autoSaveEnabled) debouncedSave({ secondaryColor: e.target.value }, 300);
                              }}
                              className="w-6 h-6 border-0 bg-transparent rounded cursor-pointer"
                            />
                            <span className="text-[9px] font-mono text-white">{editSecondaryColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Presets Manager */}
                    <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-3">
                      <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">Tournament Presets</span>
                      
                      <div className="flex space-x-1">
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="Preset name (e.g. GPL 2026)..."
                          className="flex-1 bg-dark-950 border border-dark-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSavePreset}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer flex items-center space-x-1"
                        >
                          <Download className="h-3 w-3" />
                          <span>Save</span>
                        </button>
                      </div>

                      {editPresets.length > 0 ? (
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pt-1">
                          {editPresets.map((pr: any) => (
                            <div key={pr.name} className="flex items-center justify-between bg-dark-950 border border-dark-800 px-3 py-1.5 rounded-xl">
                              <span className="text-xs text-white font-bold">{pr.name}</span>
                              <div className="flex space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleLoadPreset(pr)}
                                  className="px-2 py-0.5 bg-dark-900 hover:bg-dark-850 text-purple-400 text-[8px] font-bold uppercase rounded cursor-pointer"
                                >
                                  Load
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePreset(pr.name)}
                                  className="px-2 py-0.5 bg-red-950/30 text-red-400 text-[8px] font-bold uppercase rounded cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[8px] text-dark-500 block text-center pt-1 font-mono">No presets saved in database.</span>
                      )}
                    </div>

                    {/* Import/Export & Restore Defaults */}
                    <div className="grid grid-cols-3 gap-2 bg-dark-900/30 border border-dark-850 p-2.5 rounded-2xl">
                      <button
                        type="button"
                        onClick={handleExportBranding}
                        className="py-1.5 bg-dark-950 hover:bg-dark-850 border border-dark-800 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <FileDown className="h-3 w-3 text-dark-400" />
                        <span>Export</span>
                      </button>
                      <label className="py-1.5 bg-dark-950 hover:bg-dark-850 border border-dark-800 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center space-x-1 cursor-pointer text-center">
                        <FileUp className="h-3 w-3 text-dark-400" />
                        <span>Import</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportBranding}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRestoreDefaults}
                        className="py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-500/25 text-red-400 rounded-xl text-[9px] font-black uppercase cursor-pointer"
                      >
                        Defaults
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeModalTab === 'profile' && (
                <div className="bg-dark-900/40 border border-dark-850 p-3 rounded-2xl space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Venue</label>
                    <input
                      type="text"
                      value={editVenue}
                      onChange={(e) => {
                        setEditVenue(e.target.value);
                        if (autoSaveEnabled) debouncedSave({ venue: e.target.value }, 600);
                      }}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                      placeholder="e.g. Koratagere Stadium, Tumakuru"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Organizer</label>
                    <input
                      type="text"
                      value={editOrganizer}
                      onChange={(e) => {
                        setEditOrganizer(e.target.value);
                        if (autoSaveEnabled) debouncedSave({ organizer: e.target.value }, 600);
                      }}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                      placeholder="e.g. Lakshmish Cricket Events"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Contact Number</label>
                    <input
                      type="text"
                      value={editContactNumber}
                      onChange={(e) => {
                        setEditContactNumber(e.target.value);
                        if (autoSaveEnabled) debouncedSave({ contactNumber: e.target.value }, 600);
                      }}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Tournament Dates</label>
                    <input
                      type="text"
                      value={editDates}
                      onChange={(e) => {
                        setEditDates(e.target.value);
                        if (autoSaveEnabled) debouncedSave({ dates: e.target.value }, 600);
                      }}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                      placeholder="e.g. June 18th - 25th, 2026"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[8px] text-dark-450 font-bold uppercase tracking-wider block">Organizer Photo</label>
                    <div className="flex items-center space-x-2">
                      <div className="h-10 w-10 bg-dark-950 border border-dark-800 rounded flex items-center justify-center p-1">
                        {editOrganizerPhoto ? (
                          <img src={editOrganizerPhoto} alt="Organizer" className="max-w-full max-h-full object-contain rounded-full" />
                        ) : (
                          <Image className="h-5 w-5 text-dark-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {editOrganizerPhoto && (
                            <button
                              type="button"
                              onClick={() => handleCropExistingImage(editOrganizerPhoto, 'organizer')}
                              className="px-2 py-1 bg-dark-800 hover:bg-dark-700 text-white rounded text-[8px] font-bold flex items-center space-x-1 cursor-pointer"
                            >
                              <Scissors className="h-2.5 w-2.5" />
                              <span>Crop</span>
                            </button>
                          )}
                          <label className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[8px] font-bold cursor-pointer flex items-center space-x-1">
                            <Upload className="h-2.5 w-2.5" />
                            <span>{activeUploadSlot === 'organizer' ? 'Uploading...' : (editOrganizerPhoto ? 'Replace' : 'Upload Photo')}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleSelectFileForCrop(e, 'organizer')}
                              className="hidden"
                            />
                          </label>
                          {editOrganizerPhoto && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditOrganizerPhoto('');
                                if (autoSaveEnabled) saveConfigurationRealTime({ organizerPhoto: '' });
                              }}
                              className="px-2 py-1 bg-red-950/40 hover:bg-red-950 text-red-400 rounded text-[8px] font-bold cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={editOrganizerPhoto}
                          onChange={(e) => {
                            setEditOrganizerPhoto(e.target.value);
                            if (autoSaveEnabled) debouncedSave({ organizerPhoto: e.target.value }, 600);
                          }}
                          placeholder="Organizer photo URL..."
                          className="w-full bg-dark-900 border border-dark-800 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* OBS Links Panel */}
                  <div className="pt-3 border-t border-dark-800/40 space-y-2">
                    <span className="text-[9px] text-[#facc15] font-extrabold uppercase tracking-wider block">OBS Scene Integration Quick Links</span>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink('broadcast')}
                        className="py-2 bg-dark-950 border border-dark-800 hover:border-purple-500 rounded-xl text-[8px] font-black uppercase text-white flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Copy className="h-3 w-3 text-purple-400" />
                        <span>{copiedLinkType === 'broadcast' ? 'Copied!' : 'Broadcast Overlay'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink('led')}
                        className="py-2 bg-dark-950 border border-dark-800 hover:border-purple-500 rounded-xl text-[8px] font-black uppercase text-white flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Copy className="h-3 w-3 text-purple-400" />
                        <span>{copiedLinkType === 'led' ? 'Copied!' : 'LED Wall Overlay'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink('score')}
                        className="py-2 bg-dark-950 border border-dark-800 hover:border-purple-500 rounded-xl text-[8px] font-black uppercase text-white flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Copy className="h-3 w-3 text-purple-400" />
                        <span>{copiedLinkType === 'score' ? 'Copied!' : 'Scoreboard Only'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink('intro')}
                        className="py-2 bg-dark-950 border border-dark-800 hover:border-purple-500 rounded-xl text-[8px] font-black uppercase text-white flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Copy className="h-3 w-3 text-purple-400" />
                        <span>{copiedLinkType === 'intro' ? 'Copied!' : 'Intro Screen Scene'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                  <span>{autoSaveEnabled ? 'Save & Close' : 'Apply Changes'}</span>
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
      {/* 2. Crop Modal Overlay */}
      {showCropModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-dark-900 border border-dark-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-950/50">
              <div className="flex items-center space-x-2">
                <Scissors className="h-4 w-4 text-[#facc15]" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Crop & Align Image</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCropModal(false)}
                className="text-dark-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col items-center space-y-4">
              {/* Drag Container */}
              <div 
                className="relative w-[320px] h-[320px] bg-dark-950 border border-dark-800 rounded-2xl overflow-hidden cursor-move touch-none flex items-center justify-center select-none"
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              >
                {/* The Image */}
                {cropSrc && (
                  <img
                    src={cropSrc}
                    alt="To Crop"
                    crossOrigin="anonymous"
                    style={{
                      transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropZoom}) rotate(${cropRotation}deg)`,
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      maxWidth: 'none',
                      width: imgDimensions.width,
                      height: imgDimensions.height,
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* SVG mask cutout overlay */}
                <svg className="absolute inset-0 w-[320px] h-[320px] pointer-events-none z-10">
                  <defs>
                    <mask id="cropMask">
                      <rect x="0" y="0" width="320" height="320" fill="white" />
                      {cropPreset === 'circle' ? (
                        <circle cx="160" cy="160" r="125" fill="black" />
                      ) : cropPreset === '16:9' ? (
                        <rect x="20" y="81.25" width="280" height="157.5" fill="black" />
                      ) : cropPreset === '4:5' ? (
                        <rect x="60" y="35" width="200" height="250" fill="black" />
                      ) : cropPreset === '3:4' ? (
                        <rect x="66.25" y="35" width="187.5" height="250" fill="black" />
                      ) : (
                        <rect x="35" y="35" width="250" height="250" fill="black" />
                      )}
                    </mask>
                  </defs>
                  <rect x="0" y="0" width="320" height="320" fill="black" fillOpacity="0.7" mask="url(#cropMask)" />
                  {cropPreset === 'circle' ? (
                    <circle cx="160" cy="160" r="125" stroke="#facc15" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                  ) : cropPreset === '16:9' ? (
                    <rect x="20" y="81.25" width="280" height="157.5" stroke="#facc15" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                  ) : cropPreset === '4:5' ? (
                    <rect x="60" y="35" width="200" height="250" stroke="#facc15" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                  ) : cropPreset === '3:4' ? (
                    <rect x="66.25" y="35" width="187.5" height="250" stroke="#facc15" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                  ) : (
                    <rect x="35" y="35" width="250" height="250" stroke="#facc15" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                  )}
                </svg>
              </div>

              {/* Controls */}
              <div className="w-full space-y-3">
                {/* Aspect Ratio Presets */}
                <div className="flex flex-col space-y-1.5">
                  <span className="text-[9px] text-dark-450 font-bold uppercase tracking-wider">Crop Preset Aspect Ratio</span>
                  <div className="flex flex-wrap gap-1.5">
                    {getAvailablePresets().map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setCropPreset(preset.value as any)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                          cropPreset === preset.value
                            ? 'bg-[#facc15] text-black shadow-md shadow-yellow-500/10'
                            : 'bg-dark-950 hover:bg-dark-800 text-dark-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zoom Controls */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] font-bold text-dark-450 uppercase">
                    <span className="flex items-center space-x-1">
                      <ZoomIn className="h-3 w-3" />
                      <span>Zoom Level</span>
                    </span>
                    <span>{Math.round(cropZoom * 100)}%</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setCropZoom(prev => Math.max(0.5, prev - 0.1))}
                      className="p-1 bg-dark-950 hover:bg-dark-800 border border-dark-800 rounded-lg text-white cursor-pointer"
                    >
                      <ZoomOut className="h-3 w-3" />
                    </button>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.01"
                      value={cropZoom}
                      onChange={(e) => setCropZoom(Number(e.target.value))}
                      className="flex-1 accent-[#facc15] h-1 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setCropZoom(prev => Math.min(3.0, prev + 0.1))}
                      className="p-1 bg-dark-950 hover:bg-dark-800 border border-dark-800 rounded-lg text-white cursor-pointer"
                    >
                      <ZoomIn className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Rotation Controls */}
                <div className="space-y-1.5">
                  <span className="text-[9px] text-dark-450 font-bold uppercase tracking-wider block">Rotation</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCropRotation(prev => (prev - 90 + 360) % 360)}
                      className="py-1.5 bg-dark-950 hover:bg-dark-800 border border-dark-800 rounded-xl text-[10px] font-bold text-white flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <RotateCw className="h-3 w-3 transform -scale-x-100" />
                      <span>Rotate Left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCropRotation(prev => (prev + 90) % 360)}
                      className="py-1.5 bg-dark-950 hover:bg-dark-800 border border-dark-800 rounded-xl text-[10px] font-bold text-white flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <RotateCw className="h-3 w-3" />
                      <span>Rotate Right</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-dark-800 bg-dark-950/50 flex space-x-2">
              <button
                type="button"
                onClick={() => setShowCropModal(false)}
                className="flex-1 py-2 bg-dark-850 hover:bg-dark-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrop}
                className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer flex items-center justify-center space-x-1 shadow-md shadow-purple-500/20"
              >
                <Check className="h-3 w-3" />
                <span>Save Crop</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Sponsor Preview Modal Overlay */}
      {previewSponsorUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setPreviewSponsorUrl(null)}>
          <div className="bg-dark-900 border border-dark-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button 
              type="button" 
              onClick={() => setPreviewSponsorUrl(null)} 
              className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="text-sm font-extrabold text-[#facc15] uppercase tracking-wider mb-4 text-center">Sponsor Badge Preview</h3>
            
            <div className="bg-dark-950 rounded-2xl p-8 border border-dark-850 flex items-center justify-center min-h-[220px]">
              {(() => {
                const sponsorIdx = editSponsorLogos.indexOf(previewSponsorUrl || '');
                const sponsorName = sponsorIdx !== -1 ? editSponsorNames[sponsorIdx] : '';
                const sponsorSubtitle = sponsorIdx !== -1 ? editSponsorSubtitles[sponsorIdx] : '';
                return (
                  <div className="flex flex-col items-center justify-center min-w-[140px] max-w-[170px]">
                    <span className="text-[12px] text-yellow-400 font-extrabold uppercase tracking-wider text-center block font-sans">
                      ಹೆಚ್ಚಿನ ಪ್ರೋತ್ಸಾಹಕರು
                    </span>
                    
                    <div className="w-12 border-t border-yellow-500/35 my-1.5" />
                    
                    <div className="relative h-16 w-16 rounded-full border-[3px] border-yellow-500/80 shadow-[0_0_12px_rgba(234,179,8,0.3)] overflow-hidden mb-2 bg-dark-900 flex items-center justify-center">
                      <img 
                        src={previewSponsorUrl} 
                        alt="Sponsor Photo" 
                        className="h-full w-full object-cover" 
                      />
                    </div>
                    
                    <span className="text-[13px] text-white font-extrabold text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] block font-sans max-w-[140px] truncate leading-tight">
                      {sponsorName || 'ಪ್ರೋತ್ಸಾಹಕರು'}
                    </span>
                    {sponsorSubtitle && (
                      <span className="text-[10px] text-yellow-500/90 font-bold text-center block font-sans mt-0.5 max-w-[140px] truncate leading-none">
                        {sponsorSubtitle}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
            
            <p className="text-[10px] text-dark-450 mt-4 text-center">
              This is a live representation of the sponsor appreciation card as displayed on the broadcast graphics overlay.
            </p>
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
