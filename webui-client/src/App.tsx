import React, { useEffect, useState } from 'react';
import { Buffer } from 'buffer';

import DropzoneOrig, { type DropzoneProps, type DropzoneState } from 'react-dropzone';
import { Upload as UploadIcon } from 'lucide-react';

import { useCommandStore } from './stores/commandStore';
import { useSessionStore } from './stores/sessionStore';

import CommandPalette from './components/CommandPalette';
import SessionList    from './components/SessionList';
import ShareToggle    from './components/ShareToggle';
import ResultRenderer from './components/ResultRenderer';

// ── react-dropzone ships React-18 typings; this wrapper calms JSX-19
const Dropzone = DropzoneOrig as React.FC<DropzoneProps & {
  children?: (state: DropzoneState) => React.ReactNode
}>;
const SafeUploadIcon = UploadIcon as unknown as React.FC<{ size?: number }>;

export default function App(): JSX.Element {
  const { history, execute } = useCommandStore();
  const { sessions, current, refresh, create, setCurrent } = useSessionStore();

  const [input, setInput] = useState('');

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handler = (e: Event): void => {
      const name = (e as CustomEvent<string>).detail;
      setInput('/' + name);
    };
    addEventListener('exec-cmd', handler);
    return () => removeEventListener('exec-cmd', handler);
  }, []);

  async function send(): Promise<void> {
    if (!input.trim() || !current) return;
    const hasSlash = input.startsWith('/');
    const name = hasSlash ? input.slice(1).split(' ')[0] : 'say';
    const text = hasSlash ? input.replace(/^\/\w+\s*/, '') : input;
    await execute(name, { text, sessionId: current });
    setInput('');
  }

  return (
    <>
      <CommandPalette />

      <div className="card">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-cyan-300 text-2xl font-semibold">Multimodal&nbsp;WebUI</h1>
          <ShareToggle />
        </header>

        <div className="flex gap-4">
          <aside className="w-56 shrink-0 space-y-2 overflow-y-auto max-h-[70vh] pr-2">
            <button className="btn w-full" onClick={() => create('New chat')}>+&nbsp;New</button>
            <SessionList list={sessions} current={current} onSelect={setCurrent} />
          </aside>

          <section className="flex-1 flex flex-col max-h-[70vh]">
            <main className="flex-1 overflow-y-auto space-y-4 pr-2">
              {history.map((h, i) => (
                <div key={i}>
                  <p className="text-cyan-400 font-bold">You:</p>
                  <p className="mb-1 break-all whitespace-pre-wrap">{h.input}</p>

                  <p className="text-pink-400 font-bold">Bot:</p>

                  {/* Known shapes */}
                  {h.output?.type && <ResultRenderer output={h.output as any} />}

                  {/* Fallback: raw JSON when type is missing or unknown */}
                  {!h.output?.type && (
                    <pre className="bg-black/30 border border-cyan-500/30 rounded p-2 text-xs overflow-x-auto">
                      {JSON.stringify(h.output, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </main>

            <footer className="mt-2 flex items-center gap-3">
              <Dropzone
                maxFiles={1}
                onDropAccepted={async (files) => {
                  const body = new FormData();
                  body.append('file', files[0]);
                  const { url } = await fetch('/api/upload', { method: 'POST', body }).then(r => r.json());
                  setInput(url);
                }}
              >
                {({ getRootProps, getInputProps }) => (
                  <div {...getRootProps()} className="flex items-center gap-1 cursor-pointer text-cyan-300">
                    <input {...getInputProps()} />
                    <SafeUploadIcon size={16} />
                    <span>Upload</span>
                  </div>
                )}
              </Dropzone>

              <input
                className="flex-1 bg-black/25 border border-cyan-400 rounded px-3 py-2 text-teal-100"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message or /command…"
                onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              />

              <button className="btn" onClick={() => void send()}>Send</button>
            </footer>
          </section>
        </div>
      </div>
    </>
  );
}
