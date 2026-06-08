"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

function getSocketUrl(): string {
  if (typeof window === "undefined") return "http://localhost:5000";
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  if (protocol === "https:") return `${protocol}//${hostname}`;
  return `${protocol}//${hostname}:5000`;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lms-token");
}

const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
  /** Connect only when user is logged in (has token). Pass user?.id or !!token to control. */
  enabled?: boolean;
}

export function SocketProvider({ children, enabled = true }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const token = getToken();
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const url = getSocketUrl();
    const s = io(url, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    s.on("connect_error", (err) => {
      // Log once in production to avoid console spam when Nginx WebSocket proxy is missing
      if (process.env.NODE_ENV !== "production") {
        console.error("[Socket] Connection error:", err.message);
      }
    });

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [enabled]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
