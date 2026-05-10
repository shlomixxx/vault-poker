import { useState, useEffect, useCallback, useRef } from "react";

/*
 * VAULT POKER V8
 * Real deck shuffle + deal, pot distribution, blind rotation, bot AI
 */

const SU = { h:{c:"♥",cl:"#E53935"}, d:{c:"♦",cl:"#E53935"}, c:{c:"♣",cl:"#1A1F36"}, s:{c:"♠",cl:"#1A1F36"} };
const PHASES = ["preflop","flop","turn","river","showdown"];
const PH_LABEL = { preflop:"PRE-FLOP",flop:"FLOP",turn:"TURN",river:"RIVER",showdown:"SHOWDOWN 🏆" };
const PH_REVEAL = { preflop:0,flop:3,turn:4,river:5,showdown:5 };
const PRESETS = {
  fast:{label:"🚀 מהיר",buyIn:500,sb:5,bb:10,timer:15,bank:30,rebuy:false,blindsUp:false},
  normal:{label:"🎯 רגיל",buyIn:1000,sb:10,bb:20,timer:30,bank:60,rebuy:true,blindsUp:false},
  tourney:{label:"🏆 טורניר",buyIn:2000,sb:10,bb:20,timer:30,bank:60,rebuy:false,blindsUp:true},
  turbo:{label:"⚡ טורבו",buyIn:1000,sb:10,bb:20,timer:15,bank:30,rebuy:false,blindsUp:true},
};
const INIT_PLAYERS = [
  {n:"שלומי",ch:0,c:[],f:false,a:"🎯"},{n:"דני",ch:0,c:[],f:false,a:"🎲"},
  {n:"יוסי",ch:0,c:[],f:false,a:"🃏"},{n:"מיקי",ch:0,c:[],f:false,a:"💎"},
  {n:"אבי",ch:0,c:[],f:false,a:"🔥"},{n:"רון",ch:0,c:[],f:false,a:"⚡"},
  {n:"נעם",ch:0,c:[],f:false,a:"🎪"},{n:"עומר",ch:0,c:[],f:false,a:"🌟"},
  {n:"גיל",ch:0,c:[],f:false,a:"🏆"},
];

// ═══════════════════════════════════════════
// DECK
// ═══════════════════════════════════════════
function createDeck() {
  const ranks = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
  return ranks.flatMap(r => ["h","d","c","s"].map(s => r+s));
}
function shuffleDeck(deck) {
  const d = [...deck];
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function dealGame(n) {
  const deck = shuffleDeck(createDeck());
  return {
    holeCards: Array.from({length:n},(_,i)=>[deck[i*2],deck[i*2+1]]),
    board: deck.slice(n*2,n*2+5),
  };
}

// ═══════════════════════════════════════════
// HAND EVALUATOR — finds best 5 from 7 cards
// ═══════════════════════════════════════════
const RANK_VAL = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14 };
const HAND_NAMES_HE = ["קלף גבוה","זוג","שני זוגות","שלישייה","סטרייט","פלאש","פול האוס","רביעייה","סטרייט פלאש","רויאל פלאש"];

function parseCard(c) {
  const r = c.length === 3 ? c.slice(0,2) : c[0];
  const s = c[c.length-1];
  return { rank: RANK_VAL[r] || 0, suit: s, str: c };
}

function getCombinations(arr, k) {
  const result = [];
  function helper(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); helper(i+1, combo); combo.pop(); }
  }
  helper(0, []);
  return result;
}

function evaluate5(cards) {
  const sorted = [...cards].sort((a,b) => b.rank - a.rank);
  const ranks = sorted.map(c => c.rank);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  let isStraight = false;
  let straightHigh = 0;

  if (ranks[0]-ranks[1]===1 && ranks[1]-ranks[2]===1 && ranks[2]-ranks[3]===1 && ranks[3]-ranks[4]===1) {
    isStraight = true; straightHigh = ranks[0];
  }
  if (ranks[0]===14 && ranks[1]===5 && ranks[2]===4 && ranks[3]===3 && ranks[4]===2) {
    isStraight = true; straightHigh = 5;
  }

  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r]||0)+1);
  const groups = Object.entries(counts).map(([r,c]) => ({ rank:+r, count:c })).sort((a,b) => b.count-a.count || b.rank-a.rank);

  let handRank = 0;
  let score = 0;
  let name = "";

  if (isStraight && isFlush) {
    if (straightHigh === 14) { handRank = 9; name = "Royal Flush"; }
    else { handRank = 8; name = "Straight Flush"; }
    score = handRank * 1000000 + straightHigh;
  } else if (groups[0].count === 4) {
    handRank = 7; name = "Four of a Kind";
    score = handRank * 1000000 + groups[0].rank * 100 + groups[1].rank;
  } else if (groups[0].count === 3 && groups[1].count === 2) {
    handRank = 6; name = "Full House";
    score = handRank * 1000000 + groups[0].rank * 100 + groups[1].rank;
  } else if (isFlush) {
    handRank = 5; name = "Flush";
    score = handRank * 1000000 + ranks[0]*10000 + ranks[1]*1000 + ranks[2]*100 + ranks[3]*10 + ranks[4];
  } else if (isStraight) {
    handRank = 4; name = "Straight";
    score = handRank * 1000000 + straightHigh;
  } else if (groups[0].count === 3) {
    handRank = 3; name = "Three of a Kind";
    score = handRank * 1000000 + groups[0].rank * 10000 + groups[1].rank * 100 + groups[2].rank;
  } else if (groups[0].count === 2 && groups[1].count === 2) {
    handRank = 2; name = "Two Pair";
    const highPair = Math.max(groups[0].rank, groups[1].rank);
    const lowPair = Math.min(groups[0].rank, groups[1].rank);
    score = handRank * 1000000 + highPair * 10000 + lowPair * 100 + groups[2].rank;
  } else if (groups[0].count === 2) {
    handRank = 1; name = "Pair";
    score = handRank * 1000000 + groups[0].rank * 10000 + groups[1].rank * 100 + groups[2].rank * 10 + groups[3].rank;
  } else {
    handRank = 0; name = "High Card";
    score = ranks[0]*10000 + ranks[1]*1000 + ranks[2]*100 + ranks[3]*10 + ranks[4];
  }

  return { handRank, score, name, nameHe: HAND_NAMES_HE[handRank], cards: sorted.map(c => c.str) };
}

