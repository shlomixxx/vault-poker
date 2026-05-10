import { useState, useEffect } from "react";
import { hb, globalCSS } from "../styles/ui";

const SERVER = import.meta.env.VITE_SERVER_URL ?? "";

async function fetchJSON(url) {
  const r = await fetch(`${SERVER}${url}`);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "עכשיו";
  if (d < 3600) return `${Math.floor(d / 60)}ד'`;
  if (d < 86400) return `${Math.floor(d / 3600)}ש'`;
  return `${Math.floor(d / 86400)}י'`;
}

function WinRateBar({ pct }) {
  const n = parseFloat(pct) || 0;
  const color = n >= 50 ? "#22C55E" : n >= 30 ? "#E5C94B" : "#FF6B6B";
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", width: "100%", marginTop: 3 }}>
      <div style={{ height: "100%", width: `${n}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
  );
}

export function StatsScreen({ onExit }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [selected,    setSelected]    = useState(null); // player name for detail view
  const [detail,      setDetail]      = useState(null); // detailed stats object
  const [loading,     setLoading]     = useState(true);
  const [detailLoad,  setDetailLoad]  = useState(false);
  const [search,      setSearch]      = useState("");
  const [tab,         setTab]         = useState("leaderboard"); // leaderboard | history

  useEffect(() => {
    fetchJSON("/api/stats")
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
      .finally(() => setLoading(false));
  }, []);

  const selectPlayer = async (name) => {
    setSelected(name);
    setTab("history");
    setDetailLoad(true);
    try {
      const d = await fetchJSON(`/api/stats/${encodeURIComponent(name)}`);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoad(false);
    }
  };

  const filtered = leaderboard.filter(p =>
    !search || p.winner_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 30%,#101A10,#060A06 60%,#030503)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 12px 60px", fontFamily: "'Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 560, marginBottom: 20 }}>
        <button onClick={onExit} style={{ ...hb, color: "#888" }}>← חזרה</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#C5A028", fontFamily: "Georgia,serif", letterSpacing: 3 }}>VAULT</div>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 2 }}>LEADERBOARD</div>
        </div>
        <div style={{ width: 48 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", width: "100%", maxWidth: 560 }}>
        {[["leaderboard","🏆 מובילים"],["history","📋 היסטוריה"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex:1, padding:"8px 4px", fontSize:11, fontWeight:700, cursor:"pointer", border:"none",
            background: tab===k ? "rgba(184,150,12,0.18)" : "transparent",
            color: tab===k ? "#E5C94B" : "#555",
          }}>{l}</button>
        ))}
      </div>

      {/* ── Leaderboard tab ── */}
      {tab === "leaderboard" && (
        <div style={{ width: "100%", maxWidth: 560 }}>
          {/* Search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 חפש שחקן..."
            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#DDD", marginBottom: 12, outline: "none", boxSizing: "border-box" }}
          />

          {loading ? (
            <div style={{ textAlign: "center", color: "#555", padding: 40, fontSize: 12 }}>טוען...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#555", padding: 40, fontSize: 12 }}>אין נתונים עדיין — שחקו כמה ידיים!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((p, idx) => (
                <div key={p.winner_name}
                  onClick={() => selectPlayer(p.winner_name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(184,150,12,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                >
                  {/* Rank badge */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: idx === 0 ? "linear-gradient(135deg,#C5A028,#92750A)"
                               : idx === 1 ? "linear-gradient(135deg,#9E9E9E,#616161)"
                               : idx === 2 ? "linear-gradient(135deg,#CD7F32,#8B4513)"
                               : "rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 900, color: idx < 3 ? "#FFF" : "#666",
                  }}>
                    {idx < 3 ? ["🥇","🥈","🥉"][idx] : idx + 1}
                  </div>

                  {/* Player info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#DDE", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.winner_name}
                    </div>
                    <WinRateBar pct={p.win_rate} />
                  </div>

                  {/* Stats */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#E5C94B", fontFamily: "Georgia,serif" }}>
                      {(p.total_chips_won || 0).toLocaleString()} 💰
                    </div>
                    <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>
                      {p.total_wins} ניצחונות · {p.win_rate}% win
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div style={{ width: "100%", maxWidth: 560 }}>
          {!selected ? (
            <div style={{ textAlign: "center", color: "#555", padding: 40, fontSize: 12 }}>
              בחר שחקן מלוח המובילים כדי לראות את ההיסטוריה שלו
            </div>
          ) : detailLoad ? (
            <div style={{ textAlign: "center", color: "#555", padding: 40, fontSize: 12 }}>טוען...</div>
          ) : !detail ? (
            <div style={{ textAlign: "center", color: "#FF4444", padding: 40, fontSize: 12 }}>שגיאה בטעינת נתונים</div>
          ) : (
            <div>
              {/* Player summary card */}
              <div style={{
                background: "rgba(184,150,12,0.07)", border: "1px solid rgba(184,150,12,0.18)",
                borderRadius: 12, padding: "14px 16px", marginBottom: 14,
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#E5C94B", fontFamily: "Georgia,serif", marginBottom: 8 }}>
                  {detail.name}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {[
                    ["🃏 ידיים", detail.total_hands],
                    ["🏆 ניצחונות", detail.total_wins],
                    ["📈 Win Rate", `${detail.win_rate}%`],
                    ["💰 צ'יפים", (detail.chips_won || 0).toLocaleString()],
                    ["🎰 Pot מקסימלי", (detail.biggest_pot || 0).toLocaleString()],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 7, padding: "5px 10px", minWidth: 80, textAlign: "center" }}>
                      <div style={{ fontSize: 8, color: "#888", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#DDD" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent hands */}
              <div style={{ fontSize: 10, color: "#666", marginBottom: 6, fontWeight: 600 }}>30 הידיים האחרונות</div>
              {(detail.recent_hands || []).length === 0 ? (
                <div style={{ textAlign: "center", color: "#555", padding: 20, fontSize: 12 }}>אין היסטוריה עדיין</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {detail.recent_hands.map((h) => {
                    const won = h.winnerName === detail.name;
                    return (
                      <div key={h.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: won ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.025)",
                        border: `1px solid ${won ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)"}`,
                        borderRadius: 8, padding: "8px 12px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14 }}>{won ? "🏆" : "📍"}</span>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: won ? "#22C55E" : "#888" }}>
                              {won ? `ניצחון · ${h.handHe || h.handEn}` : "השתתפות"}
                            </div>
                            <div style={{ fontSize: 9, color: "#555" }}>{h.roomName} · יד #{h.handNum}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {won && <div style={{ fontSize: 12, fontWeight: 800, color: "#E5C94B" }}>+{(h.pot||0).toLocaleString()}</div>}
                          <div style={{ fontSize: 9, color: "#555" }}>{timeAgo(h.playedAt)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{globalCSS}</style>
    </div>
  );
}
