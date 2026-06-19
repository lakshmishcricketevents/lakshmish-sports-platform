import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase, isSupabaseConfigured } from './supabase';


// Define TS Interfaces
export interface Tournament {
  id: string;
  name: string;
  logo: string;
  sport: 'cricket' | 'kabaddi';
  rules: string;
  status: 'upcoming' | 'active' | 'completed';
  teams: string[];
  fixtures: string[]; // Match IDs
  pointsTable: Array<{
    teamId: string;
    teamName: string;
    logo: string;
    played: number;
    won: number;
    lost: number;
    tied: number;
    points: number;
    netRunRate?: number; // Cricket
    scoreDiff?: number; // Kabaddi
  }>;
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  players: string[]; // Player IDs
  captainId?: string;
  viceCaptainId?: string;
  purse: number; // For Auction
  stats: {
    matchesPlayed: number;
    won: number;
    lost: number;
    tied: number;
    points: number;
  };
}

export interface Player {
  id: string;
  name: string;
  photo: string;
  role: 'Batsman' | 'Bowler' | 'All-Rounder' | 'Wicketkeeper' | 'Raider' | 'Defender' | 'All-Rounder (Kabaddi)';
  battingStyle?: string;
  bowlingStyle?: string;
  auctionBaseValue: number;
  soldValue?: number;
  soldToTeamId?: string;
  mvpPoints: number;
  stats: {
    cricket?: {
      runs: number;
      wickets: number;
      matches: number;
      strikeRate: number;
      economy: number;
    };
    kabaddi?: {
      raidPoints: number;
      tacklePoints: number;
      matches: number;
      superRaids: number;
      superTackles: number;
    };
  };
}

export interface CricketState {
  innings: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number; // Current over ball index (0-5)
  strikerId?: string;
  nonStrikerId?: string;
  currentBowlerId?: string;
  batsmenStats: Array<{
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    out: boolean;
    howOut?: string;
  }>;
  bowlerStats: Array<{
    playerId: string;
    name: string;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
  }>;
  targetRuns?: number;
  partnership: {
    runs: number;
    balls: number;
    batterA: string;
    batterB: string;
  };
  fallOfWickets: Array<{
    score: number;
    wickets: number;
    overs: number;
    balls: number;
    batsmanName: string;
  }>;
}

export interface KabaddiState {
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
  timeRemaining: number; // In seconds (e.g. 2400 for 40 minutes)
  half: 1 | 2;
  timerRunning: boolean;
  activeRaiderId?: string;
  raidTime?: number;
  raidTimerRunning?: boolean;
  doOrDie?: boolean;
  superTackle?: boolean;
  raidAudioPlayState?: 'playing' | 'paused' | 'stopped';
}

export interface Match {
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
  cricketState?: CricketState;
  kabaddiState?: KabaddiState;
  ballByBall?: Array<{
    overNum: number;
    ballNum: number;
    bowlerName: string;
    batsmanName: string;
    runs: number;
    extraType?: 'wide' | 'noball' | 'legbye' | 'bye' | 'none';
    wicket?: {
      type: string;
      batsmanName: string;
    };
    description: string;
  }>;
  kabaddiActions?: Array<{
    timestamp: string;
    timeRemaining: number;
    type: 'raid_success' | 'raid_empty' | 'raid_tackled' | 'super_raid' | 'super_tackle' | 'all_out' | 'bonus' | 'technical';
    teamId: string;
    points: number;
    description: string;
  }>;
}

export interface AuctionState {
  currentBidPlayerId?: string | null;
  currentHighestBid: number;
  currentHighestBidTeamId?: string | null;
  status: 'idle' | 'bidding' | 'sold' | 'unsold';
  bids: Array<{
    teamId: string;
    teamName: string;
    bidAmount: number;
    timestamp: string;
  }>;
}

export interface Sponsor {
  id: string;
  name: string;
  logo: string;
  link: string;
}

