'use strict';

const RANK_VAL = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
  'T':10,'J':11,'Q':12,'K':13,'A':14,
};

const HAND_NAMES_HE = [
  'קלף גבוה','זוג','שני זוגות','שלישייה',
  'סטרייט','פלאש','פול האוס','רביעייה',
  'סטרייט פלאש','רויאל פלאש',
];

function parseCard(c) {
  const r = c.length === 3 ? c.slice(0,2) : c[0];
  return { rank: RANK_VAL[r] || 0, suit: c[c.length-1], str: c };
}

function getCombinations(arr, k) {
  const result = [];
  function helper(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); helper(i+1,combo); combo.pop(); }
  }
  helper(0, []);
  return result;
}

function evaluate5(cards) {
  const sorted = [...cards].sort((a,b) => b.rank - a.rank);
  const ranks  = sorted.map(c => c.rank);
  const suits  = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = false, straightHigh = 0;

  if (ranks[0]-ranks[1]===1 && ranks[1]-ranks[2]===1 && ranks[2]-ranks[3]===1 && ranks[3]-ranks[4]===1) {
    isStraight = true; straightHigh = ranks[0];
  }
  if (ranks[0]===14 && ranks[1]===5 && ranks[2]===4 && ranks[3]===3 && ranks[4]===2) {
    isStraight = true; straightHigh = 5;
  }

  const counts = {};
  ranks.forEach(r => { counts[r] = (counts[r]||0)+1; });
  const groups = Object.entries(counts)
    .map(([r,c]) => ({ rank:+r, count:c }))
    .sort((a,b) => b.count-a.count || b.rank-a.rank);

  let handRank=0, score=0, name='';

  if (isStraight && isFlush) {
    handRank = straightHigh===14 ? 9 : 8;
    name = straightHigh===14 ? 'Royal Flush' : 'Straight Flush';
    score = handRank*1000000 + straightHigh;
  } else if (groups[0].count===4) {
    handRank=7; name='Four of a Kind';
    score = handRank*1000000 + groups[0].rank*100 + groups[1].rank;
  } else if (groups[0].count===3 && groups[1].count===2) {
    handRank=6; name='Full House';
    score = handRank*1000000 + groups[0].rank*100 + groups[1].rank;
  } else if (isFlush) {
    handRank=5; name='Flush';
    score = handRank*1000000 + ranks[0]*10000+ranks[1]*1000+ranks[2]*100+ranks[3]*10+ranks[4];
  } else if (isStraight) {
    handRank=4; name='Straight';
    score = handRank*1000000 + straightHigh;
  } else if (groups[0].count===3) {
    handRank=3; name='Three of a Kind';
    score = handRank*1000000 + groups[0].rank*10000+groups[1].rank*100+groups[2].rank;
  } else if (groups[0].count===2 && groups[1].count===2) {
    handRank=2; name='Two Pair';
    const hi=Math.max(groups[0].rank,groups[1].rank), lo=Math.min(groups[0].rank,groups[1].rank);
    score = handRank*1000000 + hi*10000+lo*100+groups[2].rank;
  } else if (groups[0].count===2) {
    handRank=1; name='Pair';
    score = handRank*1000000 + groups[0].rank*10000+groups[1].rank*100+groups[2].rank*10+groups[3].rank;
  } else {
    handRank=0; name='High Card';
    score = ranks[0]*10000+ranks[1]*1000+ranks[2]*100+ranks[3]*10+ranks[4];
  }

  return { handRank, score, name, nameHe: HAND_NAMES_HE[handRank], cards: sorted.map(c=>c.str) };
}

function evaluateHand(holeCards, boardCards) {
  if (!holeCards || holeCards.length < 2) return null;
  const all = [...holeCards, ...boardCards.filter(Boolean)].map(parseCard);
  if (all.length < 5) return { handRank:0, score:0, name:'?', nameHe:'?', cards:[], bestCards:[] };
  const combos = getCombinations(all, 5);
  let best = null;
  for (const combo of combos) {
    const r = evaluate5(combo);
    if (!best || r.score > best.score) best = { ...r, bestCards: combo.map(c=>c.str) };
  }
  return best;
}

module.exports = { evaluateHand };
