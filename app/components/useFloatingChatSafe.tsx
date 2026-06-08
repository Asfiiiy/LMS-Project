"use client";
import { useContext } from "react";
import { FloatingChatContext, FloatingChatContextType } from "./FloatingChatProvider";

export function useFloatingChatSafe(): FloatingChatContextType | null {
  const context = useContext(FloatingChatContext);
  return context || null;
}