interface DatabaseSchema {
  tournaments: Tournament[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  auction: AuctionState;
  sponsors: Sponsor[];
}

const LOCAL_DB_PATH = path.join(process.cwd(), 'data', 'local_db.json');

// Seed helper
function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function getInitialData(): DatabaseSchema {
  const initialPlayers: Player[] = [
    // Cricket Players
    {
      id: 'p1',
      name: 'Virat Kohli',
      photo: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=150&h=150&fit=crop',
      role: 'Batsman',
      auctionBaseValue: 200,
      soldValue: 0,
      mvpPoints: 850,
      stats: {
        cricket: { runs: 12500, wickets: 4, matches: 280, strikeRate: 138.5, economy: 6.2 }
      }
    },
    {
      id: 'p2',
      name: 'Jasprit Bumrah',
      photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      role: 'Bowler',
      auctionBaseValue: 200,
      soldValue: 0,
      mvpPoints: 920,
      stats: {
        cricket: { runs: 300, wickets: 350, matches: 160, strikeRate: 22.1, economy: 4.8 }
      }
    },
    {
      id: 'p3',
      name: 'Hardik Pandya',
      photo: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop',
      role: 'All-Rounder',
      auctionBaseValue: 150,
      soldValue: 0,
      mvpPoints: 780,
      stats: {
        cricket: { runs: 3400, wickets: 120, matches: 140, strikeRate: 142.0, economy: 7.9 }
      }
    },
    {
      id: 'p4',
      name: 'Rishabh Pant',
      photo: 'https://images.unsplash.com/photo-1527983359383-4758693f760c?w=150&h=150&fit=crop',
      role: 'Wicketkeeper',
      auctionBaseValue: 150,
      soldValue: 0,
      mvpPoints: 690,
      stats: {
        cricket: { runs: 2800, wickets: 0, matches: 98, strikeRate: 145.2, economy: 0 }
      }
    },
    {
      id: 'p5',
      name: 'Rohit Sharma',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
      role: 'Batsman',
      auctionBaseValue: 200,
      soldValue: 0,
      mvpPoints: 810,
      stats: {
        cricket: { runs: 10800, wickets: 8, matches: 260, strikeRate: 139.8, economy: 7.1 }
      }
    },
    {
      id: 'p6',
      name: 'Rashid Khan',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
      role: 'Bowler',
      auctionBaseValue: 180,
      soldValue: 0,
      mvpPoints: 890,
      stats: {
        cricket: { runs: 800, wickets: 280, matches: 150, strikeRate: 135.0, economy: 6.4 }
      }
    },
    // Kabaddi Players
    {
      id: 'p7',
      name: 'Pawan Sehrawat',
      photo: 'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=150&h=150&fit=crop',
      role: 'Raider',
      auctionBaseValue: 120,
      soldValue: 0,
      mvpPoints: 950,
      stats: {
        kabaddi: { raidPoints: 1050, tacklePoints: 40, matches: 110, superRaids: 32, superTackles: 2 }
      }
    },
    {
      id: 'p8',
      name: 'Fazel Atrachali',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
      role: 'Defender',
      auctionBaseValue: 100,
      soldValue: 0,
      mvpPoints: 890,
      stats: {
        kabaddi: { raidPoints: 0, tacklePoints: 420, matches: 130, superRaids: 0, superTackles: 28 }
      }
    },
    {
      id: 'p9',
      name: 'Naveen Kumar',
      photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop',
      role: 'Raider',
      auctionBaseValue: 120,
      soldValue: 0,
      mvpPoints: 920,
      stats: {
        kabaddi: { raidPoints: 910, tacklePoints: 12, matches: 85, superRaids: 24, superTackles: 0 }
      }
    }
  ];

  const initialTeams: Team[] = [
    {
      id: 't1',
      name: 'Bengaluru Royals',
      logo: 'https://img.icons8.com/color/120/shield.png',
      players: ['p1', 'p3'],
      captainId: 'p1',
      viceCaptainId: 'p3',
      purse: 1500, // 15 Crore / Lakhs
      stats: { matchesPlayed: 10, won: 7, lost: 3, tied: 0, points: 14 }
    },
    {
      id: 't2',
      name: 'Mumbai Spartans',
      logo: 'https://img.icons8.com/color/120/viking-helmet.png',
      players: ['p2', 'p5'],
      captainId: 'p5',
      viceCaptainId: 'p2',
      purse: 1500,
      stats: { matchesPlayed: 10, won: 6, lost: 4, tied: 0, points: 12 }
    },
    {
      id: 't3',
      name: 'Delhi Titans',
      logo: 'https://img.icons8.com/color/120/sword.png',
      players: ['p4', 'p6'],
      captainId: 'p4',
      viceCaptainId: 'p6',
      purse: 1500,
      stats: { matchesPlayed: 10, won: 4, lost: 6, tied: 0, points: 8 }
    },
    {
      id: 't4',
      name: 'Golden Warriors',
      logo: 'https://img.icons8.com/color/120/spartan-helmet.png',
      players: ['p7', 'p8', 'p9'],
      captainId: 'p7',
      viceCaptainId: 'p8',
      purse: 1200,
      stats: { matchesPlayed: 5, won: 4, lost: 1, tied: 0, points: 8 }
    }
  ];

  const initialTournaments: Tournament[] = [
    {
      id: 'tour-1',
      name: 'Lakshmish Gold League 2026',
      logo: 'https://img.icons8.com/color/120/gold-medal.png',
      sport: 'cricket',
      rules: '20 Overs T20 format, standard ICC rules. Professional neutral umpires.',
      status: 'active',
      teams: ['t1', 't2', 't3'],
      fixtures: ['m1', 'm2'],
      pointsTable: [
        { teamId: 't1', teamName: 'Bengaluru Royals', logo: 'https://img.icons8.com/color/120/shield.png', played: 1, won: 1, lost: 0, tied: 0, points: 2, netRunRate: 1.25 },
        { teamId: 't2', teamName: 'Mumbai Spartans', logo: 'https://img.icons8.com/color/120/viking-helmet.png', played: 1, won: 0, lost: 1, tied: 0, points: 0, netRunRate: -1.25 },
        { teamId: 't3', teamName: 'Delhi Titans', logo: 'https://img.icons8.com/color/120/sword.png', played: 0, won: 0, lost: 0, tied: 0, points: 0, netRunRate: 0 }
      ]
    },
    {
      id: 'tour-2',
      name: 'Lakshmish Pro Kabaddi League',
      logo: 'https://img.icons8.com/color/120/crown.png',
      sport: 'kabaddi',
      rules: '40 Minutes match (20-min halves). 7 active players on court.',
      status: 'active',
      teams: ['t4'],
      fixtures: ['m3'],
      pointsTable: [
        { teamId: 't4', teamName: 'Golden Warriors', logo: 'https://img.icons8.com/color/120/spartan-helmet.png', played: 1, won: 1, lost: 0, tied: 0, points: 5, scoreDiff: 15 }
      ]
    }
  ];

  const initialMatches: Match[] = [
    {
      id: 'm1',
      tournamentId: 'tour-1',
      sport: 'cricket',
      teamA: { id: 't1', name: 'Bengaluru Royals', logo: 'https://img.icons8.com/color/120/shield.png' },
      teamB: { id: 't2', name: 'Mumbai Spartans', logo: 'https://img.icons8.com/color/120/viking-helmet.png' },
      status: 'live',
      tossText: 'Bengaluru Royals won the toss and chose to bat first',
      date: '2026-06-18',
      cricketState: {
        innings: 1,
        battingTeamId: 't1',
        bowlingTeamId: 't2',
        runs: 142,
        wickets: 3,
        overs: 15,
        balls: 4,
        strikerId: 'p1',
        nonStrikerId: 'p3',
        currentBowlerId: 'p2',
        batsmenStats: [
          { playerId: 'p1', name: 'Virat Kohli', runs: 72, balls: 45, fours: 6, sixes: 3, out: false },
          { playerId: 'p3', name: 'Hardik Pandya', runs: 28, balls: 16, fours: 2, sixes: 2, out: false }
        ],
        bowlerStats: [
          { playerId: 'p2', name: 'Jasprit Bumrah', overs: 3.4, maidens: 0, runs: 24, wickets: 1 }
        ],
        partnership: { runs: 58, balls: 32, batterA: 'Virat Kohli', batterB: 'Hardik Pandya' },
        fallOfWickets: [
          { score: 40, wickets: 1, overs: 4, balls: 2, batsmanName: 'Rohit Sharma' },
          { score: 84, wickets: 2, overs: 9, balls: 5, batsmanName: 'Rishabh Pant' }
        ]
      },
      ballByBall: [
        { overNum: 15, ballNum: 1, bowlerName: 'Jasprit Bumrah', batsmanName: 'Virat Kohli', runs: 1, description: 'Bumrah to Kohli, 1 run, pushed to long-on.' },
        { overNum: 15, ballNum: 2, bowlerName: 'Jasprit Bumrah', batsmanName: 'Hardik Pandya', runs: 6, description: 'Bumrah to Pandya, SIX, smashed over deep mid-wicket!' },
        { overNum: 15, ballNum: 3, bowlerName: 'Jasprit Bumrah', batsmanName: 'Hardik Pandya', runs: 0, description: 'Bumrah to Pandya, no run, blockhole yorker.' },
        { overNum: 15, ballNum: 4, bowlerName: 'Jasprit Bumrah', batsmanName: 'Hardik Pandya', runs: 4, description: 'Bumrah to Pandya, FOUR, sliced behind point for boundary.' }
      ]
    },
    {
      id: 'm2',
      tournamentId: 'tour-1',
      sport: 'cricket',
      teamA: { id: 't2', name: 'Mumbai Spartans', logo: 'https://img.icons8.com/color/120/viking-helmet.png' },
      teamB: { id: 't3', name: 'Delhi Titans', logo: 'https://img.icons8.com/color/120/sword.png' },
      status: 'upcoming',
      date: '2026-06-20'
    },
    {
      id: 'm3',
      tournamentId: 'tour-2',
      sport: 'kabaddi',
      teamA: { id: 't4', name: 'Golden Warriors', logo: 'https://img.icons8.com/color/120/spartan-helmet.png' },
      teamB: { id: 't2', name: 'Mumbai Spartans', logo: 'https://img.icons8.com/color/120/viking-helmet.png' },
      status: 'live',
      tossText: 'Mumbai Spartans won the toss and chose court, Golden Warriors to raid first',
      date: '2026-06-18',
      kabaddiState: {
        scoreA: 28,
        scoreB: 22,
        raidPointsA: 18,
        tacklePointsA: 6,
        allOutPointsA: 4,
        extraPointsA: 0,
        raidPointsB: 14,
        tacklePointsB: 8,
        allOutPointsB: 0,
        extraPointsB: 0,
        timeRemaining: 920, // 15 mins 20 seconds remaining
        half: 2,
        timerRunning: true,
        activeRaiderId: 'p7'
      },
      kabaddiActions: [
        { timestamp: '10:45', timeRemaining: 1120, type: 'raid_success', teamId: 't4', points: 2, description: 'Pawan Sehrawat secures a brilliant 2-point touch raid!' },
        { timestamp: '12:10', timeRemaining: 1040, type: 'super_tackle', teamId: 't2', points: 2, description: 'Mumbai Spartans complete a Super Tackle on Pawan Sehrawat!' },
        { timestamp: '14:30', timeRemaining: 980, type: 'all_out', teamId: 't4', points: 4, description: 'Golden Warriors enforce an ALL OUT on Mumbai Spartans!' }
      ]
    }
  ];

  const initialSponsors: Sponsor[] = [
    { id: 's1', name: 'Dream11 Mock', logo: 'https://img.icons8.com/color/96/shield.png', link: '#' },
    { id: 's2', name: 'Tata IPL Mock', logo: 'https://img.icons8.com/color/96/trophy.png', link: '#' },
    { id: 's3', name: 'RedBull Esports', logo: 'https://img.icons8.com/color/96/bull.png', link: '#' }
  ];

  return {
    tournaments: initialTournaments,
    teams: initialTeams,
    players: initialPlayers,
    matches: initialMatches,
    auction: {
      currentBidPlayerId: null,
      currentHighestBid: 0,
      currentHighestBidTeamId: null,
      status: 'idle',
      bids: []
    },
    sponsors: initialSponsors
  };
}

// Memory database instance
let memoryDb: DatabaseSchema | null = null;

// Read helper
export function readDb(): DatabaseSchema {
  if (memoryDb) return memoryDb;
  
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const defaultData = getInitialData();
    ensureDirectoryExistence(LOCAL_DB_PATH);
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
    memoryDb = defaultData;
    return defaultData;
  }
  
