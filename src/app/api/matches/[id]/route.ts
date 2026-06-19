import { NextRequest, NextResponse } from 'next/server';
import { db, CricketState, KabaddiState } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const match = await db.matches.findById(id);
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    
    // Auto-generate controlToken if not present
    if (!match.controlToken) {
      const controlToken = 'ctrl_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
      const updated = await db.matches.update(id, { controlToken });
      return NextResponse.json(updated);
    }
    
    return NextResponse.json(match);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const match = await db.matches.findById(id);

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const { action, payload } = body;

    // Verify token & status for Kabaddi matches
    const token = req.nextUrl.searchParams.get('token') || body.token || (payload && payload.token);
    
    if (match.sport === 'kabaddi') {
      if (match.status === 'completed') {
        return NextResponse.json({ error: 'Match has ended. Token expired.' }, { status: 403 });
      }
      
      if (match.controlToken && match.controlToken !== token) {
        return NextResponse.json({ error: 'Unauthorized score control. Invalid token.' }, { status: 401 });
      }
    }

    // Standard field updates (status, toss, winner)
    if (action === 'update_general') {
      const { tournamentName, ...matchUpdates } = payload;
      
      // Update tournament name if provided
      if (tournamentName && match.tournamentId) {
        await db.tournaments.update(match.tournamentId, { name: tournamentName });
      }

      // Update team names and logos in tournament pointsTable if they were changed
      if (match.tournamentId) {
        const tournament = await db.tournaments.findById(match.tournamentId);
        if (tournament) {
          let pointsTableUpdated = false;
          const newPointsTable = tournament.pointsTable.map(entry => {
            if (matchUpdates.teamA && entry.teamId === matchUpdates.teamA.id) {
              pointsTableUpdated = true;
              return { ...entry, teamName: matchUpdates.teamA.name, logo: matchUpdates.teamA.logo };
            }
            if (matchUpdates.teamB && entry.teamId === matchUpdates.teamB.id) {
              pointsTableUpdated = true;
              return { ...entry, teamName: matchUpdates.teamB.name, logo: matchUpdates.teamB.logo };
            }
            return entry;
          });
          if (pointsTableUpdated) {
            await db.tournaments.update(match.tournamentId, { pointsTable: newPointsTable });
          }
        }
      }

      const updated = await db.matches.update(id, matchUpdates);
      return NextResponse.json(updated);
    }

    // Cricket Live Scoring updates
    if (match.sport === 'cricket' && match.cricketState) {
      const state = { ...match.cricketState };
      const ballByBall = match.ballByBall ? [...match.ballByBall] : [];

      if (action === 'cricket_ball') {
        const { runs, extraType, wicket, description, strikerId, nonStrikerId, bowlerId } = payload;
        
        // Add ball to history
        ballByBall.push({
          overNum: state.overs,
          ballNum: state.balls + 1,
          bowlerName: state.bowlerStats.find(b => b.playerId === bowlerId)?.name || 'Bowler',
          batsmanName: state.batsmenStats.find(b => b.playerId === strikerId)?.name || 'Batsman',
          runs,
          extraType,
          wicket,
          description: description || `Ball scored: ${runs} runs${extraType !== 'none' ? ` (${extraType})` : ''}${wicket ? ` - Wicket: ${wicket.type}` : ''}`
        });

        // 1. Calculate Runs
        let ballRuns = runs;
        let isExtraBall = false;
        
        if (extraType === 'wide' || extraType === 'noball') {
          state.runs += (runs + 1); // Extra run + runs off ball
          ballRuns = runs + 1;
          isExtraBall = true;
        } else {
          state.runs += runs;
        }

        // Update Batsman Stats
        let strikerIdx = state.batsmenStats.findIndex(b => b.playerId === strikerId);
        if (strikerIdx !== -1) {
          const striker = state.batsmenStats[strikerIdx];
          if (extraType !== 'wide') {
            striker.balls += 1;
          }
          if (extraType !== 'legbye' && extraType !== 'bye') {
            striker.runs += runs;
            if (runs === 4) striker.fours += 1;
            if (runs === 6) striker.sixes += 1;
          }
        }

        // Update Bowler Stats
        let bowlerIdx = state.bowlerStats.findIndex(b => b.playerId === bowlerId);
        if (bowlerIdx !== -1) {
          const bowler = state.bowlerStats[bowlerIdx];
          if (!isExtraBall) {
            // increment balls count
            const currBalls = Math.round((bowler.overs % 1) * 10) + 1;
            if (currBalls >= 6) {
              bowler.overs = Math.floor(bowler.overs) + 1;
            } else {
              bowler.overs = Math.floor(bowler.overs) + (currBalls / 10);
            }
          }
          bowler.runs += ballRuns;
          if (wicket && wicket.type !== 'runout') {
            bowler.wickets += 1;
          }
        }

        // Update Partnership
        state.partnership.runs += ballRuns;
        if (extraType !== 'wide') {
          state.partnership.balls += 1;
        }

        // 2. Calculate Wickets
        if (wicket) {
          state.wickets += 1;
          
          // Fall of Wicket record
          state.fallOfWickets.push({
            score: state.runs,
            wickets: state.wickets,
            overs: state.overs,
            balls: state.balls + 1,
            batsmanName: wicket.batsmanName
          });

          // Mark batsman as out
          let outBatsmanIdx = state.batsmenStats.findIndex(b => b.playerId === wicket.batsmanId);
          if (outBatsmanIdx !== -1) {
            state.batsmenStats[outBatsmanIdx].out = true;
            state.batsmenStats[outBatsmanIdx].howOut = wicket.type;
          }

          // Reset striker if striker is out
          if (wicket.batsmanId === state.strikerId) {
            state.strikerId = undefined;
          } else if (wicket.batsmanId === state.nonStrikerId) {
            state.nonStrikerId = undefined;
          }
        }

        // 3. Update Overs
        if (!isExtraBall) {
          state.balls += 1;
          if (state.balls >= 6) {
            state.overs += 1;
            state.balls = 0;
            // Over complete: Swap batsmen
            const temp = state.strikerId;
            state.strikerId = state.nonStrikerId;
            state.nonStrikerId = temp;
          }
        }

        // 4. Batting rotations (mid-over runs)
        if (runs % 2 === 1 && !wicket) {
          const temp = state.strikerId;
          state.strikerId = state.nonStrikerId;
          state.nonStrikerId = temp;
        }

        // Apply back to state
        match.cricketState = state;
        match.ballByBall = ballByBall;
        const updated = await db.matches.update(id, {
          cricketState: state,
          ballByBall
        });
        return NextResponse.json(updated);
      }

      if (action === 'cricket_set_players') {
        const { strikerId, nonStrikerId, bowlerId } = payload;
        if (strikerId) state.strikerId = strikerId;
        if (nonStrikerId) state.nonStrikerId = nonStrikerId;
        if (bowlerId) state.currentBowlerId = bowlerId;

        // Ensure players are in the stats lists
        const players = await db.players.find();
        if (strikerId && !state.batsmenStats.some(b => b.playerId === strikerId)) {
          const pName = players.find(p => p.id === strikerId)?.name || 'Batsman';
          state.batsmenStats.push({ playerId: strikerId, name: pName, runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
        }
        if (nonStrikerId && !state.batsmenStats.some(b => b.playerId === nonStrikerId)) {
          const pName = players.find(p => p.id === nonStrikerId)?.name || 'Batsman';
          state.batsmenStats.push({ playerId: nonStrikerId, name: pName, runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
        }
        if (bowlerId && !state.bowlerStats.some(b => b.playerId === bowlerId)) {
          const pName = players.find(p => p.id === bowlerId)?.name || 'Bowler';
          state.bowlerStats.push({ playerId: bowlerId, name: pName, overs: 0, maidens: 0, runs: 0, wickets: 0 });
        }

        const updated = await db.matches.update(id, { cricketState: state });
        return NextResponse.json(updated);
      }

      if (action === 'cricket_swap_innings') {
        // Swap innings
        const newBatting = state.bowlingTeamId;
        const newBowling = state.battingTeamId;
        const targetRuns = state.runs + 1;

        const newState: CricketState = {
          innings: 2,
          battingTeamId: newBatting,
          bowlingTeamId: newBowling,
          runs: 0,
          wickets: 0,
          overs: 0,
          balls: 0,
          batsmenStats: [],
          bowlerStats: [],
          targetRuns,
          partnership: { runs: 0, balls: 0, batterA: '', batterB: '' },
          fallOfWickets: []
        };

        const updated = await db.matches.update(id, {
          cricketState: newState,
          ballByBall: []
        });
        return NextResponse.json(updated);
      }

      if (action === 'cricket_undo') {
        if (ballByBall.length === 0) {
          return NextResponse.json(match);
        }

        // Simple undo: pop last ball and rebuild state from scratch from ballByBall array
        ballByBall.pop();
        
        // Rebuild state starting from clean slate
        const cleanState: CricketState = {
          innings: state.innings,
          battingTeamId: state.battingTeamId,
          bowlingTeamId: state.bowlingTeamId,
          runs: 0,
          wickets: 0,
          overs: 0,
          balls: 0,
          strikerId: undefined,
          nonStrikerId: undefined,
          currentBowlerId: undefined,
          batsmenStats: [],
          bowlerStats: [],
          targetRuns: state.targetRuns,
          partnership: { runs: 0, balls: 0, batterA: '', batterB: '' },
          fallOfWickets: []
        };

        // We can just query original squads to build batsmanStats
        const players = await db.players.find();
        
        // Process each ball sequentially
        for (const ball of ballByBall) {
          const isExtraBall = ball.extraType === 'wide' || ball.extraType === 'noball';
          const ballRuns = ball.runs;
          
          if (ball.extraType === 'wide' || ball.extraType === 'noball') {
            cleanState.runs += (ballRuns + 1);
          } else {
            cleanState.runs += ballRuns;
          }

          // Add to batsmens
          let bIdx = cleanState.batsmenStats.findIndex(p => p.name === ball.batsmanName);
          if (bIdx === -1) {
            const pId = players.find(p => p.name === ball.batsmanName)?.id || 'p-unknown';
            cleanState.batsmenStats.push({ playerId: pId, name: ball.batsmanName, runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
            bIdx = cleanState.batsmenStats.length - 1;
          }
          
          if (ball.extraType !== 'wide') {
            cleanState.batsmenStats[bIdx].balls += 1;
          }
          if (ball.extraType !== 'legbye' && ball.extraType !== 'bye') {
            cleanState.batsmenStats[bIdx].runs += ballRuns;
            if (ballRuns === 4) cleanState.batsmenStats[bIdx].fours += 1;
            if (ballRuns === 6) cleanState.batsmenStats[bIdx].sixes += 1;
          }

          // Add to bowler
          let bowIdx = cleanState.bowlerStats.findIndex(p => p.name === ball.bowlerName);
          if (bowIdx === -1) {
            const pId = players.find(p => p.name === ball.bowlerName)?.id || 'p-unknown';
            cleanState.bowlerStats.push({ playerId: pId, name: ball.bowlerName, overs: 0, maidens: 0, runs: 0, wickets: 0 });
            bowIdx = cleanState.bowlerStats.length - 1;
          }

          if (!isExtraBall) {
            const currBalls = Math.round((cleanState.bowlerStats[bowIdx].overs % 1) * 10) + 1;
            if (currBalls >= 6) {
              cleanState.bowlerStats[bowIdx].overs = Math.floor(cleanState.bowlerStats[bowIdx].overs) + 1;
            } else {
              cleanState.bowlerStats[bowIdx].overs = Math.floor(cleanState.bowlerStats[bowIdx].overs) + (currBalls / 10);
            }
          }
          cleanState.bowlerStats[bowIdx].runs += (ball.extraType === 'wide' || ball.extraType === 'noball') ? (ballRuns + 1) : ballRuns;
          if (ball.wicket && ball.wicket.type !== 'runout') {
            cleanState.bowlerStats[bowIdx].wickets += 1;
          }

          // Partnership
          cleanState.partnership.runs += (ball.extraType === 'wide' || ball.extraType === 'noball') ? (ballRuns + 1) : ballRuns;
          if (ball.extraType !== 'wide') {
            cleanState.partnership.balls += 1;
          }

          // Wickets
          if (ball.wicket) {
            cleanState.wickets += 1;
            cleanState.fallOfWickets.push({
              score: cleanState.runs,
              wickets: cleanState.wickets,
              overs: cleanState.overs,
              balls: cleanState.balls + 1,
              batsmanName: ball.wicket.batsmanName
            });

            const outBIdx = cleanState.batsmenStats.findIndex(p => p.name === ball.wicket?.batsmanName);
            if (outBIdx !== -1) {
              cleanState.batsmenStats[outBIdx].out = true;
              cleanState.batsmenStats[outBIdx].howOut = ball.wicket.type;
            }
          }

          if (!isExtraBall) {
            cleanState.balls += 1;
            if (cleanState.balls >= 6) {
              cleanState.overs += 1;
              cleanState.balls = 0;
            }
          }
        }

        // Set striker and non-striker to last active ones if any
        const currentActiveBatsmen = cleanState.batsmenStats.filter(b => !b.out);
        if (currentActiveBatsmen.length > 0) cleanState.strikerId = currentActiveBatsmen[0].playerId;
        if (currentActiveBatsmen.length > 1) cleanState.nonStrikerId = currentActiveBatsmen[1].playerId;
        
        const lastBall = ballByBall[ballByBall.length - 1];
        if (lastBall) {
          cleanState.currentBowlerId = players.find(p => p.name === lastBall.bowlerName)?.id;
        }

        const updated = await db.matches.update(id, {
          cricketState: cleanState,
          ballByBall
        });
        return NextResponse.json(updated);
      }
    }

    // Kabaddi Live Scoring updates
    if (match.sport === 'kabaddi' && match.kabaddiState) {
      const state = { ...match.kabaddiState };
      const actions = match.kabaddiActions ? [...match.kabaddiActions] : [];

      if (action === 'kabaddi_points') {
        const { type, teamId, points, description, raiderId } = payload;
        
        const teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : match.teamA;
        const teamB = typeof match.teamB === 'string' ? JSON.parse(match.teamB) : match.teamB;
        const teamAId = teamA?.id || 'teamA';
        const teamBId = teamB?.id || 'teamB';
        const teamAName = teamA?.name || 'Team A';
        const teamBName = teamB?.name || 'Team B';

        if (teamId === teamAId) {
          if (type === 'raid_success' || type === 'bonus') {
            state.raidPointsA += points;
            state.scoreA += points;
          } else if (type === 'raid_tackled' || type === 'super_tackle') {
            state.tacklePointsB += points;
            state.scoreB += points;
          } else if (type === 'all_out') {
            state.allOutPointsA += points;
            state.scoreA += points;
          } else if (type === 'technical') {
            state.extraPointsA += points;
            state.scoreA += points;
          }
        } else {
          if (type === 'raid_success' || type === 'bonus') {
            state.raidPointsB += points;
            state.scoreB += points;
          } else if (type === 'raid_tackled' || type === 'super_tackle') {
            state.tacklePointsA += points;
            state.scoreA += points;
          } else if (type === 'all_out') {
            state.allOutPointsB += points;
            state.scoreB += points;
          } else if (type === 'technical') {
            state.extraPointsB += points;
            state.scoreB += points;
          }
        }

        if (raiderId) {
          state.activeRaiderId = raiderId;
        }

        // Add action to history log
        actions.push({
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timeRemaining: state.timeRemaining,
          type,
          teamId,
          points,
          description: description || `Points added: +${points} to ${teamId === teamAId ? teamAName : teamBName}`
        });

        // Reset raid state on points scored
        state.raidTime = 30;
        state.raidTimerRunning = false;
        state.doOrDie = false;
        state.superTackle = false;
        state.raidAudioPlayState = 'stopped';

        // Apply back
        const updated = await db.matches.update(id, {
          kabaddiState: state,
          kabaddiActions: actions
        });
        return NextResponse.json(updated);
      }

      if (action === 'kabaddi_timer') {
        const { timeRemaining, timerRunning, half } = payload;
        if (timeRemaining !== undefined) state.timeRemaining = timeRemaining;
        if (timerRunning !== undefined) state.timerRunning = timerRunning;
        if (half !== undefined) state.half = half;

        const updated = await db.matches.update(id, { kabaddiState: state });
        return NextResponse.json(updated);
      }

      if (action === 'kabaddi_raid_state') {
        const { raidTime, raidTimerRunning, doOrDie, superTackle } = payload;
        if (raidTime !== undefined) state.raidTime = raidTime;
        if (raidTimerRunning !== undefined) {
          state.raidTimerRunning = raidTimerRunning;
          if (raidTimerRunning) {
            state.raidAudioPlayState = 'playing';
          } else {
            if (state.raidTime === 0 || state.raidTime === 30) {
              state.raidAudioPlayState = 'stopped';
            } else {
              state.raidAudioPlayState = 'paused';
            }
          }
        } else if (raidTime !== undefined && (raidTime === 30 || raidTime === 0)) {
          state.raidAudioPlayState = 'stopped';
        }
        if (doOrDie !== undefined) state.doOrDie = doOrDie;
        if (superTackle !== undefined) state.superTackle = superTackle;

        const updated = await db.matches.update(id, { kabaddiState: state });
        return NextResponse.json(updated);
      }

      if (action === 'kabaddi_undo') {
        if (actions.length === 0) {
          return NextResponse.json(match);
        }

        // Pop last action and rebuild score
        actions.pop();

        const cleanState: KabaddiState = {
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
          timeRemaining: state.timeRemaining,
          half: state.half,
          timerRunning: false,
          raidTime: 30,
          raidTimerRunning: false,
          doOrDie: false,
          superTackle: false,
          raidAudioPlayState: 'stopped'
        };

        const teamA = typeof match.teamA === 'string' ? JSON.parse(match.teamA) : match.teamA;
        const teamAId = teamA?.id || 'teamA';

        for (const act of actions) {
          if (act.teamId === teamAId) {
            if (act.type === 'raid_success' || act.type === 'bonus') {
              cleanState.raidPointsA += act.points;
              cleanState.scoreA += act.points;
            } else if (act.type === 'raid_tackled' || act.type === 'super_tackle') {
              cleanState.tacklePointsB += act.points;
              cleanState.scoreB += act.points;
            } else if (act.type === 'all_out') {
              cleanState.allOutPointsA += act.points;
              cleanState.scoreA += act.points;
            } else if (act.type === 'technical') {
              cleanState.extraPointsA += act.points;
              cleanState.scoreA += act.points;
            }
          } else {
            if (act.type === 'raid_success' || act.type === 'bonus') {
              cleanState.raidPointsB += act.points;
              cleanState.scoreB += act.points;
            } else if (act.type === 'raid_tackled' || act.type === 'super_tackle') {
              cleanState.tacklePointsA += act.points;
              cleanState.scoreA += act.points;
            } else if (act.type === 'all_out') {
              cleanState.allOutPointsB += act.points;
              cleanState.scoreB += act.points;
            } else if (act.type === 'technical') {
              cleanState.extraPointsB += act.points;
              cleanState.scoreB += act.points;
            }
          }
        }

        const updated = await db.matches.update(id, {
          kabaddiState: cleanState,
          kabaddiActions: actions
        });
        return NextResponse.json(updated);
      }
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.matches.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await db.matches.update(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

