import { create } from 'zustand';

interface ChatSession {
  id: string;
  title: string;
}

interface SessionState {
  sessions: ChatSession[];
  current?: string;
  refresh(): Promise<void>;
  create(title:string): Promise<void>;
  setCurrent(id:string): void;
}

export const useSessionStore = create<SessionState>((set,get)=>({
  sessions:[],
  async refresh(){
    const res = await fetch('/api/sessions');
    set({sessions: await res.json()});
  },
  async create(title){
    const res = await fetch('/api/sessions',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title})
    });
    const s = await res.json();
    set(state=>({sessions:[s,...state.sessions],current:s.id}));
  },
  setCurrent(id){set({current:id});}
}));
