import { create } from 'zustand';

export type KnownCommand = 'say' | 'draw' | 'help';

interface HistoryEntry {
  input: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: any;
}
interface Store {
  history: HistoryEntry[];
  execute: (name: KnownCommand | string, args: Record<string, unknown>) => Promise<void>;
}
export const commandNames: KnownCommand[] = ['say','draw','help'];

export const useCommandStore = create<Store>((set) => ({
  history: [],
  execute: async (name, args) => {
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, args, sessionId: (args as any).sessionId })
    }).then(r => r.json());

    set((state) => ({
      history: [
        ...state.history,
        { input: `/${name} ${JSON.stringify(args)}`, output: res }
      ]
    }));
  }
}));
