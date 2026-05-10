'use strict';

/**
 * Compute side pots from cumulative per-player contributions.
 * contributions[i] = total chips player i has put into the pot this hand (including all streets).
 * players[i].f = true if the player folded.
 *
 * Returns an array of { amount, eligible } pots, sorted from main pot outwards.
 * Folded players' contributions are included in pot sizes but they are NOT eligible.
 */
function computePots(contributions, players) {
  const caps = [...new Set(contributions.filter(c => c > 0))].sort((a, b) => a - b);
  let prevCap = 0;
  const pots = [];

  for (const cap of caps) {
    const level    = cap - prevCap;
    const cnt      = contributions.filter(c => c >= cap).length;
    const potAmt   = level * cnt;
    const eligible = players.reduce((acc, p, i) => {
      if (!p.f && contributions[i] >= cap) acc.push(i);
      return acc;
    }, []);
    if (potAmt > 0 && eligible.length > 0) pots.push({ amount: potAmt, eligible });
    prevCap = cap;
  }
  return pots;
}

/**
 * Award each pot to the best eligible hand (supports split pots on tie).
 * results[i] = evaluateHand result or null (folded).
 * Returns { winnings: {idx->amount}, summary: [{amount, winners, isSplit}] }.
 */
function awardPots(pots, results) {
  const winnings = {};
  const summary  = [];

  for (const { amount, eligible } of pots) {
    let best = -1;
    eligible.forEach(i => { if (results[i] && results[i].score > best) best = results[i].score; });
    const winners = eligible.filter(i => results[i] && results[i].score === best);
    if (!winners.length) continue;

    const share = Math.floor(amount / winners.length);
    const rem   = amount - share * winners.length;
    winners.forEach((i, idx) => {
      winnings[i] = (winnings[i] || 0) + share + (idx === 0 ? rem : 0);
    });
    summary.push({ amount, winners, isSplit: winners.length > 1 });
  }
  return { winnings, summary };
}

module.exports = { computePots, awardPots };
