'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Camera, RefreshCw, Mic, MicOff, AlertCircle, CheckCircle, Wifi, WifiOff } from 'lucide-react';

function MobileCameraCaptureContent() {
  const { token } = useParams() as { token: string };
  const searchParams = useSearchParams();
  const camName = searchParams.get('name') || 'Mobile Cam';
  const resolution = searchParams.get('res') || '720p';

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isMuted, setIsMuted] = useState(false);
  const [connStatus, setConnStatus] = useState<'disconnected' | 'connecting' | 'live'>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraError, setCameraError] = useState('');

  // Diagnostics Panel States
  const [showDiag, setShowDiag] = useState(false);
  const [diagPermission, setDiagPermission] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagStream, setDiagStream] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagSocket, setDiagSocket] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagWebRTC, setDiagWebRTC] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagServer, setDiagServer] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [diagRegistered, setDiagRegistered] = useState<'PENDING' | 'PASS' | 'FAIL'>('PENDING');
  const [connLogs, setConnLogs] = useState<string[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${msg}`);
    setConnLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 40));
  };

  // Initialize camera stream
  useEffect(() => {
    if (!token) {
      addLog('Waiting for session token parameters...');
      return;
    }
    addLog('Session Created');
    addLog('Session Details: token=' + token + ', name=' + camName);
    startCapture();
    return () => {
      stopCapture();
    };
  }, [facingMode, token]);

  const stopCapture = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    // Notify signal endpoint of disconnection
    fetch('/api/cam/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect', token })
    }).catch(err => console.error(err));
  };

  const createMockStream = (): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;
    
    let angle = 0;
    const draw = () => {
      if (!canvas) return;
      
      // Clear background
      ctx.fillStyle = '#080809';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw premium gold rings
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 70 + Math.sin(angle) * 8, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw blinking red LIVE indicator
      ctx.fillStyle = Math.floor(Date.now() / 500) % 2 === 0 ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(40, 40, 8, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('LIVE FALLBACK FEED', 60, 43);
      
      // Draw Camera details
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(camName.toUpperCase(), canvas.width / 2 - 70, canvas.height / 2 + 5);
      
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px sans-serif';
      ctx.fillText(`TOKEN: ${token} | RESOLUTION: ${resolution}`, canvas.width / 2 - 100, canvas.height / 2 + 30);
      
      angle += 0.05;
      requestAnimationFrame(draw);
    };
    
    // Start drawing loop
    setTimeout(draw, 0);
    
    // Capture canvas at 30 fps
    return (canvas as any).captureStream(30) as MediaStream;
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

  // Diagnostic Test Buttons implementation
  const testCamera = async () => {
    addLog('Testing camera access...');
    setDiagPermission('PENDING');
    setDiagStream('PENDING');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = "Secure Connection Required: Camera access is disabled on insecure connections (HTTP). Please access via HTTPS or localhost.";
      setCameraError(msg);
      setDiagPermission('FAIL');
      setDiagStream('FAIL');
      addLog('Camera access FAILED: MediaDevices API not available (requires HTTPS or localhost).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setDiagPermission('PASS');
      setDiagStream('PASS');
      setCameraError('');
      addLog('Camera access OK: ' + stream.getVideoTracks()[0].label);
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      setDiagPermission('FAIL');
      setDiagStream('FAIL');
      
      let msg = '';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError') {
        msg = "Camera Permission Denied: Tap the lock icon in the address bar to reset camera permissions, then click 'Enable Camera Access'.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = "No Camera Found: We couldn't find a camera device on this phone. Ensure it is connected and enabled.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = "Camera in Use: Another application is already using the camera. Please close other apps and try again.";
      } else {
        msg = `Camera Access Failed: ${err.message || 'Unknown error'}. Please try again.`;
      }
      setCameraError(msg);
      addLog('Camera access FAILED: ' + err.message);
    }
  };

  const testServer = async () => {
    addLog('Testing server reachability...');
    setDiagServer('PENDING');
    try {
      const res = await fetch('/api/cam/ip', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setDiagServer('PASS');
        addLog('Server reachable. Host IP: ' + data.ip);
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (err: any) {
      setDiagServer('FAIL');
      addLog('Server unreachable: ' + err.message);
    }
  };

  const testSocket = async () => {
    addLog('Testing signaling channel connection...');
    setDiagSocket('PENDING');
    try {
      const res = await fetch('/api/cam/signal', { method: 'GET' });
      if (res.ok) {
        setDiagSocket('PASS');
        addLog('Signaling channel active. Status: OK');
      } else {
        throw new Error('HTTP ' + res.status);
      }
    } catch (err: any) {
      setDiagSocket('FAIL');
      addLog('Signaling channel error: ' + err.message);
    }
  };

  const testWebRTCStatus = () => {
    addLog('Testing WebRTC link status...');
    if (pcRef.current) {
      const state = pcRef.current.connectionState;
      const iceState = pcRef.current.iceConnectionState;
      addLog(`WebRTC state: connectionState=${state}, iceConnectionState=${iceState}`);
      if (iceState === 'connected' || iceState === 'completed') {
        setDiagWebRTC('PASS');
      } else if (iceState === 'checking') {
        setDiagWebRTC('PENDING');
      } else {
        setDiagWebRTC('FAIL');
      }
    } else {
      setDiagWebRTC('FAIL');
      addLog('WebRTC link FAILED: RTCPeerConnection not initialized.');
    }
  };

  const startCapture = async () => {
    try {
      stopCapture();
      setConnStatus('connecting');
      setErrorMsg('');
      addLog('Starting camera capture...');
      setDiagPermission('PENDING');
      setDiagStream('PENDING');
      setDiagServer('PENDING');
      setDiagSocket('PENDING');
      setDiagRegistered('PENDING');
      setDiagWebRTC('PENDING');

      // Test server connection first
      try {
        const res = await fetch('/api/cam/ip');
        if (res.ok) {
          setDiagServer('PASS');
          addLog('Server reachability verified.');
        } else {
          setDiagServer('FAIL');
          addLog('Server reachability warning: ' + res.status);
        }
      } catch (e: any) {
        setDiagServer('FAIL');
        addLog('Server unreachable: ' + e.message);
      }

      // Setup capture constraints
      const width = resolution === '1080p' ? 1920 : 1280;
      const height = resolution === '1080p' ? 1080 : 720;
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: 30 }
        },
        audio: true
      };

      let stream: MediaStream;
      
      // Check if MediaDevices API is supported (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg = "Secure Connection Required: Camera access is disabled on insecure connections (HTTP). Please access via HTTPS or localhost.";
        setCameraError(msg);
        setDiagPermission('FAIL');
        setDiagStream('FAIL');
        addLog('Browser camera stream BLOCKED: MediaDevices API not available (requires HTTPS or localhost). Initializing Canvas fallback...');
        stream = createMockStream();
      } else {
        try {
          addLog('Requesting browser camera stream...');
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          setDiagPermission('PASS');
          setDiagStream('PASS');
          setCameraError(''); // Clear error if camera captured successfully
          addLog('Camera media stream successfully captured.');
          addLog('Stream Started');
        } catch (mediaErr: any) {
          let msg = '';
          if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError' || mediaErr.name === 'SecurityError') {
            msg = "Camera Permission Denied: Tap the lock icon in the address bar to reset camera permissions, then click 'Enable Camera Access'.";
            addLog('Camera permission denied.');
          } else if (mediaErr.name === 'NotFoundError' || mediaErr.name === 'DevicesNotFoundError') {
            msg = "No Camera Found: We couldn't find a camera device on this phone. Ensure it is connected and enabled.";
            addLog('No camera hardware found.');
          } else if (mediaErr.name === 'NotReadableError' || mediaErr.name === 'TrackStartError') {
            msg = "Camera in Use: Another application is already using the camera. Please close other apps and try again.";
            addLog('Camera resource lock failed.');
          } else {
            msg = `Camera Access Failed: ${mediaErr.message || 'Unknown error'}. Please try again.`;
            addLog('Camera failed: ' + mediaErr.message);
          }
          setCameraError(msg);
          setDiagPermission('FAIL');
          setDiagStream('FAIL');
          stream = createMockStream();
          addLog('Stream Started with fallback feed.');
        }
      }
      
      streamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize WebRTC
      await initWebRTC(stream);
    } catch (err: any) {
      console.error('Failed to capture local camera media:', err);
      setConnStatus('disconnected');
      setErrorMsg(err.message || 'Camera access denied. Ensure network configuration is correct.');
      addLog('Broadcasting failed to start: ' + err.message);
    }
  };

  const initWebRTC = async (stream: MediaStream) => {
    addLog('Initializing WebRTC RTCPeerConnection...');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    const pendingCandidates: any[] = [];

    // Add local tracks to PeerConnection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
    addLog('Attached tracks: ' + stream.getTracks().map(t => t.kind).join(', '));

    // Handle ICE Candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        addLog('Gathered ICE candidate: ' + event.candidate.candidate.substring(0, 40) + '...');
        try {
          await postSignal('post_candidate_broadcaster', { candidate: event.candidate });
        } catch (err) {
          console.warn('Failed to send ice candidate:', err);
        }
      }
    };

    // Track connection state
    pc.oniceconnectionstatechange = () => {
      addLog('ICE Connection State changed: ' + pc.iceConnectionState);
      if (pc.iceConnectionState === 'checking') {
        setDiagWebRTC('PENDING');
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnStatus('live');
        setDiagWebRTC('PASS');
        addLog('Peer Connected');
        postSignal('set_connected').catch(err => console.error(err));
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setConnStatus('disconnected');
        setDiagWebRTC('FAIL');
        addLog('WebRTC link disconnected or failed. Re-initiating connection...');
        // Trigger auto reconnect
        setTimeout(startCapture, 3000);
      }
    };

    try {
      // 1. Register Camera on signal server
      addLog('Registering broadcaster on signaling server...');
      await postSignal('register', { name: camName, resolution });
      setDiagSocket('PASS');
      setDiagRegistered('PASS');
      addLog('Session Registered');

      // 2. Create Offer & Set Local Description
      addLog('Creating local SDP offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 3. Post Offer to Signal Server
      addLog('Uploading local SDP offer to signal server...');
      await postSignal('post_offer', { offer });
      addLog('SDP offer uploaded. Waiting for answer...');

      // 4. Begin Polling for SDP Answer and ICE Candidates
      pollTimerRef.current = setInterval(async () => {
        try {
          const data = await postSignal('poll', { role: 'broadcaster' });

          if (data.sessionNotFound) {
            addLog('Signaling session expired on server. Re-registering camera in 3s...');
            clearInterval(pollTimerRef.current!);
            setDiagSocket('FAIL');
            setDiagRegistered('FAIL');
            setTimeout(startCapture, 3000);
            return;
          }

          if (data.answer && pc.signalingState === 'have-local-offer') {
            addLog('SDP answer received from receiver. Setting remote description...');
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            addLog('Remote description set successfully.');
            
            // Drain buffered candidates
            if (pendingCandidates.length > 0) {
              addLog(`Draining ${pendingCandidates.length} buffered ICE candidates...`);
              for (const cand of pendingCandidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn('Failed to add buffered ICE candidate:', e);
                }
              }
              pendingCandidates.length = 0;
            }
          }

          if (Array.isArray(data.candidates) && data.candidates.length > 0) {
            addLog(`Received ${data.candidates.length} ICE candidates from receiver.`);
            for (const cand of data.candidates) {
              try {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } else {
                  pendingCandidates.push(cand);
                }
              } catch (e) {
                console.warn('Failed to add ICE candidate:', e);
              }
            }
          }
        } catch (e: any) {
          console.error('Error polling signaling channel:', e);
          addLog('Signaling poll error: ' + e.message);
          if (e.message && (e.message.includes('404') || e.message.includes('Session not found'))) {
            addLog('Signaling session not found on server. Re-registering camera in 3s...');
            clearInterval(pollTimerRef.current!);
            setDiagSocket('FAIL');
            setDiagRegistered('FAIL');
            setTimeout(startCapture, 3000);
          }
        }
      }, 1500);
    } catch (err: any) {
      setDiagSocket('FAIL');
      setDiagRegistered('FAIL');
      addLog('WebRTC signaling initialization failed: ' + err.message);
      throw err;
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const swapCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const getDetailedStatus = () => {
    if (connStatus === 'live') return 'LIVE';
    if (connStatus === 'connecting') {
      if (diagPermission === 'FAIL') return 'Permission Denied';
      if (diagStream === 'FAIL') return 'Camera Not Found';
      if (diagServer === 'FAIL') return 'Server Offline';
      if (diagSocket === 'FAIL') return 'Signaling Failed';
      if (diagRegistered === 'FAIL') return 'Registration Failed';
      return 'Connecting';
    }
    if (diagPermission === 'FAIL') return 'Permission Denied';
    if (diagStream === 'FAIL') return 'Camera Not Found';
    if (diagServer === 'FAIL') return 'Server Offline';
    if (diagSocket === 'FAIL') return 'Signaling Failed';
    if (diagRegistered === 'FAIL') return 'Registration Failed';
    if (errorMsg) {
      if (errorMsg.includes('404') || errorMsg.includes('Session')) return 'Registration Failed';
      return 'Network Error';
    }
    return 'Disconnected';
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white flex flex-col justify-between p-4 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center bg-dark-900 border border-dark-850 p-4 rounded-xl shadow-md">
        <div>
          <h1 className="text-sm font-bold text-white uppercase tracking-wider">{camName}</h1>
          <span className="text-[10px] text-dark-400 font-semibold uppercase tracking-widest">{resolution} Capture Node</span>
        </div>

        {/* Live Indicator Badge */}
        <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase transition-all duration-300 ${
          connStatus === 'live'
            ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
            : connStatus === 'connecting'
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {connStatus === 'live' ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{getDetailedStatus()}</span>
        </div>
      </div>

      {/* Main Cam Viewport */}
      <div className="my-4 relative flex-grow max-h-[50vh] bg-dark-900 rounded-xl border border-dark-800 overflow-hidden flex items-center justify-center shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {errorMsg && (
          <div className="absolute inset-0 bg-dark-950/90 flex flex-col items-center justify-center p-6 text-center z-10">
            <AlertCircle className="w-12 h-12 text-red-400 mb-3 animate-bounce" />
            <p className="text-xs font-semibold text-white leading-relaxed">{errorMsg}</p>
            <button
              onClick={startCapture}
              className="mt-4 bg-gold-500 text-dark-950 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-transform active:scale-95"
            >
              Retry Connection
            </button>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 bg-dark-950/85 flex flex-col items-center justify-center p-6 text-center z-10 backdrop-blur-sm">
            <AlertCircle className="w-12 h-12 text-amber-500 mb-3 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Camera Access Required</h3>
            <p className="text-xs text-dark-300 leading-relaxed max-w-xs mb-4 text-center">
              {cameraError}
            </p>
            <button
              onClick={startCapture}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all transform active:scale-95 shadow-lg shadow-purple-500/20 flex items-center space-x-2"
            >
              <Camera className="w-4 h-4" />
              <span>Enable Camera Access</span>
            </button>
          </div>
        )}
      </div>

      {/* Expandable Diagnostics Panel */}
      <div className="mb-4">
        <button
          onClick={() => setShowDiag(!showDiag)}
          className="w-full bg-dark-900 hover:bg-dark-850 border border-dark-800 text-dark-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between"
        >
          <span>Diagnostics & Logs</span>
          <span className={`text-[10px] px-2 py-0.5 rounded ${showDiag ? 'bg-gold-500/20 text-gold-450' : 'bg-dark-800 text-dark-400'}`}>
            {showDiag ? 'HIDE' : 'SHOW'}
          </span>
        </button>

        {showDiag && (
          <div className="mt-2 bg-dark-900 border border-dark-850 rounded-xl p-4 space-y-4 animate-fadeIn shadow-2xl">
            {/* Status Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Camera Permission', val: diagPermission },
                { label: 'Camera Stream', val: diagStream },
                { label: 'Signaling Channel', val: diagSocket },
                { label: 'WebRTC P2P Link', val: diagWebRTC },
                { label: 'Server Reachable', val: diagServer },
                { label: 'Stream Registered', val: diagRegistered }
              ].map((item, idx) => (
                <div key={idx} className="bg-dark-950/60 border border-dark-850 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] text-dark-400 font-semibold">{item.label}</span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                    item.val === 'PASS'
                      ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                      : item.val === 'FAIL'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-amber-500/10 text-amber-450 border border-amber-500/20 animate-pulse'
                  }`}>
                    {item.val}
                  </span>
                </div>
              ))}
            </div>

            {/* Diagnostic Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1.5 border-t border-dark-800">
              <button
                onClick={testCamera}
                className="bg-dark-950 hover:bg-dark-800 border border-dark-800 text-dark-300 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors"
              >
                Test Camera
              </button>
              <button
                onClick={testSocket}
                className="bg-dark-950 hover:bg-dark-800 border border-dark-800 text-dark-300 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors"
              >
                Test Signaling
              </button>
              <button
                onClick={testWebRTCStatus}
                className="bg-dark-950 hover:bg-dark-800 border border-dark-800 text-dark-300 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors"
              >
                Test WebRTC
              </button>
              <button
                onClick={testServer}
                className="bg-dark-950 hover:bg-dark-800 border border-dark-800 text-dark-300 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors"
              >
                Test Server
              </button>
              <button
                onClick={startCapture}
                className="bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/25 text-gold-450 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors"
              >
                Force Reconnect
              </button>
            </div>

            {/* Log Terminal console */}
            <div>
              <span className="block text-[8px] font-extrabold text-dark-400 uppercase tracking-widest mb-1.5">Live Connection Logs</span>
              <div className="bg-dark-950 border border-dark-850 p-3 rounded-lg h-32 overflow-y-auto font-mono text-[9px] text-dark-300 leading-relaxed scrollbar-thin">
                {connLogs.length === 0 ? (
                  <span className="text-dark-500">No logs generated yet.</span>
                ) : (
                  connLogs.map((log, i) => (
                    <div key={i} className={log.includes('FAILED') || log.includes('error') ? 'text-red-400' : log.includes('LIVE') || log.includes('established') || log.includes('successfully') ? 'text-emerald-450' : ''}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controller Buttons */}
      <div className="bg-dark-900 border border-dark-850 p-4 rounded-xl flex items-center justify-around shadow-md">
        <button
          onClick={swapCamera}
          className="flex flex-col items-center space-y-1 text-dark-300 hover:text-gold-400 transition-colors"
        >
          <div className="p-3 bg-dark-950 border border-dark-800 rounded-full shadow-md">
            <RefreshCw className="h-5 w-5" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider">Flip Lens</span>
        </button>

        <button
          onClick={toggleMute}
          className="flex flex-col items-center space-y-1 text-dark-300 hover:text-gold-400 transition-colors"
        >
          <div className="p-3 bg-dark-950 border border-dark-800 rounded-full shadow-md">
            {isMuted ? <MicOff className="h-5 w-5 text-red-400" /> : <Mic className="h-5 w-5 text-emerald-400" />}
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider">{isMuted ? 'Unmute' : 'Mute Mic'}</span>
        </button>

        <button
          onClick={startCapture}
          className="flex flex-col items-center space-y-1 text-dark-300 hover:text-gold-400 transition-colors"
        >
          <div className="p-3 bg-dark-950 border border-dark-800 rounded-full shadow-md">
            <Camera className="h-5 w-5 text-gold-500" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider">Reset</span>
        </button>
      </div>
    </div>
  );
}

export default function MobileCameraCapture() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-dark-950 text-white font-sans">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-gold-500 border-r-transparent align-[-0.125em]" />
      </div>
    }>
      <MobileCameraCaptureContent />
    </Suspense>
  );
}
