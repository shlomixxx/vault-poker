import { useState, useEffect, useCallback } from "react";
import { PRESETS }      from "../constants/presets";
import { Section }      from "../components/Section";
import { Toggle }       from "../components/Toggle";
import { HelpButton }   from "../components/HelpButton";
import { useSocket }    from "../context/SocketContext";
import { lbl, inp, sliderStyle, primaryBtn } from "../styles/ui";

export function LobbyScreen({ onStart, onStartOnline }) {
  const { socket } = useSocket();

  // ── Offline state ──────────────────────────────────────────────────────────
  const [preset,   setPreset]   = useState("normal");
  const [settings, setSettings] = useState({
    ...PRESETS.normal,
    name: "ליל פוקר 🃏",
    password: "",
    maxPlayers: 9,
    minPlayers: 3,
    autoAction: "fold",
  });
  const [offlineTab, setOfflineTab] = useState("create");

  // ── Mode toggle ────────────────────────────────────────────────────────────
  const [mode, setMode] = useState("offline");

  // ── Online state ───────────────────────────────────────────────────────────
  const [playerName,     setPlayerName]     = useState("");
  const [rooms,          setRooms]          = useState([]);
  const [onlineTab,      setOnlineTab]      = useState("list");
  const [onlineSettings, setOnlineSettings] = useState({ ...PRESETS.normal, name: "ליל פוקר 🌐", maxPlayers: 6 });
  const [joinCode,       setJoinCode]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  const applyPreset = (k) => { setPreset(k); setSettings(s => ({ ...s, ...PRESETS[k] })); };
  const set    = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const setOL  = (k, v) => setOnlineSettings(s => ({ ...s, [k]: v }));

  // ── Fetch rooms when switching to online mode ──────────────────────────────
  const fetchRooms = useCallback(() => {
    if (!socket) return;
    socket.emit('list_rooms', (list) => setRooms(list || []));
  }, [socket]);

  useEffect(() => {
    if (mode !== 'online') return;
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [mode, fetchRooms]);

  // ── Online join ────────────────────────────────────────────────────────────
  const handleJoin = (code) => {
    const name = playerName.trim();
    if (!name)        { setError("הזן שם שחקן"); return; }
    if (!code.trim()) { setError("הזן קוד חדר"); return; }
    setError(null);
    setLoading(true);
    socket.emit('join_room', { roomId: code.trim().toUpperCase(), playerName: name }, (res) => {
      setLoading(false);
      if (res?.success) { onStartOnline(); }
      else { setError(res?.error || "שגיאה בהצטרפות"); }
    });
  };

  // ── Online create ──────────────────────────────────────────────────────────
  const handleCreate = () => {
    const name = playerName.trim();
    if (!name) { setError("הזן שם שחקן"); return; }
    setError(null);
    setLoading(true);
    socket.emit('create_room', { name: onlineSettings.name, settings: onlineSettings, playerName: name }, (res) => {
      setLoading(false);
      if (res?.success) { onStartOnline(); }
      else { setError(res?.error || "שגיאה ביצירת חדר"); }
    });
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const tabBtn = (active) => ({
    padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
    background: active ? "rgba(184,150,12,0.2)" : "rgba(255,255,255,0.02)",
    color: active ? "#E5C94B" : "#666",
  });

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 30%,#101A10,#060A06 60%,#030503)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "20px 16px 80px", fontFamily: "'Segoe UI',sans-serif",
    }}>
      <span style={{ fontSize: 28, fontWeight: 900, color: "#C5A028", letterSpacing: 5, fontFamily: "Georgia,serif", marginBottom: 4 }}>VAULT</span>
      <span style={{ fontSize: 11, color: "#555", letterSpacing: 3, marginBottom: 24 }}>POKER</span>

      {/* ── Mode tabs: Offline / Online ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(184,150,12,0.15)" }}>
        {[["offline", "🤖 אופליין"], ["online", "🌐 אונליין"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={tabBtn(mode === k)}>{l}</button>
        ))}
      </div>

      {/* ════════════════════════════ ONLINE MODE ════════════════════════════ */}
      {mode === "online" ? (
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 0 }}>

          {/* Player name */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>שם שחקן</label>
            <input value={playerName} onChange={e => setPlayerName(e.target.value)}
              placeholder="הקלד את שמך..." maxLength={20} style={inp} />
          </div>

          {/* Online sub-tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[["list", "🏠 חדרים"], ["join", "🔗 הצטרף"], ["create", "➕ צור"]].map(([k, l]) => (
              <button key={k} onClick={() => setOnlineTab(k)} style={{
                flex: 1, padding: "7px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none",
                background: onlineTab === k ? "rgba(184,150,12,0.15)" : "transparent",
                color: onlineTab === k ? "#E5C94B" : "#555",
              }}>{l}</button>
            ))}
          </div>

          {error && (
            <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#FF4444", marginBottom: 12 }}>
              {error}
            </div>
          )}

          {/* Rooms list */}
          {onlineTab === "list" && (
            <div>
              {rooms.length === 0 ? (
                <div style={{ textAlign: "center", color: "#555", fontSize: 12, padding: "24px 0" }}>
                  אין חדרים פתוחים כרגע<br />
                  <span style={{ fontSize: 10, color: "#444" }}>צור חדר חדש וזמן חברים</span>
                </div>
              ) : rooms.map(r => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#DDD" }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>קוד: <b style={{ color: "#C5A028", fontFamily: "Georgia,serif" }}>{r.id}</b> · {r.players}/{r.maxPlayers} שחקנים</div>
                  </div>
                  <button onClick={() => handleJoin(r.id)} disabled={loading} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, color: "#22C55E", padding: "6px 14px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>הצטרף</button>
                </div>
              ))}
              <button onClick={fetchRooms} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#555", padding: "7px", fontSize: 10, cursor: "pointer", marginTop: 4 }}>🔄 רענן</button>
            </div>
          )}

          {/* Join by code */}
          {onlineTab === "join" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>קוד חדר (6 תווים)</label>
                <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="AB4C2F" maxLength={6}
                  style={{ ...inp, fontSize: 22, textAlign: "center", letterSpacing: 8, fontFamily: "Georgia,serif" }} />
              </div>
              <button onClick={() => handleJoin(joinCode)} disabled={loading || !joinCode} style={primaryBtn}>
                {loading ? "מתחבר..." : "הצטרף 🔗"}
              </button>
            </div>
          )}

          {/* Create room */}
          {onlineTab === "create" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>שם החדר</label>
                <input value={onlineSettings.name} onChange={e => setOL("name", e.target.value)} style={inp} />
              </div>

              <div>
                <label style={lbl}>Buy-in</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[500, 1000, 2000, 5000].map(v => (
                    <button key={v} onClick={() => setOL("buyIn", v)} style={{
                      flex: 1, padding: "7px 2px", borderRadius: 7, fontSize: 11, fontWeight: 800, cursor: "pointer",
                      background: onlineSettings.buyIn === v ? "rgba(184,150,12,0.2)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${onlineSettings.buyIn === v ? "#C5A028" : "rgba(255,255,255,0.06)"}`,
                      color: onlineSettings.buyIn === v ? "#E5C94B" : "#888",
                    }}>{v >= 1000 ? `${v/1000}k` : v}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>SB</label>
                  <input type="number" value={onlineSettings.sb} onChange={e => setOL("sb", +e.target.value)} style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>BB</label>
                  <input type="number" value={onlineSettings.bb} onChange={e => setOL("bb", +e.target.value)} style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>שחקנים</label>
                  <select value={onlineSettings.maxPlayers} onChange={e => setOL("maxPlayers", +e.target.value)} style={inp}>
                    {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>⏱️ שניות לתור: <b style={{ color: "#E5C94B" }}>{onlineSettings.timer}s</b></label>
                <input type="range" min={10} max={90} step={5} value={onlineSettings.timer}
                  onChange={e => setOL("timer", +e.target.value)} style={sliderStyle} />
              </div>

              <button onClick={handleCreate} disabled={loading} style={primaryBtn}>
                {loading ? "יוצר..." : "צור חדר 🚀"}
              </button>
            </div>
          )}
        </div>

      ) : (
      /* ════════════════════════════ OFFLINE MODE ════════════════════════════ */
        <div style={{ width: "100%", maxWidth: 380 }}>

          {/* Offline sub-tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(184,150,12,0.15)" }}>
            {[["create", "צור שולחן 🃏"], ["join", "הצטרף 🔗"]].map(([k, l]) => (
              <button key={k} onClick={() => setOfflineTab(k)} style={tabBtn(offlineTab === k)}>{l}</button>
            ))}
          </div>

          {/* Join tab (offline placeholder) */}
          {offlineTab === "join" ? (
            <div>
              <label style={lbl}>קוד שולחן</label>
              <input type="text" placeholder="A7X2" maxLength={6} style={inp} />
              <label style={{ ...lbl, marginTop: 12 }}>סיסמה</label>
              <input type="password" placeholder="••••" style={inp} />
              <button onClick={() => onStart(settings)} style={primaryBtn}>הצטרף 🚀</button>
            </div>

          /* Create tab */
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>תבנית מוכנה</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(PRESETS).map(([k, v]) => (
                    <button key={k} onClick={() => applyPreset(k)} style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      background: preset === k ? "rgba(184,150,12,0.2)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${preset === k ? "rgba(184,150,12,0.4)" : "rgba(255,255,255,0.06)"}`,
                      color: preset === k ? "#E5C94B" : "#888",
                    }}>{v.label}</button>
                  ))}
                </div>
              </div>

              <Section title="⚙️ בסיסי">
                <label style={lbl}>שם השולחן</label>
                <input value={settings.name} onChange={e => set("name", e.target.value)} style={inp} />
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>סיסמה</label>
                    <input type="password" value={settings.password} onChange={e => set("password", e.target.value)} placeholder="ריק = ציבורי" style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>שחקנים</label>
                    <select value={settings.maxPlayers} onChange={e => set("maxPlayers", +e.target.value)} style={inp}>
                      {[2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </Section>

              <Section title="💰 כסף">
                <label style={lbl}>Buy-in</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[500, 1000, 2000, 5000].map(v => (
                    <button key={v} onClick={() => set("buyIn", v)} style={{
                      flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer",
                      background: settings.buyIn === v ? "rgba(184,150,12,0.2)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${settings.buyIn === v ? "#C5A028" : "rgba(255,255,255,0.06)"}`,
                      color: settings.buyIn === v ? "#E5C94B" : "#888", fontFamily: "Georgia,serif",
                    }}>{v.toLocaleString()}</button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <Toggle on={settings.rebuy} onToggle={v => set("rebuy", v)} />
                  <span style={{ fontSize: 11, color: "#aaa" }}>Re-buy מותר</span>
                </div>
              </Section>

              <Section title="🎯 Blinds">
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Small Blind</label>
                    <input type="number" value={settings.sb} onChange={e => set("sb", +e.target.value)} style={inp} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={lbl}>Big Blind</label>
                    <input type="number" value={settings.bb} onChange={e => set("bb", +e.target.value)} style={inp} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <Toggle on={settings.blindsUp} onToggle={v => set("blindsUp", v)} />
                  <span style={{ fontSize: 11, color: "#aaa" }}>Blinds עולים</span>
                </div>
              </Section>

              <Section title="⏱️ טיימר">
                <label style={lbl}>שניות לתור: <b style={{ color: "#E5C94B" }}>{settings.timer}s</b></label>
                <input type="range" min={10} max={90} step={5} value={settings.timer}
                  onChange={e => set("timer", +e.target.value)} style={sliderStyle} />
                <label style={{ ...lbl, marginTop: 10 }}>בנק זמן: <b style={{ color: "#E5C94B" }}>{settings.bank}s</b></label>
                <input type="range" min={0} max={120} step={10} value={settings.bank}
                  onChange={e => set("bank", +e.target.value)} style={sliderStyle} />
                <label style={{ ...lbl, marginTop: 10 }}>כשנגמר הזמן:</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["fold", "Auto Fold"], ["check_fold", "Check / Fold"]].map(([k, l]) => (
                    <button key={k} onClick={() => set("autoAction", k)} style={{
                      flex: 1, padding: "6px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: "pointer",
                      background: settings.autoAction === k ? "rgba(184,150,12,0.2)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${settings.autoAction === k ? "#C5A028" : "rgba(255,255,255,0.06)"}`,
                      color: settings.autoAction === k ? "#E5C94B" : "#888",
                    }}>{l}</button>
                  ))}
                </div>
              </Section>

              <div style={{ background: "rgba(184,150,12,0.06)", borderRadius: 12, padding: 12, border: "1px solid rgba(184,150,12,0.1)" }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 6, fontWeight: 600 }}>סיכום הגדרות</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10, color: "#ccc" }}>
                  <span>💰 {settings.buyIn.toLocaleString()}</span>
                  <span>🎯 {settings.sb}/{settings.bb}</span>
                  <span>⏱️ {settings.timer}s</span>
                  <span>👥 {settings.maxPlayers}</span>
                </div>
              </div>

              <button onClick={() => onStart(settings)} style={primaryBtn}>צור שולחן 🚀</button>
            </div>
          )}
        </div>
      )}

      <HelpButton screen={mode === "online" ? "onlineLobby" : "lobby"} />
    </div>
  );
}
