import { create } from 'zustand';

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Store {
  sessions: Session[];
  current: string | null;
  refresh: () => Promise<void>;
  create: (title: string) => Promise<void>;
  setCurrent: (id: string) => void;
}

export const useSessionStore = create<Store>((set, get) => ({
  sessions: [],
  current: null,

  refresh: async () => {
    const list = await fetch('/api/sessions').then(r => r.json()) as Session[];
    set({ sessions: list });
    if (!get().current && list.length > 0) set({ current: list[0].id });
  },

  create: async (title: string) => {
    const row = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    }).then(r => r.json()) as Session;

    set((s) => ({ sessions: [row, ...s.sessions], current: row.id }));
  },

  setCurrent: (id: string) => set({ current: id }),
}));