  try {
    const rawData = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    memoryDb = JSON.parse(rawData);
    return memoryDb!;
  } catch (error) {
    console.error('Error reading JSON DB, using seed values:', error);
    memoryDb = getInitialData();
    return memoryDb;
  }
}

// Write helper
export function writeDb(data: DatabaseSchema) {
  memoryDb = data;
  if (isSupabaseConfigured) {
    // Skip filesystem write to prevent Next.js file-watcher compilation loops when using Supabase
    return;
  }
  try {
    ensureDirectoryExistence(LOCAL_DB_PATH);
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing JSON DB:', error);
  }
}

// Supabase Table Mapper Helpers & Deterministic UUID Conversion
function stringToUuid(str: string): string {
  if (!str) return str;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) return str;

  const hash = crypto.createHash('md5').update(str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-');
}

function mapToDb(match: Partial<Match>, originalId?: string): any {
  const dbMatch: any = {};
  const actualOriginalId = originalId || match.id;

  if (match.id !== undefined) dbMatch.id = stringToUuid(match.id);
  if (match.tournamentId !== undefined) dbMatch.tournament_id = match.tournamentId;
  if (match.sport !== undefined) dbMatch.sport = match.sport;

  let mappedKabaddiState = match.kabaddiState;
  if (mappedKabaddiState && actualOriginalId) {
    mappedKabaddiState = { ...mappedKabaddiState, originalId: actualOriginalId } as any;
  }

  let mappedCricketState = match.cricketState;
  if (mappedCricketState && actualOriginalId) {
    mappedCricketState = { ...mappedCricketState, originalId: actualOriginalId } as any;
  }

  if (match.teamA !== undefined) dbMatch.team_a = match.teamA;
  if (match.teamB !== undefined) dbMatch.team_b = match.teamB;
  if (match.status !== undefined) dbMatch.status = match.status;
  if (match.winnerId !== undefined) dbMatch.winner_id = match.winnerId;
  if (match.tossText !== undefined) dbMatch.toss_text = match.tossText;
  if (match.date !== undefined) dbMatch.date = match.date;
  if (match.controlToken !== undefined) dbMatch.control_token = match.controlToken;
  if (match.cricketState !== undefined) dbMatch.cricket_state = mappedCricketState;
  if (match.kabaddiState !== undefined) dbMatch.kabaddi_state = mappedKabaddiState;
  if (match.kabaddiActions !== undefined) dbMatch.kabaddi_actions = match.kabaddiActions;
  if (match.ballByBall !== undefined) dbMatch.ball_by_ball = match.ballByBall;
  return dbMatch;
}

