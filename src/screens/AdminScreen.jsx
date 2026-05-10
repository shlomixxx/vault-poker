import { useState, useEffect, useCallback } from 'react';
import { HelpButton } from '../components/HelpButton.jsx';

const API = '/api/admin';

const dark  = { fontFamily: "'Segoe UI',sans-serif", minHeight: '100vh', background: '#080D08', color: '#DDD', padding: '20px 16px' };
const card  = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(184,150,12,0.15)', borderRadius: 12, padding: 16, marginBottom: 16 };
const hdr   = { fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' };
const inp   = { width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#EEE', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const btn   = (color='#C5A028') => ({ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${color}`, color, fontSize: 12, fontWeight: 700, cursor: 'pointer' });
const badge = (pct) => ({ display:'inline-block', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background: pct>0?'rgba(197,160,40,0.15)':'rgba(255,255,255,0.04)', color: pct>0?'#E5C94B':'#666', border:`1px solid ${pct>0?'rgba(197,160,40,0.3)':'rgba(255,255,255,0.06)'}` });

export function AdminScreen({ onExit }) {
  const [pwd,       setPwd]       = useState('');
  const [authed,    setAuthed]    = useState(false);
  const [authErr,   setAuthErr]   = useState('');
  const [tab,       setTab]       = useState('boosts');

  const [boosts,    setBoosts]    = useState({});
  const [rooms,     setRooms]     = useState([]);
  const [history,   setHistory]   = useState([]);
  const [stats,     setStats]     = useState([]);
  const [newPlayer, setNewPlayer] = useState('');
  const [newPct,    setNewPct]    = useState(50);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState('');

  const headers = { 'Content-Type': 'application/json', 'x-admin-password': pwd };

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const login = async () => {
    const r = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd }) });
    const j = await r.json();
    if (j.success) { setAuthed(true); setAuthErr(''); loadAll(); }
    else setAuthErr(j.error || 'שגיאה');
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [b, r, h, s] = await Promise.all([
      fetch(`${API}/win-boosts`, { headers }).then(x=>x.json()),
      fetch(`${API}/rooms`,      { headers }).then(x=>x.json()),
      fetch(`${API}/history`,    { headers }).then(x=>x.json()),
      fetch(`${API}/stats`,      { headers }).then(x=>x.json()),
    ]);
    setBoosts(b);
    setRooms(Array.isArray(r) ? r : []);
    setHistory(Array.isArray(h) ? h : []);
    setStats(Array.isArray(s) ? s : []);
    setLoading(false);
  }, [pwd]);

  const saveBoost = async (name, pct) => {
    await fetch(`${API}/win-boosts/${encodeURIComponent(name)}`, { method:'PUT', headers, body: JSON.stringify({ pct }) });
    setBoosts(prev => ({ ...prev, [name]: pct }));
    flash(`✅ ${name} → ${pct}%`);
  };

  const deleteBoost = async (name) => {
    await fetch(`${API}/win-boosts/${encodeURIComponent(name)}`, { method:'DELETE', headers });
    setBoosts(prev => { const n={...prev}; delete n[name]; return n; });
    flash(`🗑️ הוסר: ${name}`);
  };

  const addBoost = async () => {
    if (!newPlayer.trim()) return;
    await saveBoost(newPlayer.trim(), newPct);
    setNewPlayer('');
  };

  if (!authed) {
    return (
      <div style={{ ...dark, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ ...card, maxWidth:340, width:'100%', textAlign:'center' }}>
          <div style={{ fontSize:28, fontWeight:900, color:'#C5A028', fontFamily:'Georgia,serif', letterSpacing:4, marginBottom:4 }}>VAULT</div>
          <div style={{ fontSize:11, color:'#555', letterSpacing:3, marginBottom:24 }}>ADMIN</div>
          <input type="password" placeholder="סיסמת אדמין" value={pwd} onChange={e=>setPwd(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&login()} style={inp} autoFocus />
          {authErr && <div style={{ color:'#E53935', fontSize:12, marginTop:8 }}>{authErr}</div>}
          <button onClick={login} style={{ ...btn(), width:'100%', marginTop:12, padding:'10px' }}>כניסה →</button>
          <button onClick={onExit} style={{ ...btn('#555'), width:'100%', marginTop:8, padding:'8px' }}>← חזרה</button>
        </div>
        <HelpButton screen="admin" />
      </div>
    );
  }

  const TABS = [['boosts','🎯 אחוזי ניצחון'],['rooms','🏠 חדרים'],['history','📜 היסטוריה'],['stats','📊 סטטיסטיקה']];

  return (
    <div style={dark}>
      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <span style={{ fontSize:20, fontWeight:900, color:'#C5A028', fontFamily:'Georgia,serif', letterSpacing:3 }}>VAULT</span>
          <span style={{ fontSize:11, color:'#555', marginLeft:8, letterSpacing:2 }}>ADMIN</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={loadAll} style={btn('#4488FF')}>{loading ? '...' : '🔄 רענן'}</button>
          <button onClick={onExit}  style={btn('#666')}>← יציאה</button>
        </div>
      </div>

      {msg && <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:8, padding:'8px 14px', marginBottom:12, fontSize:12, color:'#22C55E' }}>{msg}</div>}

      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:16, overflowX:'auto' }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
            background: tab===k ? 'rgba(184,150,12,0.2)' : 'rgba(255,255,255,0.03)',
            border:`1px solid ${tab===k?'rgba(184,150,12,0.4)':'rgba(255,255,255,0.06)'}`,
            color: tab===k ? '#E5C94B' : '#888',
          }}>{l}</button>
        ))}
      </div>

      {/* ── Tab: Win boosts ── */}
      {tab==='boosts' && (
        <div>
          <div style={card}>
            <div style={hdr}>הוסף / עדכן שחקן</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input value={newPlayer} onChange={e=>setNewPlayer(e.target.value)} placeholder="שם שחקן" style={{ ...inp, flex:2, minWidth:140 }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, flex:3, minWidth:200 }}>
                <input type="range" min={0} max={100} step={5} value={newPct} onChange={e=>setNewPct(+e.target.value)} style={{ flex:1, accentColor:'#C5A028' }} />
                <span style={{ fontSize:14, fontWeight:900, color:'#E5C94B', minWidth:36 }}>{newPct}%</span>
              </div>
              <button onClick={addBoost} style={btn('#22C55E')}>✓ שמור</button>
            </div>
            <div style={{ fontSize:11, color:'#666', marginTop:8 }}>
              0% = רנדומלי · 50% = ינצח בחצי מהידיים · 100% = תמיד יקבל קלפים פרימיום
            </div>
          </div>

          <div style={card}>
            <div style={hdr}>הגדרות פעילות</div>
            {Object.keys(boosts).length === 0 && <div style={{ fontSize:12, color:'#555' }}>אין הגדרות — כל המשחק רנדומלי</div>}
            {Object.entries(boosts).map(([name, pct]) => (
              <BoostRow key={name} name={name} pct={pct} onSave={saveBoost} onDelete={deleteBoost} />
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Rooms ── */}
      {tab==='rooms' && (
        <div style={card}>
          <div style={hdr}>חדרים פעילים ({rooms.length})</div>
          {rooms.length===0 && <div style={{ fontSize:12, color:'#555' }}>אין חדרים פתוחים</div>}
          {rooms.map(r => (
            <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', marginBottom:8 }}>
              <div>
                <span style={{ fontSize:13, fontWeight:700, color:'#E5C94B', fontFamily:'Georgia,serif', marginRight:10 }}>{r.id}</span>
                <span style={{ fontSize:12, color:'#CCC' }}>{r.name}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:11, color:'#888' }}>{r.playerCount}/{r.maxPlayers} שחקנים</span>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(184,150,12,0.1)', color:'#C5A028', fontWeight:700 }}>{r.phase?.toUpperCase()}</span>
                <span style={{ fontSize:11, color:'#666' }}>יד #{r.handNum}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: History ── */}
      {tab==='history' && (
        <div style={card}>
          <div style={hdr}>היסטוריית ידיים (אחרונות {history.length})</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ color:'#666', fontSize:10 }}>
                  {['#','חדר','יד','מנצח','סיר','יד זוכה','מוגבר','זמן'].map(h=>(
                    <th key={h} style={{ textAlign:'right', padding:'6px 8px', borderBottom:'1px solid rgba(255,255,255,0.05)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding:'7px 8px', color:'#555' }}>{h.id}</td>
                    <td style={{ padding:'7px 8px', color:'#C5A028', fontFamily:'Georgia,serif', fontWeight:700 }}>{h.room_id}</td>
                    <td style={{ padding:'7px 8px', color:'#888' }}>{h.hand_num}</td>
                    <td style={{ padding:'7px 8px', color:'#EEE', fontWeight:700 }}>{h.winner_name}</td>
                    <td style={{ padding:'7px 8px', color:'#E5C94B' }}>{h.pot?.toLocaleString()}</td>
                    <td style={{ padding:'7px 8px', color:'#AAA' }}>{h.winning_hand_he}</td>
                    <td style={{ padding:'7px 8px' }}>{h.was_boosted ? <span style={{ color:'#F97316', fontWeight:700 }}>⚡ כן</span> : <span style={{ color:'#555' }}>לא</span>}</td>
                    <td style={{ padding:'7px 8px', color:'#555', fontSize:10 }}>{new Date(h.played_at*1000).toLocaleTimeString('he-IL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Stats ── */}
      {tab==='stats' && (
        <div style={card}>
          <div style={hdr}>סטטיסטיקת ניצחונות</div>
          {stats.length===0 && <div style={{ fontSize:12, color:'#555' }}>אין נתונים עדיין</div>}
          {stats.map((s,i) => {
            const boost = boosts[s.winner_name] || 0;
            const boostRatio = s.total_wins>0 ? Math.round((s.boosted_wins/s.total_wins)*100) : 0;
            return (
              <div key={s.winner_name} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', marginBottom:8 }}>
                <span style={{ fontSize:16, fontWeight:900, color:'#444', minWidth:24 }}>{i+1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:'#EEE' }}>{s.winner_name}</span>
                    <span style={badge(boost)}>{boost}% boost</span>
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:11, color:'#888' }}>
                    <span>🏆 {s.total_wins} ניצחונות</span>
                    <span>💰 {s.total_chips_won?.toLocaleString()} צ'יפים</span>
                    <span style={{ color: boostRatio>50?'#F97316':'#666' }}>⚡ {boostRatio}% מוגברים</span>
                  </div>
                  <WinBar pct={boostRatio} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HelpButton screen="admin" />
    </div>
  );
}

// Inline editable boost row
function BoostRow({ name, pct, onSave, onDelete }) {
  const [val, setVal] = useState(pct);
  const [editing, setEditing] = useState(false);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', marginBottom:6 }}>
      <span style={{ flex:1, fontSize:13, color:'#DDD', fontWeight:600 }}>{name}</span>
      {editing ? (
        <>
          <input type="range" min={0} max={100} step={5} value={val} onChange={e=>setVal(+e.target.value)} style={{ flex:2, accentColor:'#C5A028' }} />
          <span style={{ fontSize:13, fontWeight:900, color:'#E5C94B', minWidth:36 }}>{val}%</span>
          <button onClick={()=>{onSave(name,val);setEditing(false);}} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.3)', color:'#22C55E', fontSize:11, cursor:'pointer' }}>✓</button>
          <button onClick={()=>setEditing(false)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#888', fontSize:11, cursor:'pointer' }}>✕</button>
        </>
      ) : (
        <>
          <span style={{ fontSize:14, fontWeight:900, color: pct>0?'#E5C94B':'#555', minWidth:36 }}>{pct}%</span>
          <button onClick={()=>setEditing(true)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(184,150,12,0.1)', border:'1px solid rgba(184,150,12,0.2)', color:'#C5A028', fontSize:11, cursor:'pointer' }}>✎</button>
          <button onClick={()=>onDelete(name)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.2)', color:'#E53935', fontSize:11, cursor:'pointer' }}>🗑</button>
        </>
      )}
    </div>
  );
}

function WinBar({ pct }) {
  return (
    <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.06)', marginTop:6, overflow:'hidden' }}>
      <div style={{ height:'100%', borderRadius:2, width:`${pct}%`, background: pct>50?'#F97316':pct>20?'#EAB308':'#4488FF', transition:'width 0.4s' }} />
    </div>
  );
}
