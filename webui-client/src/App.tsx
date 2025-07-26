/* webui‑client/src/App.tsx ------------------------------------------- */
import React, { useEffect, useState } from 'react';
import { Buffer }                                   from 'buffer';

import DropzoneOrig, {
  type DropzoneProps,
  type DropzoneState,
} from 'react-dropzone';
import { Upload as UploadIcon }                     from 'lucide-react';

import { useCommandStore }                          from './stores/commandStore';
import { useSessionStore }                          from './stores/sessionStore';

import CommandPalette                               from './components/CommandPalette';
import SessionList                                  from './components/SessionList';
import ShareToggle                                  from './components/ShareToggle';

/* ------------------------------------------------------------------ */
/*  Type‑helpers                                                      */
/* ------------------------------------------------------------------ */

/** react‑dropzone ships React‑18 typings; this wrapper satisfies JSX‑19. */
const Dropzone = DropzoneOrig as React.FC<
  DropzoneProps & { children: (s: DropzoneState) => React.ReactNode }
>;

/** Lucide icon typed as a normal React component for JSX‑19. */
const SafeUploadIcon = UploadIcon as unknown as React.FC<{ size?: number }>;

/* ------------------------------------------------------------------ */

export default function App(): JSX.Element {
  /* stores ---------------------------------------------------------- */
  const { history, execute }      = useCommandStore();
  const { sessions, current,
          refresh, create,
          setCurrent }            = useSessionStore();

  /* UI state -------------------------------------------------------- */
  const [input, setInput] = useState('');

  /* load sessions on mount ----------------------------------------- */
  useEffect(() => { refresh(); }, [refresh]);

  /* global “exec‑cmd” event – fired by <CommandPalette> ------------- */
  useEffect(() => {
    const handler = (e: Event): void => {
      const name = (e as CustomEvent<string>).detail;
      setInput('/' + name);
    };
    addEventListener('exec-cmd', handler);
    return () => removeEventListener('exec-cmd', handler);
  }, []);

  /* send ------------------------------------------------------------ */
  async function send(): Promise<void> {
    if (!input.trim() || !current) return;

    const hasSlash = input.startsWith('/');
    const [cmd, ...rest] = hasSlash ? input.slice(1).split(/\s+/) : ['say'];
    const text           = hasSlash ? rest.join(' ')                : input;

    /* ----------------------------------------------------------------
       `execute` was typed to accept only the *known* slash‑commands
       union.  Cast is fine here because new server‑side commands will
       still work – they’ll just bypass compile‑time narrowing.      */
    await execute(cmd as unknown as Parameters<typeof execute>[0], {
      text,
      sessionId: current,
    });

    setInput('');
  }

  /* ---------------------------------------------------------------- */
  return (
    <>
      <CommandPalette />

      <div className="card">
        {/* header ---------------------------------------------------- */}
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-cyan-300 text-2xl font-semibold">
            Multimodal&nbsp;WebUI
          </h1>
          <ShareToggle />
        </header>

        <div className="flex gap-4">
          {/* ───────────────────── sidebar ─────────────────────────── */}
          <aside className="w-56 shrink-0 space-y-2 overflow-y-auto max-h-[70vh] pr-2">
            <button className="btn w-full" onClick={() => create('New chat')}>
              +&nbsp;New
            </button>

            <SessionList
              list={sessions}
              current={current}
              onSelect={setCurrent}
            />
          </aside>

          {/* ───────────────────── chat panel ─────────────────────── */}
          <section className="flex-1 flex flex-col max-h-[70vh]">
            <main className="flex-1 overflow-y-auto space-y-4 pr-2">
              {history.map((h, i) => (
                <div key={i}>
                  <p className="text-cyan-400 font-bold">You:</p>
                  <p className="mb-1 break-all whitespace-pre-wrap">
                    {h.input}
                  </p>

                  <p className="text-pink-400 font-bold">Bot:</p>

                  {h.output.type === 'text' && (
                    <p className="whitespace-pre-wrap">{h.output.content}</p>
                  )}

                  {h.output.type === 'image' && (
                    <img
                      alt="generated"
                      src={`data:${h.output.mime};base64,${Buffer
                        .from(h.output.buffer)
                        .toString('base64')}`}
                      className="max-w-full rounded shadow"
                    />
                  )}
                </div>
              ))}
            </main>

            {/* composer --------------------------------------------- */}
            <footer className="mt-2 flex items-center gap-3">
              {/* upload */}
              <Dropzone
                maxFiles={1}
                onDropAccepted={async (files) => {
                  const body = new FormData();
                  body.append('file', files[0]);
                  const { url } = await fetch('/api/upload', {
                    method: 'POST',
                    body,
                  }).then((r) => r.json());
                  setInput(url); // simple demo – you might auto‑send instead
                }}
              >
                {({ getRootProps, getInputProps }) => (
                  <div
                    {...getRootProps()}
                    className="flex items-center gap-1 cursor-pointer text-cyan-300"
                  >
                    <input {...getInputProps()} />
                    <SafeUploadIcon size={16} />
                    <span>Upload</span>
                  </div>
                )}
              </Dropzone>

              {/* text input */}
              <input
                className="flex-1 bg-black/25 border border-cyan-400 rounded px-3 py-2 text-teal-100"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message or /command…"
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              />

              <button className="btn" onClick={send}>
                Send
              </button>
            </footer>
          </section>
        </div>
      </div>
    </>
  );
}