function evaluateHand(holeCards, boardCards) {
  if (!holeCards || holeCards.length < 2) return null;
  const all = [...holeCards, ...boardCards.filter(Boolean)].map(parseCard);
  if (all.length < 5) return { handRank:0, score:0, name:"?", nameHe:"?", cards:[], bestCards:[] };

  const combos = getCombinations(all, 5);
  let best = null;
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || result.score > best.score) {
      best = { ...result, bestCards: combo.map(c => c.str) };
    }
  }
  return best;
}

// ═══ CARD ═══
function Card({ card, faceDown=false, w=44, h=62, delay=0, highlight=false, dim=false }) {
  const [on,setOn]=useState(false);
  const [fl,setFl]=useState(faceDown);
  useEffect(()=>{const t=setTimeout(()=>setOn(true),delay);return()=>clearTimeout(t)},[delay]);
  useEffect(()=>{if(faceDown){setFl(true);return;}if(on){const t=setTimeout(()=>setFl(false),150);return()=>clearTimeout(t)}},[faceDown,on]);
  if(!card&&!faceDown) return <div style={{width:w,height:h,borderRadius:w*0.1,border:"1.5px dashed rgba(255,255,255,0.15)",background:"rgba(0,0,0,0.12)",flexShrink:0}} />;
  const r=card?(card.length===3?card.slice(0,2):card[0]):"";
  const sk=card?card[card.length-1]:"s"; const su=SU[sk]||SU.s; const red=sk==="h"||sk==="d";
  const fs=Math.max(w*0.32,10);
  return (
    <div style={{width:w,height:h,perspective:600,flexShrink:0,opacity:on?(dim?0.35:1):0,
      transform:on?(highlight?"translateY(-4px) scale(1.08)":"scale(1)"):"translateY(-40px) scale(0.3)",
      transition:`all 0.4s cubic-bezier(0.22,1.2,0.36,1) ${delay}ms`,
      filter:highlight?"drop-shadow(0 0 8px rgba(212,175,55,0.7))":"none",
    }}>
      <div style={{width:"100%",height:"100%",position:"relative",transformStyle:"preserve-3d",transform:fl?"rotateY(180deg)":"rotateY(0)",transition:"transform 0.45s cubic-bezier(0.4,0,0.2,1)"}}>
        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",borderRadius:w*0.1,background:"#FEFEFE",
          boxShadow:highlight?"0 2px 12px rgba(212,175,55,0.5), 0 0 0 2px #C5A028":"0 1px 4px rgba(0,0,0,0.3)",
          border:highlight?"2px solid #C5A028":"none",
        }}>
          <div style={{position:"absolute",top:2,left:3,lineHeight:1}}><div style={{fontSize:fs,fontWeight:900,color:su.cl,fontFamily:"Georgia,serif"}}>{r}</div><div style={{fontSize:fs*0.7,color:su.cl,marginTop:-2}}>{su.c}</div></div>
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:w*0.5,color:red?"#EF5350":"#37474F",opacity:0.7,lineHeight:1}}>{su.c}</div>
          <div style={{position:"absolute",bottom:2,right:3,lineHeight:1,transform:"rotate(180deg)"}}><div style={{fontSize:fs,fontWeight:900,color:su.cl,fontFamily:"Georgia,serif"}}>{r}</div><div style={{fontSize:fs*0.7,color:su.cl,marginTop:-2}}>{su.c}</div></div>
        </div>
        <div style={{position:"absolute",inset:0,backfaceVisibility:"hidden",transform:"rotateY(180deg)",borderRadius:w*0.1,background:"linear-gradient(145deg,#1B1464,#0D0B3E)",border:"1.5px solid #B8960C",boxShadow:"0 1px 4px rgba(0,0,0,0.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:w*0.3,color:"#B8960C",opacity:0.25}}>♠</span>
        </div>
      </div>
    </div>
  );
}

function Hand({cards,faceDown,w=30,h=42,delay=0,highlightCards=[]}){
  if(!cards)return null;const ov=w*0.45;
  return(<div style={{position:"relative",width:w*2-ov,height:h,flexShrink:0}}>
    <div style={{position:"absolute",left:0,top:0,zIndex:1,transform:"rotate(-4deg)"}}><Card card={cards[0]} faceDown={faceDown} w={w} h={h} delay={delay} highlight={highlightCards.includes(cards[0])}/></div>
    <div style={{position:"absolute",left:w-ov,top:0,zIndex:2,transform:"rotate(4deg)"}}><Card card={cards[1]} faceDown={faceDown} w={w} h={h} delay={delay+80} highlight={highlightCards.includes(cards[1])}/></div>
  </div>);
}

function Community({board,count,pkey,highlightCards=[]}){
  const[fl,setFl]=useState([1,1,1,1,1]);
  useEffect(()=>{if(!count){setFl([1,1,1,1,1]);return;}const t=[];for(let i=0;i<5;i++)if(i<count)t.push(setTimeout(()=>setFl(p=>{const n=[...p];n[i]=0;return n}),400+(count<=3&&i<3?i*250:0)));return()=>t.forEach(clearTimeout)},[count,pkey]);
  return(<div style={{display:"flex",gap:4,padding:"5px 8px",background:"rgba(0,0,0,0.2)",borderRadius:10,border:"1px solid rgba(255,255,255,0.04)"}}>
    {board.map((c,i)=>i<count
      ?<Card key={`${i}-${c}`} card={c} faceDown={!!fl[i]} w={44} h={62} delay={200+i*150} highlight={highlightCards.includes(c)} dim={highlightCards.length>0 && !highlightCards.includes(c)}/>
      :<Card key={i} card={null} w={44} h={62}/>)}
  </div>);
}

