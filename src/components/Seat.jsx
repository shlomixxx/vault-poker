import { Hand } from "./Hand";
import { TimerBar } from "./TimerBar";

/**
 * A player's seat: hole cards, name chip, bet badge, and timer strip.
 * Positioned absolutely within the table oval via the `pos` prop.
 */
export function Seat({ p, pos, isMe, showAll, bet, active, timerData, handResult, isWinner, isDealer, hideSelfCards = false }) {
  const see = isMe || showAll;
  const highlightCards = handResult?.bestCards || [];
  // hideSelfCards=true → "me" is rendered in the bottom panel.
  // Keep it that way even at showdown so the user's tall cards don't overlap
  // the community row on narrow phones.
  const showHandOnTable = !isMe || !hideSelfCards;

  return (
    <div style={{
      position: "absolute", ...pos,
      transform: "translate(-50%,-50%)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      zIndex: active || isWinner ? 15 : 5,
      opacity: p.f ? 0.25 : 1,
      transition: "opacity 0.3s",
    }}>

      {/* Hole cards or FOLD label */}
      {p.c && p.c.length > 0 && !p.f && showHandOnTable ? (
        <Hand
          cards={p.c} faceDown={!see}
          w={isMe ? 48 : 30} h={isMe ? 67 : 42} delay={300}
          highlightCards={showAll && isWinner ? highlightCards : []}
        />
      ) : p.f ? (
        <div style={{ height: 12, display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 7, color: "#E53935", fontWeight: 800, letterSpacing: 1.5 }}>FOLD</span>
        </div>
      ) : null}

      {/* Name chip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        background: isWinner ? "rgba(184,150,12,0.3)" : active ? "rgba(184,150,12,0.22)" : isMe ? "rgba(50,90,180,0.2)" : "rgba(8,8,20,0.88)",
        padding: "3px 7px 3px 3px", borderRadius: 14,
        border: isWinner ? "2px solid #C5A028" : active ? "1.5px solid #C5A028" : isMe ? "1.5px solid rgba(100,160,255,0.35)" : "1px solid rgba(255,255,255,0.05)",
        boxShadow: isWinner ? "0 0 16px rgba(184,150,12,0.5)" : active ? "0 0 12px rgba(184,150,12,0.35)" : "0 1px 5px rgba(0,0,0,0.5)",
        animation: active ? "glow 1.8s ease-in-out infinite" : isWinner ? "winGlow 1.5s ease-in-out infinite" : "none",
        backdropFilter: "blur(6px)",
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%",
          background: "linear-gradient(135deg,#1a1a3e,#2a2a5e)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, flexShrink: 0,
        }}>
          {p.a}
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: isMe ? "#8AB4FF" : "#DDE", lineHeight: 1, whiteSpace: "nowrap" }}>
            {p.n}{isMe && " ⭐"}{isDealer && " 🎴"}
          </div>
          <div style={{ fontSize: 7, color: p.ch <= 0 ? "#E53935" : "#C5A028", fontWeight: 700, lineHeight: 1.1 }}>
            {p.ch <= 0 ? "ALL IN" : p.ch.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Hand name — plain text only, no box (winner banner shows it prominently) */}
      {showAll && handResult && !p.f && (
        <div style={{ marginTop: 1, textAlign: "center" }}>
          <span style={{ fontSize: 7, fontWeight: 800, color: isWinner ? "#E5C94B" : "#777", textShadow: isWinner ? "0 0 6px rgba(184,150,12,0.5)" : "none" }}>
            {handResult.nameHe}
          </span>
        </div>
      )}

      {/* Current bet badge */}
      {bet > 0 && !p.f && !showAll && (
        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          background: "rgba(0,0,0,0.55)", borderRadius: 10,
          padding: "1px 6px 1px 2px", border: "1px solid rgba(184,150,12,0.1)",
        }}>
          <div style={{
            width: 9, height: 9, borderRadius: "50%",
            background: "linear-gradient(135deg,#C5A028,#92750A)",
            border: "1px solid rgba(255,255,255,0.15)",
          }} />
          <span style={{ fontSize: 8, fontWeight: 800, color: "#E5C94B" }}>{bet}</span>
        </div>
      )}

      {active && timerData && <TimerBar {...timerData} />}
    </div>
  );
}
