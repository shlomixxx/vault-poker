import { useState } from "react";

/**
 * Collapsible settings section used in the lobby.
 */
export function Section({ title, children }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.04)", overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "10px 14px", background: "none", border: "none",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          cursor: "pointer", color: "#ddd", fontSize: 13, fontWeight: 700,
        }}
      >
        {title}
        <span style={{ fontSize: 10, color: "#666" }}>{open ? "▼" : "▶"}</span>
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}
