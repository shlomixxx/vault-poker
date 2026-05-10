/**
 * Compact horizontal timer strip shown below the active player's seat.
 * Turns orange when drawing from the time bank.
 */
export function TimerBar({ remaining, total, bankRemaining, bankTotal, inBank }) {
  const pct = inBank ? (bankRemaining / bankTotal) * 100 : (remaining / total) * 100;
  const color = inBank ? "#F97316" : pct > 50 ? "#22C55E" : pct > 20 ? "#EAB308" : "#EF4444";
  const critical = !inBank && pct <= 20;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, width: 60 }}>
      <div style={{
        flex: 1, height: 3, borderRadius: 2,
        background: "rgba(255,255,255,0.06)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 2, background: color,
          width: `${pct}%`, transition: "width 0.9s linear",
          animation: critical ? "blink 0.5s ease-in-out infinite" : "none",
        }} />
      </div>
      <span style={{
        fontSize: 8, fontWeight: 800, color,
        minWidth: 16, textAlign: "right", fontFamily: "Georgia,serif",
      }}>
        {inBank ? bankRemaining : remaining}
      </span>
    </div>
  );
}
