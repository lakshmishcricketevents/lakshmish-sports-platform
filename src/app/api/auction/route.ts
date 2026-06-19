import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const state = await db.auction.get();
    
    // Enrich player details if set
    let enrichedPlayer = null;
    if (state.currentBidPlayerId) {
      enrichedPlayer = await db.players.findById(state.currentBidPlayerId);
    }

    return NextResponse.json({ ...state, player: enrichedPlayer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;
    const state = await db.auction.get();

    if (action === 'set_player') {
      const { playerId } = payload;
      const player = await db.players.findById(playerId);
      if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      const updated = await db.auction.update({
        currentBidPlayerId: playerId,
        currentHighestBid: player.auctionBaseValue,
        currentHighestBidTeamId: null,
        status: 'bidding',
        bids: []
      });
      return NextResponse.json(updated);
    }

    if (action === 'place_bid') {
      const { teamId, bidAmount } = payload;
      if (state.status !== 'bidding') {
        return NextResponse.json({ error: 'Auction is not in bidding state' }, { status: 400 });
      }

      const team = await db.teams.findById(teamId);
      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      if (team.purse < bidAmount) {
        return NextResponse.json({ error: 'Insufficient team purse budget' }, { status: 400 });
      }

      if (bidAmount <= state.currentHighestBid) {
        return NextResponse.json({ error: 'Bid must be higher than current bid' }, { status: 400 });
      }

      // Add to bids history log
      const bids = [...state.bids, {
        teamId,
        teamName: team.name,
        bidAmount,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }];

      const updated = await db.auction.update({
        currentHighestBid: bidAmount,
        currentHighestBidTeamId: teamId,
        bids
      });

      return NextResponse.json(updated);
    }

    if (action === 'mark_sold') {
      if (!state.currentBidPlayerId) {
        return NextResponse.json({ error: 'No player active' }, { status: 400 });
      }
      if (!state.currentHighestBidTeamId) {
        return NextResponse.json({ error: 'No active bid to sell player' }, { status: 400 });
      }

      const player = await db.players.findById(state.currentBidPlayerId);
      const team = await db.teams.findById(state.currentHighestBidTeamId);

      if (!player || !team) {
        return NextResponse.json({ error: 'Player or Team not found' }, { status: 404 });
      }

      // Update Player as Sold
      await db.players.update(player.id, {
        soldValue: state.currentHighestBid,
        soldToTeamId: team.id
      });

      // Deduct from Team Purse and Add to Squad
      const updatedSquad = [...team.players, player.id];
      const updatedPurse = team.purse - state.currentHighestBid;
      await db.teams.update(team.id, {
        players: updatedSquad,
        purse: updatedPurse
      });

      // Update Auction State
      const updated = await db.auction.update({
        status: 'sold'
      });

      return NextResponse.json({ success: true, state: updated });
    }

    if (action === 'mark_unsold') {
      if (!state.currentBidPlayerId) {
        return NextResponse.json({ error: 'No player active' }, { status: 400 });
      }

      // Update Player
      await db.players.update(state.currentBidPlayerId, {
        soldValue: undefined,
        soldToTeamId: undefined
      });

      // Update Auction State
      const updated = await db.auction.update({
        status: 'unsold'
      });

      return NextResponse.json({ success: true, state: updated });
    }

    if (action === 'reset') {
      const updated = await db.auction.update({
        currentBidPlayerId: null,
        currentHighestBid: 0,
        currentHighestBidTeamId: null,
        status: 'idle',
        bids: []
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
