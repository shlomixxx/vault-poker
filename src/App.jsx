import { useState } from "react";
import { SocketProvider } from "./context/SocketContext";
import { LobbyScreen }    from "./screens/LobbyScreen";
import { GameScreen }     from "./screens/GameScreen";
import { OnlineGameScreen } from "./screens/OnlineGameScreen";
import { AdminScreen }    from "./screens/AdminScreen";

function AppRouter() {
  const [screen, setScreen] = useState(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'lobby'
  );
  const [offlineSettings, setOfflineSettings] = useState(null);

  const goLobby = () => {
    window.history.pushState({}, '', '/');
    setScreen('lobby');
  };

  if (screen === 'admin')  return <AdminScreen  onExit={goLobby} />;
  if (screen === 'game')   return <GameScreen   settings={offlineSettings} onExit={goLobby} />;
  if (screen === 'online') return <OnlineGameScreen onExit={goLobby} />;

  return (
    <LobbyScreen
      onStart={s => { setOfflineSettings(s); setScreen('game'); }}
      onStartOnline={() => setScreen('online')}
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
