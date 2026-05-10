// Returns an ordered 52-card deck (e.g. "Ah", "Kd", "2c")
export function createDeck() {
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  return ranks.flatMap(r => ["h", "d", "c", "s"].map(s => r + s));
}

// Fisher-Yates in-place shuffle — returns a new shuffled array
export function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Deal hole cards + board for n players from a single shuffled deck
export function dealGame(n) {
  const deck = shuffleDeck(createDeck());
  return {
    holeCards: Array.from({ length: n }, (_, i) => [deck[i * 2], deck[i * 2 + 1]]),
    board: deck.slice(n * 2, n * 2 + 5),
  };
}