function safeParse(val: any) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      console.error('Failed to parse JSON string:', val, e);
      return val;
    }
  }
  return val;
}

function mapFromDb(dbMatch: any, originalIdFallback?: string): Match {
  const parsedKabaddiState = safeParse(dbMatch.kabaddi_state);
  const parsedCricketState = safeParse(dbMatch.cricket_state);
  
  const originalId = 
    (parsedKabaddiState && (parsedKabaddiState as any).originalId) || 
    (parsedCricketState && (parsedCricketState as any).originalId) || 
    originalIdFallback || 
    dbMatch.id;

  return {
    id: originalId,
    supabaseId: dbMatch.id,
    tournamentId: dbMatch.tournament_id,
    sport: dbMatch.sport,
    teamA: safeParse(dbMatch.team_a),
    teamB: safeParse(dbMatch.team_b),
    status: dbMatch.status,
    winnerId: dbMatch.winner_id,
    tossText: dbMatch.toss_text,
    date: dbMatch.date,
    controlToken: dbMatch.control_token,
    cricketState: parsedCricketState,
    kabaddiState: parsedKabaddiState,
    kabaddiActions: safeParse(dbMatch.kabaddi_actions) || [],
    ballByBall: safeParse(dbMatch.ball_by_ball) || []
  };
}

