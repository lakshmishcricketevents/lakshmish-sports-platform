import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const list = await db.matches.find();
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tournamentId, sport, teamAId, teamBId, date } = body;

    const tournaments = await db.tournaments.find();
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const teams = await db.teams.find();
    const teamA = teams.find(t => t.id === teamAId);
    const teamB = teams.find(t => t.id === teamBId);

    if (!teamA || !teamB) {
      return NextResponse.json({ error: 'One or both teams not found' }, { status: 404 });
    }

    const newMatchData: any = {
      tournamentId,
      sport,
      teamA: { id: teamA.id, name: teamA.name, logo: teamA.logo },
      teamB: { id: teamB.id, name: teamB.name, logo: teamB.logo },
      status: 'upcoming',
      date: date || new Date().toISOString().split('T')[0]
    };

    if (sport === 'cricket') {
      newMatchData.cricketState = {
        innings: 1,
        battingTeamId: teamA.id,
        bowlingTeamId: teamB.id,
        runs: 0,
        wickets: 0,
        overs: 0,
        balls: 0,
        batsmenStats: [],
        bowlerStats: [],
        partnership: { runs: 0, balls: 0, batterA: '', batterB: '' },
        fallOfWickets: []
      };
      newMatchData.ballByBall = [];
    } else {
      newMatchData.kabaddiState = {
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
        timeRemaining: 2400, // 40 minutes default
        half: 1,
        timerRunning: false
      };
      newMatchData.kabaddiActions = [];
    }

    const newMatch = await db.matches.create(newMatchData);

    // Add match to tournament fixtures list
    const updatedFixtures = [...tournament.fixtures, newMatch.id];
    await db.tournaments.update(tournamentId, { fixtures: updatedFixtures });

    return NextResponse.json(newMatch);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
