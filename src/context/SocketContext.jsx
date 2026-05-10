import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// In production the server serves the client from the same origin — connect to ''.
// In development use VITE_SERVER_URL (defaults to localhost:3001 via Vite proxy fallback).
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? '';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL || undefined, { autoConnect: true, withCredentials: false });
    socketRef.current = socket;
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => socket.disconnect();
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
