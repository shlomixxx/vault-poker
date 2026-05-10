import { useState } from "react";
import { SocketProvider } from "./context/SocketContext";
import { LobbyScreen }    from "./screens/LobbyScreen";
import { GameScreen }     from "./screens/GameScreen";
import { OnlineGameScreen } from "./screens/OnlineGameScreen";
import { AdminScreen }    from "./screens/AdminScreen";
import { StatsScreen }    from "./screens/StatsScreen";

function AppRouter() {
  const [screen, setScreen] = useState(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'lobby'
  );
  const [offlineSettings, setOfflineSettings] = useState(null);
  const [activeRoomId,    setActiveRoomId]    = useState(null);
  const [isSpectating,    setIsSpectating]    = useState(false);
  const [activePlayerName, setActivePlayerName] = useState('');

  const goLobby = () => {
    window.history.pushState({}, '', '/');
    setScreen('lobby');
    setActiveRoomId(null);
    setIsSpectating(false);
  };

  if (screen === 'admin')   return <AdminScreen  onExit={goLobby} />;
  if (screen === 'stats')   return <StatsScreen  onExit={goLobby} />;
  if (screen === 'game')    return <GameScreen   settings={offlineSettings} onExit={goLobby} />;
  if (screen === 'online')  return <OnlineGameScreen roomId={activeRoomId} isSpectator={isSpectating} playerName={activePlayerName} onExit={goLobby} />;

  return (
    <LobbyScreen
      onStart={s => { setOfflineSettings(s); setScreen('game'); }}
      onStartOnline={(roomId, spectate = false, playerName = '') => {
        setActiveRoomId(roomId || null);
        setIsSpectating(!!spectate);
        setActivePlayerName(playerName);
        setScreen('online');
      }}
      onStats={() => setScreen('stats')}
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
