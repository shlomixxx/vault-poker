import { Hand } from "./Hand";
import { TimerBar } from "./TimerBar";

/**
 * A player's seat: hole cards, name chip, bet badge, and timer strip.
 * Positioned absolutely within the table oval via the `pos` prop.
 *
 * Bottom-row seats (pos.bottom set) render the name chip ABOVE the cards
 * so the cards point toward the screen edge instead of into the community
 * row — otherwise the centered bottom seat's cards overlap the board.
 */
export function Seat({ p, pos, isMe, showAll, bet, active, timerData, handResult, isWinner, isDealer, hideSelfCards = false }) {
  const see = isMe || showAll;
  const highlightCards = handResult?.bestCards || [];
  // When hideSelfCards=true (online "me" seat), render JUST the name chip on
  // the table — no cards, no bet badge, no timer. Everything is in the bottom
  // panel instead. This guarantees the user's seat can never overlap the
  // community cards regardless of position math.
  const compactSelf = isMe && hideSelfCards;
  const showHandOnTable = !isMe || !hideSelfCards;
  // Top- and bottom-row seats render the name above the cards so cards point
  // into the table instead of off-screen (top row clips against the header,
  // bottom-center overlaps the community row).
  const isBottomSeat = pos?.bottom !== undefined;
  const topPct       = pos?.top ? parseFloat(pos.top) : null;
  const isTopSeat    = topPct !== null && topPct < 20;
  const flipLayout   = isBottomSeat || isTopSeat;

  const cardsEl = p.c && p.c.length > 0 && !p.f && showHandOnTable ? (
    <Hand
      cards={p.c} faceDown={!see}
      w={isMe ? 48 : 30} h={isMe ? 67 : 42} delay={300}
      highlightCards={showAll && isWinner ? highlightCards : []}
    />
  ) : p.f ? (
    <div style={{ height: 12, display: "flex", alignItems: "center" }}>
      <span style={{ fontSize: 7, color: "#E53935", fontWeight: 800, letterSpacing: 1.5 }}>FOLD</span>
    </div>
  ) : null;

  const nameChipEl = (
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
  );

  const handNameEl = showAll && handResult && !p.f && (
    <div style={{ marginTop: 1, textAlign: "center" }}>
      <span style={{ fontSize: 7, fontWeight: 800, color: isWinner ? "#E5C94B" : "#777", textShadow: isWinner ? "0 0 6px rgba(184,150,12,0.5)" : "none" }}>
        {handResult.nameHe}
      </span>
    </div>
  );

  const betBadgeEl = bet > 0 && !p.f && !showAll && (
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
  );

  const timerEl = active && timerData && <TimerBar {...timerData} />;

  return (
    <div style={{
      position: "absolute", ...pos,
      transform: "translate(-50%,-50%)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      zIndex: active || isWinner ? 15 : 5,
      opacity: p.f ? 0.25 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* compactSelf: same flow as flipLayout but cards skipped — they live
          in the bottom "הקלפים שלך" panel for the user themselves. */}
      {flipLayout ? (
        <>
          {/* Name first so cards face into the table instead of off-screen */}
          {betBadgeEl}
          {nameChipEl}
          {handNameEl}
          {!compactSelf && cardsEl}
          {timerEl}
        </>
      ) : (
        <>
          {!compactSelf && cardsEl}
          {nameChipEl}
          {handNameEl}
          {betBadgeEl}
          {timerEl}
        </>
      )}
    </div>
  );
}
