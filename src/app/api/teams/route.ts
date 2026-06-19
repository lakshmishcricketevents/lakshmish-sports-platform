import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const list = await db.teams.find();
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, logo, playerIds, captainId, viceCaptainId, purse } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newTeam = await db.teams.create({
      name,
      logo: logo || 'https://img.icons8.com/color/120/shield.png',
      players: playerIds || [],
      captainId: captainId || undefined,
      viceCaptainId: viceCaptainId || undefined,
      purse: purse !== undefined ? Number(purse) : 1500, // 15 Crore default
      stats: {
        matchesPlayed: 0,
        won: 0,
        lost: 0,
        tied: 0,
        points: 0
      }
    });

    return NextResponse.json(newTeam);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    await db.teams.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const body = await req.json();
    const targetId = id || body.id;
    if (!targetId) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }
    const updated = await db.teams.update(targetId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

