'use strict';

require('dotenv').config();
const http    = require('http');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const { Server } = require('socket.io');

const db          = require('./db');
const logger      = require('./logger');
const adminRouter = require('./routes/admin');
const statsRouter = require('./routes/stats');
const engine      = require('./game/engine');

const IS_PROD = process.env.NODE_ENV === 'production';

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors: IS_PROD ? {} : { origin: '*' },
  pingInterval: 25000,   // keeps Railway proxy alive (60s timeout)
  pingTimeout:  60000,
});
const PORT = process.env.PORT || 3001;

// ── Express middleware ─────────────────────────────────────────────────────
if (!IS_PROD) app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

// ── Logs endpoint ─────────────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  if (req.query.password !== db.getAdminPassword()) return res.status(401).json({ error: 'unauthorized' });
  res.json(logger.getLogs(+req.query.n || 200));
});

app.use('/api/admin', adminRouter);
app.use('/api/stats', statsRouter);

if (IS_PROD) {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return;
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── In-memory room registry ────────────────────────────────────────────────
const rooms      = new Map();   // roomId -> room object
const turnTimers = new Map();   // roomId -> timeoutId

app.locals.getRooms = () =>
  [...rooms.values()].map(r => ({
    id: r.id, name: r.name, phase: r.state.phase,
    playerCount: r.state.players.length, maxPlayers: r.settings.maxPlayers,
    settings: r.settings, handNum: r.state.handNum,
  }));

// ── Room code generator ────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return rooms.has(c) ? genCode() : c;
}

// ── Broadcast helpers ──────────────────────────────────────────────────────
function broadcastRoom(room) {
  const map   = room.socketMap;
  const total = Object.keys(map).length;
  let   sent  = 0;
  for (const [name, sid] of Object.entries(map)) {
    const sock = io.sockets.sockets.get(sid);
    if (sock) { sock.emit('game_state', engine.stateForPlayer(room, name)); sent++; }
    else logger.warn('broadcast', 'socket לא נמצא לשחקן', { room: room.id, name, sid });
  }
  logger.info('broadcast', 'שלח game_state', { room: room.id, sent, total, phase: room.state.phase });
  // Persist room state after every broadcast (fire-and-forget)
  db.saveRoom(room);
}

function broadcastToRoom(room, event, data) {
  io.to(room.id).emit(event, data);
}

// Spectator state — only to sockets that joined via spectate_room
// We track spectator sockets in a Set per room to avoid sending hidden-card
// state to players (which would overwrite their own cards view).
const spectatorSockets = new Map(); // roomId -> Set<socketId>

function broadcastSpectators(room) {
  const sids = spectatorSockets.get(room.id);
  if (!sids || sids.size === 0) return;
  const state = engine.stateForSpectator(room);
  for (const sid of sids) {
    const sock = io.sockets.sockets.get(sid);
    if (sock) sock.emit('game_state', state);
  }
}

// ── Turn timer ─────────────────────────────────────────────────────────────
function clearTurnTimer(roomId) {
  const t = turnTimers.get(roomId);
  if (t) { clearTimeout(t); turnTimers.delete(roomId); }
}

function startTurnTimer(room) {
  clearTurnTimer(room.id);
  const { timer, bank, autoAction } = room.settings;
  const totalMs = (timer + bank + 3) * 1000;
  turnTimers.set(room.id, setTimeout(() => {
    const s = room.state;
    if (s.phase === 'showdown' || s.phase === 'waiting') return;
    const playerName = s.players[s.turn]?.name || '?';
    const canCheck   = s.curBet <= (s.bets[s.turn] || 0);
    const action     = (autoAction === 'check_fold' && canCheck) ? 'CHECK' : 'FOLD';
    appendAction(room.id, { playerName, action, amount: 0, phase: s.phase });
    io.to(room.id).emit('action_event', { sender: playerName, type: action, amount: 0, auto: true });
    const result = engine.processAction(room, s.turn, action);
    if (result.handOver) persistHand(room);
    broadcastRoom(room);
    broadcastSpectators(room);
    if (result.handOver) io.to(room.id).emit('action_event', { type: 'showdown' });
    else if (room.state.phase !== s.phase) io.to(room.id).emit('action_event', { type: 'phase', phase: room.state.phase });
    else startTurnTimer(room);
  }, totalMs));
}

