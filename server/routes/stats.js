'use strict';

const express = require('express');
const db      = require('../db');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    const [stats, history] = await Promise.all([db.getWinStats(), db.getHistory(500)]);
    const handsPlayed = {};
    for (const h of history) {
      for (const p of (h.players || [])) {
        handsPlayed[p.name] = (handsPlayed[p.name] || 0) + 1;
      }
    }
    const enriched = stats.map(s => ({
      ...s,
      hands_played: handsPlayed[s.winner_name] || s.total_wins,
      win_rate: handsPlayed[s.winner_name]
        ? ((s.total_wins / handsPlayed[s.winner_name]) * 100).toFixed(1)
        : '100.0',
    }));
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:name', async (req, res) => {
  try {
    const name    = decodeURIComponent(req.params.name);
    const history = await db.getHistory(500);
    const mine    = history.filter(h =>
      h.winnerName === name || (h.players || []).some(p => p.name === name)
    ).slice(0, 30);

    const wins       = mine.filter(h => h.winnerName === name).length;
    const chipsWon   = mine.filter(h => h.winnerName === name).reduce((a, h) => a + (h.pot || 0), 0);
    const bestHand   = mine.find(h => h.winnerName === name)?.handEn || null;
    const biggestPot = Math.max(0, ...mine.filter(h => h.winnerName === name).map(h => h.pot || 0));

    res.json({
      name,
      total_hands:  mine.length,
      total_wins:   wins,
      win_rate:     mine.length ? ((wins / mine.length) * 100).toFixed(1) : '0.0',
      chips_won:    chipsWon,
      biggest_pot:  biggestPot,
      best_hand:    bestHand,
      recent_hands: mine,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
