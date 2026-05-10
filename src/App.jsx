import { useState, useEffect } from "react";
import { SocketProvider } from "./context/SocketContext";
import { LobbyScreen }    from "./screens/LobbyScreen";
import { GameScreen }     from "./screens/GameScreen";
import { OnlineGameScreen } from "./screens/OnlineGameScreen";
import { AdminScreen }    from "./screens/AdminScreen";
import { StatsScreen }    from "./screens/StatsScreen";

const SESSION_KEY = 'vaultPokerLastGame';

function AppRouter() {
  const [screen, setScreen] = useState(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'lobby'
  );
  const [offlineSettings, setOfflineSettings] = useState(null);
  const [activeRoomId,     setActiveRoomId]     = useState(null);
  const [isSpectating,     setIsSpectating]     = useState(false);
  const [activePlayerName, setActivePlayerName] = useState('');
  const [lastRoom,         setLastRoom]         = useState(null); // { roomId, playerName }

  // Restore lastRoom from sessionStorage on refresh
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.roomId && parsed?.playerName) {
          setLastRoom(parsed);
        }
      }
    } catch {}
  }, []);

  const saveSession = (roomId, playerName) => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerName })); } catch {}
  };
  const clearSession = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  const goLobby = (fromGame = false) => {
    window.history.pushState({}, '', '/');
    if (fromGame && activeRoomId && activePlayerName && !isSpectating) {
      const lr = { roomId: activeRoomId, playerName: activePlayerName };
      setLastRoom(lr);
      saveSession(lr.roomId, lr.playerName);
    } else if (!fromGame) {
      // Explicit lobby navigation (not from game exit) — keep lastRoom/session intact
    }
    setScreen('lobby');
    setActiveRoomId(null);
    setIsSpectating(false);
  };

  if (screen === 'admin')   return <AdminScreen  onExit={goLobby} />;
  if (screen === 'stats')   return <StatsScreen  onExit={goLobby} />;
  if (screen === 'game')    return <GameScreen   settings={offlineSettings} onExit={goLobby} />;
  if (screen === 'online')  return <OnlineGameScreen roomId={activeRoomId} isSpectator={isSpectating} playerName={activePlayerName} onExit={() => goLobby(true)} />;

  const handleStartOnline = (roomId, spectate = false, playerName = '') => {
    setActiveRoomId(roomId || null);
    setIsSpectating(!!spectate);
    setActivePlayerName(playerName);
    setLastRoom(null);
    // Persist session so page refresh can rejoin
    if (!spectate && roomId && playerName) saveSession(roomId, playerName);
    setScreen('online');
  };

  const handleClearLastRoom = () => {
    setLastRoom(null);
    clearSession();
  };

  return (
    <LobbyScreen
      onStart={s => { setOfflineSettings(s); setScreen('game'); }}
      onStartOnline={handleStartOnline}
      onStats={() => setScreen('stats')}
      lastRoom={lastRoom}
      onClearLastRoom={handleClearLastRoom}
    />
  );
}

export default function App() {
  return (
    <SocketProvider>
      <AppRouter />
    </SocketProvider>
  );
}
