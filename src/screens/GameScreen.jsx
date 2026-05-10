import { useState, useEffect, useCallback, useRef } from "react";
import { PHASES, PH_LABEL, PH_REVEAL } from "../constants/phases";
import { INIT_PLAYERS } from "../constants/players";
import { dealGame } from "../utils/deck";
import { evaluateHand } from "../utils/handEvaluator";
import { Community } from "../components/Community";
import { Seat } from "../components/Seat";
import { Card } from "../components/Card";
import { HelpButton } from "../components/HelpButton";
import { hb, sliderStyle, abtn, globalCSS } from "../styles/ui";
import { playDeal, playChip, playWin } from "../utils/sounds";

const HAND_STRENGTH_PCT = [12, 28, 46, 62, 73, 81, 89, 95, 98, 100];

// ── Pot computation helpers (mirrors server/game/pots.js) ──────────────────
function computePots(contributions, players) {
  const caps = [...new Set(contributions.filter(c => c > 0))].sort((a, b) => a - b);
  let prevCap = 0;
  const pots = [];
  for (const cap of caps) {
    const level    = cap - prevCap;
    const cnt      = contributions.filter(c => c >= cap).length;
    const eligible = players.reduce((acc, p, i) => {
      if (!p.f && contributions[i] >= cap) acc.push(i);
      return acc;
    }, []);
    if (level * cnt > 0 && eligible.length > 0) pots.push({ amount: level * cnt, eligible });
    prevCap = cap;
  }
  return pots;
}

function awardPots(pots, results) {
  const winnings = {};
  const summary  = [];
  for (const { amount, eligible } of pots) {
    let best = -1;
    eligible.forEach(i => { if (results[i] && results[i].score > best) best = results[i].score; });
    const winners = eligible.filter(i => results[i] && results[i].score === best);
    if (!winners.length) continue;
    const share = Math.floor(amount / winners.length);
    const rem   = amount - share * winners.length;
    winners.forEach((i, idx) => { winnings[i] = (winnings[i] || 0) + share + (idx === 0 ? rem : 0); });
    summary.push({ amount, winners, isSplit: winners.length > 1 });
  }
  return { winnings, summary };
}

const SEAT_POSITIONS = [
  { bottom: "-1%",  left: "50%" },
  { bottom: "10%",  left: "15%" },
  { top:    "42%",  left: "10%" },
  { top:    "16%",  left: "16%" },
  { top:    "3%",   left: "34%" },
  { top:    "3%",   left: "66%" },
  { top:    "16%",  left: "84%" },
  { top:    "42%",  left: "90%" },
  { bottom: "10%",  left: "85%" },
];

