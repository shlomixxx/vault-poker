// Game phase order
export const PHASES = ["preflop", "flop", "turn", "river", "showdown"];

// Display label per phase
export const PH_LABEL = {
  preflop:  "PRE-FLOP",
  flop:     "FLOP",
  turn:     "TURN",
  river:    "RIVER",
  showdown: "SHOWDOWN 🏆",
};

// How many community cards are visible per phase
export const PH_REVEAL = {
  preflop:  0,
  flop:     3,
  turn:     4,
  river:    5,
  showdown: 5,
};
