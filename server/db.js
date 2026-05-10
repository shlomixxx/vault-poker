'use strict';

/**
 * File-based JSON persistence — no native dependencies, works on any Node version.
 * Data is stored in server/data.json next to this file.
 */

const fs   = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

// ── Default state ───────────────────────────────────────────────────────────
const DEFAULT = {
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  winBoosts: {},     // { playerName: pct }
  handHistory: [],   // array of hand result objects
};

// ── Read / write helpers ────────────────────────────────────────────────────
function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { ...DEFAULT };
  }
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Ensure file exists on startup
if (!fs.existsSync(DATA_FILE)) save(DEFAULT);

// ── Win boosts ──────────────────────────────────────────────────────────────
function getWinBoosts() {
  return load().winBoosts || {};
}

function setWinBoost(playerName, pct) {
  const data = load();
  data.winBoosts = data.winBoosts || {};
  if (pct === null || pct === undefined || pct <= 0) {
    delete data.winBoosts[playerName];
  } else {
    data.winBoosts[playerName] = Math.max(0, Math.min(100, pct));
  }
  save(data);
}

// ── Hand history ────────────────────────────────────────────────────────────
function saveHandResult({ roomId, roomName, handNum, winnerName, pot, handEn, handHe, wasManipulated, board, actions, players, potSummary }) {
  const data = load();
  data.handHistory = data.handHistory || [];
  data.handHistory.push({
    id: Date.now(),
    roomId, roomName, handNum, winnerName, pot,
    handEn: handEn || '', handHe: handHe || '',
    wasManipulated: !!wasManipulated,
    board:       board     || [],
    actions:     actions   || [],
    players:     players   || [],
    potSummary:  potSummary || [],
    playedAt: Date.now(),
  });
  // Keep last 500 hands to prevent unbounded growth
  if (data.handHistory.length > 500) {
    data.handHistory = data.handHistory.slice(-500);
  }
  save(data);
}

function getHistory(limit = 50) {
  const history = load().handHistory || [];
  return history.slice(-limit).reverse();
}

function getWinStats() {
  const stats = {};
  for (const h of (load().handHistory || [])) {
    if (!stats[h.winnerName]) stats[h.winnerName] = { winner_name: h.winnerName, total_wins: 0, boosted_wins: 0, total_chips_won: 0 };
    stats[h.winnerName].total_wins++;
    stats[h.winnerName].total_chips_won += (h.pot || 0);
    if (h.wasManipulated) stats[h.winnerName].boosted_wins++;
  }
  return Object.values(stats).sort((a, b) => b.total_wins - a.total_wins);
}

// ── Admin password ──────────────────────────────────────────────────────────
function getAdminPassword() {
  return load().adminPassword || DEFAULT.adminPassword;
}

function setAdminPassword(newPassword) {
  const data = load();
  data.adminPassword = newPassword;
  save(data);
}

module.exports = { getWinBoosts, setWinBoost, saveHandResult, getHistory, getWinStats, getAdminPassword, setAdminPassword };
