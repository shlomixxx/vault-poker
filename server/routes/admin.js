'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Middleware: verify admin password from Authorization header
function auth(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (!pwd || pwd !== db.getAdminPassword()) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }
  next();
}

// POST /api/admin/login — verify password
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === db.getAdminPassword()) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'סיסמה שגויה' });
  }
});

// GET /api/admin/win-boosts — all win boost settings
router.get('/win-boosts', auth, (req, res) => {
  res.json(db.getWinBoosts());
});

// PUT /api/admin/win-boosts/:name — set/update boost for a player
router.put('/win-boosts/:name', auth, (req, res) => {
  const { pct } = req.body;
  if (pct === undefined || isNaN(pct)) return res.status(400).json({ error: 'pct required' });
  db.setWinBoost(req.params.name, Number(pct));
  res.json({ success: true, player: req.params.name, pct: Number(pct) });
});

// DELETE /api/admin/win-boosts/:name — remove boost
router.delete('/win-boosts/:name', auth, (req, res) => {
  db.setWinBoost(req.params.name, 0);
  res.json({ success: true });
});

// GET /api/admin/history?limit=N — recent hand history
router.get('/history', auth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit)||100, 500);
  res.json(db.getHistory(limit));
});

// GET /api/admin/stats — win stats per player
router.get('/stats', auth, (req, res) => {
  res.json(db.getWinStats());
});

// GET /api/admin/rooms — active rooms (injected from server.js via req.app.locals)
router.get('/rooms', auth, (req, res) => {
  const rooms = req.app.locals.getRooms?.() || [];
  res.json(rooms);
});

// PUT /api/admin/password — change admin password
router.put('/password', auth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'סיסמה קצרה מדי (מינימום 4 תווים)' });
  db.setAdminPassword(newPassword);
  res.json({ success: true });
});

module.exports = router;
