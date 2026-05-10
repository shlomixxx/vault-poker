'use strict';

const { dealGame, dealWithBoost } = require('./dealer');
const { evaluateHand } = require('./evaluator');
const { computePots, awardPots } = require('./pots');

const PHASES = ['preflop','flop','turn','river','showdown'];

// Returns next seat that can still bet. Returns -1 when all remaining are all-in.
function nextActiveWithChips(players, from, n) {
  for (let i = 1; i <= n; i++) {
    const nx = (from + i) % n;
    if (!players[nx].f && players[nx].ch > 0) return nx;
  }
  return -1;
}

// ── State factory ──────────────────────────────────────────────────────────
function createRoom(id, name, settings) {
  return {
    id,
    name,
    settings,
    state: {
      phase: 'waiting',
      players: [],     // filled as players join
      board: [],
      bets: [],
      pot: 0,
      turn: 0,
      curBet: 0,
      dealerIdx: 0,
      acted: [],       // serialisable Set equivalent — array of player indices
      winner: null,
      handResults: [],
      pkey: 0,
      handNum: 0,
      contributions: [],   // cumulative chips each player put in this hand
    },
    socketMap: {},     // playerName -> socketId
    handLog: [],       // { winnerName, pot, wasManipulated }
  };
}

function addPlayer(room, playerName, avatar, socketId) {
  const seatIdx = room.state.players.length;
  room.state.players.push({
    name: playerName,
    avatar: avatar || '🎯',
    ch: room.settings.buyIn,
    c: [],
    f: false,
    connected: true,
    seatIdx,
  });
  room.state.bets.push(0);
  room.socketMap[playerName] = socketId;
  return seatIdx;
}

