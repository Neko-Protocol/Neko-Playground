// Zustand store for session state
// Session information and temporary UI state
import { create } from "zustand";

interface SessionState {
  sessionId: string | undefined;
  setSession: (sessionId: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: undefined,
  setSession: (sessionId) => set({ sessionId }),
  clearSession: () => set({ sessionId: undefined }),
}));

/** Derived: true when sessionId is set. Use with useSessionStore(state => state.sessionId != null) */
export const selectIsAuthenticated = (state: SessionState): boolean =>
  state.sessionId != null;
