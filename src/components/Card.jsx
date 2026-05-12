import { useState, useEffect } from "react";
import { SU } from "../constants/suits";

/**
 * Single playing card with flip animation.
 * Pass card=null for an empty placeholder slot.
 */
export function Card({ card, faceDown = false, w = 44, h = 62, delay = 0, highlight = false, dim = false }) {
  const [on, setOn] = useState(false);   // entrance animation triggered
  const [fl, setFl] = useState(faceDown); // face-down (back visible)

  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (faceDown) { setFl(true); return; }
    if (on) {
      const t = setTimeout(() => setFl(false), 150);
      return () => clearTimeout(t);
    }
  }, [faceDown, on]);

  // Empty placeholder slot
  if (!card && !faceDown) {
    return (
      <div style={{
        width: w, height: h, borderRadius: w * 0.1, flexShrink: 0,
        border: "1.5px dashed rgba(255,255,255,0.15)",
        background: "rgba(0,0,0,0.12)",
      }} />
    );
  }

  const rawRank  = card ? (card.length === 3 ? card.slice(0, 2) : card[0]) : "";
  const rank     = rawRank === "T" ? "10" : rawRank;
  const suitKey  = card ? card[card.length - 1] : "s";
  const su       = SU[suitKey] || SU.s;
  const isRed    = suitKey === "h" || suitKey === "d";
  // Sans-serif at a larger ratio reads better at small widths than Georgia 900.
  // "10" needs to be a bit narrower so it fits the corner without clipping.
  const fs       = rank === "10" ? Math.max(w * 0.34, 11) : Math.max(w * 0.44, 13);
  const suitFs   = Math.max(w * 0.30, 9);
  const rankFont = '"Helvetica Neue",Arial,sans-serif';

  return (
    <div style={{
      width: w, height: h, perspective: 600, flexShrink: 0,
      opacity: on ? (dim ? 0.35 : 1) : 0,
      transform: on ? (highlight ? "translateY(-4px) scale(1.08)" : "scale(1)") : "translateY(-40px) scale(0.3)",
      transition: `all 0.4s cubic-bezier(0.22,1.2,0.36,1) ${delay}ms`,
      filter: highlight ? "drop-shadow(0 0 8px rgba(212,175,55,0.7))" : "none",
    }}>
      <div style={{
        width: "100%", height: "100%", position: "relative",
        transformStyle: "preserve-3d",
        transform: fl ? "rotateY(180deg)" : "rotateY(0)",
        transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Card face */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          borderRadius: w * 0.1, background: "#FEFEFE",
          boxShadow: highlight
            ? "0 2px 12px rgba(212,175,55,0.5), 0 0 0 2px #C5A028"
            : "0 1px 4px rgba(0,0,0,0.3)",
          border: highlight ? "2px solid #C5A028" : "none",
          overflow: "hidden",
        }}>
          {/* Top-left corner */}
          <div style={{ position: "absolute", top: w * 0.05, left: w * 0.08, lineHeight: 0.95, textAlign: "left" }}>
            <div style={{ fontSize: fs, fontWeight: 800, color: su.cl, fontFamily: rankFont, letterSpacing: rank === "10" ? -1.5 : -0.5 }}>{rank}</div>
            <div style={{ fontSize: suitFs, color: su.cl, marginTop: 1, lineHeight: 1 }}>{su.c}</div>
          </div>
          {/* Center pip */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: Math.min(w * 0.5, 28), color: isRed ? "#EF5350" : "#37474F",
            opacity: 0.55, lineHeight: 1,
          }}>{su.c}</div>
          {/* Bottom-right corner (rotated) */}
          <div style={{ position: "absolute", bottom: w * 0.05, right: w * 0.08, lineHeight: 0.95, textAlign: "left", transform: "rotate(180deg)" }}>
            <div style={{ fontSize: fs, fontWeight: 800, color: su.cl, fontFamily: rankFont, letterSpacing: rank === "10" ? -1.5 : -0.5 }}>{rank}</div>
            <div style={{ fontSize: suitFs, color: su.cl, marginTop: 1, lineHeight: 1 }}>{su.c}</div>
          </div>
        </div>

        {/* Card back */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          transform: "rotateY(180deg)", borderRadius: w * 0.1,
          background: "linear-gradient(145deg,#1B1464,#0D0B3E)",
          border: "1.5px solid #B8960C", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: w * 0.3, color: "#B8960C", opacity: 0.25 }}>♠</span>
        </div>
      </div>
    </div>
  );
}
