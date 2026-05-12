import { useState, useEffect } from "react";
import { Card } from "./Card";

/**
 * The five community cards on the board.
 * Cards flip from face-down to face-up as each street is dealt.
 *
 * `w`/`h` are passed in by the parent so the row scales with the table width
 * — without this, 5×44px cards (+gaps) overflow seats on narrow phones.
 */
export function Community({ board, count, pkey, highlightCards = [], w = 44, h = 62 }) {
  const [faceDown, setFaceDown] = useState([1, 1, 1, 1, 1]);
  const gap = Math.max(3, Math.round(w * 0.09));

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
      display: "flex", gap, padding: `${Math.max(3, w * 0.1)}px ${Math.max(5, w * 0.16)}px`,
      background: "rgba(0,0,0,0.2)", borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.04)",
    }}>
      {board.map((card, i) =>
        i < count ? (
          <Card
            key={`${i}-${card}`}
            card={card}
            faceDown={!!faceDown[i]}
            w={w} h={h}
            delay={200 + i * 150}
            highlight={highlightCards.includes(card)}
            dim={highlightCards.length > 0 && !highlightCards.includes(card)}
          />
        ) : (
          <Card key={i} card={null} w={w} h={h} />
        )
      )}
    </div>
  );
}
