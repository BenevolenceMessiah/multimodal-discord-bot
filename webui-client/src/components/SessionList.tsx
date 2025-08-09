import React from 'react';
import type { Session } from '../stores/sessionStore';

export default function SessionList({
  list, current, onSelect
}: {
  list: Session[];
  current: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  if (!list?.length) {
    return <p className="text-sm text-slate-400">No chats yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {list.map(s => {
        const active = s.id === current;
        return (
          <li key={s.id}>
            <button
              className={
                'w-full text-left px-3 py-2 rounded border ' +
                (active
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                  : 'border-cyan-500/20 hover:border-cyan-500/40 text-slate-200')
              }
              title={new Date(s.updated_at ?? s.created_at).toLocaleString()}
              onClick={() => onSelect(s.id)}
            >
              {s.title}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