export function GameScreen({ settings, onExit }) {
  const n = settings.maxPlayers;

  const buildHand = (chips, dealerIdx) => {
    const sb = (dealerIdx + 1) % n;
    const bb = (dealerIdx + 2) % n;
    const { holeCards, board } = dealGame(n);
    const ps = INIT_PLAYERS.slice(0, n).map((p, i) => ({
      ...p, ch: chips[i], c: holeCards[i], f: false,
    }));
    const sbAmt = Math.min(settings.sb, ps[sb].ch);
    const bbAmt = Math.min(settings.bb, ps[bb].ch);
    ps[sb].ch -= sbAmt;
    ps[bb].ch -= bbAmt;
    const bts = Array(n).fill(0);
    bts[sb] = sbAmt;
    bts[bb] = bbAmt;
    const contribs = Array(n).fill(0);
    contribs[sb] = sbAmt;
    contribs[bb] = bbAmt;
    let utg = (bb + 1) % n, attempts = 0;
    while (ps[utg].ch <= 0 && attempts < n) { utg = (utg + 1) % n; attempts++; }
    return { ps, board, bts, utg, contribs };
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [dealerIdx, setDealerIdx] = useState(0);
  const [{ ps: initPs, board: initBoard, bts: initBts, utg: initUtg, contribs: initContribs }] = useState(
    () => buildHand(Array(n).fill(settings.buyIn), 0)
  );
  const [players,        setPlayers]        = useState(initPs);
  const [board,          setBoard]          = useState(initBoard);
  const [bets,           setBets]           = useState(initBts);
  const [pot,            setPot]            = useState(0);
  const [phaseIdx,       setPhaseIdx]       = useState(0);
  const [pkey,           setPkey]           = useState(0);
  const [turn,           setTurn]           = useState(initUtg);
  const [curBet,         setCurBet]         = useState(settings.bb);
  const [raise,          setRaise]          = useState(settings.bb * 2);
  const [toast,          setToast]          = useState(null);
  const [winner,         setWinner]         = useState(null);
  const [acted,          setActed]          = useState(new Set());
  const [handResults,    setHandResults]    = useState([]);
  const [timerRemaining, setTimerRemaining] = useState(settings.timer);
  const [bankRemaining,  setBankRemaining]  = useState(settings.bank);
  const [inBank,         setInBank]         = useState(false);
  const [actionLog,      setActionLog]      = useState([]);
  const [contributions,  setContributions]  = useState(initContribs);
  const [potResults,     setPotResults]     = useState([]);

  // ── Refs (prevent stale closures in async callbacks) ──────────────────────
  const timerRef          = useRef(null);
  const turnRef           = useRef(initUtg);
  const playersRef        = useRef(initPs);
  const betsRef           = useRef(initBts);
  const contributionsRef  = useRef(initContribs);
  const curBetRef         = useRef(settings.bb);
  const potRef           = useRef(0);
  const boardRef         = useRef(initBoard);
  const phaseIdxRef      = useRef(0);
  const actedRef         = useRef(new Set());
  const raiseRef         = useRef(settings.bb * 2);
  const bankRemainingRef = useRef(settings.bank);
  const dealerIdxRef     = useRef(0);

  useEffect(() => { turnRef.current        = turn;          }, [turn]);
  useEffect(() => { playersRef.current     = players;       }, [players]);
  useEffect(() => { betsRef.current        = bets;          }, [bets]);
  useEffect(() => { curBetRef.current      = curBet;        }, [curBet]);
  useEffect(() => { potRef.current         = pot;           }, [pot]);
  useEffect(() => { boardRef.current       = board;         }, [board]);
  useEffect(() => { phaseIdxRef.current    = phaseIdx;      }, [phaseIdx]);
  useEffect(() => { actedRef.current       = acted;         }, [acted]);
  useEffect(() => { raiseRef.current       = raise;         }, [raise]);
  useEffect(() => { contributionsRef.current = contributions; }, [contributions]);
  useEffect(() => { bankRemainingRef.current = bankRemaining; }, [bankRemaining]);
  useEffect(() => { dealerIdxRef.current   = dealerIdx;     }, [dealerIdx]);

  const phase       = PHASES[phaseIdx];
  const revealCount = PH_REVEAL[phase];
  const isMyTurn    = turn === 0;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const addLog = (text, type = "action") =>
    setActionLog(prev => [...prev.slice(-24), { text, type, id: Date.now() + Math.random() }]);

  // Returns the next seat that can still bet (not folded, has chips).
  // Returns -1 when all remaining players are all-in (no one can bet).
  const nextActiveWithChips = (from, ps) => {
    for (let i = 1; i <= n; i++) {
      const nx = (from + i) % n;
      if (!ps[nx].f && ps[nx].ch > 0) return nx;
    }
    return -1;
  };

  // ── Turn timer ──────────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    setTimerRemaining(settings.timer);
    setInBank(false);
  }, [settings.timer]);

  useEffect(() => {
    if (phase === "showdown" || winner) { clearInterval(timerRef.current); return; }
    resetTimer();
    timerRef.current = setInterval(() => {
      setTimerRemaining(prev => {
        if (prev > 1) return prev - 1;
        setInBank(ib => { if (!ib && bankRemainingRef.current > 0) return true; return ib; });
        return 0;
      });
      setInBank(ib => {
        if (ib) {
          setBankRemaining(br => {
            if (br > 1) return br - 1;
            clearInterval(timerRef.current);
            setTimeout(() => doAction("FOLD", true), 100);
            return 0;
          });
        }
        return ib;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [turn, phase, winner]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Bot AI ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMyTurn || phase === "showdown" || winner) return;
    const delay = 700 + Math.random() * 800;
    const tid = setTimeout(() => {
      const ps = playersRef.current;
      const t  = turnRef.current;
      if (ps[t]?.f) return;

      // All-in player shouldn't be acting — skip to next or advance phase
      if (ps[t]?.ch <= 0) {
        const nx = nextActiveWithChips(t, ps);
        if (nx === -1) {
          advancePhaseFromRefs();
        } else {
          setTurn(nx);
        }
        return;
      }

      const cb       = curBetRef.current;
      const bt       = betsRef.current;
      const canCheck = cb <= (bt[t] || 0);
      const r        = Math.random();

      if (!canCheck && r < 0.28) {
        doAction("FOLD");
      } else if ((canCheck && r > 0.82) || (!canCheck && r > 0.75)) {
        doAction("RAISE", false, Math.max(cb * 2, settings.bb * 2));
      } else {
        doAction(canCheck ? "CHECK" : "CALL");
      }
    }, delay);
    return () => clearTimeout(tid);
  }, [turn, phase, winner, isMyTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Advance phase using current ref values (for bot/auto cases) ────────────
  const advancePhaseFromRefs = () => {
    advancePhase(playersRef.current, betsRef.current, potRef.current, phaseIdxRef.current, boardRef.current);
  };

  // ── Advance to next street (or showdown) ───────────────────────────────────
  const advancePhase = (currentPlayers, currentBets, currentPot, currentPhaseIdx, currentBoard) => {
    const betTotal    = currentBets.reduce((a, b) => a + b, 0);
    const totalPotVal = currentPot + betTotal;
    const newPhaseIdx = currentPhaseIdx + 1;

    const phaseLogLabels = ['', '— FLOP —', '— TURN —', '— RIVER —', '— SHOWDOWN —'];
    addLog(phaseLogLabels[newPhaseIdx] || '', 'phase');

    setPhaseIdx(newPhaseIdx);
    setPkey(k => k + 1);
    setBets(Array(n).fill(0));
    setCurBet(0);
    setActed(new Set());
    setRaise(settings.bb * 2);

    if (newPhaseIdx === 4) {
      // Showdown: evaluate all remaining hands
      const results = currentPlayers.map(p => {
        if (p.f || !p.c || p.c.length < 2) return null;
        return evaluateHand(p.c, currentBoard);
      });
      setHandResults(results);

      // Side pots + split pot logic
      const contribs = contributionsRef.current;
      const hasSidePots = contribs && contribs.some(c => c > 0);
      const pots = hasSidePots
        ? computePots(contribs, currentPlayers)
        : [{ amount: totalPotVal, eligible: currentPlayers.map((p,i)=>i).filter(i=>!currentPlayers[i].f) }];
      const { winnings, summary } = awardPots(pots, results);

      const wp = currentPlayers.map((p, i) => ({ ...p, ch: p.ch + (winnings[i] || 0) }));
      setPlayers(wp);
      setPot(0);
      setPotResults(summary);

      // Main winner = winner of the main pot (best hand eligible by all)
      const mainIdx = summary.length > 0 ? summary[0].winners[0] : -1;
      if (mainIdx >= 0) {
        setWinner({
          idx: mainIdx,
          name: currentPlayers[mainIdx].n,
          hand: results[mainIdx]?.nameHe || '',
          handEn: results[mainIdx]?.name || '',
          bestCards: results[mainIdx]?.bestCards || [],
          amount: winnings[mainIdx],
          totalPot: totalPotVal,
        });
        playWin();
      }
    } else {
      playDeal();
      setPot(totalPotVal);
      // First to act post-flop: first active player after dealer
      const nx = nextActiveWithChips(dealerIdxRef.current, currentPlayers);
      if (nx === -1) {
        // Everyone is all-in — run out the remaining streets automatically
        setTimeout(() => advancePhase(currentPlayers, Array(n).fill(0), totalPotVal, newPhaseIdx, currentBoard), 800);
      } else {
        setTurn(nx);
      }
    }
  };

  // ── Process action ─────────────────────────────────────────────────────────
  const doAction = (action, isAuto = false, raiseOverride = null) => {
    const p  = playersRef.current.map(x => ({ ...x }));
    const nb = [...betsRef.current];
    const na = new Set(actedRef.current);
    const cb = curBetRef.current;
    const rz = raiseOverride ?? raiseRef.current;
    const t  = turnRef.current;
    na.add(t);
    let betAmt = 0;

    switch (action) {
      case "FOLD":
        p[t].f = true; p[t].c = null;
        break;
      case "CHECK":
        break;
      case "CALL":
        betAmt = Math.min(cb - nb[t], p[t].ch);
        nb[t] += betAmt; p[t].ch -= betAmt;
        break;
      case "RAISE":
        betAmt = Math.max(0, Math.min(rz - nb[t], p[t].ch));
        nb[t] += betAmt; p[t].ch -= betAmt;
        setCurBet(nb[t]); na.clear(); na.add(t);
        break;
      case "ALL IN":
        betAmt = p[t].ch;
        nb[t] += betAmt; p[t].ch = 0;
        if (nb[t] > cb) { setCurBet(nb[t]); na.clear(); na.add(t); }
        break;
    }

    // Track cumulative contributions
    const nc = [...contributionsRef.current];
    nc[t] = (nc[t] || 0) + betAmt;
    setContributions(nc);
    contributionsRef.current = nc;

    // Log action
    const actionLabels = { FOLD: "Fold", CHECK: "Check", CALL: `Call ${betAmt}`, RAISE: `Raise ${betAmt}`, "ALL IN": "All In" };
    addLog(`${p[t].n}: ${actionLabels[action] || action}`);
    if (action !== "FOLD") playChip();

    setActed(na);
    if (!isAuto) {
      setToast(`${p[t].n}: ${action}${betAmt > 0 ? ` ${betAmt}` : ""}`);
      setTimeout(() => setToast(null), 1400);
    }

    // All others folded — award pot immediately
    const remaining = p.filter(x => !x.f);
    if (remaining.length === 1) {
      const totalWin = potRef.current + nb.reduce((a, b) => a + b, 0);
      const winIdx   = p.indexOf(remaining[0]);
      p[winIdx].ch  += totalWin;
      setPlayers(p); setBets(Array(n).fill(0)); setPot(0);
      setWinner({ idx: winIdx, name: remaining[0].n, hand: "כולם עשו Fold", bestCards: [], amount: totalWin, totalPot: totalWin });
      setPhaseIdx(4); setHandResults([]);
      playWin();
      return;
    }

    setPlayers(p); setBets(nb);

    // Check if betting round is complete
    const activePlayers = p.filter(x => !x.f && x.ch > 0);
    const allActed      = activePlayers.every(x => na.has(p.indexOf(x)));
    const maxBet        = nb.length > 0 ? Math.max(...nb.map((v, i) => p[i].f ? 0 : v)) : 0;
    const allEqual      = activePlayers.every(x => nb[p.indexOf(x)] === maxBet || x.ch <= 0);

    if (action !== "FOLD" && allActed && allEqual) {
      setTimeout(() => advancePhase(p, nb, potRef.current, phaseIdxRef.current, boardRef.current), 600);
      return;
    }

    // Move to next player who can bet — skip all-in players
    const nx = nextActiveWithChips(t, p);
    if (nx === -1) {
      // Everyone remaining is all-in — auto-advance street
      setTimeout(() => advancePhase(p, nb, potRef.current, phaseIdxRef.current, boardRef.current), 600);
    } else {
      setTurn(nx);
    }
  };

  // ── New hand ───────────────────────────────────────────────────────────────
  const reset = () => {
    const newDealer = (dealerIdxRef.current + 1) % n;
    setDealerIdx(newDealer);
    const chips = playersRef.current.map(p => p.ch <= 0 ? settings.buyIn : p.ch);
    const { ps, board: nb, bts, utg, contribs } = buildHand(chips, newDealer);
    setPlayers(ps); setBoard(nb); setBets(bts); setPot(0);
    setPhaseIdx(0); setPkey(k => k + 1); setTurn(utg);
    setCurBet(settings.bb); setRaise(settings.bb * 2);
    setWinner(null); setActed(new Set());
    setBankRemaining(settings.bank); setInBank(false); setHandResults([]); setPotResults([]);
    setContributions(contribs); contributionsRef.current = contribs;
    setActionLog([]);
    playDeal();
  };

  // ── Derived render values ──────────────────────────────────────────────────
  const callAmt        = Math.min(curBet - (bets[0] || 0), players[0]?.ch || 0);
  const canCheck       = curBet <= (bets[0] || 0);
  const seats          = SEAT_POSITIONS.slice(0, n);
  const totalPot       = pot + bets.reduce((a, b) => a + b, 0);
  const displayPot     = (phase === 'showdown' && winner?.totalPot) ? winner.totalPot : totalPot;
  const winnerBestCards = winner?.bestCards || [];
  const raiseMin       = Math.max(curBet * 2, settings.bb * 2);
  const raiseMax       = Math.max(players[0]?.ch || 0, raiseMin);
  const raisePct       = raiseMax > raiseMin ? ((raise - raiseMin) / (raiseMax - raiseMin)) * 100 : 0;

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 40%,#101A10,#080E08 55%,#030503)",
      display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: "'Segoe UI',sans-serif", overflow: "hidden",
    }}>

      {/* ── Top bar ── */}
      <div className="vault-top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", maxWidth: 900, padding: "8px 10px 2px", zIndex: 20 }}>
        <button onClick={onExit} style={{ ...hb, color: "#888" }}>← יציאה</button>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#C5A028", letterSpacing: 2, fontFamily: "Georgia,serif" }}>VAULT</span>
          <div style={{ background: phase === "showdown" ? "rgba(184,150,12,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 800, color: phase === "showdown" ? "#E5C94B" : "#888", letterSpacing: 1 }}>{PH_LABEL[phase]}</div>
        </div>
        <div style={{ fontSize: 9, color: "#555", direction: "ltr" }}>{settings.timer}s ⏱️ · {settings.sb}/{settings.bb} 🎯</div>
      </div>

      {/* ── Table oval ── */}
      <div style={{ position: "relative", width: "100%", maxWidth: 860, aspectRatio: "4/3.4", maxHeight: "calc(100vh - 160px)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "4%", left: "2%", right: "2%", bottom: "4%", borderRadius: "50%", background: "linear-gradient(180deg,#4A3728,#3D2E22 40%,#2E2218 70%,#1E160F)", boxShadow: "0 16px 50px rgba(0,0,0,0.55)", padding: "2.5%" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 42%,#1F7A3A,#176B30 20%,#105824 45%,#0B4A1C 65%,#073814)", boxShadow: "inset 0 0 40px rgba(0,0,0,0.3)", position: "relative" }}>

            {/* Pot */}
            <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 11 }}>
              <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 12, padding: "4px 16px", border: "1px solid rgba(184,150,12,0.1)", textAlign: "center" }}>
                <div style={{ fontSize: 7, color: "#999", letterSpacing: 2 }}>POT</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#E5C94B", fontFamily: "Georgia,serif", lineHeight: 1 }}>{displayPot.toLocaleString()}</div>
              </div>
            </div>

            {/* Community cards */}
            <div style={{ position: "absolute", top: "48%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 11 }}>
              <Community board={board} count={revealCount} pkey={pkey} highlightCards={phase === "showdown" ? winnerBestCards : []} />
            </div>

            {/* Seats */}
            {players.map((p, i) => (
              <Seat
                key={i} p={p} pos={seats[i]}
                isMe={i === 0}
                showAll={phase === "showdown"}
                bet={bets[i]}
                active={i === turn && !p.f && phase !== "showdown"}
                timerData={i === turn && !p.f && phase !== "showdown"
                  ? { remaining: timerRemaining, total: settings.timer, bankRemaining, bankTotal: settings.bank, inBank }
                  : null}
                handResult={handResults[i] || null}
                isWinner={winner?.idx === i}
                isDealer={i === dealerIdx}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── My Cards Panel ── */}
      {phase !== "showdown" && !players[0]?.f && players[0]?.c?.length === 2 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, direction: "ltr",
          background: "rgba(4,10,4,0.90)",
          border: "1px solid rgba(68,136,255,0.22)",
          borderRadius: 12, padding: "7px 16px 7px 10px",
          width: "100%", maxWidth: 680,
          backdropFilter: "blur(8px)", zIndex: 15, marginTop: 2,
        }}>
          <div style={{ fontSize: 8, color: "#6B9CFF", fontWeight: 700, letterSpacing: 1, minWidth: 36, textAlign: "center", lineHeight: 1.5 }}>
            הקלפים<br/>שלך
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Card card={players[0].c[0]} w={52} h={73} />
            <Card card={players[0].c[1]} w={52} h={73} />
          </div>
          {revealCount >= 3 && (() => {
            try {
              const res = evaluateHand(players[0].c, board.slice(0, revealCount));
              if (!res) return null;
              const pct = HAND_STRENGTH_PCT[res.handRank] ?? 10;
              const barColor = res.handRank >= 5 ? "#22C55E" : res.handRank >= 3 ? "#E5C94B" : "#4488FF";
              return (
                <div style={{ flex: 1, textAlign: "right" }}>
                  <div style={{ fontSize: 8, color: "#555", letterSpacing: 0.5 }}>יד נוכחית</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#E5C94B", fontFamily: "Georgia,serif" }}>
                    {res.nameHe}
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            } catch { return null; }
          })()}
        </div>
      )}

      {/* ── Winner banner ── */}
      {winner && (
        <div style={{ width: "100%", maxWidth: 680, background: "rgba(10,10,24,0.95)", border: "1px solid #C5A028", borderRadius: 14, padding: "10px 16px", zIndex: 25, backdropFilter: "blur(20px)", boxShadow: "0 0 30px rgba(184,150,12,0.25)", animation: "fadeInUp 0.4s ease", marginTop: 4, direction: "ltr" }}>
          {/* Row 1: trophy + name + amount */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#E5C94B", fontFamily: "Georgia,serif", lineHeight: 1 }}>{winner.name}</div>
                <div style={{ fontSize: 11, color: "#FFF", fontWeight: 700 }}>{winner.hand}</div>
                {winner.handEn && <div style={{ fontSize: 8, color: "#888" }}>{winner.handEn}</div>}
              </div>
            </div>
            <div style={{ fontSize: 18, color: "#C5A028", fontWeight: 900, fontFamily: "Georgia,serif" }}>
              +{(winner.amount || totalPot).toLocaleString()} 💰
            </div>
          </div>
          {/* Row 2: best hand cards */}
          {winner.bestCards?.length > 0 && (
            <div style={{ display: "flex", gap: 3, marginTop: 8, justifyContent: "center" }}>
              {winner.bestCards.map((c, i) => <Card key={i} card={c} w={46} h={65} delay={i * 80} highlight />)}
            </div>
          )}
          {/* Row 3: side pots / split pot details */}
          {potResults.length > 1 && (
            <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              {potResults.map((pr, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#888" }}>
                  <span style={{ color: "#C5A028" }}>{idx === 0 ? "Main Pot" : `Side Pot ${idx}`} {pr.isSplit ? "(תיקו)" : ""}</span>
                  <span style={{ direction: "ltr" }}>+{pr.amount.toLocaleString()} {pr.winners.map(wi => players[wi]?.n || wi).join(" & ")}</span>
                </div>
              ))}
            </div>
          )}
          {potResults.length === 1 && potResults[0]?.isSplit && (
            <div style={{ marginTop: 6, textAlign: "center", fontSize: 9, color: "#C5A028" }}>
              תיקו — הקופה מתחלקת בין {potResults[0].winners.map(wi => players[wi]?.n).join(" ו")}
            </div>
          )}
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="vault-action-bar" style={{ width: "100%", maxWidth: 680, padding: "6px 10px 10px", background: "linear-gradient(180deg,rgba(12,12,28,0.96),rgba(6,6,16,0.98))", borderRadius: "14px 14px 0 0", border: "1px solid rgba(184,150,12,0.06)", borderBottom: "none", boxShadow: "0 -4px 20px rgba(0,0,0,0.3)", zIndex: 20 }}>

        {/* Phase progress */}
        <div style={{ display: "flex", gap: 3, marginBottom: 4, justifyContent: "center" }}>
          {PHASES.map((ph, i) => (
            <div key={ph} style={{ flex: 1, height: 3, borderRadius: 2, maxWidth: 55, background: i < phaseIdx ? "rgba(184,150,12,0.4)" : i === phaseIdx ? "#C5A028" : "rgba(255,255,255,0.04)" }} />
          ))}
        </div>

        {/* Action log */}
        {actionLog.length > 0 && (
          <div style={{ maxHeight: 44, overflowY: "auto", marginBottom: 4, display: "flex", flexDirection: "column", gap: 1 }}>
            {actionLog.slice(-6).map(entry => (
              <div key={entry.id} style={{
                fontSize: 8, fontWeight: entry.type === "phase" ? 700 : 500,
                color: entry.type === "phase" ? "#C5A028" : "#666",
                textAlign: entry.type === "phase" ? "center" : "right",
                letterSpacing: entry.type === "phase" ? 1 : 0,
                lineHeight: 1.4,
              }}>
                {entry.text}
              </div>
            ))}
          </div>
        )}

        {phase !== "showdown" ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 5, fontSize: 11, color: isMyTurn ? "#E5C94B" : "#666", fontWeight: 700 }}>
              {isMyTurn ? "🎯 התור שלך!" : `⏳ ממתין ל-${players[turn]?.n}...`}
            </div>

            {/* Raise slider */}
            {isMyTurn && (
              <div className="vault-raise-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: "#666", flexShrink: 0 }}>RAISE</span>
                <input
                  type="range" min={raiseMin} max={raiseMax} step={10}
                  value={Math.max(raise, raiseMin)}
                  onChange={e => { const v = +e.target.value; setRaise(v); raiseRef.current = v; }}
                  style={{ ...sliderStyle, flex: 1, background: `linear-gradient(90deg,#C5A028 ${raisePct}%,rgba(255,255,255,0.04) ${raisePct}%)` }}
                />
                <div style={{ background: "rgba(184,150,12,0.08)", border: "1px solid rgba(184,150,12,0.12)", borderRadius: 6, padding: "2px 7px", fontSize: 13, fontWeight: 800, color: "#E5C94B", fontFamily: "Georgia,serif", minWidth: 48, textAlign: "center", flexShrink: 0 }}>
                  {raise}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 4, opacity: isMyTurn ? 1 : 0.35, pointerEvents: isMyTurn ? "auto" : "none" }}>
              <button onClick={() => doAction("FOLD")}    style={abtn("#FF4444", "rgba(255,68,68,0.2)")}><span style={{ fontSize: 11, fontWeight: 800 }}>FOLD</span></button>
              {canCheck
                ? <button onClick={() => doAction("CHECK")}   style={abtn("#8899AA", "rgba(136,153,170,0.1)")}><span style={{ fontSize: 11, fontWeight: 800 }}>CHECK</span></button>
                : <button onClick={() => doAction("CALL")}    style={abtn("#4488FF", "rgba(68,136,255,0.15)")}><span style={{ fontSize: 11, fontWeight: 800 }}>CALL</span><span style={{ fontSize: 9, opacity: 0.6 }}>{callAmt}</span></button>
              }
              <button onClick={() => doAction("RAISE")}  style={abtn("#E5C94B", "rgba(184,150,12,0.2)")}><span style={{ fontSize: 11, fontWeight: 800 }}>RAISE</span><span style={{ fontSize: 9, opacity: 0.6 }}>{raise}</span></button>
              <button onClick={() => doAction("ALL IN")} style={abtn("#FFF",    "rgba(184,150,12,0.25)")}><span style={{ fontSize: 11, fontWeight: 800 }}>ALL IN</span></button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
            <button onClick={reset}   style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",  borderRadius: 8, color: "#22C55E", padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>🔄 יד חדשה</button>
            <button onClick={onExit}  style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)",   borderRadius: 8, color: "#FF4444", padding: "10px 24px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>🚪 יציאה</button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 44, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,24,0.92)", border: "1px solid rgba(184,150,12,0.2)", borderRadius: 10, padding: "5px 16px", zIndex: 100, color: "#E5C94B", fontSize: 12, fontWeight: 700, backdropFilter: "blur(16px)", animation: "fadeIn 0.2s ease" }}>
          {toast}
        </div>
      )}

      <HelpButton screen="game" />
      <style>{globalCSS}</style>
    </div>
  );
}
