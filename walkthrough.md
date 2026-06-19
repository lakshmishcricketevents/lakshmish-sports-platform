# Walkthrough - Lakshmish Cricket Events Platform

We have successfully developed **Lakshmish Cricket Events**, a premium modern sports live scoring and management platform. Below is a summary of the project architecture, features implemented, and validation results.

---

## 1. Accomplished Changes & File Structure

Here is a summary of the newly created files and directories inside the workspace:

### Core Files
- **[`globals.css`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/globals.css)**: Implemented the premium black-and-gold design tokens (IPL, Cricbuzz, and esports-inspired), glassmorphic layout rules (`.glass-panel`, `.glass-panel-hover`), and custom keyframe animations for the live scoring indicator and gold glows.
- **[`layout.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/layout.tsx)**: Root Next.js layout configuration implementing the Google Font **Outfit** across all child modules.

### Components & Camera Stream Receiver
- **[`Navbar.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/components/layout/Navbar.tsx)**: Fully responsive premium header layout featuring glassmorphism accents, active link highlight states, and a mobile hamburger slide-out drawer optimized for ground operators.
- **[`Footer.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/components/layout/Footer.tsx)**: Dark, minimalist bottom footer showcasing sponsor alignments and copyrights.
- **[`CameraStreamReceiver.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/components/admin/CameraStreamReceiver.tsx)**: WebRTC stream receiver module. Connects dynamically to the mobile capture browser node, handles ICE candidates swaps, and renders a live, low-latency (<1s) video element grid inside the admin console.

### Database Layer
- **[`db.ts`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/lib/db.ts)**: Configured a unified database interface. By default, it operates on a local JSON file-based database (`data/local_db.json`) and seeds it with rich, premium mock data (tournaments, rosters, live matches, players, and sponsors). It is also fully wired to connect to a **MongoDB Atlas** database cluster if `MONGODB_URI` is provided in `.env.local`.

### Backend API Routes
- **[`/api/matches`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/matches/route.ts)**: Matches list retrieval and scheduled fixture registration.
- **[`/api/matches/[id]`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/matches/[id]/route.ts)**: Live scoring updates processor. Parses runs, boundaries, wickets, extras (cricket), and timer counts, touch-points, tackle points, and all-outs (kabaddi).
- **[`/api/tournaments`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/tournaments/route.ts)**: Tournament additions, rules settings, and participant team registrations.
- **[`/api/teams`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/teams/route.ts)**: Franchise creation, budget limits, captain/vice-captain settings.
- **[`/api/players`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/players/route.ts)**: Player profile cards, base auction values, and stats logs.
- **[`/api/auction`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/auction/route.ts)**: Place bids, cycle active players, sell players to squads, and track remaining budgets.
- **[`/api/sponsors`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/sponsors/route.ts)**: Sponsor banner managers.
- **[`/api/cam/signal`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/cam/signal/route.ts)**: Signalling server for WebRTC handshake swaps.
- **[`/api/cam/ip`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/cam/ip/route.ts)**: IP Auto-Detection API that resolves the computer's Wi-Fi or Ethernet local network address.

