'use strict';

require('dotenv').config();
const http    = require('http');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const { Server } = require('socket.io');

const db          = require('./db');
const adminRouter = require('./routes/admin');
const statsRouter = require('./routes/stats');
const engine      = require('./game/engine');

const IS_PROD = process.env.NODE_ENV === 'production';

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors: IS_PROD ? {} : { origin: '*' },
});
const PORT       = process.env.PORT || 3001;

// ── Express middleware ─────────────────────────────────────────────────────
if (!IS_PROD) app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/admin', adminRouter);
app.use('/api/stats', statsRouter);

// ── Serve built React app in production ───────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return;
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

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

// Per-room action log (cleared on new hand)
const handActionLogs = new Map(); // roomId -> [{playerName, action, amount, phase}]

function appendAction(roomId, entry) {
  if (!handActionLogs.has(roomId)) handActionLogs.set(roomId, []);
  handActionLogs.get(roomId).push(entry);
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
    board:         room.state.board || [],
    actions:       handActionLogs.get(room.id) || [],
    players:       room.state.players.map(p => ({ name: p.name, avatar: p.avatar })),
    potSummary:    winner.potSummary || [],
  });
  handActionLogs.delete(room.id);
}

// ── Socket.io ──────────────────────────────────────────────────────────────
io.on('connection', socket => {
  let myRoomId   = null;
  let myName     = null;
  let isSpectator = false;

  // ─ List rooms (open to join + in-progress to spectate) ─
  socket.on('list_rooms', cb => {
    const list = [...rooms.values()]
      .filter(r => r.state.phase === 'waiting' && r.state.players.length < r.settings.maxPlayers)
      .map(r => ({ id:r.id, name:r.name, players:r.state.players.length, maxPlayers:r.settings.maxPlayers, phase:r.state.phase }));
    const spectatable = [...rooms.values()]
      .filter(r => r.state.phase !== 'waiting')
      .map(r => ({ id:r.id, name:r.name, players:r.state.players.length, maxPlayers:r.settings.maxPlayers, phase:r.state.phase, spectatable:true }));
    if (cb) cb([...list, ...spectatable]);
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

  // ─ Join room (with reconnect support) ─
  socket.on('join_room', ({ roomId, playerName, avatar }, cb) => {
    const room = rooms.get(roomId);
    if (!room) { cb?.({ success:false, error:'חדר לא נמצא' }); return; }

    // Reconnect: player was in this room and disconnected
    const existing = room.state.players.find(p => p.name === playerName);
    if (existing && !existing.connected) {
      existing.connected = true;
      room.socketMap[playerName] = socket.id;
      socket.join(roomId);
      myRoomId = roomId;
      myName   = playerName;
      socket.emit('game_state', engine.stateForPlayer(room, playerName));
      broadcastToRoom(room, 'player_reconnected', { playerName });
      cb?.({ success:true, reconnected:true });
      console.log(`[room] ${playerName} reconnected to ${roomId}`);
      return;
    }

    if (room.state.phase !== 'waiting') {
      cb?.({ success:false, error:'המשחק כבר התחיל — אפשר לצפות בלבד' }); return;
    }
    if (room.state.players.length >= room.settings.maxPlayers) {
      cb?.({ success:false, error:'השולחן מלא' }); return;
    }

    engine.addPlayer(room, playerName, avatar, socket.id);
    socket.join(roomId);
    myRoomId = roomId;
    myName   = playerName;
    broadcastRoom(room);
    broadcastToRoom(room, 'player_joined', { playerName, seatIdx: room.state.players.length-1 });
    cb?.({ success:true });
    console.log(`[room] ${playerName} joined ${roomId}`);
  });

  // ─ Spectate room ─
  socket.on('spectate_room', ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) { cb?.({ success:false, error:'חדר לא נמצא' }); return; }
    socket.join(roomId);
    myRoomId    = roomId;
    isSpectator = true;
    // Send state with all cards hidden until showdown
    socket.emit('game_state', engine.stateForSpectator(room));
    cb?.({ success:true });
  });

  // ─ Start game (any player can trigger when ≥2 players) ─
  socket.on('start_game', cb => {
    const room = rooms.get(myRoomId);
    if (!room) { cb?.({ success:false, error:'חדר לא קיים' }); return; }
    if (room.state.players.length < 2) { cb?.({ success:false, error:'דרושים לפחות 2 שחקנים' }); return; }
    handActionLogs.delete(myRoomId);
    engine.buildHand(room, db.getWinBoosts());
    broadcastRoom(room);
    broadcastSpectatorsInRoom(room);
    startTurnTimer(room);
    cb?.({ success:true });
  });

  // ─ Player action ─
  socket.on('action', ({ type, amount }) => {
    const room = rooms.get(myRoomId);
    if (!room || !myName || isSpectator) return;
    const s = room.state;
    const playerIdx = s.players.findIndex(p => p.name === myName);
    if (playerIdx !== s.turn) return;
    if (s.phase === 'showdown' || s.phase === 'waiting') return;

    appendAction(myRoomId, { playerName: myName, action: type, amount: amount || 0, phase: s.phase });
    clearTurnTimer(room.id);
    const result = engine.processAction(room, playerIdx, type, amount);
    if (result.handOver) persistHand(room);
    broadcastRoom(room);
    broadcastSpectatorsInRoom(room);
    if (!result.handOver) startTurnTimer(room);
  });

  // ─ Chat message ─
  socket.on('chat_message', ({ text }) => {
    const room = rooms.get(myRoomId);
    if (!room || !text?.trim()) return;
    const senderName = isSpectator ? '👁️ צופה' : (myName || '???');
    const msg = { sender: senderName, text: text.trim().slice(0, 120), at: Date.now() };
    io.to(myRoomId).emit('chat_message', msg);
  });

  // ─ Re-request current state ─
  socket.on('get_state', () => {
    const room = rooms.get(myRoomId);
    if (!room) return;
    if (isSpectator) {
      socket.emit('game_state', engine.stateForSpectator(room));
    } else if (myName) {
      socket.emit('game_state', engine.stateForPlayer(room, myName));
    }
  });

  // ─ New hand (after showdown) ─
  socket.on('new_hand', cb => {
    const room = rooms.get(myRoomId);
    if (!room || room.state.phase !== 'showdown') { cb?.({ success:false }); return; }
    handActionLogs.delete(myRoomId);
    engine.rotateDealerForNewHand(room);
    engine.buildHand(room, db.getWinBoosts());
    broadcastRoom(room);
    broadcastSpectatorsInRoom(room);
    startTurnTimer(room);
    cb?.({ success:true });
  });

  // ─ Disconnect ─
  socket.on('disconnect', () => {
    const room = rooms.get(myRoomId);
    if (!room) return;
    if (isSpectator) return; // spectators don't affect the game
    if (!myName) return;
    const p = room.state.players.find(x => x.name === myName);
    if (p) { p.connected = false; }
    broadcastToRoom(room, 'player_disconnected', { playerName: myName });
    // Keep room alive for 5 min to allow reconnect; clean up if all disconnected
    setTimeout(() => {
      if (!rooms.has(myRoomId)) return;
      const r = rooms.get(myRoomId);
      if (r.state.players.every(x => !x.connected)) {
        clearTurnTimer(myRoomId);
        handActionLogs.delete(myRoomId);
        rooms.delete(myRoomId);
        console.log(`[room] ${myRoomId} cleaned up (all disconnected)`);
      }
    }, 5 * 60 * 1000);
  });
});

// ── Broadcast helpers (spectators) ────────────────────────────────────────
function broadcastSpectatorsInRoom(room) {
  const spectatorState = engine.stateForSpectator(room);
  io.to(room.id).emit('spectator_state', spectatorState);
}

// ── Start server ───────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`\n🃏  Vault Poker Server running on http://localhost:${PORT}`);
  console.log(`🔑  Admin password: ${db.getAdminPassword()}\n`);
});
