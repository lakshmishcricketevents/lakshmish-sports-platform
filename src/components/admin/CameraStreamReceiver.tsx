'use client';

import { useState, useEffect, useRef } from 'react';
import { Camera, Play, Volume2, VolumeX, Maximize2, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface ReceiverProps {
  token: string;
  name: string;
  resolution: string;
  baseUrl: string;
}

export default function CameraStreamReceiver({ token, name, resolution, baseUrl }: ReceiverProps) {
  const [status, setStatus] = useState<'idle' | 'offered' | 'connected' | 'reconnecting'>('idle');
  const [isMuted, setIsMuted] = useState(true);
  const [showFull, setShowFull] = useState(false);

  // Diagnostics Panel States
  const [showDiag, setShowDiag] = useState(false);
  const [diagSession, setDiagSession] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagSocket, setDiagSocket] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagWebRTC, setDiagWebRTC] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagVideo, setDiagVideo] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [connLogs, setConnLogs] = useState<string[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const captureUrl = `${baseUrl}/cam/capture/${token}?name=${encodeURIComponent(name)}&res=${resolution}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(captureUrl)}&color=d4af37&bgcolor=080809`;

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${msg}`);
    setConnLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 40));
  };

  // Start polling signal server
  useEffect(() => {
    startListening();
    return () => {
      stopListening();
    };
  }, [token]);

  // Poll active sessions on server when diagnostics panel is open
  useEffect(() => {
    if (!showDiag) return;
    const fetchActiveSessions = async () => {
      try {
        const res = await fetch('/api/cam/signal');
        if (res.ok) {
          const data = await res.json();
          setActiveSessions(data);
        }
      } catch (err) {
        console.warn('Failed to fetch active camera sessions:', err);
      }
    };
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 3000);
    return () => clearInterval(interval);
  }, [showDiag]);

  const stopListening = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setStatus('idle');
  };

  const postSignal = async (action: string, payload?: any) => {
    const res = await fetch('/api/cam/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, token, payload })
    });
    if (!res.ok) {
      if (res.status === 404 && action === 'poll') {
        return {};
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Server error: ${res.status}`);
    }
    return res.json();
  };

  // Test Buttons
  const testSignaling = async () => {
    addLog('Testing signaling channel reachability...');
    setDiagSocket('PENDING');
    try {
      const res = await fetch('/api/cam/signal');
      if (res.ok) {
        setDiagSocket('PASS');
        addLog('Signaling channel online.');
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (err: any) {
      setDiagSocket('FAIL');
      addLog('Signaling test failed: ' + err.message);
    }
  };

  const testWebRTC = () => {
    addLog('Checking WebRTC peer states...');
    if (pcRef.current) {
      const state = pcRef.current.connectionState;
      const iceState = pcRef.current.iceConnectionState;
      addLog(`WebRTC states: ConnectionState=${state}, ICEState=${iceState}`);
      if (iceState === 'connected' || iceState === 'completed') {
        setDiagWebRTC('PASS');
      } else {
        setDiagWebRTC('FAIL');
      }
    } else {
      setDiagWebRTC('FAIL');
      addLog('WebRTC not initialized.');
    }
  };

  const forceReconnect = () => {
    addLog('Forcing stream reconnection...');
    startListening();
  };

  const startListening = () => {
    stopListening();
    addLog('Session Created');
    addLog(`Receiver listening for stream: ${name} (${token})...`);
    setDiagSession('PENDING');
    setDiagSocket('PENDING');
    setDiagWebRTC('PENDING');
    setDiagVideo('PENDING');

    let wasRegistered = false;
    const pendingCandidates: any[] = [];

    // Poll the signal server for offers
    pollTimerRef.current = setInterval(async () => {
      try {
        const data = await postSignal('poll', { role: 'receiver' });
        setDiagSocket('PASS');

        // Check if camera session exists on server
        if (data.sessionNotFound || !data.status) {
          setDiagSession('FAIL');
          wasRegistered = false;
          if (pcRef.current) {
            addLog('Broadcaster session offline. Resetting connection...');
            pcRef.current.close();
            pcRef.current = null;
            setStatus('idle');
            setDiagWebRTC('PENDING');
            setDiagVideo('PENDING');
          }
        } else {
          if (!wasRegistered) {
            addLog('Session Registered');
            wasRegistered = true;
          }
          setDiagSession('PASS');
        }

        // CRITICAL BUG FIX: If we receive a new offer ('offered' status), or if the peer connection is not setup,
        // or if the connection has failed, recycle the connection immediately to accept the new stream.
        const needsNewConnection = 
          data.offer && 
          (data.status === 'offered' || 
           !pcRef.current || 
           pcRef.current.connectionState === 'failed' || 
           pcRef.current.iceConnectionState === 'failed');

        if (needsNewConnection) {
          if (pcRef.current) {
            addLog('New connection offer detected. Closing and recycling old connection...');
            pcRef.current.close();
            pcRef.current = null;
          }
          setStatus('offered');
          setDiagWebRTC('PENDING');
          await establishConnection(data.offer, pendingCandidates);
        }

        // 2. Feed Ice candidates
        if (pcRef.current && Array.isArray(data.candidates) && data.candidates.length > 0) {
          addLog(`Received ${data.candidates.length} candidates from broadcaster.`);
          for (const cand of data.candidates) {
            try {
              if (pcRef.current.remoteDescription) {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
              } else {
                pendingCandidates.push(cand);
              }
            } catch (err) {
              console.warn('Failed to add remote candidate:', err);
            }
          }
        }
      } catch (err: any) {
        console.error('Signaling receiver error:', err);
        setDiagSocket('FAIL');
        addLog('Signaling error: ' + err.message);
      }
    }, 1500);
  };

  const establishConnection = async (offer: any, pendingCandidates: any[]) => {
    addLog('Received remote SDP offer. Creating RTCPeerConnection...');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // Handle incoming streams
    pc.ontrack = (event) => {
      addLog('WebRTC media track received: ' + event.track.kind);
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
        setStatus('connected');
        setDiagVideo('PASS');
        addLog('Stream Started');
        addLog('Attached stream to video player. Streaming is active.');
      }
    };

    // Gather ICE Candidates to send back
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        addLog('Gathered local receiver candidate: ' + event.candidate.candidate.substring(0, 40) + '...');
        try {
          await postSignal('post_candidate_receiver', { candidate: event.candidate });
        } catch (err) {
          console.warn('Failed to send ice candidate:', err);
        }
      }
    };

    let wasPeerConnected = false;
    pc.oniceconnectionstatechange = () => {
      addLog('WebRTC ICE state changed: ' + pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setStatus('connected');
        if (!wasPeerConnected) {
          addLog('Peer Connected');
          wasPeerConnected = true;
        }
        setDiagWebRTC('PASS');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setStatus('reconnecting');
        wasPeerConnected = false;
        setDiagWebRTC('FAIL');
        addLog('WebRTC disconnected. Restarting poll listener...');
        startListening();
      }
    };

    try {
      // Set remote description from mobile offer
      addLog('Setting remote description from offer...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      addLog('Remote description set successfully.');

      // Drain buffered candidates
      if (pendingCandidates.length > 0) {
        addLog(`Draining ${pendingCandidates.length} buffered broadcaster candidates...`);
        for (const cand of pendingCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn('Failed to add buffered ICE candidate:', e);
          }
        }
        pendingCandidates.length = 0;
      }

      // Create SDP Answer
      addLog('Creating local SDP answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send SDP Answer to Mobile via signal server
      addLog('Sending SDP answer to signaling server...');
      await postSignal('post_answer', { answer });
      addLog('SDP answer posted. Waiting for P2P link establishment...');
    } catch (e: any) {
      setDiagWebRTC('FAIL');
      addLog('WebRTC connection establishment failed: ' + e.message);
      throw e;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch(err => {
          console.error(err);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const getDetailedStatus = () => {
    if (status === 'connected') return 'LIVE';
    if (status === 'offered') return 'CONNECTING';
    if (status === 'reconnecting') return 'RECONNECTING';
    
    // Status is idle (waiting)
    if (diagSocket === 'FAIL') return 'Server Offline';
    if (diagSession === 'FAIL') return 'Waiting for Scan';
    if (diagWebRTC === 'FAIL') return 'WebRTC Failed';
    if (diagVideo === 'FAIL') return 'Playback Failed';
    return 'SCAN QR';
  };

  return (
    <div className={`glass-panel rounded-xl border border-gold-500/10 overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300 ${
      showFull ? 'fixed inset-0 z-50 bg-dark-950 p-6' : ''
    }`}>
      {/* Stream Header */}
      <div className="px-4 py-2.5 bg-dark-950/80 border-b border-dark-800 flex justify-between items-center">
        <div>
          <h4 className="text-xs font-extrabold uppercase text-white tracking-wider flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-gold-500" />
            <span>{name}</span>
          </h4>
          <span className="text-[9px] text-dark-450 uppercase font-semibold">{resolution} Feed</span>
        </div>

        {/* Live Status indicator */}
        <div className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
          status === 'connected'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
            : status === 'offered' || status === 'reconnecting'
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25 animate-pulse'
            : 'bg-dark-900 border border-dark-800 text-dark-400'
        }`}>
          {status === 'connected' ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-dark-400" />}
          <span>{getDetailedStatus()}</span>
        </div>
      </div>

      {/* Stream Viewport / QR code container */}
      <div className="relative aspect-video bg-dark-950 flex items-center justify-center border-b border-dark-900">
        {status !== 'connected' ? (
          <div className="flex flex-col items-center p-4 text-center">
            {/* Display QR Code */}
            <div className="p-2 bg-dark-900 border border-gold-500/30 rounded-lg glow-gold shadow-md">
              <img src={qrCodeUrl} alt="Scan QR Code" className="w-28 h-28 object-contain" />
            </div>
            <p className="text-[10px] text-gold-450 mt-3 font-semibold max-w-[180px] leading-relaxed">
              Scan with phone camera to connect WebRTC Stream instantly
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            className="w-full h-full object-cover"
          />
        )}

        {/* Active stream overlays */}
        {status === 'connected' && (
          <div className="absolute bottom-2 right-2 flex space-x-2">
            <button
              onClick={toggleMute}
              className="p-1.5 bg-dark-950/80 border border-dark-800 hover:border-gold-500/35 rounded-lg text-white"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-450" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 bg-dark-950/80 border border-dark-800 hover:border-gold-500/35 rounded-lg text-white"
            >
              <Maximize2 className="h-3.5 w-3.5 text-gold-500" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Diagnostics Section */}
      <div className="border-b border-dark-900">
        <button
          onClick={() => setShowDiag(!showDiag)}
          className="w-full bg-dark-900/60 hover:bg-dark-900 border-none text-dark-450 hover:text-white px-3 py-2 text-[9px] font-extrabold uppercase tracking-wider flex items-center justify-between"
        >
          <span>Diagnostics & Logs</span>
          <span>{showDiag ? 'HIDE' : 'SHOW'}</span>
        </button>

        {showDiag && (
          <div className="bg-dark-950 p-3 space-y-3 border-t border-dark-900">
            {/* Diagnostics checklist */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Signaling Server', val: diagSocket },
                { label: 'Mobile Session Found', val: diagSession },
                { label: 'WebRTC P2P Link', val: diagWebRTC === 'PASS' ? 'CONNECTED' : diagWebRTC },
                { label: 'Video Playback', val: diagVideo === 'PASS' ? 'CONNECTED' : diagVideo }
              ].map((item, idx) => (
                <div key={idx} className="bg-dark-900/60 p-2 rounded flex justify-between items-center border border-dark-850">
                  <span className="text-[8px] text-dark-400 font-semibold">{item.label}</span>
                  <span className={`text-[8px] font-extrabold px-1 rounded ${
                    item.val === 'PASS' || item.val === 'CONNECTED' || item.val === 'STARTED'
                      ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                      : item.val === 'FAIL'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-amber-500/10 text-amber-450 border border-amber-500/20'
                  }`}>
                    {item.val}
                  </span>
                </div>
              ))}
            </div>

            {/* Diagnostics Actions */}
            <div className="flex gap-2 border-t border-dark-900 pt-2">
              <button
                onClick={testSignaling}
                className="bg-dark-900 hover:bg-dark-800 border border-dark-850 text-dark-300 hover:text-white px-2.5 py-1 rounded text-[8px] font-extrabold uppercase transition-all"
              >
                Test Signal Server
              </button>
              <button
                onClick={testWebRTC}
                className="bg-dark-900 hover:bg-dark-800 border border-dark-850 text-dark-300 hover:text-white px-2.5 py-1 rounded text-[8px] font-extrabold uppercase transition-all"
              >
                Test WebRTC Link
              </button>
              <button
                onClick={forceReconnect}
                className="bg-gold-500/15 hover:bg-gold-500/20 border border-gold-500/20 text-gold-450 px-2.5 py-1 rounded text-[8px] font-extrabold uppercase transition-all"
              >
                Force Reset
              </button>
            </div>

            {/* Active Server Sessions list */}
            <div className="space-y-1.5 border-t border-dark-900 pt-2">
              <span className="block text-[8px] text-dark-400 font-bold uppercase tracking-widest">Active Server Sessions</span>
              <div className="bg-dark-900 p-2 rounded max-h-24 overflow-y-auto font-mono text-[8px] leading-relaxed scrollbar-thin">
                {activeSessions.length === 0 ? (
                  <span className="text-dark-500">No active sessions on server.</span>
                ) : (
                  activeSessions.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center text-dark-300 py-0.5 border-b border-dark-950 last:border-b-0">
                      <span>Token: <span className="text-gold-500">{s.token}</span> ({s.name})</span>
                      <span className={`px-1 rounded font-bold ${
                        s.status === 'connected' ? 'text-emerald-450' : 'text-amber-450'
                      }`}>{s.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Log Panel */}
            <div className="space-y-1">
              <span className="block text-[8px] text-dark-400 font-bold uppercase tracking-widest">Logs</span>
              <div className="bg-dark-900 p-2 rounded h-24 overflow-y-auto font-mono text-[8px] text-dark-300 Leading-relaxed scrollbar-thin">
                {connLogs.length === 0 ? (
                  <span className="text-dark-500">Waiting for logs...</span>
                ) : (
                  connLogs.map((log, i) => (
                    <div key={i} className={log.includes('failed') || log.includes('error') ? 'text-red-400' : log.includes('active') || log.includes('established') || log.includes('LIVE') || log.includes('Created') || log.includes('Registered') || log.includes('Started') || log.includes('Connected') ? 'text-emerald-450' : ''}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / URL Link info */}
      <div className="p-3 bg-dark-900/30 text-[9px] text-dark-400 flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span>Target Connection Stream URL:</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(captureUrl);
              alert('Capture URL copied to clipboard.');
            }}
            className="text-gold-500 hover:underline font-bold"
          >
            Copy URL
          </button>
        </div>
        <input
          type="text"
          readOnly
          value={captureUrl}
          className="bg-dark-950 border border-dark-850 px-2 py-1 rounded text-dark-500 font-mono select-all w-full truncate focus:outline-none"
        />
      </div>
    </div>
  );
}
