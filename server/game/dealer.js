'use strict';

const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
const SUITS = ['h','d','c','s'];

function createDeck() {
  return RANKS.flatMap(r => SUITS.map(s => r+s));
}

function shuffleDeck(deck) {
  const d = [...deck];
  for (let i=d.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i],d[j]] = [d[j],d[i]];
  }
  return d;
}

// Normal random deal
function dealGame(n) {
  const deck = shuffleDeck(createDeck());
  return {
    holeCards: Array.from({length:n},(_,i) => [deck[i*2], deck[i*2+1]]),
    board: deck.slice(n*2, n*2+5),
    wasManipulated: false,
  };
}

// Premium starting hands (strongest first, randomised within tier)
const PREMIUM_TIERS = [
  // Tier 1 — Aces
  [['Ah','Ad'],['Ah','Ac'],['Ah','As'],['Ad','Ac'],['Ad','As'],['Ac','As']],
  // Tier 2 — Kings
  [['Kh','Kd'],['Kh','Kc'],['Kh','Ks'],['Kd','Kc'],['Kd','Ks'],['Kc','Ks']],
  // Tier 3 — Queens + AK suited
  [['Qh','Qd'],['Qh','Qc'],['Qh','Qs'],['Qd','Qc'],['Ah','Kh'],['Ad','Kd'],['Ac','Kc'],['As','Ks']],
  // Tier 4 — Jacks + AQ suited + AK offsuit
  [['Jh','Jd'],['Jh','Jc'],['Ah','Qh'],['Ad','Qd'],['Ah','Kd'],['Ad','Kc'],['As','Kh']],
];

function pickPremiumHand() {
  // Randomly choose a tier weighted toward Tier 1
  const tierWeights = [40, 30, 20, 10];
  const roll = Math.random() * 100;
  let acc = 0;
  let tierIdx = 0;
  for (let i=0; i<tierWeights.length; i++) {
    acc += tierWeights[i];
    if (roll < acc) { tierIdx = i; break; }
  }
  const tier = PREMIUM_TIERS[tierIdx];
  return tier[Math.floor(Math.random() * tier.length)];
}

// Deal with win boost — boostedIdx player gets a premium starting hand
function dealWithBoost(n, boostedIdx) {
  const premiumHand = pickPremiumHand();
  const deck = shuffleDeck(createDeck().filter(c => !premiumHand.includes(c)));

  const holeCards = new Array(n).fill(null);
  holeCards[boostedIdx] = premiumHand;

  let di = 0;
  for (let i=0; i<n; i++) {
    if (i !== boostedIdx) {
      holeCards[i] = [deck[di], deck[di+1]];
      di += 2;
    }
  }

  return {
    holeCards,
    board: deck.slice(di, di+5),
    wasManipulated: true,
  };
}

module.exports = { dealGame, dealWithBoost };
