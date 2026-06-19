import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const list = await db.tournaments.find();
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, logo, sport, rules, teamIds } = body;

    if (!name || !sport) {
      return NextResponse.json({ error: 'Name and sport are required' }, { status: 400 });
    }

    const allTeams = await db.teams.find();
    const selectedTeams = allTeams.filter(t => teamIds?.includes(t.id));

    // Prepare points table entries
    const pointsTable = selectedTeams.map(team => ({
      teamId: team.id,
      teamName: team.name,
      logo: team.logo,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      netRunRate: sport === 'cricket' ? 0 : undefined,
      scoreDiff: sport === 'kabaddi' ? 0 : undefined
    }));

    const newTournament = await db.tournaments.create({
      name,
      logo: logo || 'https://img.icons8.com/color/120/trophy.png',
      sport,
      rules: rules || 'Standard rules apply.',
      status: 'upcoming',
      teams: selectedTeams.map(t => t.id),
      fixtures: [],
      pointsTable
    });

    return NextResponse.json(newTournament);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
