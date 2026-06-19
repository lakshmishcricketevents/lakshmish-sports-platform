import { NextRequest, NextResponse } from 'next/server';

interface SignalState {
  token: string;
  name: string;
  resolution: string;
  offer: any | null;
  answer: any | null;
  broadcasterCandidates: any[];
  receiverCandidates: any[];
  status: 'idle' | 'offered' | 'answered' | 'connected';
  lastActive: number;
}

// Persist signaling dictionary across development hot reloads
const globalSignals = global as any;
globalSignals.cameraSignals = globalSignals.cameraSignals || new Map<string, SignalState>();
const cameraSignals = globalSignals.cameraSignals as Map<string, SignalState>;

// Periodic cleanup of stale signalling sessions (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, state] of cameraSignals.entries()) {
    if (now - state.lastActive > 10 * 60 * 1000) {
      cameraSignals.delete(token);
    }
  }
}, 5 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, token, payload } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const now = Date.now();

    // 1. Register Camera (Mobile broadcaster initiates)
    if (action === 'register') {
      const { name, resolution } = payload;
      const state: SignalState = {
        token,
        name: name || 'Mobile Cam',
        resolution: resolution || '720p',
        offer: null,
        answer: null,
        broadcasterCandidates: [],
        receiverCandidates: [],
        status: 'idle',
        lastActive: now
      };
      cameraSignals.set(token, state);
      return NextResponse.json({ success: true, state });
    }

    // Ensure session exists
    let state = cameraSignals.get(token);
    if (!state) {
      return NextResponse.json({ 
        error: 'Session not found. Register first.', 
        sessionNotFound: true,
        status: 'idle'
      });
    }

    state.lastActive = now;

    // 2. Post SDP Offer (Mobile sends)
    if (action === 'post_offer') {
      state.offer = payload.offer;
      state.status = 'offered';
      cameraSignals.set(token, state);
      return NextResponse.json({ success: true });
    }

    // 3. Get SDP Offer (Receiver pulls)
    if (action === 'get_offer') {
      return NextResponse.json({
        offer: state.offer,
        status: state.status,
        name: state.name,
        resolution: state.resolution
      });
    }

    // 4. Post SDP Answer (Receiver sends)
    if (action === 'post_answer') {
      state.answer = payload.answer;
      state.status = 'answered';
      cameraSignals.set(token, state);
      return NextResponse.json({ success: true });
    }

    // 5. Get SDP Answer (Mobile pulls)
    if (action === 'get_answer') {
      return NextResponse.json({
        answer: state.answer,
        status: state.status
      });
    }

    // 6. Post ICE Candidates (Broadcaster)
    if (action === 'post_candidate_broadcaster') {
      state.broadcasterCandidates.push(payload.candidate);
      cameraSignals.set(token, state);
      return NextResponse.json({ success: true });
    }

    // 7. Post ICE Candidates (Receiver)
    if (action === 'post_candidate_receiver') {
      state.receiverCandidates.push(payload.candidate);
      cameraSignals.set(token, state);
      return NextResponse.json({ success: true });
    }

    // 8. Poll ICE Candidates & Status
    if (action === 'poll') {
      const role = payload.role; // 'broadcaster' or 'receiver'
      
      if (role === 'broadcaster') {
        // Broadcaster wants answer + receiver's ICE candidates
        const response = {
          status: state.status,
          answer: state.answer,
          candidates: state.receiverCandidates
        };
        // Clear candidates after read to save bandwidth
        state.receiverCandidates = [];
        cameraSignals.set(token, state);
        return NextResponse.json(response);
      } else {
        // Receiver wants offer + broadcaster's ICE candidates
        const response = {
          status: state.status,
          offer: state.offer,
          candidates: state.broadcasterCandidates
        };
        state.broadcasterCandidates = [];
        cameraSignals.set(token, state);
        return NextResponse.json(response);
      }
    }

    if (action === 'set_connected') {
      state.status = 'connected';
      cameraSignals.set(token, state);
      return NextResponse.json({ success: true });
    }

    if (action === 'disconnect') {
      cameraSignals.delete(token);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid signal action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET lists all active cameras
export async function GET() {
  try {
    const list = Array.from(cameraSignals.values()).map(s => ({
      token: s.token,
      name: s.name,
      resolution: s.resolution,
      status: s.status,
      lastActive: s.lastActive
    }));
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
