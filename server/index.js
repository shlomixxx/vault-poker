'use strict';

require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const { Server } = require('socket.io');

const db          = require('./db');
const adminRouter = require('./routes/admin');
const engine      = require('./game/engine');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });
const PORT       = process.env.PORT || 3001;

// ── Express middleware ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/api/admin', adminRouter);

// ── In-memory room registry ────────────────────────────────────────────────
const rooms = new Map();   // roomId -> room object
const turnTimers = new Map(); // roomId -> timeoutId

// Expose rooms list to admin route
app.locals.getRooms = () =>
  [...rooms.values()].map(r => ({
    id: r.id,
    name: r.name,
    phase: r.state.phase,
    playerCount: r.state.players.length,
    maxPlayers: r.settings.maxPlayers,
    settings: r.settings,
    handNum: r.state.handNum,
  }));

// ── Room code generator ────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  let c = '';
  for (let i=0; i<6; i++) c += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
  return rooms.has(c) ? genCode() : c;
}

// ── Broadcast helpers ──────────────────────────────────────────────────────
function broadcastRoom(room) {
  for (const [name, sid] of Object.entries(room.socketMap)) {
    const sock = io.sockets.sockets.get(sid);
    if (sock) sock.emit('game_state', engine.stateForPlayer(room, name));
  }
}

function broadcastToRoom(room, event, data) {
  io.to(room.id).emit(event, data);
}

// ── Turn timer ─────────────────────────────────────────────────────────────
function clearTurnTimer(roomId) {
  const t = turnTimers.get(roomId);
  if (t) { clearTimeout(t); turnTimers.delete(roomId); }
}

function startTurnTimer(room) {
  clearTurnTimer(room.id);
  const { timer, bank, autoAction } = room.settings;
  const totalMs = (timer + bank + 3) * 1000; // a little buffer
  turnTimers.set(room.id, setTimeout(() => {
    const s = room.state;
    if (s.phase === 'showdown' || s.phase === 'waiting') return;
    const canCheck = s.curBet <= (s.bets[s.turn] || 0);
    const action   = (autoAction === 'check_fold' && canCheck) ? 'CHECK' : 'FOLD';
    const result   = engine.processAction(room, s.turn, action);
    if (result.handOver) persistHand(room);
    broadcastRoom(room);
    if (s.phase !== 'showdown') startTurnTimer(room);
  }, totalMs));
}

function persistHand(room) {
  const winner = room.state.winner;
  if (!winner || !winner.name) return;
  db.saveHandResult({
    roomId:        room.id,
    roomName:      room.name,
    handNum:       room.state.handNum,
    winnerName:    winner.name,
    pot:           winner.amount || 0,
    handEn:        winner.handEn || '',
    handHe:        winner.hand   || '',
    wasManipulated: !!room.state.boostedPlayerName,
  });
}

// ── Socket.io ──────────────────────────────────────────────────────────────
io.on('connection', socket => {
  let myRoomId   = null;
  let myName     = null;

  // ─ List open rooms ─
  socket.on('list_rooms', cb => {
    const list = [...rooms.values()]
      .filter(r => r.state.phase === 'waiting' && r.state.players.length < r.settings.maxPlayers)
      .map(r => ({ id:r.id, name:r.name, players:r.state.players.length, maxPlayers:r.settings.maxPlayers }));
    if (cb) cb(list);
  });

  // ─ Create room ─
  socket.on('create_room', ({ name, settings, playerName, avatar }, cb) => {
    const id   = genCode();
    const room = engine.createRoom(id, name || `שולחן ${id}`, settings);
    engine.addPlayer(room, playerName, avatar, socket.id);
    rooms.set(id, room);
    socket.join(id);
    myRoomId = id;
    myName   = playerName;
    socket.emit('game_state', engine.stateForPlayer(room, playerName));
    if (cb) cb({ success:true, roomId:id });
    console.log(`[room] ${id} created by ${playerName}`);
  });

  // ─ Join room ─
  socket.on('join_room', ({ roomId, playerName, avatar }, cb) => {
    const room = rooms.get(roomId);
    if (!room) { cb?.({ success:false, error:'חדר לא נמצא' }); return; }
    if (room.state.players.length >= room.settings.maxPlayers) {
      cb?.({ success:false, error:'השולחן מלא' }); return;
    }
    if (room.state.phase !== 'waiting') {
      cb?.({ success:false, error:'המשחק כבר התחיל' }); return;
    }
    engine.addPlayer(room, playerName, avatar, socket.id);
    socket.join(roomId);
    myRoomId = roomId;
    myName   = playerName;
    broadcastRoom(room); // sends personalized game_state to all players including new joiner
    broadcastToRoom(room, 'player_joined', { playerName, seatIdx: room.state.players.length-1 });
    cb?.({ success:true });
    console.log(`[room] ${playerName} joined ${roomId}`);
  });

  // ─ Start game (any player can trigger when ≥2 players) ─
  socket.on('start_game', cb => {
    const room = rooms.get(myRoomId);
    if (!room) { cb?.({ success:false, error:'חדר לא קיים' }); return; }
    if (room.state.players.length < 2) { cb?.({ success:false, error:'דרושים לפחות 2 שחקנים' }); return; }
    const boosts = db.getWinBoosts();
    engine.buildHand(room, boosts);
    broadcastRoom(room);
    startTurnTimer(room);
    cb?.({ success:true });
  });

  // ─ Player action ─
  socket.on('action', ({ type, amount }) => {
    const room = rooms.get(myRoomId);
    if (!room || !myName) return;
    const s = room.state;
    const playerIdx = s.players.findIndex(p => p.name === myName);
    if (playerIdx !== s.turn) return; // not your turn
    if (s.phase === 'showdown' || s.phase === 'waiting') return;

    clearTurnTimer(room.id);
    const result = engine.processAction(room, playerIdx, type, amount);
    if (result.handOver) persistHand(room);
    broadcastRoom(room);
    if (!result.handOver) startTurnTimer(room);
  });

  // ─ Re-request current state (called on screen mount after create/join) ─
  socket.on('get_state', () => {
    const room = rooms.get(myRoomId);
    if (!room || !myName) return;
    socket.emit('game_state', engine.stateForPlayer(room, myName));
  });

  // ─ New hand (after showdown) ─
  socket.on('new_hand', cb => {
    const room = rooms.get(myRoomId);
    if (!room || room.state.phase !== 'showdown') { cb?.({ success:false }); return; }
    engine.rotateDealerForNewHand(room);
    engine.buildHand(room, db.getWinBoosts());
    broadcastRoom(room);
    startTurnTimer(room);
    cb?.({ success:true });
  });

  // ─ Disconnect ─
  socket.on('disconnect', () => {
    const room = rooms.get(myRoomId);
    if (!room || !myName) return;
    const p = room.state.players.find(x => x.name === myName);
    if (p) { p.connected = false; }
    broadcastToRoom(room, 'player_disconnected', { playerName: myName });
    // Clean up empty rooms after 30s
    setTimeout(() => {
      if (!rooms.has(myRoomId)) return;
      const r = rooms.get(myRoomId);
      if (r.state.players.every(x => !x.connected)) {
        clearTurnTimer(myRoomId);
        rooms.delete(myRoomId);
        console.log(`[room] ${myRoomId} cleaned up (all disconnected)`);
      }
    }, 30000);
  });
});

// ── Start server ───────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🃏  Vault Poker Server running on http://localhost:${PORT}`);
  console.log(`🔑  Admin password: ${db.getAdminPassword()}\n`);
});
