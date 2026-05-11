import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// In production the server serves the client from the same origin — connect to ''.
// In development use VITE_SERVER_URL (defaults to localhost:3001 via Vite proxy fallback).
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket,       setSocket]       = useState(null);
  const [connected,    setConnected]    = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const s = io(SERVER_URL || undefined, {
      autoConnect: true,
      withCredentials: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });
    setSocket(s);

    s.on('connect',             () => { setConnected(true);  setReconnecting(false); });
    s.on('disconnect',          () => { setConnected(false); });
    s.on('reconnect_attempt',   () => setReconnecting(true));
    s.on('reconnect',           () => { setConnected(true);  setReconnecting(false); });
    s.on('reconnect_error',     () => setReconnecting(true));
    s.on('reconnect_failed',    () => setReconnecting(false));

    return () => s.disconnect();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, reconnecting }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