// Mappers for newly synchronized tables
function mapTournamentToDb(tour: Partial<Tournament>): any {
  const dbTour: any = {};
  if (tour.id !== undefined) dbTour.id = tour.id;
  if (tour.name !== undefined) dbTour.name = tour.name;
  if (tour.logo !== undefined) dbTour.logo = tour.logo;
  if (tour.sport !== undefined) dbTour.sport = tour.sport;
  if (tour.rules !== undefined) dbTour.rules = tour.rules;
  if (tour.status !== undefined) dbTour.status = tour.status;
  if (tour.teams !== undefined) dbTour.teams = tour.teams;
  if (tour.fixtures !== undefined) dbTour.fixtures = tour.fixtures;
  if (tour.pointsTable !== undefined) dbTour.points_table = tour.pointsTable;
  return dbTour;
}

function mapTournamentFromDb(dbTour: any): Tournament {
  return {
    id: dbTour.id,
    name: dbTour.name,
    logo: dbTour.logo,
    sport: dbTour.sport,
    rules: dbTour.rules,
    status: dbTour.status,
    teams: safeParse(dbTour.teams) || [],
    fixtures: safeParse(dbTour.fixtures) || [],
    pointsTable: safeParse(dbTour.points_table) || []
  };
}

function mapTeamToDb(team: Partial<Team>): any {
  const dbTeam: any = {};
  if (team.id !== undefined) dbTeam.id = team.id;
  if (team.name !== undefined) dbTeam.name = team.name;
  if (team.logo !== undefined) dbTeam.logo = team.logo;
  if (team.players !== undefined) dbTeam.players = team.players;
  if (team.captainId !== undefined) dbTeam.captain_id = team.captainId;
  if (team.viceCaptainId !== undefined) dbTeam.vice_captain_id = team.viceCaptainId;
  if (team.purse !== undefined) dbTeam.purse = team.purse;
  if (team.stats !== undefined) dbTeam.stats = team.stats;
  return dbTeam;
}

function mapTeamFromDb(dbTeam: any): Team {
  return {
    id: dbTeam.id,
    name: dbTeam.name,
    logo: dbTeam.logo,
    players: safeParse(dbTeam.players) || [],
    captainId: dbTeam.captain_id,
    viceCaptainId: dbTeam.vice_captain_id,
    purse: dbTeam.purse || 1500,
    stats: safeParse(dbTeam.stats) || { matchesPlayed: 0, won: 0, lost: 0, tied: 0, points: 0 }
  };
}

function mapPlayerToDb(p: Partial<Player>): any {
  const dbP: any = {};
  if (p.id !== undefined) dbP.id = p.id;
  if (p.name !== undefined) dbP.name = p.name;
  if (p.photo !== undefined) dbP.photo = p.photo;
  if (p.role !== undefined) dbP.role = p.role;
  if (p.auctionBaseValue !== undefined) dbP.auction_base_value = p.auctionBaseValue;
  if (p.soldValue !== undefined) dbP.sold_value = p.soldValue;
  if (p.soldToTeamId !== undefined) dbP.sold_to_team_id = p.soldToTeamId;
  if (p.mvpPoints !== undefined) dbP.mvp_points = p.mvpPoints;
  if (p.stats !== undefined) dbP.stats = p.stats;
  return dbP;
}

function mapPlayerFromDb(dbP: any): Player {
  return {
    id: dbP.id,
    name: dbP.name,
    photo: dbP.photo,
    role: dbP.role as any,
    auctionBaseValue: dbP.auction_base_value || 100,
    soldValue: dbP.sold_value,
    soldToTeamId: dbP.sold_to_team_id,
    mvpPoints: dbP.mvp_points || 0,
    stats: safeParse(dbP.stats) || {}
  };
}

function mapSponsorToDb(s: Partial<Sponsor>): any {
  const dbS: any = {};
  if (s.id !== undefined) dbS.id = s.id;
  if (s.name !== undefined) dbS.name = s.name;
  if (s.logo !== undefined) dbS.logo = s.logo;
  if (s.link !== undefined) dbS.link = s.link;
  return dbS;
}

