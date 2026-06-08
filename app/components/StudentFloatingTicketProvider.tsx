'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import FloatingTicketWindow from './FloatingTicketWindow';
import { User } from './types';

// Global function so MessageDropdown/Navbar can open ticket for students without being inside this provider
let globalOpenFloatingTicketForStudent: ((ticketId: number, subject?: string) => void) | null = null;
export function openFloatingTicketForStudent(ticketId: number, subject?: string) {
  if (globalOpenFloatingTicketForStudent) globalOpenFloatingTicketForStudent(ticketId, subject);
}

export interface OpenTicketStudent {
  ticketId: number;
  subject: string;
  position: { x: number; y: number };
  isMinimized: boolean;
  unreadCount: number;
}

interface StudentFloatingTicketContextType {
  openFloatingTicket: (ticketId: number, subject?: string) => void;
  closeTicket: (ticketId: number) => void;
  minimizeTicket: (ticketId: number) => void;
  maximizeTicket: (ticketId: number) => void;
  addMessageToTicket: (ticketId: number, message: unknown) => void;
}

const StudentFloatingTicketContext = createContext<StudentFloatingTicketContextType | undefined>(undefined);

export function useStudentFloatingTicket() {
  return useContext(StudentFloatingTicketContext);
}

export function StudentFloatingTicketProvider({ children, user }: { children: React.ReactNode; user: User | null }) {
  const [openTickets, setOpenTickets] = useState<OpenTicketStudent[]>([]);

  const isStudent = user && ['Student', 'ManagerStudent', 'InstituteStudent'].includes(user.role || '');

  const openFloatingTicket = useCallback((ticketId: number, subject?: string) => {
    if (!isStudent || !user?.id) return;
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
          position: { x: Math.max(0, baseX - offset), y: Math.max(0, baseY - offset) },
          isMinimized: false,
          unreadCount: 0
        }
      ];
    });
  }, [isStudent, user?.id]);

  useEffect(() => {
    if (isStudent) globalOpenFloatingTicketForStudent = openFloatingTicket;
    return () => { globalOpenFloatingTicketForStudent = null; };
  }, [isStudent, openFloatingTicket]);

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

  const addMessageToTicket = useCallback((_ticketId: number, _message: unknown) => {
    // Optional: could be used to append staff reply in real time; FloatingTicketWindow refetches on focus
  }, []);

  const markAsRead = useCallback((ticketId: number) => {
    setOpenTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, unreadCount: 0 } : t))
    );
  }, []);

  const updatePosition = useCallback((ticketId: number, x: number, y: number) => {
    setOpenTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, position: { x, y } } : t))
    );
  }, []);

  const value: StudentFloatingTicketContextType = {
    openFloatingTicket,
    closeTicket,
    minimizeTicket,
    maximizeTicket,
    addMessageToTicket
  };

  const userId = user?.id;
  const hasValidUser = isStudent && user && typeof userId === 'number';

  return (
    <StudentFloatingTicketContext.Provider value={value}>
      {children}
      {hasValidUser &&
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
            onMarkAsRead={() => markAsRead(ticket.ticketId)}
            onPositionChange={(x, y) => updatePosition(ticket.ticketId, x, y)}
            userId={userId}
            minimizedIndex={index}
            forStudent
          />
        ))}
    </StudentFloatingTicketContext.Provider>
  );
}
