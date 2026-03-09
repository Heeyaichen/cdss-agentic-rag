import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/lib/types';

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  theme: 'light' | 'dark';
  sessionTimeout: number;
  lastActivity: number;
  
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateActivity: () => void;
  resetSession: () => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      theme: 'light',
      sessionTimeout: 30 * 60 * 1000,
      lastActivity: Date.now(),
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      
      setTheme: (theme) => set({ theme }),
      
      updateActivity: () => set({ lastActivity: Date.now() }),
      
      resetSession: () => set({
        user: null,
        isAuthenticated: false,
        lastActivity: Date.now(),
      }),
      
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          lastActivity: Date.now(),
        });
      },
    }),
    {
      name: 'user-storage',
      partialize: true,
    }
  )
);

export const useThemeStore = create<{ theme: 'light' | 'dark'; toggleTheme: () => void }>()(
  persist(
    (set) => ({
      theme: 'light' as const,
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    { name: 'theme-storage' }
  )
);

interface QueryHistoryState {
  queries: Array<{ id: string; query: string; timestamp: number }>;
  addQuery: (query: { id: string; query: string }) => void;
  clearHistory: () => void;
}

export const useQueryHistoryStore = create<QueryHistoryState>()(
  persist(
    (set, get) => ({
      queries: [],
      addQuery: (query) => set({
        queries: [
          { ...query, timestamp: Date.now() },
          ...get().queries.slice(0, 49),
        ],
      }),
      clearHistory: () => set({ queries: [] }),
    }),
    { name: 'query-history-storage' }
  )
);
