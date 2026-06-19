import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const list = await db.players.find();
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, ...data } = body;

    // Support updating existing player if ID is supplied
    if (id) {
      const updated = await db.players.update(id, data);
      if (!updated) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    const { name, photo, role, battingStyle, bowlingStyle, auctionBaseValue } = data;
    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });
    }

    const newPlayer = await db.players.create({
      name,
      photo: photo || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      role,
      battingStyle: battingStyle || undefined,
      bowlingStyle: bowlingStyle || undefined,
      auctionBaseValue: auctionBaseValue ? Number(auctionBaseValue) : 100,
      mvpPoints: 0,
      stats: {
        cricket: role.includes('Raider') || role.includes('Defender') ? undefined : { runs: 0, wickets: 0, matches: 0, strikeRate: 0, economy: 0 },
        kabaddi: role.includes('Raider') || role.includes('Defender') ? { raidPoints: 0, tacklePoints: 0, matches: 0, superRaids: 0, superTackles: 0 } : undefined
      }
    });

    return NextResponse.json(newPlayer);
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
    await db.players.delete(id);
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
    const updated = await db.players.update(targetId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