function mapSponsorFromDb(dbS: any): Sponsor {
  return {
    id: dbS.id,
    name: dbS.name,
    logo: dbS.logo,
    link: dbS.link || '#'
  };
}

async function syncAllLocalToSupabase() {
  if (!isSupabaseConfigured) return;
  const local = readDb();
  
  // 1. Sync tournaments
  try {
    if (local.tournaments.length > 0) {
      const { data: dbT, error: dbTError } = await supabase.from('tournaments').select('id');
      if (dbTError) throw dbTError;
      const dbIds = new Set(dbT?.map(t => t.id) || []);
      const toInsert = local.tournaments.filter(t => !dbIds.has(t.id)).map(t => mapTournamentToDb(t));
      if (toInsert.length > 0) {
        const { error: insError } = await supabase.from('tournaments').upsert(toInsert);
        if (insError) throw insError;
      }
    }
  } catch (err: any) {
    console.error('Error during Supabase sync for "tournaments" table (it may be missing or schema mismatch):', err.message || err);
  }
  
  // 2. Sync teams
  try {
    if (local.teams.length > 0) {
      const { data: dbTe, error: dbTeError } = await supabase.from('teams').select('id');
      if (dbTeError) throw dbTeError;
      const dbIds = new Set(dbTe?.map(t => t.id) || []);
      const toInsert = local.teams.filter(t => !dbIds.has(t.id)).map(t => mapTeamToDb(t));
      if (toInsert.length > 0) {
        const { error: insError } = await supabase.from('teams').upsert(toInsert);
        if (insError) throw insError;
      }
    }
  } catch (err: any) {
    console.error('Error during Supabase sync for "teams" table (it may be missing or schema mismatch):', err.message || err);
  }
  
  // 3. Sync players
  try {
    if (local.players.length > 0) {
      const { data: dbP, error: dbPError } = await supabase.from('players').select('id');
      if (dbPError) throw dbPError;
      const dbIds = new Set(dbP?.map(p => p.id) || []);
      const toInsert = local.players.filter(p => !dbIds.has(p.id)).map(p => mapPlayerToDb(p));
      if (toInsert.length > 0) {
        const { error: insError } = await supabase.from('players').upsert(toInsert);
        if (insError) throw insError;
      }
    }
  } catch (err: any) {
    console.error('Error during Supabase sync for "players" table (it may be missing or schema mismatch):', err.message || err);
  }

  // 4. Sync sponsors
  try {
    if (local.sponsors.length > 0) {
      const { data: dbS, error: dbSError } = await supabase.from('sponsors').select('id');
      if (dbSError) throw dbSError;
      const dbIds = new Set(dbS?.map(s => s.id) || []);
      const toInsert = local.sponsors.filter(s => !dbIds.has(s.id)).map(s => mapSponsorToDb(s));
      if (toInsert.length > 0) {
        const { error: insError } = await supabase.from('sponsors').upsert(toInsert);
        if (insError) throw insError;
      }
    }
  } catch (err: any) {
    console.error('Error during Supabase sync for "sponsors" table (it may be missing or schema mismatch):', err.message || err);
  }
  
  // 5. Sync matches
  try {
    if (local.matches.length > 0) {
      const { data: dbMatches, error: dbMatchesError } = await supabase.from('matches').select('id');
      if (dbMatchesError) throw dbMatchesError;
      const dbIds = new Set(dbMatches?.map(m => m.id) || []);
      const toInsert = [];
      for (const match of local.matches) {
        const dbId = stringToUuid(match.id);
        if (!dbIds.has(dbId)) {
          toInsert.push(mapToDb(match));
        }
      }
      if (toInsert.length > 0) {
        const { error: insError } = await supabase.from('matches').upsert(toInsert);
        if (insError) throw insError;
      }
    }
  } catch (err: any) {
    console.error('Error during Supabase sync for "matches" table (it may be missing or schema mismatch):', err.message || err);
  }
}

