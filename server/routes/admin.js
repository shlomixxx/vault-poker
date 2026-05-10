'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

function auth(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (!pwd || pwd !== db.getAdminPassword()) return res.status(401).json({ error: 'סיסמה שגויה' });
  next();
}

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === db.getAdminPassword()) res.json({ success: true });
  else res.status(401).json({ success: false, error: 'סיסמה שגויה' });
});

router.get('/win-boosts', auth, (req, res) => {
  res.json(db.getWinBoosts());
});

router.put('/win-boosts/:name', auth, async (req, res) => {
  const { pct } = req.body;
  if (pct === undefined || isNaN(pct)) return res.status(400).json({ error: 'pct required' });
  try {
    await db.setWinBoost(req.params.name, Number(pct));
    res.json({ success: true, player: req.params.name, pct: Number(pct) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/win-boosts/:name', auth, async (req, res) => {
  try {
    await db.setWinBoost(req.params.name, 0);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    res.json(await db.getHistory(limit));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    res.json(await db.getWinStats());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/rooms', auth, (req, res) => {
  res.json(req.app.locals.getRooms?.() || []);
});

router.put('/password', auth, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'סיסמה קצרה מדי (מינימום 4 תווים)' });
  try {
    await db.setAdminPassword(newPassword);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
