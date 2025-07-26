/* webui‑client/src/stores/commandStore.ts --------------------------------- */
import { create } from 'zustand';
import { immer }  from 'zustand/middleware/immer';

/* ------------------------------------------------------------------ */
/* 1.  Public list of slash‑commands (keep in sync with the server!)  */
export const commandNames = ['say', 'draw', 'help'] as const;

/* ------------------------------------------------------------------ */
/* 2.  Store typing                                                   */
interface HistoryEntry {
  input : string;
  /* narrow type if you like: { type:'text'|'image'; … } */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: any;
}

interface Store {
  history: HistoryEntry[];
  execute: (
    name : (typeof commandNames)[number],
    args : Record<string, unknown> & { sessionId: string }
  ) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/* 3.  Implementation                                                 */
export const useCommandStore = create<Store>()(
  immer((set) => ({
    history: [],

    async execute (name, args) {
      /* hit the API -------------------------------------------------- */
      const output = await fetch('/api/execute', {
        method : 'POST',
        headers: { 'Content-Type':'application/json' },
        body   : JSON.stringify({ name, args, sessionId: args.sessionId })
      }).then(r => r.json());

      /* immutable update – immer guarantees a new array reference ---- */
      set((state) => {
        state.history.push({
          input : `/${name} ${JSON.stringify(args)}`,
          output
        });
      });
    }
  }))
);
