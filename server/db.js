'use strict';

/**
 * Persistence layer.
 * Production (DATABASE_URL set) → PostgreSQL via pg.
 * Local dev (no DATABASE_URL)   → JSON file fallback (server/data.json).
 */

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const IS_PG = !!process.env.DATABASE_URL;

// ── JSON fallback ─────────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data.json');
const DEFAULT   = {
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  winBoosts: {},
  handHistory: [],
};

function jsonLoad() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { ...DEFAULT }; }
}
function jsonSave(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}
if (!IS_PG && !fs.existsSync(DATA_FILE)) jsonSave(DEFAULT);

// ── PostgreSQL pool + in-memory cache ────────────────────────────────────────
let pool = null;
let _cache = {
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  winBoosts:     {},
};

async function pgInit() {
  if (!IS_PG) return; // nothing to do in local mode

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS win_boosts (
      player_name TEXT PRIMARY KEY,
      pct         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hand_history (
      id              BIGINT PRIMARY KEY,
      room_id         TEXT,
      room_name       TEXT,
      hand_num        INTEGER,
      winner_name     TEXT,
      pot             INTEGER,
      hand_en         TEXT,
      hand_he         TEXT,
      was_manipulated BOOLEAN,
      board           JSONB,
      actions         JSONB,
      players         JSONB,
      pot_summary     JSONB,
      played_at       BIGINT
    );

    CREATE TABLE IF NOT EXISTS active_rooms (
      room_id       TEXT PRIMARY KEY,
      room_name     TEXT,
      settings      JSONB,
      state         JSONB,
      rake_owner    TEXT,
      hand_log      JSONB,
      last_activity TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed admin password (first run only)
  await pool.query(
    `INSERT INTO settings(key, value) VALUES('adminPassword', $1) ON CONFLICT DO NOTHING`,
    [_cache.adminPassword],
  );

  // Load cache from DB
  const [pwRows, boostRows] = await Promise.all([
    pool.query("SELECT value FROM settings WHERE key = 'adminPassword'"),
    pool.query('SELECT player_name, pct FROM win_boosts'),
  ]);
  if (pwRows.rows.length) _cache.adminPassword = pwRows.rows[0].value;
  for (const r of boostRows.rows) _cache.winBoosts[r.player_name] = r.pct;
}

// ── Win boosts ────────────────────────────────────────────────────────────────
function getWinBoosts() {
  if (!IS_PG) return jsonLoad().winBoosts || {};
  return _cache.winBoosts; // always from in-memory cache
}

async function setWinBoost(playerName, pct) {
  if (!IS_PG) {
    const data = jsonLoad();
    data.winBoosts = data.winBoosts || {};
    if (!pct || pct <= 0) delete data.winBoosts[playerName];
    else data.winBoosts[playerName] = Math.max(0, Math.min(100, pct));
    jsonSave(data);
    return;
  }
  if (!pct || pct <= 0) {
    delete _cache.winBoosts[playerName];
    await pool.query('DELETE FROM win_boosts WHERE player_name = $1', [playerName]);
  } else {
    const v = Math.max(0, Math.min(100, pct));
    _cache.winBoosts[playerName] = v;
    await pool.query(
      `INSERT INTO win_boosts(player_name, pct) VALUES($1, $2)
       ON CONFLICT(player_name) DO UPDATE SET pct = $2`,
      [playerName, v],
    );
  }
}

// ── Hand history ──────────────────────────────────────────────────────────────
async function saveHandResult({
  roomId, roomName, handNum, winnerName, pot,
  handEn, handHe, wasManipulated, board, actions, players, potSummary,
}) {
  const id = Date.now();
  if (!IS_PG) {
    const data = jsonLoad();
    data.handHistory = data.handHistory || [];
    data.handHistory.push({
      id, roomId, roomName, handNum, winnerName, pot,
      handEn: handEn || '', handHe: handHe || '',
      wasManipulated: !!wasManipulated,
      board: board || [], actions: actions || [],
      players: players || [], potSummary: potSummary || [],
      playedAt: id,
    });
    if (data.handHistory.length > 500) data.handHistory = data.handHistory.slice(-500);
    jsonSave(data);
    return;
  }
  await pool.query(
    `INSERT INTO hand_history(
       id, room_id, room_name, hand_num, winner_name, pot,
       hand_en, hand_he, was_manipulated,
       board, actions, players, pot_summary, played_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT(id) DO NOTHING`,
    [
      id, roomId, roomName, handNum, winnerName, pot || 0,
      handEn || '', handHe || '', !!wasManipulated,
      JSON.stringify(board || []), JSON.stringify(actions || []),
      JSON.stringify(players || []), JSON.stringify(potSummary || []),
      id,
    ],
  );
}

async function getHistory(limit = 50) {
  if (!IS_PG) {
    const h = jsonLoad().handHistory || [];
    return h.slice(-limit).reverse();
  }
  const { rows } = await pool.query(
    'SELECT * FROM hand_history ORDER BY played_at DESC LIMIT $1',
    [Math.min(limit, 500)],
  );
  return rows.map(r => ({
    id:             Number(r.id),
    roomId:         r.room_id,
    roomName:       r.room_name,
    handNum:        r.hand_num,
    winnerName:     r.winner_name,
    pot:            r.pot,
    handEn:         r.hand_en,
    handHe:         r.hand_he,
    wasManipulated: r.was_manipulated,
    board:          r.board,
    actions:        r.actions,
    players:        r.players,
    potSummary:     r.pot_summary,
    playedAt:       Number(r.played_at),
  }));
}

async function getWinStats() {
  if (!IS_PG) {
    const stats = {};
    for (const h of (jsonLoad().handHistory || [])) {
      if (!stats[h.winnerName])
        stats[h.winnerName] = { winner_name: h.winnerName, total_wins: 0, boosted_wins: 0, total_chips_won: 0 };
      stats[h.winnerName].total_wins++;
      stats[h.winnerName].total_chips_won += (h.pot || 0);
      if (h.wasManipulated) stats[h.winnerName].boosted_wins++;
    }
    return Object.values(stats).sort((a, b) => b.total_wins - a.total_wins);
  }
  const { rows } = await pool.query(`
    SELECT
      winner_name,
      COUNT(*)                                         AS total_wins,
      SUM(pot)                                         AS total_chips_won,
      SUM(CASE WHEN was_manipulated THEN 1 ELSE 0 END) AS boosted_wins
    FROM hand_history
    GROUP BY winner_name
    ORDER BY total_wins DESC
  `);
  return rows.map(r => ({
    winner_name:     r.winner_name,
    total_wins:      Number(r.total_wins),
    total_chips_won: Number(r.total_chips_won),
    boosted_wins:    Number(r.boosted_wins),
  }));
}

// ── Admin password ────────────────────────────────────────────────────────────
function getAdminPassword() {
  if (!IS_PG) return jsonLoad().adminPassword || DEFAULT.adminPassword;
  return _cache.adminPassword;
}

async function setAdminPassword(newPassword) {
  if (!IS_PG) {
    const data = jsonLoad();
    data.adminPassword = newPassword;
    jsonSave(data);
    return;
  }
  _cache.adminPassword = newPassword;
  await pool.query(
    `INSERT INTO settings(key, value) VALUES('adminPassword', $1)
     ON CONFLICT(key) DO UPDATE SET value = $1`,
    [newPassword],
  );
}

// ── Active rooms (PostgreSQL only — no-op in local dev) ───────────────────────
async function saveRoom(room) {
  if (!IS_PG) return;
  try {
    await pool.query(
      `INSERT INTO active_rooms(room_id, room_name, settings, state, rake_owner, hand_log, last_activity)
       VALUES($1,$2,$3,$4,$5,$6, NOW())
       ON CONFLICT(room_id) DO UPDATE SET
         room_name=$2, settings=$3, state=$4,
         rake_owner=$5, hand_log=$6, last_activity=NOW()`,
      [
        room.id, room.name,
        JSON.stringify(room.settings),
        JSON.stringify(room.state),
        room.rakeOwner || null,
        JSON.stringify(room.handLog || []),
      ],
    );
  } catch (e) {
    // fire-and-forget; caller logs if needed
    console.error('[db] saveRoom error:', e.message);
  }
}

async function deleteRoom(roomId) {
  if (!IS_PG) return;
  try {
    await pool.query('DELETE FROM active_rooms WHERE room_id = $1', [roomId]);
  } catch (e) {
    console.error('[db] deleteRoom error:', e.message);
  }
}

async function loadActiveRooms() {
  if (!IS_PG) return [];
  try {
    // Only restore rooms active in the last 2 hours
    const { rows } = await pool.query(
      `SELECT * FROM active_rooms
       WHERE last_activity > NOW() - INTERVAL '2 hours'`,
    );
    return rows.map(r => ({
      id:        r.room_id,
      name:      r.room_name,
      settings:  r.settings,
      state:     {
        ...r.state,
        // Mark all players disconnected — they must reconnect
        players: (r.state.players || []).map(p => ({ ...p, connected: false })),
      },
      rakeOwner: r.rake_owner,
      handLog:   r.hand_log || [],
      socketMap: {}, // rebuilt as players rejoin
    }));
  } catch (e) {
    console.error('[db] loadActiveRooms error:', e.message);
    return [];
  }
}

module.exports = {
  pgInit,
  IS_PG,
  getWinBoosts,
  setWinBoost,
  saveHandResult,
  getHistory,
  getWinStats,
  getAdminPassword,
  setAdminPassword,
  saveRoom,
  deleteRoom,
  loadActiveRooms,
};
