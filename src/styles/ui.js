// ── Inline style objects shared across lobby and game screens ──

export const lbl = {
  fontSize: 10, color: "#888", display: "block",
  marginBottom: 4, letterSpacing: 0.5, fontWeight: 600,
};

export const inp = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  color: "#E2E8F0", fontSize: 13, outline: "none",
  fontFamily: "Georgia,serif", boxSizing: "border-box",
};

// Base slider style — override `background` inline to reflect the current value
export const sliderStyle = {
  width: "100%", height: 3, appearance: "none", outline: "none",
  background: "linear-gradient(90deg,#C5A028 50%,rgba(255,255,255,0.04) 50%)",
  borderRadius: 2, cursor: "pointer",
};

export const primaryBtn = {
  width: "100%", padding: "12px", borderRadius: 12,
  background: "linear-gradient(135deg,#C5A028,#92750A)",
  border: "none", color: "#111", fontSize: 14, fontWeight: 800,
  cursor: "pointer", letterSpacing: 2, marginTop: 12,
};

// Header icon button (e.g. "← יציאה")
export const hb = {
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(184,150,12,0.12)",
  borderRadius: 6, color: "#C5A028", padding: "3px 8px",
  fontSize: 10, cursor: "pointer", fontWeight: 600,
};

// Action button factory — pass text color + border color
export const abtn = (c, bc) => ({
  flex: 1, padding: "10px 2px 8px", borderRadius: 8,
  background: "transparent", border: `1px solid ${bc}`,
  color: c, cursor: "pointer", display: "flex",
  flexDirection: "column", alignItems: "center",
  minHeight: 48, justifyContent: "center",
  WebkitTapHighlightColor: "transparent",
});

// Global CSS injected once by GameScreen via <style>
export const globalCSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{margin:0;background:#030503;overflow-x:hidden}
  button{touch-action:manipulation}
  @keyframes glow{
    0%,100%{box-shadow:0 0 10px rgba(184,150,12,0.25),0 1px 5px rgba(0,0,0,0.5)}
    50%{box-shadow:0 0 20px rgba(184,150,12,0.45),0 1px 5px rgba(0,0,0,0.5)}
  }
  @keyframes winGlow{
    0%,100%{box-shadow:0 0 12px rgba(184,150,12,0.4),0 0 0 2px rgba(184,150,12,0.2)}
    50%{box-shadow:0 0 24px rgba(184,150,12,0.7),0 0 0 3px rgba(184,150,12,0.3)}
  }
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
  @keyframes fadeIn{
    from{opacity:0;transform:translateX(-50%) translateY(-6px)}
    to{opacity:1;transform:translateX(-50%) translateY(0)}
  }
  @keyframes fadeInUp{
    from{opacity:0;transform:translateY(20px)}
    to{opacity:1;transform:translateY(0)}
  }
  input[type=range]::-webkit-slider-thumb{
    -webkit-appearance:none;width:18px;height:18px;border-radius:50%;
    background:linear-gradient(135deg,#C5A028,#92750A);
    border:1.5px solid rgba(255,255,255,0.2);cursor:pointer
  }
  input[type=range]::-moz-range-thumb{
    width:18px;height:18px;border-radius:50%;
    background:linear-gradient(135deg,#C5A028,#92750A);
    border:1.5px solid rgba(255,255,255,0.2);cursor:pointer
  }
  select{-webkit-appearance:none}
  @media(max-width:640px){
    .vault-action-bar{padding:6px 6px env(safe-area-inset-bottom,10px) !important}
    .vault-top-bar{padding:6px 8px 2px !important}
    .vault-raise-row{gap:4px !important}
  }
`;
