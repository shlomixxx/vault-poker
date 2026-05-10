// Predefined table configurations selectable from the lobby
export const PRESETS = {
  fast:   { label: "🚀 מהיר",   buyIn: 500,  sb: 5,  bb: 10, timer: 15, bank: 30,  rebuy: false, blindsUp: false },
  normal: { label: "🎯 רגיל",   buyIn: 1000, sb: 10, bb: 20, timer: 30, bank: 60,  rebuy: true,  blindsUp: false },
  tourney:{ label: "🏆 טורניר", buyIn: 2000, sb: 10, bb: 20, timer: 30, bank: 60,  rebuy: false, blindsUp: true  },
  turbo:  { label: "⚡ טורבו",  buyIn: 1000, sb: 10, bb: 20, timer: 15, bank: 30,  rebuy: false, blindsUp: true  },
};
