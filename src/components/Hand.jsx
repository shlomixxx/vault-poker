import { Card } from "./Card";

/**
 * Two hole cards fanned slightly for a player seat.
 */
export function Hand({ cards, faceDown, w = 30, h = 42, delay = 0, highlightCards = [] }) {
  if (!cards) return null;
  const overlap = w * 0.45;

  return (
    <div style={{ position: "relative", width: w * 2 - overlap, height: h, flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: 0, zIndex: 1, transform: "rotate(-4deg)" }}>
        <Card
          card={cards[0]} faceDown={faceDown} w={w} h={h}
          delay={delay} highlight={highlightCards.includes(cards[0])}
        />
      </div>
      <div style={{ position: "absolute", left: w - overlap, top: 0, zIndex: 2, transform: "rotate(4deg)" }}>
        <Card
          card={cards[1]} faceDown={faceDown} w={w} h={h}
          delay={delay + 80} highlight={highlightCards.includes(cards[1])}
        />
      </div>
    </div>
  );
}
