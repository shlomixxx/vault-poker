import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { Community } from '../components/Community.jsx';
import { Seat }      from '../components/Seat.jsx';
import { Card }      from '../components/Card.jsx';
import { HelpButton } from '../components/HelpButton.jsx';
import { PHASES, PH_LABEL, PH_REVEAL } from '../constants/phases.js';
import { evaluateHand } from '../utils/handEvaluator';
import { hb, sliderStyle, abtn, globalCSS } from '../styles/ui.js';

const HAND_STRENGTH_PCT = [12, 28, 46, 62, 73, 81, 89, 95, 98, 100];

const SEAT_POSITIONS = [
  { bottom:"-1%",  left:"50%" }, { bottom:"10%",  left:"15%" },
  { top:"42%",     left:"10%" }, { top:"16%",     left:"16%" },
  { top:"3%",      left:"34%" }, { top:"3%",      left:"66%" },
  { top:"16%",     left:"84%" }, { top:"42%",     left:"90%" },
  { bottom:"10%",  left:"85%" },
];

export function OnlineGameScreen({ onExit }) {
  const { socket } = useSocket();
  const [gs,    setGs]    = useState(null);   // game state from server
  const [raise, setRaise] = useState(40);
  const [toast, setToast] = useState(null);
  const raiseRef = useRef(40);

  useEffect(() => {
    if (!socket) return;
    socket.emit('get_state'); // request current state in case we missed the initial emit
    const onState = (state) => {
      setGs(state);
      if (state.settings) {
        const minRaise = Math.max(state.curBet * 2, state.settings.bb * 2);
        setRaise(r => Math.max(r, minRaise));
      }
    };
    const onToast = ({ message }) => {
      setToast(message);
      setTimeout(() => setToast(null), 2000);
    };
    socket.on('game_state',        onState);
    socket.on('player_joined',     ({ playerName }) => setToast(`👋 ${playerName} הצטרף`));
    socket.on('player_disconnected', ({ playerName }) => setToast(`⚠️ ${playerName} התנתק`));
    socket.on('error',             onToast);
    return () => { socket.off('game_state',onState); socket.off('player_joined'); socket.off('player_disconnected'); socket.off('error',onToast); };
  }, [socket]);

  const sendAction = (type, amount) => {
    socket?.emit('action', { type, amount: amount ?? raiseRef.current });
  };

  const startGame = () => socket?.emit('start_game');
  const newHand   = () => socket?.emit('new_hand');

  // ── Loading / waiting ──
  if (!gs) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#030503' }}>
        <div style={{ textAlign:'center', color:'#C5A028', fontFamily:'Georgia,serif' }}>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:5, marginBottom:8 }}>VAULT</div>
          <div style={{ fontSize:13, color:'#555' }}>מתחבר לשרת...</div>
        </div>
      </div>
    );
  }

  const { myIdx=0, players, board, bets, pot, turn, curBet, phase, winner, handResults=[], dealerIdx, pkey, settings, handNum=0 } = gs;
  const phaseIdx     = PHASES.indexOf(phase);
  const revealCount  = PH_REVEAL[phase] || 0;
  const isMyTurn     = turn === myIdx;
  const totalPot     = pot + (bets||[]).reduce((a,b)=>a+b,0);
  const myBet        = (bets||[])[myIdx] || 0;
  const callAmt      = Math.min(curBet - myBet, players[myIdx]?.ch || 0);
  const canCheck     = curBet <= myBet;
  const n            = players.length;
  const seats        = SEAT_POSITIONS.slice(0, n);
  const winnerCards  = winner?.bestCards || [];
  const raiseMin     = Math.max(curBet*2, settings?.bb*2 || 20);
  const raiseMax     = Math.max(players[myIdx]?.ch || 0, raiseMin);
  const raisePct     = raiseMax>raiseMin ? ((raise-raiseMin)/(raiseMax-raiseMin))*100 : 0;

  return (
    <div style={{ width:'100%', minHeight:'100vh', background:'radial-gradient(ellipse at 50% 40%,#101A10,#080E08 55%,#030503)', display:'flex', flexDirection:'column', alignItems:'center', fontFamily:"'Segoe UI',sans-serif", overflow:'hidden' }}>

      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', maxWidth:900, padding:'8px 10px 2px', zIndex:20 }}>
        <button onClick={onExit} style={{ ...hb, color:'#888' }}>← יציאה</button>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:14, fontWeight:900, color:'#C5A028', letterSpacing:2, fontFamily:'Georgia,serif' }}>VAULT</span>
          <div style={{ background:phase==='showdown'?'rgba(184,150,12,0.2)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:6, padding:'2px 8px', fontSize:9, fontWeight:800, color:phase==='showdown'?'#E5C94B':'#888', letterSpacing:1 }}>{PH_LABEL[phase]||phase}</div>
          <div style={{ fontSize:9, color:'#555', background:'rgba(68,136,255,0.08)', border:'1px solid rgba(68,136,255,0.15)', borderRadius:4, padding:'1px 6px' }}>🌐 LIVE</div>
        </div>
        <div style={{ fontSize:9, color:'#555' }}>יד #{handNum} · {settings?.sb}/{settings?.bb}</div>
      </div>

      {/* Table oval */}
      <div style={{ position:'relative', width:'100%', maxWidth:860, aspectRatio:'4/3.4', maxHeight:'calc(100vh - 170px)', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'4%', left:'2%', right:'2%', bottom:'4%', borderRadius:'50%', background:'linear-gradient(180deg,#4A3728,#3D2E22 40%,#2E2218 70%,#1E160F)', boxShadow:'0 16px 50px rgba(0,0,0,0.55)', padding:'2.5%' }}>
          <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'radial-gradient(ellipse at 50% 42%,#1F7A3A,#176B30 20%,#105824 45%,#0B4A1C 65%,#073814)', boxShadow:'inset 0 0 40px rgba(0,0,0,0.3)', position:'relative' }}>
            {/* Pot */}
            <div style={{ position:'absolute', top:'25%', left:'50%', transform:'translate(-50%,-50%)', zIndex:11 }}>
              <div style={{ background:'rgba(0,0,0,0.5)', borderRadius:12, padding:'4px 16px', border:'1px solid rgba(184,150,12,0.1)', textAlign:'center' }}>
                <div style={{ fontSize:7, color:'#999', letterSpacing:2 }}>POT</div>
                <div style={{ fontSize:20, fontWeight:900, color:'#E5C94B', fontFamily:'Georgia,serif', lineHeight:1 }}>{totalPot.toLocaleString()}</div>
              </div>
            </div>
            {/* Community cards */}
            <div style={{ position:'absolute', top:'48%', left:'50%', transform:'translate(-50%,-50%)', zIndex:11 }}>
              {board?.length>0 && <Community board={board} count={revealCount} pkey={pkey} highlightCards={phase==='showdown'?winnerCards:[]} />}
            </div>
            {/* Seats */}
            {players.map((p, i) => (
              <Seat key={i} p={p} pos={seats[i]}
                isMe={i===myIdx} showAll={phase==='showdown'} bet={(bets||[])[i]||0}
                active={i===turn && !p.f && phase!=='showdown' && phase!=='waiting'}
                timerData={null}
                handResult={handResults[i]||null}
                isWinner={winner?.idx===i}
                isDealer={i===dealerIdx}
              />
            ))}
          </div>
        </div>
      </div>

      {/* My Cards Panel */}
      {phase !== 'showdown' && !players[myIdx]?.f && players[myIdx]?.c?.length === 2 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, direction: 'ltr',
          background: 'rgba(4,10,4,0.90)',
          border: '1px solid rgba(68,136,255,0.22)',
          borderRadius: 12, padding: '7px 16px 7px 10px',
          width: '100%', maxWidth: 680,
          backdropFilter: 'blur(8px)', zIndex: 15, marginTop: 2,
        }}>
          <div style={{ fontSize: 8, color: '#6B9CFF', fontWeight: 700, letterSpacing: 1, minWidth: 36, textAlign: 'center', lineHeight: 1.5 }}>
            הקלפים<br/>שלך
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Card card={players[myIdx].c[0]} w={52} h={73} />
            <Card card={players[myIdx].c[1]} w={52} h={73} />
          </div>
          {revealCount >= 3 && (() => {
            try {
              const res = evaluateHand(players[myIdx].c, board.slice(0, revealCount));
              if (!res) return null;
              const pct = HAND_STRENGTH_PCT[res.handRank] ?? 10;
              const barColor = res.handRank >= 5 ? '#22C55E' : res.handRank >= 3 ? '#E5C94B' : '#4488FF';
              return (
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 8, color: '#555', letterSpacing: 0.5 }}>יד נוכחית</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#E5C94B', fontFamily: 'Georgia,serif' }}>
                    {res.nameHe}
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            } catch { return null; }
          })()}
        </div>
      )}

      {/* Winner banner */}
      {winner && (
        <div style={{ width:'100%', maxWidth:680, background:'rgba(10,10,24,0.95)', border:'1px solid #C5A028', borderRadius:14, padding:'10px 16px', zIndex:25, backdropFilter:'blur(20px)', boxShadow:'0 0 30px rgba(184,150,12,0.25)', animation:'fadeInUp 0.4s ease', marginTop:4, direction:'ltr' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:20 }}>🏆</span>
              <div>
                <div style={{ fontSize:16, fontWeight:900, color:'#E5C94B', fontFamily:'Georgia,serif', lineHeight:1 }}>{winner.name}</div>
                <div style={{ fontSize:11, color:'#FFF', fontWeight:700 }}>{winner.hand}</div>
                {winner.handEn && <div style={{ fontSize:8, color:'#888' }}>{winner.handEn}</div>}
              </div>
            </div>
            <div style={{ fontSize:18, color:'#C5A028', fontWeight:900, fontFamily:'Georgia,serif' }}>+{(winner.amount||0).toLocaleString()} 💰</div>
          </div>
          {winner.bestCards?.length>0 && (
            <div style={{ display:'flex', gap:3, marginTop:8, justifyContent:'center' }}>
              {winner.bestCards.map((c,i) => <Card key={i} card={c} w={46} h={65} delay={i*80} highlight />)}
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div style={{ width:'100%', maxWidth:680, padding:'6px 10px 10px', background:'linear-gradient(180deg,rgba(12,12,28,0.96),rgba(6,6,16,0.98))', borderRadius:'14px 14px 0 0', border:'1px solid rgba(184,150,12,0.06)', borderBottom:'none', boxShadow:'0 -4px 20px rgba(0,0,0,0.3)', zIndex:20 }}>
        <div style={{ display:'flex', gap:3, marginBottom:6, justifyContent:'center' }}>
          {PHASES.map((ph,i) => <div key={ph} style={{ flex:1, height:3, borderRadius:2, maxWidth:55, background:i<phaseIdx?'rgba(184,150,12,0.4)':i===phaseIdx?'#C5A028':'rgba(255,255,255,0.04)' }} />)}
        </div>

        {phase === 'waiting' ? (
          <div style={{ textAlign:'center', padding:'8px 0' }}>
            <div style={{ fontSize:12, color:'#888', marginBottom:10 }}>ממתין לשחקנים... ({players.length}/{settings?.maxPlayers})</div>
            <button onClick={startGame} style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:8, color:'#22C55E', padding:'8px 24px', fontSize:12, cursor:'pointer', fontWeight:700 }}>▶ התחל משחק</button>
          </div>
        ) : phase !== 'showdown' ? (
          <>
            <div style={{ textAlign:'center', marginBottom:5, fontSize:10, color:isMyTurn?'#E5C94B':'#666', fontWeight:700 }}>
              {isMyTurn ? '🎯 התור שלך!' : `⏳ ממתין ל-${players[turn]?.name}...`}
            </div>
            {isMyTurn && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                <span style={{ fontSize:8, color:'#666' }}>RAISE</span>
                <input type="range" min={raiseMin} max={raiseMax} step={10} value={Math.max(raise,raiseMin)}
                  onChange={e => { const v=+e.target.value; setRaise(v); raiseRef.current=v; }}
                  style={{ ...sliderStyle, background:`linear-gradient(90deg,#C5A028 ${raisePct}%,rgba(255,255,255,0.04) ${raisePct}%)` }}
                />
                <div style={{ background:'rgba(184,150,12,0.08)', border:'1px solid rgba(184,150,12,0.12)', borderRadius:6, padding:'2px 7px', fontSize:12, fontWeight:800, color:'#E5C94B', fontFamily:'Georgia,serif', minWidth:42, textAlign:'center' }}>{raise}</div>
              </div>
            )}
            <div style={{ display:'flex', gap:4, opacity:isMyTurn?1:0.35, pointerEvents:isMyTurn?'auto':'none' }}>
              <button onClick={()=>sendAction('FOLD')}    style={abtn('#FF4444','rgba(255,68,68,0.2)')}><span style={{ fontSize:11, fontWeight:800 }}>FOLD</span></button>
              {canCheck
                ? <button onClick={()=>sendAction('CHECK')}   style={abtn('#8899AA','rgba(136,153,170,0.1)')}><span style={{ fontSize:11, fontWeight:800 }}>CHECK</span></button>
                : <button onClick={()=>sendAction('CALL')}    style={abtn('#4488FF','rgba(68,136,255,0.15)')}><span style={{ fontSize:11, fontWeight:800 }}>CALL</span><span style={{ fontSize:9, opacity:0.6 }}>{callAmt}</span></button>
              }
              <button onClick={()=>sendAction('RAISE',raise)} style={abtn('#E5C94B','rgba(184,150,12,0.2)')}><span style={{ fontSize:11, fontWeight:800 }}>RAISE</span><span style={{ fontSize:9, opacity:0.6 }}>{raise}</span></button>
              <button onClick={()=>sendAction('ALL_IN')}  style={abtn('#FFF','rgba(184,150,12,0.25)')}><span style={{ fontSize:11, fontWeight:800 }}>ALL IN</span></button>
            </div>
          </>
        ) : (
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:4 }}>
            <button onClick={newHand} style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:8, color:'#22C55E', padding:'7px 20px', fontSize:11, cursor:'pointer', fontWeight:700 }}>🔄 יד חדשה</button>
            <button onClick={onExit} style={{ background:'rgba(255,68,68,0.1)', border:'1px solid rgba(255,68,68,0.2)', borderRadius:8, color:'#FF4444', padding:'7px 20px', fontSize:11, cursor:'pointer', fontWeight:700 }}>🚪 יציאה</button>
          </div>
        )}
      </div>

      {toast && <div style={{ position:'fixed', top:44, left:'50%', transform:'translateX(-50%)', background:'rgba(10,10,24,0.92)', border:'1px solid rgba(184,150,12,0.2)', borderRadius:10, padding:'5px 16px', zIndex:100, color:'#E5C94B', fontSize:12, fontWeight:700, backdropFilter:'blur(16px)', animation:'fadeIn 0.2s ease' }}>{toast}</div>}

      <HelpButton screen="game" />
      <style>{globalCSS}</style>
    </div>
  );
}
