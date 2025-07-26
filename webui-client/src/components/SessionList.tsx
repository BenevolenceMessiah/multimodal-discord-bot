import React from 'react';

export interface SessionMeta {
  id: string;
  title: string;
  updated_at?: string;       // ← optional so ChatSession matches
}

interface Props {
  list: SessionMeta[];
  current: string | undefined;
  onSelect: (id: string) => void;
}

/** Vertical list of saved chat sessions */
export default function SessionList({ list, current, onSelect }: Props) {
  if (list.length === 0) {
    return (
      <p className="text-xs text-cyan-300/70 italic">
        No chats yet – hit “New”.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {list.map((s) => {
        const active = s.id === current;
        return (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className={`w-full text-left px-3 py-2 rounded
                ${active
                  ? 'bg-cyan-700/40 text-cyan-100 font-semibold'
                  : 'bg-black/20 hover:bg-black/30 text-cyan-200'}`}
            >
              <span className="block truncate">{s.title}</span>
              {s.updated_at && (
                <span className="block text-[11px] opacity-70 leading-none">
                  {timeAgo(s.updated_at)}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* helper ------------------------------------------------------- */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 6e4);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  return `${days} d ago`;
}
