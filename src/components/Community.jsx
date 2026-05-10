import { useState, useEffect } from "react";
import { Card } from "./Card";

/**
 * The five community cards on the board.
 * Cards flip from face-down to face-up as each street is dealt.
 */
export function Community({ board, count, pkey, highlightCards = [] }) {
  const [faceDown, setFaceDown] = useState([1, 1, 1, 1, 1]);

  useEffect(() => {
    if (!count) { setFaceDown([1, 1, 1, 1, 1]); return; }
    const timers = [];
    for (let i = 0; i < 5; i++) {
      if (i < count) {
        timers.push(
          setTimeout(() => {
            setFaceDown(prev => {
              const next = [...prev];
              next[i] = 0;
              return next;
            });
          }, 400 + (count <= 3 && i < 3 ? i * 250 : 0))
        );
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [count, pkey]);

  return (
    <div style={{
      display: "flex", gap: 4, padding: "5px 8px",
      background: "rgba(0,0,0,0.2)", borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.04)",
    }}>
      {board.map((card, i) =>
        i < count ? (
          <Card
            key={`${i}-${card}`}
            card={card}
            faceDown={!!faceDown[i]}
            w={44} h={62}
            delay={200 + i * 150}
            highlight={highlightCards.includes(card)}
            dim={highlightCards.length > 0 && !highlightCards.includes(card)}
          />
        ) : (
          <Card key={i} card={null} w={44} h={62} />
        )
      )}
    </div>
  );
}