// Unified Database Helpers mirroring Mongoose models
export const db = {
  tournaments: {
    find: async () => {
      if (isSupabaseConfigured) {
        await syncAllLocalToSupabase();
        const { data, error } = await supabase.from('tournaments').select('*');
        if (data && !error) return data.map(t => mapTournamentFromDb(t));
      }
      return readDb().tournaments;
    },
    findById: async (id: string) => {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
        if (data && !error) return mapTournamentFromDb(data);
      }
      return readDb().tournaments.find(t => t.id === id) || null;
    },
    create: async (item: Omit<Tournament, 'id'>) => {
      const newItem: Tournament = { ...item, id: `tour-${Date.now()}` };
      if (isSupabaseConfigured) {
        const dbItem = mapTournamentToDb(newItem);
        const { data, error } = await supabase.from('tournaments').insert([dbItem]).select().single();
        if (data && !error) {
          return mapTournamentFromDb(data);
        }
      }
      const data = readDb();
      data.tournaments.push(newItem);
      writeDb(data);
      return newItem;
    },
    update: async (id: string, updates: Partial<Tournament>) => {
      if (isSupabaseConfigured) {
        const dbUpdates = mapTournamentToDb(updates);
        const { data, error } = await supabase.from('tournaments').update(dbUpdates).eq('id', id).select().single();
        if (data && !error) {
          return mapTournamentFromDb(data);
        }
      }
      const data = readDb();
      const idx = data.tournaments.findIndex(t => t.id === id);
      if (idx !== -1) {
        data.tournaments[idx] = { ...data.tournaments[idx], ...updates };
        writeDb(data);
        return data.tournaments[idx];
      }
      return null;
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured) {
        await supabase.from('tournaments').delete().eq('id', id);
      }
      const data = readDb();
      data.tournaments = data.tournaments.filter(t => t.id !== id);
      writeDb(data);
      return true;
    }
  },
  teams: {
    find: async () => {
      if (isSupabaseConfigured) {
        await syncAllLocalToSupabase();
        const { data, error } = await supabase.from('teams').select('*');
        if (data && !error) return data.map(t => mapTeamFromDb(t));
      }
      return readDb().teams;
    },
    findById: async (id: string) => {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('teams').select('*').eq('id', id).single();
        if (data && !error) return mapTeamFromDb(data);
      }
      return readDb().teams.find(t => t.id === id) || null;
    },
    create: async (item: Omit<Team, 'id'>) => {
      const newItem: Team = { ...item, id: `t-${Date.now()}` };
      if (isSupabaseConfigured) {
        const dbItem = mapTeamToDb(newItem);
        const { data, error } = await supabase.from('teams').insert([dbItem]).select().single();
        if (data && !error) {
          return mapTeamFromDb(data);
        }
      }
      const data = readDb();
      data.teams.push(newItem);
      writeDb(data);
      return newItem;
    },
    update: async (id: string, updates: Partial<Team>) => {
      if (isSupabaseConfigured) {
        const dbUpdates = mapTeamToDb(updates);
        const { data, error } = await supabase.from('teams').update(dbUpdates).eq('id', id).select().single();
        if (data && !error) {
          return mapTeamFromDb(data);
        }
      }
      const data = readDb();
      const idx = data.teams.findIndex(t => t.id === id);
      if (idx !== -1) {
        data.teams[idx] = { ...data.teams[idx], ...updates };
        writeDb(data);
        return data.teams[idx];
      }
      return null;
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured) {
        await supabase.from('teams').delete().eq('id', id);
      }
      const data = readDb();
      data.teams = data.teams.filter(t => t.id !== id);
      writeDb(data);
      return true;
    }
  },
  players: {
    find: async () => {
      if (isSupabaseConfigured) {
        await syncAllLocalToSupabase();
        const { data, error } = await supabase.from('players').select('*');
        if (data && !error) return data.map(p => mapPlayerFromDb(p));
      }
      return readDb().players;
    },
    findById: async (id: string) => {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('players').select('*').eq('id', id).single();
        if (data && !error) return mapPlayerFromDb(data);
      }
      return readDb().players.find(p => p.id === id) || null;
    },
    create: async (item: Omit<Player, 'id'>) => {
      const newItem: Player = { ...item, id: `p-${Date.now()}` };
      if (isSupabaseConfigured) {
        const dbItem = mapPlayerToDb(newItem);
        const { data, error } = await supabase.from('players').insert([dbItem]).select().single();
        if (data && !error) {
          return mapPlayerFromDb(data);
        }
      }
      const data = readDb();
      data.players.push(newItem);
      writeDb(data);
      return newItem;
    },
    update: async (id: string, updates: Partial<Player>) => {
      if (isSupabaseConfigured) {
        const dbUpdates = mapPlayerToDb(updates);
        const { data, error } = await supabase.from('players').update(dbUpdates).eq('id', id).select().single();
        if (data && !error) {
          return mapPlayerFromDb(data);
        }
      }
      const data = readDb();
      const idx = data.players.findIndex(p => p.id === id);
      if (idx !== -1) {
        data.players[idx] = { ...data.players[idx], ...updates };
        writeDb(data);
        return data.players[idx];
      }
      return null;
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured) {
        await supabase.from('players').delete().eq('id', id);
      }
      const data = readDb();
      data.players = data.players.filter(p => p.id !== id);
      writeDb(data);
      return true;
    }
  },
  matches: {
    find: async () => {
      if (isSupabaseConfigured) {
        await syncAllLocalToSupabase();
        const { data, error } = await supabase.from('matches').select('*');
        if (error) {
          console.error('Error fetching matches from Supabase:', error);
        } else if (data) {
          return data.map(dbMatch => mapFromDb(dbMatch));
        }
      }
      return readDb().matches;
    },
    findById: async (id: string) => {
      if (isSupabaseConfigured) {
        const dbId = stringToUuid(id);
        const { data, error } = await supabase.from('matches').select('*').eq('id', dbId).single();
        if (error) {
          console.error(`Error fetching match ${id} (dbId: ${dbId}) from Supabase:`, error);
          if (error.code === 'PGRST116') {
            const localMatch = readDb().matches.find(m => m.id === id);
            if (localMatch) {
              console.log(`Match ${id} exists in local DB but not Supabase. Auto-syncing to Supabase...`);
              const dbItem = mapToDb(localMatch);
              const { data: insertedData, error: insertError } = await supabase
                .from('matches')
                .insert([dbItem])
                .select()
                .single();
              if (insertError) {
                console.error(`Failed to auto-sync match ${id} to Supabase:`, insertError);
              } else if (insertedData) {
                console.log(`Successfully auto-synced match ${id} to Supabase.`);
                return mapFromDb(insertedData, id);
              }
            }
          }
        } else if (data) {
          return mapFromDb(data, id);
        }
      }
      return readDb().matches.find(m => m.id === id) || null;
    },
    create: async (item: Omit<Match, 'id'>) => {
      const newItem: Match = { ...item, id: `m-${Date.now()}` };
      if (isSupabaseConfigured) {
        const dbItem = mapToDb(newItem);
        const { data, error } = await supabase.from('matches').insert([dbItem]).select().single();
        if (error) {
          console.error('Error creating match in Supabase:', error);
        } else if (data) {
          return mapFromDb(data, newItem.id);
        }
      }
      const data = readDb();
      data.matches.push(newItem);
      writeDb(data);
      return newItem;
    },
    update: async (id: string, updates: Partial<Match>) => {
      if (isSupabaseConfigured) {
        const dbId = stringToUuid(id);
        const dbUpdates = mapToDb(updates, id);
        const { data, error } = await supabase.from('matches').update(dbUpdates).eq('id', dbId).select().single();
        if (error) {
          console.error(`Error updating match ${id} (dbId: ${dbId}) in Supabase:`, error);
          if (error.code === 'PGRST116') {
            const localData = readDb();
            const idx = localData.matches.findIndex(m => m.id === id);
            if (idx !== -1) {
              const mergedMatch = { ...localData.matches[idx], ...updates };
              console.log(`Match ${id} not found in Supabase during update. Auto-syncing merged match...`);
              const dbItem = mapToDb(mergedMatch);
              const { data: insertedData, error: insertError } = await supabase
                .from('matches')
                .insert([dbItem])
                .select()
                .single();
              if (insertError) {
                console.error(`Failed to auto-sync match ${id} to Supabase during update:`, insertError);
              } else if (insertedData) {
                console.log(`Successfully auto-synced and updated match ${id} in Supabase.`);
                localData.matches[idx] = mergedMatch;
                writeDb(localData);
                return mapFromDb(insertedData, id);
              }
            }
          }
        } else if (data) {
          const localData = readDb();
          const idx = localData.matches.findIndex(m => m.id === id);
          if (idx !== -1) {
            localData.matches[idx] = { ...localData.matches[idx], ...updates };
            writeDb(localData);
          }
          return mapFromDb(data, id);
        }
      }
      const data = readDb();
      const idx = data.matches.findIndex(m => m.id === id);
      if (idx !== -1) {
        data.matches[idx] = { ...data.matches[idx], ...updates };
        writeDb(data);
        return data.matches[idx];
      }
      return null;
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured) {
        const dbId = stringToUuid(id);
        await supabase.from('matches').delete().eq('id', dbId);
      }
      const data = readDb();
      data.matches = data.matches.filter(m => m.id !== id);
      writeDb(data);
      return true;
    }
  },
  auction: {
    get: async () => readDb().auction,
    update: async (updates: Partial<AuctionState>) => {
      const data = readDb();
      data.auction = { ...data.auction, ...updates };
      writeDb(data);
      return data.auction;
    }
  },
  sponsors: {
    find: async () => {
      if (isSupabaseConfigured) {
        await syncAllLocalToSupabase();
        const { data, error } = await supabase.from('sponsors').select('*');
        if (data && !error) return data.map(s => mapSponsorFromDb(s));
      }
      return readDb().sponsors;
    },
    create: async (item: Omit<Sponsor, 'id'>) => {
      const newItem: Sponsor = { ...item, id: `s-${Date.now()}` };
      if (isSupabaseConfigured) {
        const dbItem = mapSponsorToDb(newItem);
        const { data, error } = await supabase.from('sponsors').insert([dbItem]).select().single();
        if (data && !error) return mapSponsorFromDb(data);
      }
      const data = readDb();
      data.sponsors.push(newItem);
      writeDb(data);
      return newItem;
    },
    delete: async (id: string) => {
      if (isSupabaseConfigured) {
        await supabase.from('sponsors').delete().eq('id', id);
      }
      const data = readDb();
      data.sponsors = data.sponsors.filter(s => s.id !== id);
      writeDb(data);
      return true;
    }
  }
};