// ── Hand action log ────────────────────────────────────────────────────────
const handActionLogs = new Map(); // roomId -> [{playerName, action, amount, phase}]
function appendAction(roomId, entry) {
  if (!handActionLogs.has(roomId)) handActionLogs.set(roomId, []);
  handActionLogs.get(roomId).push(entry);
}

function persistHand(room) {
  const winner = room.state.winner;
  if (!winner?.name) return;
  db.saveHandResult({
    roomId:         room.id,
    roomName:       room.name,
    handNum:        room.state.handNum,
    winnerName:     winner.name,
    pot:            winner.amount || 0,
    handEn:         winner.handEn || '',
    handHe:         winner.hand   || '',
    wasManipulated: !!room.state.boostedPlayerName,
    board:          room.state.board || [],
    actions:        handActionLogs.get(room.id) || [],
    players:        room.state.players.map(p => ({ name: p.name, avatar: p.avatar })),
    potSummary:     winner.potSummary || [],
  }).catch(e => logger.error('db', 'saveHandResult error', { e: e.message }));
  handActionLogs.delete(room.id);
}

// ── Socket.io ──────────────────────────────────────────────────────────────
io.on('connection', socket => {
  let myRoomId    = null;
  let myName      = null;
  let isSpectator = false;
  logger.info('socket', 'חיבור חדש', { sid: socket.id });

  // List public rooms
  socket.on('list_rooms', cb => {
    const joinable = [...rooms.values()]
      .filter(r => !r.settings.password && r.state.phase === 'waiting' && r.state.players.length < r.settings.maxPlayers)
      .map(r => ({ id: r.id, name: r.name, players: r.state.players.length, maxPlayers: r.settings.maxPlayers, phase: r.state.phase, settings: r.settings }));
    const spectatable = [...rooms.values()]
      .filter(r => !r.settings.password && r.state.phase !== 'waiting')
      .map(r => ({ id: r.id, name: r.name, players: r.state.players.length, maxPlayers: r.settings.maxPlayers, phase: r.state.phase, settings: r.settings, spectatable: true }));
    cb?.([...joinable, ...spectatable]);
  });

  // Create room
  socket.on('create_room', ({ name, settings, playerName, avatar }, cb) => {
    const pName = playerName?.trim();
    if (!pName || pName.length > 20) { cb?.({ success: false, error: 'שם שחקן לא תקין' }); return; }
    const id   = genCode();
    const room = engine.createRoom(id, name || `שולחן ${id}`, settings);
    room.rakeOwner = pName;
    engine.addPlayer(room, pName, avatar, socket.id);
    rooms.set(id, room);
    socket.join(id);
    myRoomId = id; myName = pName;
    socket.emit('game_state', engine.stateForPlayer(room, pName));
    db.saveRoom(room);
    cb?.({ success: true, roomId: id });
    logger.info('room', 'נוצר חדר', { roomId: id, playerName: pName, sid: socket.id });
  });

  // Join room (handles both new join and reconnect)
  socket.on('join_room', ({ roomId, playerName, avatar, password }, cb) => {
    const room  = rooms.get(roomId);
    const pName = playerName?.trim();
    if (!room)  { cb?.({ success: false, error: 'חדר לא נמצא' }); return; }
    if (!pName || pName.length > 20) { cb?.({ success: false, error: 'שם שחקן לא תקין' }); return; }

    // Same player name → always treat as reconnect
    const existing = room.state.players.find(p => p.name === pName);
    if (existing) {
      const wasConnected = existing.connected;
      existing.connected = true;
      room.socketMap[pName] = socket.id;
      socket.join(roomId);
      myRoomId = roomId; myName = pName;
      socket.emit('game_state', engine.stateForPlayer(room, pName));
      if (room.state.phase !== 'waiting') {
        broadcastToRoom(room, 'player_reconnected', { playerName: pName });
        // Restart turn timer if the game is active and no timer is running
        if (!turnTimers.has(roomId)) startTurnTimer(room);
      }
      cb?.({ success: true, reconnected: true });
      logger.info('room', wasConnected ? 'חיבור מחדש (socket חדש)' : 'חיבור מחדש (לאחר ניתוק)', { roomId, playerName: pName, sid: socket.id });
      return;
    }

    // New player — validate
    if (room.settings.password && room.settings.password !== password) {
      logger.warn('room', 'סיסמה שגויה', { roomId, playerName: pName });
      cb?.({ success: false, error: 'סיסמה שגויה' }); return;
    }
    if (room.state.phase !== 'waiting') {
      logger.warn('room', 'ניסיון הצטרפות לחדר פעיל', { roomId, playerName: pName });
      cb?.({ success: false, error: 'המשחק כבר התחיל — אפשר לצפות בלבד' }); return;
    }
    if (room.state.players.length >= room.settings.maxPlayers) {
      logger.warn('room', 'חדר מלא', { roomId, playerName: pName });
      cb?.({ success: false, error: 'השולחן מלא' }); return;
    }

    engine.addPlayer(room, pName, avatar, socket.id);
    socket.join(roomId);
    myRoomId = roomId; myName = pName;
    broadcastRoom(room);
    broadcastToRoom(room, 'player_joined', { playerName: pName, seatIdx: room.state.players.length - 1 });
    cb?.({ success: true });
    logger.info('room', 'שחקן הצטרף', { roomId, playerName: pName, totalPlayers: room.state.players.length });
  });

  // Spectate room
  socket.on('spectate_room', ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) { cb?.({ success: false, error: 'חדר לא נמצא' }); return; }
    socket.join(roomId);
    myRoomId    = roomId;
    isSpectator = true;
    // Track this socket as a spectator so we don't send it player state
    if (!spectatorSockets.has(roomId)) spectatorSockets.set(roomId, new Set());
    spectatorSockets.get(roomId).add(socket.id);
    socket.emit('game_state', engine.stateForSpectator(room));
    cb?.({ success: true });
  });

  // Start game
  socket.on('start_game', cb => {
    const room = rooms.get(myRoomId);
    if (!room) { logger.error('game', 'start_game: חדר לא נמצא', { myRoomId }); cb?.({ success: false, error: 'חדר לא קיים' }); return; }
    if (room.state.players.length < 2) { cb?.({ success: false, error: 'נדרשים לפחות 2 שחקנים' }); return; }
    logger.info('game', 'משחק מתחיל', { roomId: myRoomId, players: room.state.players.map(p => p.name), socketMap: room.socketMap });
    handActionLogs.delete(myRoomId);
    engine.buildHand(room, db.getWinBoosts());
    io.to(myRoomId).emit('action_event', { type: 'new_hand', handNum: room.state.handNum });
    broadcastRoom(room);
    broadcastSpectators(room);
    startTurnTimer(room);
    cb?.({ success: true });
  });

  // Player action
  socket.on('action', ({ type, amount }) => {
    const room = rooms.get(myRoomId);
    if (!room || !myName || isSpectator) {
      logger.warn('action', 'פעולה נדחתה', { myName, myRoomId, isSpectator }); return;
    }
    const s = room.state;
    const playerIdx = s.players.findIndex(p => p.name === myName);
    if (playerIdx !== s.turn) { logger.warn('action', 'לא התור של השחקן', { myName, turn: s.turn, playerIdx }); return; }
    if (s.phase === 'showdown' || s.phase === 'waiting') return;
    // Basic server-side amount validation
    if (amount !== undefined && (typeof amount !== 'number' || amount < 0 || amount > 1e8)) return;

    appendAction(myRoomId, { playerName: myName, action: type, amount: amount || 0, phase: s.phase });
    io.to(myRoomId).emit('action_event', { sender: myName, type, amount: amount || 0 });
    clearTurnTimer(room.id);
    const phaseBefore = s.phase;
    const result = engine.processAction(room, playerIdx, type, amount);
    if (result.handOver) {
      persistHand(room);
      io.to(myRoomId).emit('action_event', { type: 'showdown' });
    } else if (room.state.phase !== phaseBefore) {
      io.to(myRoomId).emit('action_event', { type: 'phase', phase: room.state.phase });
    }
    broadcastRoom(room);
    broadcastSpectators(room);
    if (!result.handOver) startTurnTimer(room);
  });

  // Chat
  socket.on('chat_message', ({ text }) => {
    const room = rooms.get(myRoomId);
    if (!room || !text?.trim()) return;
    const senderName = isSpectator ? '👁️ צופה' : (myName || '???');
    io.to(myRoomId).emit('chat_message', { sender: senderName, text: text.trim().slice(0, 120), at: Date.now() });
  });

  // Re-request current state
  socket.on('get_state', () => {
    const room = rooms.get(myRoomId);
    if (!room) return;
    if (isSpectator) socket.emit('game_state', engine.stateForSpectator(room));
    else if (myName) socket.emit('game_state', engine.stateForPlayer(room, myName));
  });

  // New hand
  socket.on('new_hand', cb => {
    const room = rooms.get(myRoomId);
    if (!room || room.state.phase !== 'showdown') { cb?.({ success: false }); return; }
    handActionLogs.delete(myRoomId);
    engine.rotateDealerForNewHand(room);
    engine.buildHand(room, db.getWinBoosts());
    io.to(myRoomId).emit('action_event', { type: 'new_hand', handNum: room.state.handNum });
    broadcastRoom(room);
    broadcastSpectators(room);
    startTurnTimer(room);
    cb?.({ success: true });
  });

  // Disconnect
  socket.on('disconnect', reason => {
    logger.info('socket', 'ניתוק', { sid: socket.id, myName, myRoomId, reason });

    // Remove from spectator set if applicable
    if (myRoomId) {
      spectatorSockets.get(myRoomId)?.delete(socket.id);
    }

    const room = rooms.get(myRoomId);
    if (!room || isSpectator || !myName) return;

    const p = room.state.players.find(x => x.name === myName);
    if (p) p.connected = false;
    broadcastToRoom(room, 'player_disconnected', { playerName: myName });

    // Clean up room after 5 min if all players disconnected
    setTimeout(() => {
      const r = rooms.get(myRoomId);
      if (!r) return;
      if (r.state.players.every(x => !x.connected)) {
        clearTurnTimer(myRoomId);
        handActionLogs.delete(myRoomId);
        spectatorSockets.delete(myRoomId);
        rooms.delete(myRoomId);
        db.deleteRoom(myRoomId);
        logger.info('room', 'חדר נמחק (כולם התנתקו)', { roomId: myRoomId });
      }
    }, 5 * 60 * 1000);
  });
});

// ── Server startup ─────────────────────────────────────────────────────────
async function start() {
  // Initialize database (creates tables, loads cache)
  await db.pgInit();
  logger.info('db', db.IS_PG ? 'PostgreSQL מחובר' : 'מצב JSON מקומי');

  // Restore active rooms from DB (PostgreSQL only)
  const restored = await db.loadActiveRooms();
  for (const r of restored) {
    rooms.set(r.id, r);
    logger.info('room', 'חדר שוחזר מ-DB', { roomId: r.id, phase: r.state.phase, players: r.state.players.length });
  }
  if (restored.length > 0) logger.info('db', `שוחזרו ${restored.length} חדרים פעילים`);

  httpServer.listen(PORT, () => {
    console.log(`\n🃏  Vault Poker Server on http://localhost:${PORT}`);
    console.log(`🔑  Admin password: ${db.getAdminPassword()}`);
    console.log(`🗄️   Database: ${db.IS_PG ? 'PostgreSQL' : 'JSON file'}\n`);
  });
}

start().catch(err => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