function TimerBar({remaining,total,bankRemaining,bankTotal,inBank}){
  const pct=inBank?(bankRemaining/bankTotal)*100:(remaining/total)*100;
  const color=inBank?"#F97316":pct>50?"#22C55E":pct>20?"#EAB308":"#EF4444";
  const critical=!inBank&&pct<=20;
  return(<div style={{display:"flex",alignItems:"center",gap:4,width:60}}>
    <div style={{flex:1,height:3,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
      <div style={{height:"100%",borderRadius:2,background:color,width:`${pct}%`,transition:"width 0.9s linear",animation:critical?"blink 0.5s ease-in-out infinite":"none"}}/>
    </div>
    <span style={{fontSize:8,fontWeight:800,color,minWidth:16,textAlign:"right",fontFamily:"Georgia,serif"}}>{inBank?bankRemaining:remaining}</span>
  </div>);
}

function Seat({p,pos,isMe,showAll,bet,active,timerData,handResult,isWinner,isDealer}){
  const see=isMe||showAll;
  const hl=handResult?.bestCards||[];
  return(
    <div style={{position:"absolute",...pos,transform:"translate(-50%,-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:2,zIndex:active||isWinner?15:5,opacity:p.f?0.25:1,transition:"opacity 0.3s"}}>
      {p.c&&p.c.length>0&&!p.f?<Hand cards={p.c} faceDown={!see} w={30} h={42} delay={300} highlightCards={showAll?hl:[]}/>:p.f?<div style={{height:12,display:"flex",alignItems:"center"}}><span style={{fontSize:7,color:"#E53935",fontWeight:800,letterSpacing:1.5}}>FOLD</span></div>:null}
      <div style={{display:"flex",alignItems:"center",gap:4,
        background:isWinner?"rgba(184,150,12,0.3)":active?"rgba(184,150,12,0.22)":isMe?"rgba(50,90,180,0.2)":"rgba(8,8,20,0.88)",
        padding:"3px 7px 3px 3px",borderRadius:14,
        border:isWinner?"2px solid #C5A028":active?"1.5px solid #C5A028":isMe?"1.5px solid rgba(100,160,255,0.35)":"1px solid rgba(255,255,255,0.05)",
        boxShadow:isWinner?"0 0 16px rgba(184,150,12,0.5)":active?"0 0 12px rgba(184,150,12,0.35)":"0 1px 5px rgba(0,0,0,0.5)",
        animation:active?"glow 1.8s ease-in-out infinite":isWinner?"winGlow 1.5s ease-in-out infinite":"none",
        position:"relative",backdropFilter:"blur(6px)"}}>
        <div style={{width:18,height:18,borderRadius:"50%",background:"linear-gradient(135deg,#1a1a3e,#2a2a5e)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,flexShrink:0}}>{p.a}</div>
        <div>
          <div style={{fontSize:8,fontWeight:700,color:isMe?"#8AB4FF":"#DDE",lineHeight:1,whiteSpace:"nowrap"}}>{p.n}{isMe&&" ⭐"}{isDealer&&" 🎴"}</div>
          <div style={{fontSize:7,color:p.ch<=0?"#E53935":"#C5A028",fontWeight:700,lineHeight:1.1}}>{p.ch<=0?"ALL IN":p.ch.toLocaleString()}</div>
        </div>
      </div>
      {showAll && handResult && !p.f && (
        <div style={{background:isWinner?"rgba(184,150,12,0.25)":"rgba(0,0,0,0.5)",borderRadius:6,padding:"1px 6px",border:`1px solid ${isWinner?"rgba(184,150,12,0.4)":"rgba(255,255,255,0.06)"}`,marginTop:1}}>
          <span style={{fontSize:7,fontWeight:800,color:isWinner?"#E5C94B":"#999"}}>{handResult.nameHe}</span>
        </div>
      )}
      {bet>0&&!p.f&&!showAll&&(<div style={{display:"flex",alignItems:"center",gap:2,background:"rgba(0,0,0,0.55)",borderRadius:10,padding:"1px 6px 1px 2px",border:"1px solid rgba(184,150,12,0.1)"}}><div style={{width:9,height:9,borderRadius:"50%",background:"linear-gradient(135deg,#C5A028,#92750A)",border:"1px solid rgba(255,255,255,0.15)"}}/><span style={{fontSize:8,fontWeight:800,color:"#E5C94B"}}>{bet}</span></div>)}
      {active&&timerData&&<TimerBar {...timerData}/>}
    </div>
  );
}

// ═══ LOBBY SCREEN ═══
function LobbyScreen({onStart}){
  const[preset,setPreset]=useState("normal");
  const[settings,setSettings]=useState({...PRESETS.normal,name:"ליל פוקר 🃏",password:"",maxPlayers:9,minPlayers:3,autoAction:"fold"});
  const[tab,setTab]=useState("create");
  const applyPreset=(k)=>{setPreset(k);setSettings(s=>({...s,...PRESETS[k]}))};
  const set=(k,v)=>setSettings(s=>({...s,[k]:v}));
  return(
    <div style={{width:"100%",minHeight:"100vh",background:"radial-gradient(ellipse at 50% 30%,#101A10,#060A06 60%,#030503)",display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 16px",fontFamily:"'Segoe UI',sans-serif"}}>
      <span style={{fontSize:28,fontWeight:900,color:"#C5A028",letterSpacing:5,fontFamily:"Georgia,serif",marginBottom:4}}>VAULT</span>
      <span style={{fontSize:11,color:"#555",letterSpacing:3,marginBottom:24}}>POKER</span>
      <div style={{display:"flex",gap:0,marginBottom:20,borderRadius:10,overflow:"hidden",border:"1px solid rgba(184,150,12,0.15)"}}>
        {[["create","צור שולחן 🃏"],["join","הצטרף 🔗"]].map(([k,l])=>(<button key={k} onClick={()=>setTab(k)} style={{padding:"8px 24px",fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:tab===k?"rgba(184,150,12,0.2)":"rgba(255,255,255,0.02)",color:tab===k?"#E5C94B":"#666"}}>{l}</button>))}
      </div>
      {tab==="join"?(
        <div style={{width:"100%",maxWidth:340}}>
          <label style={lbl}>קוד שולחן</label><input type="text" placeholder="A7X2" maxLength={6} style={inp}/>
          <label style={{...lbl,marginTop:12}}>סיסמה</label><input type="password" placeholder="••••" style={inp}/>
          <button onClick={()=>onStart(settings)} style={primaryBtn}>הצטרף 🚀</button>
        </div>
      ):(
        <div style={{width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:16}}>
          <div><label style={lbl}>תבנית מוכנה</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(PRESETS).map(([k,v])=>(<button key={k} onClick={()=>applyPreset(k)} style={{padding:"6px 14px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",background:preset===k?"rgba(184,150,12,0.2)":"rgba(255,255,255,0.03)",border:`1px solid ${preset===k?"rgba(184,150,12,0.4)":"rgba(255,255,255,0.06)"}`,color:preset===k?"#E5C94B":"#888"}}>{v.label}</button>))}</div>
          </div>
          <Section title="⚙️ בסיסי"><label style={lbl}>שם השולחן</label><input value={settings.name} onChange={e=>set("name",e.target.value)} style={inp}/><div style={{display:"flex",gap:10,marginTop:8}}><div style={{flex:1}}><label style={lbl}>סיסמה</label><input type="password" value={settings.password} onChange={e=>set("password",e.target.value)} placeholder="ריק = ציבורי" style={inp}/></div><div style={{flex:1}}><label style={lbl}>שחקנים</label><select value={settings.maxPlayers} onChange={e=>set("maxPlayers",+e.target.value)} style={inp}>{[2,3,4,5,6,7,8,9].map(n=><option key={n} value={n}>{n}</option>)}</select></div></div></Section>
          <Section title="💰 כסף"><label style={lbl}>Buy-in</label><div style={{display:"flex",gap:6}}>{[500,1000,2000,5000].map(v=>(<button key={v} onClick={()=>set("buyIn",v)} style={{flex:1,padding:"8px 4px",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",background:settings.buyIn===v?"rgba(184,150,12,0.2)":"rgba(255,255,255,0.03)",border:`1px solid ${settings.buyIn===v?"#C5A028":"rgba(255,255,255,0.06)"}`,color:settings.buyIn===v?"#E5C94B":"#888",fontFamily:"Georgia,serif"}}>{v.toLocaleString()}</button>))}</div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}><Toggle on={settings.rebuy} onToggle={v=>set("rebuy",v)}/><span style={{fontSize:11,color:"#aaa"}}>Re-buy מותר</span></div></Section>
          <Section title="🎯 Blinds"><div style={{display:"flex",gap:10}}><div style={{flex:1}}><label style={lbl}>Small Blind</label><input type="number" value={settings.sb} onChange={e=>set("sb",+e.target.value)} style={inp}/></div><div style={{flex:1}}><label style={lbl}>Big Blind</label><input type="number" value={settings.bb} onChange={e=>set("bb",+e.target.value)} style={inp}/></div></div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:10}}><Toggle on={settings.blindsUp} onToggle={v=>set("blindsUp",v)}/><span style={{fontSize:11,color:"#aaa"}}>Blinds עולים</span></div></Section>
          <Section title="⏱️ טיימר"><label style={lbl}>שניות לתור: <b style={{color:"#E5C94B"}}>{settings.timer}s</b></label><input type="range" min={10} max={90} step={5} value={settings.timer} onChange={e=>set("timer",+e.target.value)} style={sliderStyle}/><label style={{...lbl,marginTop:10}}>בנק זמן: <b style={{color:"#E5C94B"}}>{settings.bank}s</b></label><input type="range" min={0} max={120} step={10} value={settings.bank} onChange={e=>set("bank",+e.target.value)} style={sliderStyle}/><label style={{...lbl,marginTop:10}}>כשנגמר הזמן:</label><div style={{display:"flex",gap:6}}>{[["fold","Auto Fold"],["check_fold","Check / Fold"]].map(([k,l])=>(<button key={k} onClick={()=>set("autoAction",k)} style={{flex:1,padding:"6px 8px",borderRadius:8,fontSize:10,fontWeight:700,cursor:"pointer",background:settings.autoAction===k?"rgba(184,150,12,0.2)":"rgba(255,255,255,0.03)",border:`1px solid ${settings.autoAction===k?"#C5A028":"rgba(255,255,255,0.06)"}`,color:settings.autoAction===k?"#E5C94B":"#888"}}>{l}</button>))}</div></Section>
          <div style={{background:"rgba(184,150,12,0.06)",borderRadius:12,padding:12,border:"1px solid rgba(184,150,12,0.1)"}}><div style={{fontSize:10,color:"#888",marginBottom:6,fontWeight:600}}>סיכום הגדרות</div><div style={{display:"flex",flexWrap:"wrap",gap:8,fontSize:10,color:"#ccc"}}><span>💰 {settings.buyIn.toLocaleString()}</span><span>🎯 {settings.sb}/{settings.bb}</span><span>⏱️ {settings.timer}s</span><span>👥 {settings.maxPlayers}</span></div></div>
          <button onClick={()=>onStart(settings)} style={primaryBtn}>צור שולחן 🚀</button>
        </div>
      )}
    </div>
  );
}
function Section({title,children}){const[open,setOpen]=useState(true);return(<div style={{background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.04)",overflow:"hidden"}}><button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"10px 14px",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",color:"#ddd",fontSize:13,fontWeight:700}}>{title}<span style={{fontSize:10,color:"#666"}}>{open?"▼":"▶"}</span></button>{open&&<div style={{padding:"0 14px 14px"}}>{children}</div>}</div>);}
function Toggle({on,onToggle}){return(<div onClick={()=>onToggle(!on)} style={{width:36,height:20,borderRadius:10,background:on?"rgba(184,150,12,0.4)":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",border:`1px solid ${on?"#C5A028":"rgba(255,255,255,0.1)"}`}}><div style={{width:16,height:16,borderRadius:"50%",background:on?"#C5A028":"#555",position:"absolute",top:1,left:on?17:1,transition:"left 0.2s"}}/></div>);}

// ═══ GAME SCREEN ═══
function GameScreen({settings,onExit}){
  const n=settings.maxPlayers;

  // Build initial hand state
  const buildHand = (chips, dealerIdx) => {
    const sb=(dealerIdx+1)%n, bb=(dealerIdx+2)%n;
    const {holeCards,board}=dealGame(n);
    const ps=INIT_PLAYERS.slice(0,n).map((p,i)=>({...p,ch:chips[i],c:holeCards[i],f:false}));
    const sbAmt=Math.min(settings.sb,ps[sb].ch);
    const bbAmt=Math.min(settings.bb,ps[bb].ch);
    ps[sb].ch-=sbAmt; ps[bb].ch-=bbAmt;
    const bts=Array(n).fill(0);
    bts[sb]=sbAmt; bts[bb]=bbAmt;
    // find UTG: first active player after BB
    let utg=(bb+1)%n, attempts=0;
    while(ps[utg].ch<=0&&attempts<n){utg=(utg+1)%n;attempts++;}
    return {ps,board,bts,utg,sb,bb};
  };

  const[dealerIdx,setDealerIdx]=useState(0);
  const init=()=>buildHand(Array(n).fill(settings.buyIn),0);
  const[{ps:initPs,board:initBoard,bts:initBts,utg:initUtg}]=useState(init);

  const[players,setPlayers]=useState(initPs);
  const[board,setBoard]=useState(initBoard);
  const[bets,setBets]=useState(initBts);
  const[pot,setPot]=useState(0);
  const[phaseIdx,setPhaseIdx]=useState(0);
  const[pkey,setPkey]=useState(0);
  const[turn,setTurn]=useState(initUtg);
  const[curBet,setCurBet]=useState(settings.bb);
  const[raise,setRaise]=useState(settings.bb*2);
  const[toast,setToast]=useState(null);
  const[winner,setWinner]=useState(null);
  const[acted,setActed]=useState(new Set());
  const[handResults,setHandResults]=useState([]);
  const[timerRemaining,setTimerRemaining]=useState(settings.timer);
  const[bankRemaining,setBankRemaining]=useState(settings.bank);
  const[inBank,setInBank]=useState(false);

  // Refs to prevent stale closures in timeouts
  const timerRef=useRef(null);
  const turnRef=useRef(initUtg);
  const playersRef=useRef(initPs);
  const betsRef=useRef(initBts);
  const curBetRef=useRef(settings.bb);
  const potRef=useRef(0);
  const boardRef=useRef(initBoard);
  const phaseIdxRef=useRef(0);
  const actedRef=useRef(new Set());
  const raiseRef=useRef(settings.bb*2);
  const bankRemainingRef=useRef(settings.bank);
  const dealerIdxRef=useRef(0);

  useEffect(()=>{turnRef.current=turn},[turn]);
  useEffect(()=>{playersRef.current=players},[players]);
  useEffect(()=>{betsRef.current=bets},[bets]);
  useEffect(()=>{curBetRef.current=curBet},[curBet]);
  useEffect(()=>{potRef.current=pot},[pot]);
  useEffect(()=>{boardRef.current=board},[board]);
  useEffect(()=>{phaseIdxRef.current=phaseIdx},[phaseIdx]);
  useEffect(()=>{actedRef.current=acted},[acted]);
  useEffect(()=>{raiseRef.current=raise},[raise]);
  useEffect(()=>{bankRemainingRef.current=bankRemaining},[bankRemaining]);
  useEffect(()=>{dealerIdxRef.current=dealerIdx},[dealerIdx]);

  const phase=PHASES[phaseIdx];
  const revealCount=PH_REVEAL[phase];
  const isMyTurn=turn===0;

  const nextActive=(from,ps)=>{
    let nx=(from+1)%n,t=0;
    while((ps[nx].f||ps[nx].ch<=0)&&t<n){nx=(nx+1)%n;t++;}
    return nx;
  };

  // ── Timer ──
  const resetTimer=useCallback(()=>{setTimerRemaining(settings.timer);setInBank(false)},[settings.timer]);

  useEffect(()=>{
    if(phase==="showdown"||winner){clearInterval(timerRef.current);return;}
    resetTimer();
    timerRef.current=setInterval(()=>{
      setTimerRemaining(prev=>{
        if(prev>1)return prev-1;
        setInBank(ib=>{if(!ib&&bankRemainingRef.current>0)return true;return ib});
        return 0;
      });
      setInBank(ib=>{
        if(ib){setBankRemaining(br=>{
          if(br>1)return br-1;
          clearInterval(timerRef.current);
          setTimeout(()=>doAction("FOLD",true),100);
          return 0;
        });}
        return ib;
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[turn,phase,winner]);

  // ── Bot AI ──
  useEffect(()=>{
    if(isMyTurn||phase==="showdown"||winner)return;
    const delay=700+Math.random()*800;
    const tid=setTimeout(()=>{
      const ps=playersRef.current;
      const t=turnRef.current;
      if(ps[t]?.f)return;
      const cb=curBetRef.current;
      const bt=betsRef.current;
      const canCheck=cb<=(bt[t]||0);
      const r=Math.random();
      if(!canCheck&&r<0.28){
        doAction("FOLD");
      }else if(canCheck&&r>0.82){
        const botRaise=Math.max(cb*2,settings.bb*2);
        doAction("RAISE",false,botRaise);
      }else if(!canCheck&&r>0.75){
        const botRaise=Math.max(cb*2,settings.bb*2);
        doAction("RAISE",false,botRaise);
      }else{
        doAction(canCheck?"CHECK":"CALL");
      }
    },delay);
    return()=>clearTimeout(tid);
  },[turn,phase,winner,isMyTurn]);

  // ── Advance phase ──
  const advancePhase=(currentPlayers,currentBets,currentPot,currentPhaseIdx,currentBoard)=>{
    const betTotal=currentBets.reduce((a,b)=>a+b,0);
    const totalPotVal=currentPot+betTotal;
    const newPhaseIdx=currentPhaseIdx+1;

    setPhaseIdx(newPhaseIdx);setPkey(k=>k+1);
    setBets(Array(n).fill(0));setCurBet(0);setActed(new Set());setRaise(settings.bb*2);

    if(newPhaseIdx===4){
      const results=currentPlayers.map(p=>{
        if(p.f||!p.c||p.c.length<2)return null;
        return evaluateHand(p.c,currentBoard);
      });
      setHandResults(results);
      let bestIdx=-1,bestScore=-1;
      results.forEach((r,i)=>{if(r&&r.score>bestScore){bestScore=r.score;bestIdx=i;}});
      if(bestIdx>=0){
        const wp=currentPlayers.map(x=>({...x}));
        wp[bestIdx].ch+=totalPotVal;
        setPlayers(wp);
        setPot(0);
        setWinner({idx:bestIdx,name:currentPlayers[bestIdx].n,hand:results[bestIdx].nameHe,handEn:results[bestIdx].name,bestCards:results[bestIdx].bestCards,amount:totalPotVal});
      }
    }else{
      setPot(totalPotVal);
      setTurn(nextActive(0,currentPlayers));
    }
  };

  // ── Core action ──
  const doAction=(action,isAuto=false,raiseOverride=null)=>{
    const p=playersRef.current.map(x=>({...x}));
    const nb=[...betsRef.current];
    const na=new Set(actedRef.current);
    const cb=curBetRef.current;
    const rz=raiseOverride??raiseRef.current;
    const t=turnRef.current;
    na.add(t);
    let betAmt=0;

    switch(action){
      case"FOLD":p[t].f=true;p[t].c=null;break;
      case"CHECK":break;
      case"CALL":betAmt=Math.min(cb-nb[t],p[t].ch);nb[t]+=betAmt;p[t].ch-=betAmt;break;
      case"RAISE":
        betAmt=Math.min(rz-nb[t],p[t].ch);
        if(betAmt<0)betAmt=0;
        nb[t]+=betAmt;p[t].ch-=betAmt;
        setCurBet(nb[t]);na.clear();na.add(t);
        break;
      case"ALL IN":
        betAmt=p[t].ch;nb[t]+=betAmt;p[t].ch=0;
        if(nb[t]>cb){setCurBet(nb[t]);na.clear();na.add(t);}
        break;
    }

    setActed(na);

    if(!isAuto){setToast(`${p[t].n}: ${action}${betAmt>0?` ${betAmt}`:""}`);setTimeout(()=>setToast(null),1400);}

    const remaining=p.filter(x=>!x.f);
    if(remaining.length===1){
      const totalWin=potRef.current+nb.reduce((a,b)=>a+b,0);
      const winIdx=p.indexOf(remaining[0]);
      p[winIdx].ch+=totalWin;
      setPlayers(p);setBets(Array(n).fill(0));setPot(0);
      setWinner({idx:winIdx,name:remaining[0].n,hand:"כולם עשו Fold",bestCards:[],amount:totalWin});
      setPhaseIdx(4);setHandResults([]);
      return;
    }

    setPlayers(p);setBets(nb);

    const ap=p.filter((x,i)=>!x.f&&x.ch>0);
    const allAct=ap.every(x=>na.has(p.indexOf(x)));
    const mx=nb.length>0?Math.max(...nb.map((v,i)=>p[i].f?0:v)):0;
    const allEq=ap.every(x=>nb[p.indexOf(x)]===mx||x.ch<=0);

    if(action!=="FOLD"&&allAct&&allEq){
      setTimeout(()=>advancePhase(p,nb,potRef.current,phaseIdxRef.current,boardRef.current),600);
      return;
    }
    setTurn(nextActive(t,p));
  };

  const reset=()=>{
    const newDealer=(dealerIdxRef.current+1)%n;
    setDealerIdx(newDealer);
    const chips=playersRef.current.map(p=>p.ch<=0?settings.buyIn:p.ch);
    const{ps,board:nb,bts,utg}=buildHand(chips,newDealer);
    setPlayers(ps);setBoard(nb);setBets(bts);setPot(0);
    setPhaseIdx(0);setPkey(k=>k+1);setTurn(utg);
    setCurBet(settings.bb);setRaise(settings.bb*2);
    setWinner(null);setActed(new Set());
    setBankRemaining(settings.bank);setInBank(false);setHandResults([]);
  };

  const callAmt=Math.min(curBet-(bets[0]||0),players[0]?.ch||0);
  const canCheck=curBet<=(bets[0]||0);
  const seats=[{bottom:"-1%",left:"50%"},{bottom:"10%",left:"15%"},{top:"42%",left:"10%"},{top:"16%",left:"16%"},{top:"3%",left:"34%"},{top:"3%",left:"66%"},{top:"16%",left:"84%"},{top:"42%",left:"90%"},{bottom:"10%",left:"85%"}].slice(0,n);
  const totalPot=pot+bets.reduce((a,b)=>a+b,0);
  const winnerBestCards=winner?.bestCards||[];
  const raiseMin=Math.max(curBet*2,settings.bb*2);
  const raiseMax=Math.max(players[0]?.ch||0,raiseMin);
  const raisePct=raiseMax>raiseMin?((raise-raiseMin)/(raiseMax-raiseMin))*100:0;

  return(
    <div style={{width:"100%",minHeight:"100vh",background:"radial-gradient(ellipse at 50% 40%,#101A10,#080E08 55%,#030503)",display:"flex",flexDirection:"column",alignItems:"center",fontFamily:"'Segoe UI',sans-serif",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",maxWidth:900,padding:"8px 10px 2px",zIndex:20}}>
        <button onClick={onExit} style={{...hb,color:"#888"}}>← יציאה</button>
        <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14,fontWeight:900,color:"#C5A028",letterSpacing:2,fontFamily:"Georgia,serif"}}>VAULT</span><div style={{background:phase==="showdown"?"rgba(184,150,12,0.2)":"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:800,color:phase==="showdown"?"#E5C94B":"#888",letterSpacing:1}}>{PH_LABEL[phase]}</div></div>
        <div style={{fontSize:9,color:"#555"}}>⏱️{settings.timer}s · 🎯{settings.sb}/{settings.bb}</div>
      </div>

      <div style={{position:"relative",width:"100%",maxWidth:860,aspectRatio:"4/3.4",maxHeight:"calc(100vh - 170px)",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"4%",left:"2%",right:"2%",bottom:"4%",borderRadius:"50%",background:"linear-gradient(180deg,#4A3728,#3D2E22 40%,#2E2218 70%,#1E160F)",boxShadow:"0 16px 50px rgba(0,0,0,0.55)",padding:"2.5%"}}>
          <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"radial-gradient(ellipse at 50% 42%,#1F7A3A,#176B30 20%,#105824 45%,#0B4A1C 65%,#073814)",boxShadow:"inset 0 0 40px rgba(0,0,0,0.3)",position:"relative"}}>
            <div style={{position:"absolute",top:"25%",left:"50%",transform:"translate(-50%,-50%)",zIndex:11}}>
              <div style={{background:"rgba(0,0,0,0.5)",borderRadius:12,padding:"4px 16px",border:"1px solid rgba(184,150,12,0.1)",textAlign:"center"}}>
                <div style={{fontSize:7,color:"#999",letterSpacing:2}}>POT</div>
                <div style={{fontSize:20,fontWeight:900,color:"#E5C94B",fontFamily:"Georgia,serif",lineHeight:1}}>{totalPot.toLocaleString()}</div>
              </div>
            </div>
            <div style={{position:"absolute",top:"48%",left:"50%",transform:"translate(-50%,-50%)",zIndex:11}}>
              <Community board={board} count={revealCount} pkey={pkey} highlightCards={phase==="showdown"?winnerBestCards:[]}/>
            </div>
            {players.map((p,i)=>(
              <Seat key={i} p={p} pos={seats[i]} isMe={i===0} showAll={phase==="showdown"} bet={bets[i]}
                active={i===turn&&!p.f&&phase!=="showdown"}
                timerData={i===turn&&!p.f&&phase!=="showdown"?{remaining:timerRemaining,total:settings.timer,bankRemaining,bankTotal:settings.bank,inBank}:null}
                handResult={handResults[i]||null}
                isWinner={winner?.idx===i}
                isDealer={i===dealerIdx}/>
            ))}
          </div>
        </div>
      </div>

      {winner&&(
        <div style={{width:"100%",maxWidth:680,background:"rgba(10,10,24,0.95)",border:"1px solid #C5A028",borderRadius:14,padding:"10px 16px",zIndex:25,textAlign:"center",backdropFilter:"blur(20px)",boxShadow:"0 0 30px rgba(184,150,12,0.25)",animation:"fadeInUp 0.4s ease",marginTop:4,display:"flex",alignItems:"center",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>🏆</span>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:"#E5C94B",fontFamily:"Georgia,serif",lineHeight:1}}>{winner.name}</div>
              <div style={{fontSize:11,color:"#FFF",fontWeight:700}}>{winner.hand}</div>
              {winner.handEn&&<div style={{fontSize:8,color:"#888"}}>{winner.handEn}</div>}
            </div>
          </div>
          {winner.bestCards?.length>0&&(
            <div style={{display:"flex",gap:2}}>
              {winner.bestCards.map((c,i)=><Card key={i} card={c} w={32} h={44} delay={i*80} highlight={true}/>)}
            </div>
          )}
          <div style={{fontSize:14,color:"#C5A028",fontWeight:800,fontFamily:"Georgia,serif"}}>+{(winner.amount||totalPot).toLocaleString()} 💰</div>
        </div>
      )}

      <div style={{width:"100%",maxWidth:680,padding:"6px 10px 10px",background:"linear-gradient(180deg,rgba(12,12,28,0.96),rgba(6,6,16,0.98))",borderRadius:"14px 14px 0 0",border:"1px solid rgba(184,150,12,0.06)",borderBottom:"none",boxShadow:"0 -4px 20px rgba(0,0,0,0.3)",zIndex:20}}>
        <div style={{display:"flex",gap:3,marginBottom:6,justifyContent:"center"}}>{PHASES.map((ph,i)=>(<div key={ph} style={{flex:1,height:3,borderRadius:2,maxWidth:55,background:i<phaseIdx?"rgba(184,150,12,0.4)":i===phaseIdx?"#C5A028":"rgba(255,255,255,0.04)"}}/>))}</div>
        {phase!=="showdown"?<>
          <div style={{textAlign:"center",marginBottom:5,fontSize:10,color:isMyTurn?"#E5C94B":"#666",fontWeight:700}}>{isMyTurn?"🎯 התור שלך!":`⏳ ממתין ל-${players[turn]?.n}...`}</div>
          {isMyTurn&&(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <span style={{fontSize:8,color:"#666"}}>RAISE</span>
            <input type="range" min={raiseMin} max={raiseMax} step={10} value={Math.max(raise,raiseMin)} onChange={e=>{const v=+e.target.value;setRaise(v);raiseRef.current=v;}} style={{...sliderStyle,background:`linear-gradient(90deg,#C5A028 ${raisePct}%,rgba(255,255,255,0.04) ${raisePct}%)`}}/>
            <div style={{background:"rgba(184,150,12,0.08)",border:"1px solid rgba(184,150,12,0.12)",borderRadius:6,padding:"2px 7px",fontSize:12,fontWeight:800,color:"#E5C94B",fontFamily:"Georgia,serif",minWidth:42,textAlign:"center"}}>{raise}</div>
          </div>)}
          <div style={{display:"flex",gap:4,opacity:isMyTurn?1:0.35,pointerEvents:isMyTurn?"auto":"none"}}>
            <button onClick={()=>doAction("FOLD")} style={abtn("#FF4444","rgba(255,68,68,0.2)")}><span style={{fontSize:9,fontWeight:800}}>FOLD</span></button>
            {canCheck?<button onClick={()=>doAction("CHECK")} style={abtn("#8899AA","rgba(136,153,170,0.1)")}><span style={{fontSize:9,fontWeight:800}}>CHECK</span></button>
            :<button onClick={()=>doAction("CALL")} style={abtn("#4488FF","rgba(68,136,255,0.15)")}><span style={{fontSize:9,fontWeight:800}}>CALL</span><span style={{fontSize:7,opacity:0.5}}>{callAmt}</span></button>}
            <button onClick={()=>doAction("RAISE")} style={abtn("#E5C94B","rgba(184,150,12,0.2)")}><span style={{fontSize:9,fontWeight:800}}>RAISE</span><span style={{fontSize:7,opacity:0.5}}>{raise}</span></button>
            <button onClick={()=>doAction("ALL IN")} style={abtn("#FFF","rgba(184,150,12,0.25)")}><span style={{fontSize:9,fontWeight:800}}>ALL IN</span></button>
          </div>
        </>:(<div style={{display:"flex",justifyContent:"center",gap:8,marginTop:4}}>
          <button onClick={reset} style={{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",borderRadius:8,color:"#22C55E",padding:"7px 20px",fontSize:11,cursor:"pointer",fontWeight:700}}>🔄 יד חדשה</button>
          <button onClick={onExit} style={{background:"rgba(255,68,68,0.1)",border:"1px solid rgba(255,68,68,0.2)",borderRadius:8,color:"#FF4444",padding:"7px 20px",fontSize:11,cursor:"pointer",fontWeight:700}}>🚪 יציאה</button>
        </div>)}
      </div>
      {toast&&(<div style={{position:"fixed",top:44,left:"50%",transform:"translateX(-50%)",background:"rgba(10,10,24,0.92)",border:"1px solid rgba(184,150,12,0.2)",borderRadius:10,padding:"5px 16px",zIndex:100,color:"#E5C94B",fontSize:12,fontWeight:700,backdropFilter:"blur(16px)",animation:"fadeIn 0.2s ease"}}>{toast}</div>)}
      <style>{`*{box-sizing:border-box;margin:0;padding:0}body{margin:0;background:#030503;overflow-x:hidden}
        @keyframes glow{0%,100%{box-shadow:0 0 10px rgba(184,150,12,0.25),0 1px 5px rgba(0,0,0,0.5)}50%{box-shadow:0 0 20px rgba(184,150,12,0.45),0 1px 5px rgba(0,0,0,0.5)}}
        @keyframes winGlow{0%,100%{box-shadow:0 0 12px rgba(184,150,12,0.4),0 0 0 2px rgba(184,150,12,0.2)}50%{box-shadow:0 0 24px rgba(184,150,12,0.7),0 0 0 3px rgba(184,150,12,0.3)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#C5A028,#92750A);border:1.5px solid rgba(255,255,255,0.2);cursor:pointer}
        input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#C5A028,#92750A);border:1.5px solid rgba(255,255,255,0.2);cursor:pointer}
        select{-webkit-appearance:none}`}</style>
    </div>
  );
}

// ═══ APP ═══
export default function App(){
  const[screen,setScreen]=useState("lobby");
  const[settings,setSettings]=useState(null);
  if(screen==="game"&&settings)return <GameScreen settings={settings} onExit={()=>setScreen("lobby")}/>;
  return <LobbyScreen onStart={s=>{setSettings(s);setScreen("game")}}/>;
}

const lbl={fontSize:10,color:"#888",display:"block",marginBottom:4,letterSpacing:0.5,fontWeight:600};
const inp={width:"100%",padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"#E2E8F0",fontSize:13,outline:"none",fontFamily:"Georgia,serif",boxSizing:"border-box"};
const sliderStyle={width:"100%",height:3,appearance:"none",outline:"none",background:"linear-gradient(90deg,#C5A028 50%,rgba(255,255,255,0.04) 50%)",borderRadius:2,cursor:"pointer"};
const primaryBtn={width:"100%",padding:"12px",borderRadius:12,background:"linear-gradient(135deg,#C5A028,#92750A)",border:"none",color:"#111",fontSize:14,fontWeight:800,cursor:"pointer",letterSpacing:2,marginTop:12};
const hb={background:"rgba(255,255,255,0.03)",border:"1px solid rgba(184,150,12,0.12)",borderRadius:6,color:"#C5A028",padding:"3px 8px",fontSize:10,cursor:"pointer",fontWeight:600};
const abtn=(c,bc)=>({flex:1,padding:"8px 2px 6px",borderRadius:8,background:"transparent",border:`1px solid ${bc}`,color:c,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center"});
