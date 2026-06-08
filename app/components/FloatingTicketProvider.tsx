'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import FloatingTicketWindow from './FloatingTicketWindow';
import { User } from './types';

export interface OpenTicket {
  ticketId: number;
  subject: string;
  studentName?: string;
  position: { x: number; y: number };
  isMinimized: boolean;
  unreadCount: number;
}

interface FloatingTicketContextType {
  openFloatingTicket: (ticketId: number, subject?: string) => void;
  closeTicket: (ticketId: number) => void;
  minimizeTicket: (ticketId: number) => void;
  maximizeTicket: (ticketId: number) => void;
  markTicketAsRead: (ticketId: number) => void;
  openTickets: OpenTicket[];
  unreadTicketReplyCount: number;
  incrementUnreadTicketReply: () => void;
}

const FloatingTicketContext = createContext<FloatingTicketContextType | undefined>(undefined);

let globalOpenFloatingTicketForStaff: ((ticketId: number, subject?: string) => void) | null = null;
export function openFloatingTicketForStaff(ticketId: number, subject?: string) {
  if (globalOpenFloatingTicketForStaff) globalOpenFloatingTicketForStaff(ticketId, subject);
}

export function useFloatingTicket() {
  const context = useContext(FloatingTicketContext);
  return context;
}

export function FloatingTicketProvider({ children, user }: { children: React.ReactNode; user: User | null }) {
  const [openTickets, setOpenTickets] = useState<OpenTicket[]>([]);
  const [unreadTicketReplyCount, setUnreadTicketReplyCount] = useState(0);

  const isStaff = user && !['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '');

  const openFloatingTicket = useCallback((ticketId: number, subject?: string) => {
    if (!isStaff) return;
    setOpenTickets((prev) => {
      const existing = prev.find((t) => t.ticketId === ticketId);
      if (existing) {
        return prev.map((t) =>
          t.ticketId === ticketId ? { ...t, isMinimized: false, unreadCount: 0 } : t
        );
      }
      const baseX = typeof window !== 'undefined' ? window.innerWidth - 400 : 400;
      const baseY = typeof window !== 'undefined' ? window.innerHeight - 520 : 300;
      const offset = prev.length * 20;
      return [
        ...prev,
        {
          ticketId,
          subject: subject || `Ticket #${ticketId}`,
          studentName: undefined,
          position: { x: Math.max(0, baseX - offset), y: Math.max(0, baseY - offset) },
          isMinimized: false,
          unreadCount: 0
        }
      ];
    });
    setUnreadTicketReplyCount((c) => Math.max(0, c - 1));
  }, [isStaff]);

  const closeTicket = useCallback((ticketId: number) => {
    setOpenTickets((prev) => prev.filter((t) => t.ticketId !== ticketId));
  }, []);

  const minimizeTicket = useCallback((ticketId: number) => {
    setOpenTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, isMinimized: true } : t))
    );
  }, []);

  const maximizeTicket = useCallback((ticketId: number) => {
    setOpenTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, isMinimized: false } : t))
    );
  }, []);

  const markTicketAsRead = useCallback((ticketId: number) => {
    setOpenTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, unreadCount: 0 } : t))
    );
    setUnreadTicketReplyCount((c) => Math.max(0, c - 1));
  }, []);

  const incrementUnreadTicketReply = useCallback(() => {
    setUnreadTicketReplyCount((c) => c + 1);
  }, []);

  const updatePosition = useCallback((ticketId: number, x: number, y: number) => {
    setOpenTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, position: { x, y } } : t))
    );
  }, []);

  useEffect(() => {
    if (isStaff) globalOpenFloatingTicketForStaff = openFloatingTicket;
    return () => { globalOpenFloatingTicketForStaff = null; };
  }, [isStaff, openFloatingTicket]);

  const value: FloatingTicketContextType = {
    openFloatingTicket,
    closeTicket,
    minimizeTicket,
    maximizeTicket,
    markTicketAsRead,
    openTickets,
    unreadTicketReplyCount,
    incrementUnreadTicketReply
  };

  return (
    <FloatingTicketContext.Provider value={value}>
      {children}
      {isStaff &&
        openTickets.map((ticket, index) => (
          <FloatingTicketWindow
            key={ticket.ticketId}
            ticketId={ticket.ticketId}
            subject={ticket.subject}
            position={ticket.position}
            isMinimized={ticket.isMinimized}
            unreadCount={ticket.unreadCount}
            onClose={() => closeTicket(ticket.ticketId)}
            onMinimize={() => minimizeTicket(ticket.ticketId)}
            onMaximize={() => maximizeTicket(ticket.ticketId)}
            onMarkAsRead={() => markTicketAsRead(ticket.ticketId)}
            onPositionChange={(x, y) => updatePosition(ticket.ticketId, x, y)}
            userId={user?.id ?? 0}
            minimizedIndex={index}
          />
        ))}
    </FloatingTicketContext.Provider>
  );
}