### User & Admin Screens
- **[`page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/page.tsx)**: Dashboard home screen showing active tournaments, live scores, upcoming matches, leaderboards (Top Scorers, Wicket Takers, Raiders), and sponsor banners.
- **[`matches/[id]/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/page.tsx)**: Multi-sport live scoreboard showing ball-by-ball narratives, innings summaries, partnership lines, kabaddi score counts, and OBS graphics shortcuts.
- **[`tournaments/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/tournaments/page.tsx)**: Lists active tournaments.
- **[`tournaments/[id]/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/tournaments/[id]/page.tsx)**: Displays Standings Points Table (with auto-rank sorting and NRR calculation) and match fixtures.
- **[`auction/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/auction/page.tsx)**: Live bidding arena showing player profile cards, live bidding status, and franchise purses.
- **[`admin/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/admin/page.tsx)**: Admin Dashboard protected by administrative passphrase (`admin123`). Now integrates the Camera Connect panel with server IP auto-detection.
- **[`admin/score/[id]/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/admin/score/[id]/page.tsx)**: Dual-mode live scorer console (runs, extras, wickets, undo, kabaddi touch/bonus, tackle, all-outs, and active timer play/pause buttons).
- **[`overlay/[id]/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/overlay/[id]/page.tsx)**: Stream overlay lower-third graphic with transparent background and green-screen mode toggler.
- **[`cam/capture/[token]/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/cam/capture/[token]/page.tsx)**: Mobile camera capture page with controls for camera flipping, mic muting, and connection status reporting.
- **[`matches/[id]/kabaddi/broadcast/page.tsx`](file:///C:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/kabaddi/broadcast/page.tsx)**: TV Broadcast Scoreboard screen featuring 1920x1080 graphic layout, neon team borders, lion/bull mascots, and real-time synchronized indicators.

---

## 2. Verification & Validation Checks

### Build Status
- Ran `npm run build` using Next.js 16 (Turbopack) and TypeScript.
- **Result**: `✓ Compiled successfully`. TypeScript type checking passed without warnings. Static page pre-generation complete.
- **Client Hydration Resolution**: Resolved a client-side deoptimization and page load hydration crash ("blank screen/not visible") in Next.js 16/15 by wrapping all client components reading parameters using `useSearchParams()` (specifically the Broadcast Scoreboard at `/matches/[id]/kabaddi` and the Mobile Camera Capture page at `/cam/capture/[token]`) inside a `<Suspense>` boundary. This ensures that static compilation and dynamic browser hydration complete successfully without throwing runtime errors.

### Real-Time Update Model
- All client pages implement auto-polling intervals (`4000ms` for dashboard, `4000ms` for scoreboards, `3000ms` for auction hub, `2000ms` for OBS overlays, and `1500ms` for WebRTC signallers) querying backend API endpoints. This triggers instantaneous page transitions without forcing browser refreshes.

---

## 3. Guide to Running the QR Camera Connect System

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```
2. **Open Admin Console**: Go to `http://localhost:3000/admin` (passphrase: `admin123`).
3. **Select 'Camera Connect' Tab**: 
   - Note the **WebRTC Server Configuration** panel.
   - The server **automatically detects your computer's local Wi-Fi IP address** and populates the Base URL (e.g., `http://10.20.185.229:3000`), meaning QR codes are pre-configured to be network-accessible right out-of-the-box!
4. **Scan QR Code**: Scan the QR code of **Ground Cam**, **Commentary Cam**, or **Boundary Cam** using your phone.
5. **Stream Live**: Open the URL on your mobile browser, grant camera/microphone permissions, and select Front/Back camera. The connection status indicator on your phone will change to **LIVE**, and your live camera stream will display instantly in the admin console dashboard with sub-second latency!
6. **Stability Notes**: We added an ICE Candidate Buffer and try-catch error safety blocks around RTCPeerConnection candidate feeding. If candidates are retrieved before the remote SDP description is completely set, they are safely queued and drained immediately upon SDP transition, preventing WebRTC DOMExceptions and disconnection loops.
7. **Console Error Cleanup (200 OK instead of 404)**: The signaling API now returns `200 OK` with a `sessionNotFound: true` flag instead of a `404 Not Found` when a camera session has not registered yet. This prevents red HTTP 404 network errors from flooding your browser console.
8. **Interactive Diagnostics & Log Console**: Added collapsible Diagnostic panels and live scrolling consoles with detailed timestamps to both mobile and admin console pages to make connection monitoring fully transparent.
9. **Peer Connection Recycling**: The receiver now actively closes and resets old peer connections when a new offer is received, allowing seamless camera-swap and reconnect capability.

---

## 4. Guide to Running the TV Broadcast Scoreboard

We separated the **Score Scorer Controller** and the **TV Broadcast Scoreboard** into two distinct modes to match professional tournament setups (projectors, LED walls, or YouTube OBS streaming), and both feature transparent data overlays aligned precisely over the design areas of the new background image:

1. **Admin/Scorer Console (`/matches/[id]/kabaddi`)**:
   - Acts as the controller. Keep it open on a secondary operator screen.
   - Displays all scoreboard parameters (names, scores, raid countdowns, match timers, and active do-or-die/super tackle indicators) positioned as transparent overlays directly over the corresponding left/right panels and center graphics built into the stadium background.
   - Includes the bottom controls toolbar and side settings panel to operate points, timers, halves, and team settings.
   
2. **TV Broadcast Screen (`/matches/[id]/kabaddi/broadcast`)**:
   - Opens a pure graphics scoreboard. Project this view on the stadium LED wall or add it as a browser source inside OBS.
   - Has absolutely **no buttons, controls, or scrollbars** (fully clean 1920x1080 cinematic overlay mode).
   - Positions Team A Name, Team B Name, Team A Score, Team B Score, Raid Timer, Match Timer, Do Or Die, and Super Tackle overlays perfectly matching the positions of the background image's left blue card, right red card, center VS emblem, and top/bottom arenas.
   - Automatically plays synchronized audio alert beeps (ticks, warnings, buzzer) depending on the raid time countdown status.
   - **How it syncs**: Polls the server match details at a high-speed `1500ms` interval, initiating smooth local intervals for both the Match Clock and Raid Clock when their running states change in the database.

---

## 5. Guide to Running the QR-Based Mobile Score Controller

We added a secure, touch-optimized **Mobile Score Controller** to allow scorers to control points and timers directly from their mobile phones.

1. **Access the Scorer QR Code**:
   - Open the Scorer/Admin Console on the laptop at `http://localhost:3000/matches/[id]/kabaddi`.
   - Click the **"Mobile Scorer QR"** button in the bottom toolbar. A modal displays with a unique QR code pointing to:
     `http://[localIp]:3000/matches/[id]/kabaddi/control?token=[controlToken]`
   
2. **Open the Controller on Mobile**:
   - Scan the QR code using a smartphone connected to the same local network.
   - The Mobile Score Controller will load showing large, touch-friendly scoring grids for both teams, match/raid timers, and play/pause/reset buttons.

3. **Secure Token Authorization**:
   - The scoreboard API validates the `token` parameter. Unauthenticated attempts without a token return `401 Unauthorized` and block access.
   - If the match status is changed to `completed` in the database, the token automatically expires, and all future scoring requests return `403 Forbidden` with a "Match has ended" error message.

4. **Scoring Syncing**:
    - The mobile client polls the server every `2000ms` to sync current scoreboard counts, raid states, and timers.
    - Points changes (+1 Touch, +1 Bonus, +1 Tackle, +2 Super Tackle, +2 All Out, +1 Technical), undo commands, match clock toggles, and raid timer controls update instantly and reflect on the laptop dashboard and the TV Broadcast screen within 1–2 seconds.

---

## 6. Guide to Supabase Integration

We integrated the Kabaddi Scoreboard with Supabase to provide persistent, cloud-based match scoring data, replacing the need for local-only state updates.

### 1. Database Client Initialization
- **[`supabase.ts`](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/lib/supabase.ts)**: Configures and initializes the `@supabase/supabase-js` client SDK using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables.
- Includes a configuration check flag `isSupabaseConfigured` to detect when credentials are empty and fallback safely.

### 2. Relational Mapping & Storage
- **[`db.ts`](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/lib/db.ts)**: Modified the database layer to automatically run mappers (`mapToDb`/`mapFromDb`) that translate camelCase application objects into snake_case database rows.
- Saves team information, scores, timers, logs, and action history inside `jsonb` fields (`team_a`, `team_b`, `kabaddi_state`, `kabaddi_actions`, etc.), allowing high-performance updates.

### 3. Realtime Updates Subscription
- Subscribed client-side screens (**Admin Console**, **TV Broadcast Screen**, and **Mobile Scorer Controller**) to Supabase Realtime changes for the active `matchId` via PostgreSQL change notifications (`postgres_changes` listener).
- When any scoring console update or mobile action occurs, it is saved instantly to Supabase. This fires a database change notification that immediately triggers the receiver clients to hot-reload `loadMatchData()` with zero polling delay.
- The default HTTP polling rate has been lowered to a slow safety fallback of 15 seconds when Supabase is configured, drastically reducing API request traffic.

### 4. Graceful Fallback
- If the credentials are not set in `.env.local`, the server prints a warning message and falls back to reading/writing to the local JSON database (`data/local_db.json`), using standard HTTP polling (1.5s - 4s) ensuring development environments continue running without configuration errors.


---

## 7. Supabase Realtime & Sync Fix (June 2026 Updates)

To solve the issue where score changes were not reflecting or saving ("no changes always showing"), we implemented a comprehensive database synchronization and realtime subscription update:

### 1. On-Demand Database Syncing
- **[`db.ts`](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/lib/db.ts)**: Added `supabaseId?: string` to the `Match` interface, which maps and exposes the database UUID (`dbMatch.id`) to the client.
- Implemented an async helper `syncLocalToSupabase()` that scans the local JSON database for missing records and seeds them into Supabase. This runs automatically inside `db.matches.find()`.
- Updated `db.matches.findById()` and `db.matches.update()` to automatically detect when a record is missing on Supabase (catching Postgrest error code `PGRST116`). If missing, it immediately syncs the full local JSON match to Supabase as an insertion. This ensures the row is guaranteed to exist before any score modifications are made.

### 2. Table-wide Realtime Subscriptions with Local JS Filtering
- **Realtime Listener Updates**: Because the database column `id` is a PostgreSQL `uuid` containing a deterministically hashed UUID, while the client pages use string-based IDs (like `m-1781785948696`), the previous realtime subscription filters (`filter: id=eq.${matchId}`) failed to match.
- Modified all 5 client pages to subscribe to all updates on the `matches` table and filter updates locally in JavaScript:
  - **[Mobile Scorer Controller](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/kabaddi/control/page.tsx)**
  - **[TV Broadcast Screen](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/kabaddi/broadcast/page.tsx)**
  - **[Admin Console](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/kabaddi/page.tsx)**
  - **[OBS Overlay](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/overlay/[id]/page.tsx)**
  - **[Match Details Page](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/page.tsx)**
- The event handlers now check if the event's `originalId` (stored inside `kabaddi_state` or `cricket_state`) matches the current URL ID, or if the update's UUID matches `match.supabaseId`. This bypasses the schema mismatch and restores sub-second realtime synchronization.

---

## 8. Mobile Controller Scoring Fix, Custom Timers & Fullscreen Esports Animations (Latest Updates)

We implemented critical bug fixes and stunning visual animations to match the user's latest requests:

### 1. Mobile Score Bug Resolution
- **Issue**: Clicking red or blue scoring buttons sometimes added score to the blue team instead of the clicked team, and undoing scoring events reconstructed all scores under Team B (Red). This occurred because the `team_a`/`team_b` columns returned from Supabase are strings in certain environments, causing `match.teamA.id` to evaluate as `undefined` (and thus `undefined === undefined` was true, routing all scoring to one side).
- **Resolution**: 
  - Modified `mapFromDb` in **[`db.ts`](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/lib/db.ts)** to automatically check and parse stringified JSON columns (`team_a`, `team_b`, `kabaddi_state`, `cricket_state`, `kabaddi_actions`, `ball_by_ball`) into native objects at the source. This ensures clean objects are returned by both the REST API and database wrappers.
  - Safely parsed `match.teamA` inside the `kabaddi_undo` API handler in **[`route.ts`](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/api/matches/[id]/route.ts)** to resolve the parsed `teamAId` for safe score reconstructions.
  - Handled fallback parameters on type declarations in the client state.

### 2. Custom Half Timers
- **First Half & Second Half Timing**: Fully enabled the custom half timers configuration panel. Scorers can now input first-half duration and second-half duration inside the Match Edit configuration panel.
- **Clock Auto-Reset**: When the period is switched (e.g. from 1st Half to 2nd Half), the match timer automatically pauses and resets the clock to the custom duration configured for the active half.

### 3. Fullscreen Esports Event Animations
- **High-Impact Overlays**: Built animated fullscreen overlay graphic cards in **[TV Broadcast Screen](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/kabaddi/broadcast/page.tsx)** and **[Admin Console](file:///c:/Users/keert/OneDrive/Desktop/kabaddi/src/app/matches/[id]/kabaddi/page.tsx)**.
- **Event Triggers**:
  - **🔥 DO OR DIE**: Triggered when the Do Or Die state changes to active. Pulses in neon warning red warning stripes with Kannada and English overlay texts.
  - **🛡️ SUPER TACKLE**: Triggered when a Super Tackle starts. Glows in shield ice blue with shield patterns.
  - **⚡ SUPER RAID**: Triggered when a raider secures 3 or more points in a single raid. Fires a golden stroboscopic strobe rotation animation with scale-in-out effects.
- **Duration**: Overlays automatically clear after 4-5 seconds via React hooks, providing clean broadcast overlays without requiring operator manual clearing.


## 9. Kabaddi Raid Audio System (Latest Updates)

We have successfully integrated a fully synchronized, high-fidelity **Kabaddi Raid Audio System** that enhances the live match experience with automatic background theme songs, beeps, and buzzer alerts.

### 🌟 Key Features & Requirements Met
1. **Automatic Audio Playback**: Plays the Pro Kabaddi 30-second raid song automatically when a raid is started.
2. **Synchronized Playback State**: Play, Pause, and Reset commands from the Mobile Controller synchronize the audio playback state (`playing`, `paused`, `stopped`) in real-time to the TV Broadcast, Laptop Admin, and OBS Overlay screens via Supabase.
3. **Audio-Timer Synchronization**: Audio position (`currentTime`) is mathematically synced to the remaining raid time (`30 - raidTime`), preventing drift between the timer and song.
4. **Volume Control Panel**: Added localized volume control selectors (**Mute**, **Low**, **Medium**, **High**) to the Laptop Admin Console and TV Broadcast/OBS Screens, saved dynamically in `localStorage`.
5. **Fail-safe Audio Loading**: Uses the HTML5 Audio API to load the MP3 from Supabase Storage. If the audio fails to load or is blocked by browser autoplay permissions, the raid countdown timer continues normally without interruption.
6. **Local Synthesized Buzzer & Beeps**: A high-impact buzzer sound is synthesized locally using the browser's Web Audio API. Warning alerts beep when less than 5 seconds remain. The buzzer plays reliably using a React `useEffect` hook monitoring `raidTime === 0`, ensuring exactly one clean buzzer execution across clients.
7. **No Dual-Audio/Chanting Clutter**: Completely removed the experimental AI text-to-speech chanting loop ("kabaddi kabaddi...") to avoid interference with the premium 30-second raid song audio stream.
8. **Raid Clock Sync Correction**: Added periodic server database synchronization (every 5 seconds) to the Mobile Controller's local countdown interval. This ensures that the server match details stay updated during a raid even if only the Mobile Controller is open, preventing the timer from resetting or jumping back to 30 seconds during slow-polling events.
9. **Automatic 30-Second Raid Reset**: When the raid clock countdown completes (reaches 0), it automatically triggers the buzzer, pauses, and then resets the countdown to 30 seconds after a 1.5-second delay, so the next raid is immediately ready.
10. **Mobile Audio Disabled**: Removed all HTML5 Audio and Web Audio synthesizer elements from the Mobile Controller interface to prevent loud audio or buzzer interference at the scorer's table.