// ── Deal new hand ──────────────────────────────────────────────────────────
function buildHand(room, winBoosts = {}) {
  const state   = room.state;
  const players = state.players;
  const n       = players.length;
  const dealer  = state.dealerIdx;
  const sb      = (dealer+1)%n;
  const bb      = (dealer+2)%n;

  // Decide if any player gets a boost this hand
  let boostedIdx = -1;
  const shuffledBoosts = Object.entries(winBoosts).sort(() => Math.random()-0.5);
  for (const [name, pct] of shuffledBoosts) {
    const idx = players.findIndex(p => p.name === name);
    if (idx >= 0 && Math.random()*100 < pct) { boostedIdx = idx; break; }
  }

  const { holeCards, board, wasManipulated } = boostedIdx >= 0
    ? dealWithBoost(n, boostedIdx)
    : dealGame(n);

  // Reset players for new hand (rebuy anyone at 0)
  const freshPlayers = players.map((p, i) => ({
    ...p,
    ch: p.ch <= 0 ? room.settings.buyIn : p.ch,
    c:  holeCards[i],
    f:  false,
  }));

  const sbAmt = Math.min(room.settings.sb, freshPlayers[sb].ch);
  const bbAmt = Math.min(room.settings.bb, freshPlayers[bb].ch);
  freshPlayers[sb].ch -= sbAmt;
  freshPlayers[bb].ch -= bbAmt;

  const bets = new Array(n).fill(0);
  bets[sb] = sbAmt;
  bets[bb] = bbAmt;

  const contributions = new Array(n).fill(0);
  contributions[sb] = sbAmt;
  contributions[bb] = bbAmt;

  // UTG = first active seat after BB
  let utg = (bb+1)%n, tries = 0;
  while (freshPlayers[utg].ch <= 0 && tries < n) { utg=(utg+1)%n; tries++; }

  room.state = {
    ...state,
    phase: 'preflop',
    players: freshPlayers,
    board,
    bets,
    pot: 0,
    turn: utg,
    curBet: room.settings.bb,
    acted: [],
    winner: null,
    handResults: [],
    pkey: state.pkey+1,
    handNum: state.handNum+1,
    contributions,
    boostedPlayerName: wasManipulated ? players[boostedIdx].name : null,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function nextActive(players, from, n) {
  let nx=(from+1)%n, tries=0;
  while ((players[nx].f || players[nx].ch<=0) && tries<n) { nx=(nx+1)%n; tries++; }
  return nx;
}

// ── Process a player action ────────────────────────────────────────────────
function processAction(room, playerIdx, action, raiseAmount) {
  const s  = room.state;
  const p  = s.players.map(x=>({...x}));
  const nb = [...s.bets];
  const na = new Set(s.acted);
  const cb = s.curBet;
  const rz = raiseAmount ?? Math.max(cb*2, room.settings.bb*2);
  const n  = p.length;
  na.add(playerIdx);
  let betAmt=0, newCurBet=cb;

  switch (action) {
    case 'FOLD':
      p[playerIdx].f = true; p[playerIdx].c = [];
      break;
    case 'CHECK':
      break;
    case 'CALL':
      betAmt = Math.min(cb - nb[playerIdx], p[playerIdx].ch);
      nb[playerIdx] += betAmt; p[playerIdx].ch -= betAmt;
      break;
    case 'RAISE':
      betAmt = Math.max(0, Math.min(rz - nb[playerIdx], p[playerIdx].ch));
      nb[playerIdx] += betAmt; p[playerIdx].ch -= betAmt;
      newCurBet = nb[playerIdx];
      na.clear(); na.add(playerIdx);
      break;
    case 'ALL_IN':
      betAmt = p[playerIdx].ch;
      nb[playerIdx] += betAmt; p[playerIdx].ch = 0;
      if (nb[playerIdx] > cb) { newCurBet=nb[playerIdx]; na.clear(); na.add(playerIdx); }
      break;
  }

  // Track cumulative contributions
  const nc = [...(s.contributions || new Array(n).fill(0))];
  nc[playerIdx] = (nc[playerIdx] || 0) + betAmt;

  // Early win: everyone else folded
  const remaining = p.filter(x => !x.f);
  if (remaining.length === 1) {
    const totalWin = s.pot + nb.reduce((a,b)=>a+b,0);
    const winIdx   = p.indexOf(remaining[0]);
    p[winIdx].ch  += totalWin;
    room.state = { ...s, phase:'showdown', players:p, bets:new Array(n).fill(0), pot:0, acted:[...na], curBet:newCurBet, contributions:nc, winner:{ idx:winIdx, name:p[winIdx].name, hand:'כולם עשו Fold', bestCards:[], amount:totalWin }, handResults:[] };
    _logHand(room, p[winIdx].name, totalWin, false);
    return { handOver:true };
  }

  room.state = { ...s, players:p, bets:nb, acted:[...na], curBet:newCurBet, contributions:nc };

  // Check if street is over
  const active  = p.filter((x,i) => !x.f && x.ch>0);
  const allAct  = active.every(x => na.has(p.indexOf(x)));
  const maxBet  = Math.max(...nb.map((v,i) => p[i].f?0:v));
  const allEq   = active.every(x => nb[p.indexOf(x)]===maxBet || x.ch<=0);

  if (action !== 'FOLD' && allAct && allEq) {
    return advancePhase(room);
  }

  // Move to next player who can bet — skip all-in players
  const nx = nextActiveWithChips(p, playerIdx, n);
  if (nx === -1) {
    // Everyone remaining is all-in — auto-advance street
    return advancePhase(room);
  }
  room.state.turn = nx;
  return { handOver:false };
}

// ── Advance street ─────────────────────────────────────────────────────────
function advancePhase(room) {
  const s         = room.state;
  const betTotal  = s.bets.reduce((a,b)=>a+b,0);
  const totalPot  = s.pot + betTotal;
  const phIdx     = PHASES.indexOf(s.phase);
  const newPhase  = PHASES[phIdx+1];
  const n         = s.players.length;

  const base = { ...s, phase:newPhase, pot:totalPot, bets:new Array(n).fill(0), curBet:0, acted:[], pkey:s.pkey+1 };

  if (newPhase === 'showdown') {
    const results = s.players.map(p => {
      if (p.f || !p.c || p.c.length<2) return null;
      return evaluateHand(p.c, s.board);
    });

    // Use contributions for side-pot computation; fall back to equal split if missing
    const contribs = s.contributions && s.contributions.some(c=>c>0)
      ? s.contributions
      : new Array(n).fill(Math.round(totalPot / n));

    const pots          = computePots(contribs, s.players);
    const { winnings, summary } = awardPots(pots, results);

    const wp = s.players.map((p,i) => ({ ...p, ch: p.ch + (winnings[i]||0) }));

    // Main winner = winner of the main pot (first pot = best hand eligible by all)
    const mainIdx = summary.length > 0 ? summary[0].winners[0] : -1;

    const winner = mainIdx>=0 ? {
      idx:      mainIdx,
      name:     s.players[mainIdx].name,
      hand:     results[mainIdx]?.nameHe || '',
      handEn:   results[mainIdx]?.name   || '',
      bestCards:results[mainIdx]?.bestCards || [],
      amount:   winnings[mainIdx],
      potSummary: summary,   // [{amount, winners, isSplit}]
    } : null;

    room.state = { ...base, players:wp, pot:0, handResults:results, winner };
    if (winner) _logHand(room, winner.name, totalPot, !!s.boostedPlayerName);
    return { handOver:true };
  }

  // Non-showdown: find first active after dealer, skip all-in players
  const nextTurn = nextActiveWithChips(base.players, s.dealerIdx, n);
  if (nextTurn === -1) {
    // All remaining players are all-in — keep running out the board
    room.state = { ...base };
    return advancePhase(room);
  }
  room.state = { ...base, turn:nextTurn };
  return { handOver:false };
}

function rotateDealerForNewHand(room) {
  const n = room.state.players.length;
  room.state.dealerIdx = (room.state.dealerIdx+1) % n;
}

function _logHand(room, winnerName, pot, wasManipulated) {
  room.handLog.push({ winnerName, pot, wasManipulated, at: Date.now() });
}

// ── State serialisation (hides opponent cards) ─────────────────────────────
function stateForPlayer(room, viewerName) {
  const s = room.state;
  const viewerIdx = s.players.findIndex(p => p.name === viewerName);
  return {
    roomId:    room.id,
    roomName:  room.name,
    settings:  room.settings,
    myIdx:     viewerIdx,
    phase:     s.phase,
    players:   s.players.map((p, i) => ({
      ...p,
      n: p.name,   // short alias expected by Seat component
      a: p.avatar, // short alias expected by Seat component
      // Hide hole cards of opponents until showdown
      c: (i===viewerIdx || s.phase==='showdown') ? p.c : (p.f ? [] : ['??','??']),
    })),
    board:       s.board,
    bets:        s.bets,
    pot:         s.pot,
    turn:        s.turn,
    curBet:      s.curBet,
    dealerIdx:   s.dealerIdx,
    acted:       s.acted,
    winner:      s.winner,
    handResults: s.handResults,
    pkey:        s.pkey,
    handNum:     s.handNum,
    potSummary:  s.winner?.potSummary || [],
  };
}

// ── Spectator state (hides all hole cards until showdown) ──────────────────
function stateForSpectator(room) {
  const s = room.state;
  return {
    roomId:    room.id,
    roomName:  room.name,
    settings:  room.settings,
    myIdx:     -1,
    isSpectator: true,
    phase:     s.phase,
    players:   s.players.map(p => ({
      ...p,
      n: p.name,
      a: p.avatar,
      c: s.phase === 'showdown' ? p.c : (p.f ? [] : ['??','??']),
    })),
    board:       s.board,
    bets:        s.bets,
    pot:         s.pot,
    turn:        s.turn,
    curBet:      s.curBet,
    dealerIdx:   s.dealerIdx,
    acted:       s.acted,
    winner:      s.winner,
    handResults: s.handResults,
    pkey:        s.pkey,
    handNum:     s.handNum,
    potSummary:  s.winner?.potSummary || [],
  };
}

module.exports = { createRoom, addPlayer, buildHand, processAction, rotateDealerForNewHand, stateForPlayer, stateForSpectator };
